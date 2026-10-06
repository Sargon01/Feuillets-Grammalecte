import assert from "node:assert/strict";
import test from "node:test";
import { GrammalecteProvider } from "../src/grammalecte-provider.ts";
import { GrammalecteWorkerRunner } from "../src/grammalecte-worker-runner.ts";
import type { GrammalecteEngine, GrammalecteError } from "../src/grammalecte-adapter.ts";
import { maskMarkdownForAnalysis } from "../src/markdown-mask.ts";
import { DEFAULT_SETTINGS } from "../src/settings.ts";
import { markdownStressFixture } from "./fixtures/markdown-stress.ts";

function errorFor(paragraph: string): GrammalecteError[] {
  const start = paragraph.indexOf("le pomme");
  return start < 0 ? [] : [{ nStart: start, nEnd: start + 8, sRuleId: "agreement", sMessage: "Accord", aSuggestions: ["la pomme"], sUnderlined: "le pomme" }];
}
function capturingEngine(): { engine: GrammalecteEngine; parsed: string[]; spelled: string[]; morphs: string[] } {
  const parsed: string[] = [];
  const spelled: string[] = [];
  const morphs: string[] = [];
  const engine: GrammalecteEngine = {
    paragraphs: (text) => text.split("\n"), setOption: () => {}, suggest: () => [],
    parse: (paragraph) => { parsed.push(paragraph); return errorFor(paragraph); },
    spell: (paragraph) => {
      spelled.push(paragraph);
      return [...paragraph.matchAll(/\b(?:fotee|cortexTechnicalIdentifier|smith2024|imagecortex|hiddenRenderer)\b/g)].map((match) => ({
        sValue: match[0], nStart: match.index, nEnd: match.index + match[0].length,
      }));
    },
    getMorph: (word) => { morphs.push(word); return [`>${word} :N`]; },
  };
  return { engine, parsed, spelled, morphs };
}

const SOURCE = "> [!questions] Questions\r\n> Il ne faut pas manger le pomme.\r\n" +
  "![[imagecortex.png|391]]\r\nVoir [[cortexTechnicalIdentifier|une fotee]] [@smith2024].\r\n%% hiddenRenderer %%";

test("provider injected engine: original input is intact, parse/spell receive the same mask, prose offsets stay exact", async () => {
  const { engine, parsed, spelled } = capturingEngine();
  const provider = new GrammalecteProvider(() => DEFAULT_SETTINGS, undefined, () => engine);
  const input = { text: SOURCE, filePath: "A.md", selectionStart: 100, selectionEnd: 200 };
  const issues = await provider.analyze(input);
  assert.equal(input.text, SOURCE);
  assert.equal(maskMarkdownForAnalysis(SOURCE).length, SOURCE.length);
  assert.deepEqual(parsed, spelled);
  for (const technical of ["questions]", "imagecortex", "cortexTechnicalIdentifier", "smith2024", "hiddenRenderer"]) {
    assert.ok(parsed.every((paragraph) => !paragraph.includes(technical)));
  }
  assert.equal(issues.length, 2);
  for (const [target, category] of [["le pomme", "Grammaire"], ["fotee", "Orthographe"]]) {
    const issue = issues.find((entry) => entry.category === category);
    assert.ok(issue);
    assert.equal(issue.start, SOURCE.indexOf(target));
    assert.equal(SOURCE.slice(issue.start, issue.end), target);
    assert.equal(issue.text, target);
  }
});

test("provider production branch: the Worker is passed masked text and keeps returned source offsets", async (t) => {
  const original = GrammalecteWorkerRunner.prototype.analyze;
  const received: string[] = [];
  GrammalecteWorkerRunner.prototype.analyze = async (text) => {
    received.push(text);
    const start = text.indexOf("fotee");
    return [{ start, end: start + 5, text: "fotee", message: "Faute", category: "Orthographe", canLearn: true }];
  };
  t.after(() => { GrammalecteWorkerRunner.prototype.analyze = original; });
  const provider = new GrammalecteProvider(() => DEFAULT_SETTINGS);
  const issues = await provider.analyze({ text: SOURCE, filePath: "A.md" });
  assert.deepEqual(received, [maskMarkdownForAnalysis(SOURCE)]);
  assert.equal(received[0].length, SOURCE.length);
  assert.equal(SOURCE.slice(issues[0].start, issues[0].end), "fotee");
  provider.dispose();
});

