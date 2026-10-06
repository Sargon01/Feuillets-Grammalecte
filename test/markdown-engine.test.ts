import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createContext, runInContext } from "node:vm";
import { buildGrammalecteWorkerSource } from "../src/grammalecte-worker-builder.ts";
import { GRAMMALECTE_WORKER_RESOURCE_FILES } from "../src/grammalecte-worker-files.ts";
import type { GrammalecteError, GrammalecteSpellToken } from "../src/grammalecte-adapter.ts";
import { maskMarkdownForAnalysis } from "../src/markdown-mask.ts";
import { MARKDOWN_FAMILIES, markdownStressFixture } from "./fixtures/markdown-stress.ts";

const RESOURCES = path.resolve(import.meta.dirname, "..", "resources", "grammalecte");
const HAS_RESOURCES = GRAMMALECTE_WORKER_RESOURCE_FILES.every((name) => existsSync(path.join(RESOURCES, name)));
type Token = GrammalecteSpellToken & { sType: string };
type RawIssue = { kind: string; error?: GrammalecteError; token?: Token; paragraphOffset: number };
type Reply = { error?: string; result: RawIssue[] };

/** Execute the exact assembled Worker in a test-only VM, without suggestions.
 * Instrument its dictionary/tokenizer, not a proxy heuristic or second engine.
 * Production continues to use a Web Worker and has no VM dependency. */
function realSpellingAudit(): {
  count: (source: string) => { tokens: number; words: number; unknown: Array<{ text: string; start: number }> };
  analyze: (source: string, spelling: boolean) => RawIssue[];
} {
  const assets = new Map(GRAMMALECTE_WORKER_RESOURCE_FILES.map((name) => [name, readFileSync(path.join(RESOURCES, name), "utf8")]));
  const source = buildGrammalecteWorkerSource(assets);
  const initialization = "  initialized = true;";
  assert.equal(source.split(initialization).length, 2);
  const instrumented = source.replace(initialization, `
  self.audit = {
    tokens: p => spellChecker.getTokenizer().genTokens(p),
    spell: p => spellChecker.parseParagraph(p)
  };
${initialization}`);
  const replies: Reply[] = [];
  const context = createContext({ console, postMessage: (message: Reply) => { replies.push(message); } });
  context.self = context;
  runInContext(instrumented, context);
  const analyze = (text: string, checkSpelling: boolean): RawIssue[] => {
    replies.length = 0;
    context.onmessage({ data: { id: 1, method: "analyze", text, options: { checkSpelling, detectRepetitions: false, maxSuggestions: 5 } } });
    const reply = replies.pop();
    assert.ok(reply);
    assert.equal(reply.error, undefined);
    return Array.from(reply.result);
  };
  analyze("", false);
  const audit = context.audit as { tokens: (p: string) => Iterable<Token>; spell: (p: string) => Token[] };
  return {
    analyze,
    count(source) {
      let tokens = 0;
      let words = 0;
      let offset = 0;
      const unknown: Array<{ text: string; start: number }> = [];
      for (const paragraph of source.split("\n")) {
        if (paragraph.trim()) {
          for (const token of audit.tokens(paragraph)) { tokens += 1; if (token.sType === "WORD") words += 1; }
          for (const token of audit.spell(paragraph)) unknown.push({ text: token.sValue, start: offset + token.nStart });
        }
        offset += paragraph.length + 1;
      }
      return { tokens, words, unknown };
    },
  };
}

// As with the existing resource tests, a checkout without restored assets can
// run unit tests. On the development fixture these real-engine tests all run.
test("real French dictionary: mixed 29600-character Markdown loses technical spelling tokens, retaining every prose typo", { skip: !HAS_RESOURCES }, (t) => {
  const engine = realSpellingAudit();
  const source = markdownStressFixture();
  const masked = maskMarkdownForAnalysis(source);
  const before = engine.count(source);
  const after = engine.count(masked);
  assert.equal(masked.length, source.length);
  assert.equal(source.length, 29600);
  assert.ok(after.words < before.words);
  assert.ok(after.tokens < before.tokens);
  assert.ok(after.unknown.length < before.unknown.length);
  const deliberate = [...source.matchAll(/fotee/g)].map((match) => match.index);
  assert.deepEqual(after.unknown.filter((entry) => entry.text === "fotee").map((entry) => entry.start), deliberate);
  assert.equal(after.unknown.length, deliberate.length, "only real prose typos remain, with no technical vocabulary");
  assert.ok(after.unknown.every((entry) => source.slice(entry.start, entry.start + entry.text.length) === entry.text));
  t.diagnostic(JSON.stringify({ characters: source.length, before: { ...before, unknown: before.unknown.length }, after: { ...after, unknown: after.unknown.length } }));
  for (const [family, text] of Object.entries(MARKDOWN_FAMILIES)) {
    const raw = engine.count(text);
    const prepared = engine.count(maskMarkdownForAnalysis(text));
    assert.ok(prepared.unknown.length <= raw.unknown.length, family);
    if (["embeds", "comments", "code", "maths"].includes(family)) assert.equal(prepared.words, 0, family);
    t.diagnostic(`${family}: WORD checks ${raw.words} -> ${prepared.words}; unknown ${raw.unknown.length} -> ${prepared.unknown.length}`);
  }
});

test("real Worker: grammar/spelling keep source offsets around Markdown and CRLF, including with spelling disabled", { skip: !HAS_RESOURCES }, () => {
  const engine = realSpellingAudit();
  const source = "## Titre\r\n> [!note] Il ne faut pas manger le pomme.\r\nVoir [@smith2024]. Une fotee.";
  const masked = maskMarkdownForAnalysis(source);
  for (const spelling of [true, false]) {
    const results = engine.analyze(masked, spelling);
    const grammar = results.filter((entry) => entry.kind === "grammar" && entry.error!.sRuleId.startsWith("g3__gn_le_"));
    assert.equal(grammar.length, 2);
    assert.deepEqual(grammar.map((issue) => source.slice(issue.paragraphOffset + issue.error!.nStart, issue.paragraphOffset + issue.error!.nEnd)), ["le", "pomme"]);
    assert.equal(grammar[0].paragraphOffset + grammar[0].error!.nStart, source.indexOf("le pomme"));
    const typos = results.filter((entry) => entry.kind === "spelling");
    assert.equal(typos.length, spelling ? 1 : 0);
    if (spelling) {
      assert.equal(typos[0].token!.sValue, "fotee");
      assert.equal(typos[0].paragraphOffset + typos[0].token!.nStart, source.indexOf("fotee"));
    }
  }
});
