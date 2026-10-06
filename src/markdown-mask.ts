/** Prepare Markdown/Obsidian prose for Grammalecte without moving any text.
 * Every hidden UTF-16 code unit becomes one space; CR/LF stay at their exact
 * positions. Aliases/labels are retained in place, never padded/recentred.
 * This is a conservative analysis mask, not a Markdown renderer. */
export function maskMarkdownForAnalysis(source: string): string {
  const output = source.split("");
  const blank = (from: number, to: number): void => {
    for (let index = from; index < to; index += 1) {
      if (source[index] !== "\n" && source[index] !== "\r") output[index] = " ";
    }
  };
  const escapes = new Uint8Array(source.length);
  let slashes = 0;
  for (let index = 0; index < source.length; index += 1) {
    escapes[index] = slashes % 2;
    slashes = source[index] === "\\" ? slashes + 1 : 0;
  }
  const escaped = (index: number): boolean => escapes[index] === 1;
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  const endOfLine = (line: number): number => line + 1 < starts.length ? starts[line + 1] - 1 : source.length;
  const lineText = (line: number): string => source.slice(starts[line], endOfLine(line));
  const contentStart = (line: number): number => {
    const prefix = /^[ \t]*(?:(?:>[ \t]*|(?:[-+*]|\d+[.)])[ \t]+))*/.exec(lineText(line));
    return starts[line] + (prefix?.[0].length ?? 0);
  };

  // Index backtick runs once. Matching code spans need not repeatedly scan
  // the rest of a large sheet when there are unmatched/mixed-width runs.
  const ticks = new Map<number, number[]>();
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "`") continue;
    const from = index;
    while (source[index + 1] === "`") index += 1;
    const width = index - from + 1;
    const entries = ticks.get(width) ?? [];
    entries.push(from);
    ticks.set(width, entries);
  }
  const tickCursors = new Map<number, number>();
  const mathClosers: number[] = [];
  for (let at = 0; at < source.length; at += 1) {
    if (source[at] === "$" && source[at - 1] !== "$" && source[at + 1] !== "$"
      && !escaped(at) && !/[ \t\r\n]/.test(source[at - 1] ?? " ")) mathClosers.push(at);
  }
  let mathCursor = 0;
  const references = new Set<string>();
  let index = 0;
  // YAML is metadata only at document start. An unclosed horizontal rule
  // must not hide the following prose as if it were complete frontmatter.
  if (/^\uFEFF?---[ \t\r]*$/.test(lineText(0))) {
    for (let line = 1; line < starts.length; line += 1) {
      if (!/^(?:---|\.\.\.)[ \t\r]*$/.test(lineText(line))) continue;
      index = endOfLine(line);
      blank(0, index);
      break;
    }
  }

  // First pass: opaque regions and block prefixes. Comments inside code,
  // fences inside comments, etc. never open another region accidentally.
  let line = 0;
  while (index < source.length) {
    while (line + 1 < starts.length && starts[line + 1] <= index) line += 1;
    if (index === starts[line]) {
      const content = contentStart(line);
      const body = source.slice(content, endOfLine(line));
      const fence = /^(`{3,}|~{3,})/.exec(body);
      if (fence) {
        const marker = fence[0][0];
        const width = fence[0].length;
        let finish = source.length;
        for (let next = line + 1; next < starts.length; next += 1) {
          const closing = source.slice(contentStart(next), endOfLine(next));
          let run = 0;
          while (closing[run] === marker) run += 1;
          if (run >= width && /^[ \t\r]*$/.test(closing.slice(run))) {
            finish = endOfLine(next);
            break;
          }
        }
        blank(index, finish);
        index = finish;
        continue;
      }
      blank(index, content); // quote/list prefixes, without touching prose
      const heading = /^#{1,6}(?:[ \t]+|$)/.exec(body);
      if (heading) blank(content, content + heading[0].length);
      const task = /^\[[ xX]\][ \t]+/.exec(body);
      // Feuillets may already have blanked the list marker upstream.
      if (task) blank(content, content + task[0].length);
      const callout = /^\[![^\]\r\n]+\][+-]?/.exec(body);
      if (callout && source.slice(starts[line], content).includes(">")) blank(content, content + callout[0].length);
      const footnote = /^\[\^[^\]\r\n]+\]:/.exec(body);
      if (footnote) blank(content, content + footnote[0].length);
      const reference = /^\[([^\]\r\n]+)\]:[ \t]*\S/.exec(body);
      if (reference && !footnote) {
        references.add(reference[1].toLowerCase());
        blank(content, endOfLine(line));
      }
      if (/^(?:[-*_][ \t]*){3,}\r?$/.test(body)
        || /^\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t\r]*$/.test(body)) blank(content, endOfLine(line));
    }
    if (output[index] !== source[index]) { index += 1; continue; }
    if (source[index] === "\\" && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(source[index + 1] ?? "")) {
      // Escaped punctuation is visible text, not an opening Markdown token.
      blank(index, index + 1);
      index += 2;
      continue;
    }
    const comment = source.startsWith("%%", index) ? ["%%", "%%"]
      : source.startsWith("<!--", index) ? ["<!--", "-->"] : null;
    if (comment) {
      const closing = source.indexOf(comment[1], index + comment[0].length);
      const finish = closing < 0 ? source.length : closing + comment[1].length;
      blank(index, finish);
      index = finish;
      continue;
    }
    if (source[index] === "`") {
      let width = 1;
      while (source[index + width] === "`") width += 1;
      const entries = ticks.get(width) ?? [];
      let cursor = tickCursors.get(width) ?? 0;
      while (cursor < entries.length && (entries[cursor] <= index || output[entries[cursor]] !== "`")) cursor += 1;
      tickCursors.set(width, cursor);
      if (cursor < entries.length) {
        const finish = entries[cursor] + width;
        blank(index, finish);
        index = finish;
        continue;
      }
      index += width;
      continue;
    }
    if (source.startsWith("$$", index)) {
      const closing = source.indexOf("$$", index + 2);
      const finish = closing < 0 ? source.length : closing + 2;
      blank(index, finish);
      index = finish;
      continue;
    }
    if (source[index] === "$" && !/[ \t\r\n$]/.test(source[index + 1] ?? " ")) {
      const lineEnd = endOfLine(line);
      // A monotonic cursor avoids quadratic rescanning of malformed input
      // containing many opening dollars and no eligible closing delimiter.
      while (mathCursor < mathClosers.length && mathClosers[mathCursor] <= index) mathCursor += 1;
      const closing = mathClosers[mathCursor];
      if (closing !== undefined && closing < lineEnd) {
        blank(index, closing + 1);
        index = closing + 1;
        continue;
      }
    }
    if (source[index] === "<") {
      const tag = /^(?:<\/?[A-Za-z][\w:-]*(?:[ \t\r\n](?:"[^"]*"|'[^']*'|[^'">])*)?[ \t]*\/?>|<![A-Z][^>]*>|<(?:(?:https?|ftp):\/\/|[^<>\s]+@)[^>\r\n]*>)/.exec(source.slice(index));
      if (tag) {
        const script = /^<(script|style)(?:[ \t>])/i.exec(tag[0]);
        let finish = index + tag[0].length;
        if (script) {
          const closing = new RegExp(`</${script[1]}[ \\t]*>`, "gi");
          closing.lastIndex = finish;
          const match = closing.exec(source);
          finish = match ? match.index + match[0].length : source.length;
        }
        blank(index, finish);
        index = finish;
        continue;
      }
    }
    index += 1;
  }

  // Pair delimiters once on the remaining text, so deeply nested or broken
  // link syntax cannot cause a repeated scan of the entire input.
  const brackets = new Map<number, number>();
  const parentheses = new Map<number, number>();
  const squareStack: number[] = [];
  const roundStack: number[] = [];
  const nestedSquares = new Set<number>();
  for (let at = 0; at < output.length; at += 1) {
    if (escaped(at)) continue;
    if (output[at] === "[") {
      if (squareStack.length > 0) nestedSquares.add(squareStack[squareStack.length - 1]);
      squareStack.push(at);
    }
    else if (output[at] === "]") { const open = squareStack.pop(); if (open !== undefined) brackets.set(open, at); }
    else if (output[at] === "(") roundStack.push(at);
    else if (output[at] === ")") { const open = roundStack.pop(); if (open !== undefined) parentheses.set(open, at); }
  }
  for (let at = 0; at < output.length; at += 1) {
    if (output[at] !== "[" || escaped(at)) continue;
    const close = brackets.get(at);
    if (close === undefined) continue;
    if (output[at + 1] === "[") {
      const innerClose = brackets.get(at + 1);
      if (innerClose === undefined || innerClose + 1 !== close || nestedSquares.has(at + 1)
        || source.slice(at, close).includes("\n")) continue;
      if (source[at - 1] === "!" && !escaped(at - 1)) { blank(at - 1, close + 1); continue; }
      const target = source.slice(at + 2, innerClose);
      const pipe = target.indexOf("|");
      const alias = pipe >= 0;
      // Without an alias, the displayed note name is kept, but folders are
      // technical targets. With an alias, only that exact source span stays.
      const slash = target.lastIndexOf("/");
      const visibleFrom = at + 2 + (alias ? pipe + 1 : slash + 1);
      blank(at, visibleFrom);
      blank(innerClose, close + 1);
      if (!alias) {
        const anchor = target.indexOf("#");
        if (anchor >= 0) {
          const position = at + 2 + anchor;
          blank(position, target[anchor + 1] === "^" ? innerClose : position + 1);
        }
        const nameEnd = anchor >= 0 ? at + 2 + anchor : innerClose;
        if (source.slice(visibleFrom, nameEnd).endsWith(".md")) blank(nameEnd - 3, nameEnd);
      }
      continue;
    }
    if (output[at + 1] === "^") { blank(at, close + 1); continue; }
    const targetEnd = output[close + 1] === "(" ? parentheses.get(close + 1)
      : output[close + 1] === "[" ? brackets.get(close + 1) : undefined;
    if (targetEnd !== undefined) {
      if (source[at - 1] === "!" && !escaped(at - 1)) blank(at - 1, targetEnd + 1);
      else { blank(at, at + 1); blank(close, targetEnd + 1); }
      continue;
    }
    if (nestedSquares.has(at)) continue;
    const label = output.slice(at + 1, close).join("");
    if (/(?:^|[ \t\r\n;])-?@[\p{L}\p{N}_]/u.test(label)) { blank(at, close + 1); continue; }
    if (references.has(label.toLowerCase())) { blank(at, at + 1); blank(close, close + 1); }
  }

  // Remaining lightweight syntax. Run on the partially masked buffer, so
  // metadata inside code/comments/targets cannot affect surviving prose.
  const remaining = output.join("");
  const narrativeCitation = /(?:^|[ \t(])-?@[\p{L}\p{N}_][\p{L}\p{N}_:.+/-]*/gmu;
  const patterns = [
    /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>[\]]+/g,
    /&(?:#[0-9]+|#x[\da-f]+|[a-z][\da-z]+);/gi,
    /(?:^|[ \t])#[\p{L}\p{N}_][\p{L}\p{N}_/-]*/gmu,
    /(?:^|[ \t])\^[\w-]+(?=[ \t\r]*$)/gm,
    narrativeCitation,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(remaining)) !== null) {
      // Pandoc keys may contain punctuation internally, but sentence-final
      // punctuation is prose. Keep it rather than swallowing the full stop.
      const tokenStart = match.index + (/^[ \t(]/.test(match[0]) ? 1 : 0);
      if (escaped(tokenStart)) continue;
      const end = match.index + (pattern === narrativeCitation
        ? match[0].replace(/[.:+/-]+$/, "").length : match[0].length);
      blank(tokenStart, end);
    }
  }
  for (let at = 0; at < output.length; at += 1) {
    if (escaped(at)) continue;
    if (output[at] === "*" || output[at] === "|"
      || (output[at] === "_" && !(/[\p{L}\p{N}]/u.test(output[at - 1] ?? "") && /[\p{L}\p{N}]/u.test(output[at + 1] ?? "")))) blank(at, at + 1);
    if ((output[at] === "~" || output[at] === "=") && output[at + 1] === output[at]) { blank(at, at + 2); at += 1; }
  }
  return output.join("");
}
