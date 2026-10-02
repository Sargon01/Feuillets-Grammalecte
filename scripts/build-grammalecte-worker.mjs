import fs from "node:fs";
import path from "node:path";

const loadOrder = [
  "graphspell/helpers.js", "graphspell/str_transform.js", "graphspell/char_player.js",
  "graphspell/lexgraph_fr.js", "graphspell/ibdawg.js", "graphspell/spellchecker.js", "text.js",
  "graphspell/tokenizer.js", "fr/conj.js", "fr/mfsp.js", "fr/phonet.js", "fr/cregex.js",
  "fr/gc_options.js", "fr/gc_functions.js", "fr/gc_rules.js", "fr/gc_rules_graph.js", "fr/gc_engine.js",
];

const dataFiles = ["fr/conj_data.json", "fr/phonet_data.json", "fr/mfsp_data.json", "graphspell/_dictionaries/fr-classic.json"];

export function buildWorkerSource(resourcesDirectory) {
  const assets = dataFiles.map((name) => [name, fs.readFileSync(path.join(resourcesDirectory, name), "utf8")]);
  const scripts = loadOrder.map((name) => {
    const directory = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "";
    return `var __dirname = "grammalecte-asset:/${directory}";\n${fs.readFileSync(path.join(resourcesDirectory, name), "utf8")}`;
  });
  const runtime = fs.readFileSync(new URL("./grammalecte-worker-runtime.js", import.meta.url), "utf8");
  return `"use strict";\n(() => {\nconst process = undefined;\nconst require = undefined;\nconst exports = undefined;\nconst module = undefined;\nconst __grammalecteAssets = new Map(${JSON.stringify(assets)});\n${scripts.join("\n")}\n${runtime}\n})();`;
}
