const ASSET_URL_PREFIX = "grammalecte-asset:/";
const DICTIONARY_DIR = "graphspell/_dictionaries";
const DICTIONARY_FILE = "fr-classic.json";

class LocalAssetRequest {
  open(_method, url) {
    let name = url.startsWith(ASSET_URL_PREFIX) ? url.slice(ASSET_URL_PREFIX.length) : url;
    if (name.endsWith("/fr-allvars.json") || name.endsWith("/fr-reform.json")) {
      name = `${DICTIONARY_DIR}/${DICTIONARY_FILE}`;
    }
    this.name = name;
  }

  overrideMimeType() {}

  send() {
    const asset = __grammalecteAssets.get(this.name);
    if (asset === undefined) throw new Error(`Ressource Grammalecte manquante : ${this.name}`);
    this.responseText = asset;
  }
}

self.XMLHttpRequest = LocalAssetRequest;

let spellChecker = null;
let initialized = false;

function initialize() {
  if (initialized) return;
  conj.init(__grammalecteAssets.get("fr/conj_data.json"));
  phonet.init(__grammalecteAssets.get("fr/phonet_data.json"));
  mfsp.init(__grammalecteAssets.get("fr/mfsp_data.json"));
  gc_engine.load("JavaScript", "aHSL", `${ASSET_URL_PREFIX}${DICTIONARY_DIR}`);
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
  for (const paragraph of text.getParagraph(sourceText)) {
    if (paragraph.trim() !== "") {
      for (const error of gc_engine.parse(paragraph, "FR", false, null, true)) {
        issues.push({ kind: "grammar", error, paragraphOffset });
      }
      if (options.checkSpelling) {
        for (const token of spellChecker.parseParagraph(paragraph)) {
          issues.push({ kind: "spelling", token, suggestions: spellChecker.suggest(token.sValue).next().value || [], paragraphOffset });
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
    throw new Error(`Méthode Grammalecte inconnue : ${data.method}`);
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
