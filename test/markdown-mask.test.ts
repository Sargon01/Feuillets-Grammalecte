import assert from "node:assert/strict";
import test from "node:test";
import { maskMarkdownForAnalysis } from "../src/markdown-mask.ts";
import { MARKDOWN_FAMILIES, markdownStressFixture } from "./fixtures/markdown-stress.ts";

function invariant(source: string): string {
  const masked = maskMarkdownForAnalysis(source);
  assert.equal(masked.length, source.length);
  for (let index = 0; index < source.length; index += 1) {
    assert.ok(masked[index] === source[index] || masked[index] === " ", `changed non-space at ${index}`);
    if (source[index] === "\n" || source[index] === "\r") assert.equal(masked[index], source[index]);
  }
  return masked;
}
function preserves(source: string, visible: string): void {
  const masked = invariant(source);
  const start = source.indexOf(visible);
  assert.ok(start >= 0);
  assert.equal(masked.slice(start, start + visible.length), visible);
}
function hidden(source: string, token: string): void {
  const masked = invariant(source);
  const start = source.indexOf(token);
  assert.ok(start >= 0);
  assert.equal(masked.slice(start, start + token.length), token.replace(/[^\r\n]/g, " "));
}

for (const [family, source] of Object.entries(MARKDOWN_FAMILIES)) {
  test(`mask: length/newline/idempotence invariant for ${family}`, () => {
    const masked = invariant(source);
    assert.equal(maskMarkdownForAnalysis(masked), masked, "well-formed prepared Markdown remains masked");
  });
}

test("mask: callout types and fold markers disappear, custom titles and quoted prose stay in place", () => {
  const source = "> [!questions]+ Un titre français\n> Quelle est la réponse ?\n>> [!synthese]-\n>> Les enfants lisent.";
  hidden(source, "[!questions]+");
  hidden(source, "[!synthese]-");
  preserves(source, "Un titre français");
  preserves(source, "Quelle est la réponse ?");
  preserves(source, "Les enfants lisent.");
});

test("mask: all Obsidian embeds, including dimensions and block/heading targets, are opaque", () => {
  for (const embed of ["![[image.png]]", "![[image.png|470]]", "![[image.png|470x250]]", "![[note#^blockid]]", "![[note#Heading|alias]]"]) {
    hidden(`Avant ${embed} après.`, embed);
  }
});

test("mask: a wikilink alias is not recentered; unaliased displayed note names remain", () => {
  const source = "Voir [[long/path/cortexTechnicalIdentifier|un chapitre français]] puis [[Dossier/Un livre]].";
  hidden(source, "long/path/cortexTechnicalIdentifier");
  preserves(source, "un chapitre français");
  preserves(source, "Un livre");
  preserves(source, "Voir");
});

test("mask: Markdown link labels keep exact offsets with nested/balanced URL syntax", () => {
  const source = 'Voir [la réponse](https://example.org/a_(b) "titre technique") et [un **livre**](url).';
  hidden(source, 'https://example.org/a_(b) "titre technique"');
  preserves(source, "la réponse");
  preserves(source, "livre");
  hidden(source, "**");
  hidden("![image descriptive](assets/image.png)", "![image descriptive](assets/image.png)");
});

test("mask: reference definitions/ids are hidden, human labels stay where written", () => {
  const source = '[une réponse][refid]\n[un livre][]\n[refid]: https://example.org/technicalPath "title"\n[un livre]: path\n';
  hidden(source, '[refid]: https://example.org/technicalPath "title"');
  hidden(source, "[refid]");
  preserves(source, "une réponse");
  preserves(source, "un livre");
});

test("mask: Pandoc citations and footnote markers disappear but note bodies and surrounding prose remain", () => {
  const source = "Voir [@smith2024, p. 42; -@doe2023]. Une fotee[^identifiant].\n[^identifiant]: Consulter [@smith2024] dans ce livre.";
  hidden(source, "[@smith2024, p. 42; -@doe2023]");
  hidden(source, "[^identifiant]");
  preserves(source, "Consulter");
  preserves(source, "dans ce livre.");
  preserves(source, "Une fotee");
});

test("mask: narrative citekeys and prefixed bracket citations leave neighboring prose/punctuation intact", () => {
  const source = "@smith2024 montre un résultat. Voir [voir @doe2023, p. 42]. Fin @smith2024.";
  hidden(source, "@smith2024");
  hidden(source, "[voir @doe2023, p. 42]");
  preserves(source, "montre un résultat.");
  preserves(source, "Voir");
  assert.equal(invariant(source).slice(-1), ".");
  preserves("Écrire à alice@example.org pour une réponse.", "alice@example.org");
  preserves("Voir (@smith2024).", "(");
  preserves("Un symbole \\#tag et \\@smith2024.", "#tag");
  preserves("Un symbole \\#tag et \\@smith2024.", "@smith2024");
});

