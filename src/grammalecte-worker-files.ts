export const GRAMMALECTE_WORKER_SCRIPT_FILES = [
  "graphspell/helpers.js",
  "graphspell/str_transform.js",
  "graphspell/char_player.js",
  "graphspell/lexgraph_fr.js",
  "graphspell/ibdawg.js",
  "graphspell/spellchecker.js",
  "text.js",
  "graphspell/tokenizer.js",
  "fr/conj.js",
  "fr/mfsp.js",
  "fr/phonet.js",
  "fr/cregex.js",
  "fr/gc_options.js",
  "fr/gc_functions.js",
  "fr/gc_rules.js",
  "fr/gc_rules_graph.js",
  "fr/gc_engine.js",
] as const;

export const GRAMMALECTE_WORKER_DATA_FILES = [
  "fr/conj_data.json",
  "fr/phonet_data.json",
  "fr/mfsp_data.json",
  "graphspell/_dictionaries/fr-classic.json",
] as const;

export const GRAMMALECTE_WORKER_RESOURCE_FILES = [
  ...GRAMMALECTE_WORKER_SCRIPT_FILES,
  ...GRAMMALECTE_WORKER_DATA_FILES,
] as const;