test("provider: spelling OFF preserves grammar and never calls spell on Markdown", async () => {
  const { engine, parsed, spelled } = capturingEngine();
  const provider = new GrammalecteProvider(() => ({ ...DEFAULT_SETTINGS, checkSpelling: false }), undefined, () => engine);
  const issues = await provider.analyze({ text: SOURCE });
  assert.equal(issues.length, 1);
  assert.equal(SOURCE.slice(issues[0].start, issues[0].end), "le pomme");
  assert.equal(spelled.length, 0);
  assert.ok(parsed.every((paragraph) => !paragraph.includes("smith2024")));
});

test("provider/Relecture: all real prose issues remain available, with no 300-issue live ceiling", async () => {
  const { engine } = capturingEngine();
  const source = Array(500).fill("> [!note] Une fotee. Voir [@smith2024].").join("\n");
  const provider = new GrammalecteProvider(() => DEFAULT_SETTINGS, undefined, () => engine);
  const issues = await provider.analyze({ text: source });
  assert.equal(issues.length, 500);
  assert.ok(issues.every((issue) => issue.text === "fotee" && source.slice(issue.start, issue.end) === "fotee"));
});

test("provider: the 29600-character stress fixture reaches only masked paragraphs; every deliberate typo stays anchored", async () => {
  const { engine, parsed, spelled } = capturingEngine();
  const source = markdownStressFixture();
  const provider = new GrammalecteProvider(() => DEFAULT_SETTINGS, undefined, () => engine);
  const issues = await provider.analyze({ text: source });
  assert.equal(source.length, 29600);
  assert.deepEqual(parsed, spelled);
  assert.ok(parsed.every((paragraph) => !/smith2024|cortexAlgorithm|hiddenGizmoRenderer|neuroWave|image-cortexatlas/.test(paragraph)));
  const typos = [...source.matchAll(/fotee/g)];
  assert.equal(issues.length, typos.length);
  assert.deepEqual(issues.map((issue) => issue.start), typos.map((match) => match.index));
});

test("linguistics injected engine: filenames, citekeys, URLs, tags and directives no longer inflate vocabulary", async () => {
  const { engine, morphs } = capturingEngine();
  const provider = new GrammalecteProvider(() => DEFAULT_SETTINGS, undefined, () => engine);
  const source = "Les enfants lisent.\n![[cortexfile.png]]\n[@smith2024]\n" +
    "%% hiddenRenderer %%\n[un livre](https://example.org/cortexURL)\n#cortexTag ^cortex-id";
  const result = await provider.analyzeLinguistics({ text: source });
  assert.ok(result);
  assert.deepEqual(morphs.sort(), ["enfants", "les", "lisent", "livre", "un"]);
  assert.equal(result.contentTotal, 5);
  assert.equal(result.uniqueLemmas, 5);
});

test("linguistics production branch receives the same masked prose as proofreading", async (t) => {
  const original = GrammalecteWorkerRunner.prototype.analyzeLinguistics;
  let received = "";
  GrammalecteWorkerRunner.prototype.analyzeLinguistics = async (text) => { received = text; return null; };
  t.after(() => { GrammalecteWorkerRunner.prototype.analyzeLinguistics = original; });
  const provider = new GrammalecteProvider(() => DEFAULT_SETTINGS);
  await provider.analyzeLinguistics({ text: SOURCE });
  assert.equal(received, maskMarkdownForAnalysis(SOURCE));
  assert.equal(received.length, SOURCE.length);
  provider.dispose();
});

test("masked technical-only input does not load an engine for either analysis", async () => {
  let loads = 0;
  const provider = new GrammalecteProvider(() => DEFAULT_SETTINGS, undefined, () => { loads += 1; return capturingEngine().engine; });
  const source = "![[image.png]]\n%% hiddenRenderer %%\n[@smith2024]\n```js\nopaque\n```\n$E = mc^2$";
  assert.deepEqual(await provider.analyze({ text: source }), []);
  assert.equal(await provider.analyzeLinguistics({ text: source }), null);
  assert.equal(loads, 0);
});
