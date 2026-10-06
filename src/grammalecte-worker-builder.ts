import type { AssetMap } from "./grammalecte-assets.ts";
import { GRAMMALECTE_WORKER_DATA_FILES, GRAMMALECTE_WORKER_SCRIPT_FILES } from "./grammalecte-worker-files.ts";

const WORKER_RUNTIME = String.raw`const ASSET_URL_PREFIX = "grammalecte-asset:/";
const DICTIONARY_DIR = "graphspell/_dictionaries";
const DICTIONARY_FILE = "fr-classic.json";

class LocalAssetRequest {
  open(_method, url) {
    let name = url.startsWith(ASSET_URL_PREFIX) ? url.slice(ASSET_URL_PREFIX.length) : url;
    if (name.endsWith("/fr-allvars.json") || name.endsWith("/fr-reform.json")) {
      name = DICTIONARY_DIR + "/" + DICTIONARY_FILE;
    }
    this.name = name;
  }

  overrideMimeType() {}

  send() {
    const asset = __grammalecteAssets.get(this.name);
    if (asset === undefined) throw new Error("Ressource Grammalecte manquante : " + this.name);
    this.responseText = asset;
  }
}

self.XMLHttpRequest = LocalAssetRequest;

let spellChecker = null;
let initialized = false;

function suggestionsFor(word, maxSuggestions) {
  initialize();
  const suggestions = [];
  const seen = new Set();
  for (const group of spellChecker.suggest(word, maxSuggestions)) {
    if (!group || typeof group[Symbol.iterator] !== "function") continue;
    for (const suggestion of group) {
      if (typeof suggestion !== "string" || seen.has(suggestion)) continue;
      seen.add(suggestion);
      suggestions.push(suggestion);
    }
  }
  return maxSuggestions > 0 ? suggestions.slice(0, maxSuggestions) : [];
}

function initialize() {
  if (initialized) return;
  conj.init(__grammalecteAssets.get("fr/conj_data.json"));
  phonet.init(__grammalecteAssets.get("fr/phonet_data.json"));
  mfsp.init(__grammalecteAssets.get("fr/mfsp_data.json"));
  gc_engine.load("JavaScript", "aHSL", ASSET_URL_PREFIX + DICTIONARY_DIR);
  spellChecker = gc_engine.getSpellChecker();
  if (!spellChecker) throw new Error("Le dictionnaire Grammalecte n'a pas pu être chargé.");
  initialized = true;
}

function analyse(sourceText, options) {
  initialize();
  gc_engine.setOption("redon1", options.detectRepetitions);
  gc_engine.setOption("redon2", options.detectRepetitions);
  const issues = [];
  let paragraphOffset = 0;
  // Grammalecte's getParagraph normalizes CRLF/CR before splitting. Keep
  // original UTF-16 positions, including the CR in a CRLF paragraph.
  for (const paragraph of sourceText.split("\n")) {
    if (paragraph.trim() !== "") {
      for (const error of gc_engine.parse(paragraph, "FR", false, null, false)) {
        issues.push({ kind: "grammar", error, paragraphOffset });
      }
      if (options.checkSpelling) {
        for (const token of spellChecker.parseParagraph(paragraph)) {
          issues.push({ kind: "spelling", token, suggestions: [], paragraphOffset });
        }
      }
    }
    paragraphOffset += paragraph.length + 1;
  }
  return issues;
}

function morphs(word) {
  initialize();
  return typeof spellChecker.getMorph === "function" ? spellChecker.getMorph(word) : [];
}

self.onmessage = ({ data }) => {
  try {
    if (data.method === "analyze") {
      self.postMessage({ id: data.id, result: analyse(data.text, data.options) });
      return;
    }
    if (data.method === "morph") {
      self.postMessage({ id: data.id, result: morphs(data.word) });
      return;
    }
    if (data.method === "suggest") {
      self.postMessage({ id: data.id, result: suggestionsFor(data.word, data.maxSuggestions) });
      return;
    }
    throw new Error("Méthode Grammalecte inconnue : " + data.method);
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};`;

export class GrammalecteWorkerAssemblyError extends Error {
  constructor(resource: string) {
    super(`Ressource Grammalecte requise introuvable : ${resource}`);
    this.name = "GrammalecteWorkerAssemblyError";
  }
}

function requiredAsset(assets: AssetMap, name: string): string {
  const source = assets.get(name);
  if (source === undefined) throw new GrammalecteWorkerAssemblyError(name);
  return source;
}

export function buildGrammalecteWorkerSource(assets: AssetMap): string {
  const assetEntries = GRAMMALECTE_WORKER_DATA_FILES.map((name) => [name, requiredAsset(assets, name)]);
  const scripts = GRAMMALECTE_WORKER_SCRIPT_FILES.map((name) => {
    const directory = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "";
    return `// ${name}\nvar __dirname = "grammalecte-asset:/${directory}";\n${requiredAsset(assets, name)}`;
  });
  return `"use strict";\n(() => {\nconst process = undefined;\nconst require = undefined;\nconst exports = undefined;\nconst module = undefined;\nconst __grammalecteAssets = new Map(${JSON.stringify(assetEntries)});\n${scripts.join("\n")}\n${WORKER_RUNTIME}\n})();`;
}