test("mask: headings, blockquotes, lists/tasks and emphasis keep all human words at their original positions", () => {
  const source = "# Bonjour le monde\n> Texte cité\n- Une liste\n1. Un ordre\n- [ ] Une tâche\n+ [x] Tâche faite\n" +
    "**faute grammaticale** *une phrase* ~~ancien texte~~ ==texte surligné== _mot_";
  for (const visible of ["Bonjour le monde", "Texte cité", "Une liste", "Un ordre", "Une tâche", "Tâche faite", "faute grammaticale", "une phrase", "ancien texte", "texte surligné", "mot"]) preserves(source, visible);
  for (const marker of ["# ", "> ", "- ", "1. ", "[ ]", "+ [x]", "**", "~~", "=="]) hidden(source, marker);
  hidden("  [x] Les enfants lisent.", "[x]"); // list marker already blanked upstream
});

test("mask: HTML/autolinks and script/style code are technical; normal HTML prose and French whitespace survive", () => {
  const source = '<div class="tech">L’été\u00a0: une réponse française.</div> <https://example.org/tech>\n' +
    '<script>hiddenRenderer()</script><style>.technical { color:red }</style>';
  preserves(source, "L’été\u00a0: une réponse française.");
  hidden(source, "<https://example.org/tech>");
  hidden(source, "hiddenRenderer()");
  hidden(source, ".technical { color:red }");
  hidden('<div data-value="texte > hiddenRenderer">Visible.</div>', '<div data-value="texte > hiddenRenderer">');
  preserves('<div data-value="texte > hiddenRenderer">Visible.</div>', "Visible.");
});

test("mask: %% directives and HTML comments, including multiline content, are completely opaque", () => {
  const source = "Avant %% colonnes: image-texte 40/60\nimage: gauche %% après.\n<!-- hidden\nrenderer --> Visible.";
  hidden(source, "%% colonnes: image-texte 40/60\nimage: gauche %%");
  hidden(source, "<!-- hidden\nrenderer -->");
  preserves(source, "après.");
  preserves(source, "Visible.");
});

test("mask: fence width/type, CRLF, quoted fences and incomplete fences preserve positions", () => {
  const source = "Avant\r\n> ````javascript\r\n> const x = `cortex`;\r\n> ```\r\n> `````\r\nAprès\r\n~~~python\r\nopaque\r\n~~~\r\nFin.";
  hidden(source, "const x = `cortex`;");
  hidden(source, "opaque");
  preserves(source, "Après");
  preserves(source, "Fin.");
  hidden("Avant\n```javascript\nunclosed cortex", "```javascript\nunclosed cortex");
});

test("mask: comments in code and fences in comments do not hide following prose", () => {
  const source = "```\n%% not a comment\n```\nVisible.\n%%\n```\n%%\nAprès.";
  preserves(source, "Visible.");
  preserves(source, "Après.");
  preserves("`%%` Visible.", "Visible.");
});

test("mask: variable-width inline code and inline/block maths are hidden", () => {
  hidden("Voir ``const `cortex` = 1`` ici.", "``const `cortex` = 1``");
  hidden("Voir $E = mc^2$ ici.\n$$\n\\operatorname{cortex}(x)\n$$", "$E = mc^2$");
  hidden("Voir $E = mc^2$ ici.\n$$\n\\operatorname{cortex}(x)\n$$", "$$\n\\operatorname{cortex}(x)\n$$");
  preserves("Le prix est $5 ou $6.", "Le prix est $5 ou $6.");
});

test("mask: table separators vanish but header/cell prose is analyzed", () => {
  const source = "| Question | Réponse |\n| :--- | ---: |\n| Une fotee | Un livre |";
  hidden(source, "| :--- | ---: |");
  preserves(source, "Question");
  preserves(source, "Une fotee");
  preserves(source, "Un livre");
  assert.equal(invariant(source).includes("|"), false);
  hidden("| Colonne |\n| :---: |\n| Texte |", "| :---: |");
});

test("mask: complete YAML, HTML metadata, tags/block ids, but no Unicode normalization", () => {
  const source = '---\r\nslug: cortexMetadata\r\n---\r\n## Cafe\u0301 😀 œufs\n<span data-cortex="metadata">Élodie lit.</span>\n#cortexTag ^block-id';
  hidden(source, "slug: cortexMetadata");
  hidden(source, '<span data-cortex="metadata">');
  hidden(source, "#cortexTag");
  hidden(source, "^block-id");
  preserves(source, "Cafe\u0301 😀 œufs");
  preserves(source, "Élodie lit.");
  preserves("---\nUne phrase française.", "Une phrase française.");
});

test("mask: prose, escaped punctuation, malformed syntax and hostile delimiter density retain the contract", () => {
  const prose = "Élodie 😀 dit : « Cafe\u0301, œufs, l’été ! »\r\nLe chat mange.\n";
  assert.equal(invariant(prose), prose);
  preserves("\\[texte\\] et \\`mot\\`", "texte");
  for (const source of ["[".repeat(12000), "\\".repeat(12000), "[[".repeat(1000) + "texte" + "]]".repeat(1000), "<x<".repeat(1000), "`a\n".repeat(1000), "$a ".repeat(10000)]) invariant(source);
  let seed = 7;
  const alphabet = ["é", "😀", "\n", "\r", "[", "]", "|", "`", "$", "%", "\\", "a", "*", " "];
  for (let sample = 0; sample < 100; sample += 1) {
    let source = "";
    for (let index = 0; index < 100; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      source += alphabet[seed % alphabet.length];
    }
    invariant(source);
  }
  assert.equal(invariant(markdownStressFixture()).length, 29600);
});
