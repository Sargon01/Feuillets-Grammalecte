/** Synthetic Markdown/Obsidian fixture; no private manuscript content. */
export const MARKDOWN_FAMILIES: Record<string, string> = {
  callouts: "> [!synthese]-\n> Les enfants lisent un livre.\n> [!questions]+ Titre humain\n> Quelle est la réponse ?\n",
  embeds: "![[assets/image-cortexatlas.png|470]]\n![[fichiers/schema-neurocortex.webp]]\n",
  citations: "Voir [@smith2024, p. 42; -@doe2023] et [@neuroscientificResearch2020].\n",
  footnotes: "Une fotee demeure ici[^identifiant-technique].\n[^identifiant-technique]: Voir [@smith2024] dans ce livre.\n",
  comments: "%% colonnes: image-texte 40/60 %%\n%% image: gauche ; neuroblocklayout %%\n%% configuration: hiddenGizmoRenderer ; unknowncortexid %%\n",
  tables: "| Question | Réponse |\n| :--- | ---: |\n| Les enfants | lisent un livre. |\n",
  code: "`const cortexAlgorithm = asyncRenderer(\"image.png\")`\n```javascript\nfunction renderCortex(inputStream) { return parsingLayoutEngine; }\n```\n",
  maths: "$E = mc^2 + neuroWave$\n$$\n\\operatorname{cortexAlgorithm}(x) = \\neuroWave\n$$\n",
  wikilinks: "Voir [[Documentation/Chapitre français|un chapitre français]] puis [[Un livre]].\n",
  prose: "## Un titre français\n- [x] Les enfants lisent.\n1. Une autre phrase.\n> Une citation française.\n",
  html: '<span class="technicalSyntaxTag">Le lecteur comprend.</span>\n#neurocortex ^internal-block-id\n',
};

export function markdownStressFixture(): string {
  const block = Object.values(MARKDOWN_FAMILIES).join("\n");
  const copies = Math.floor(29600 / block.length);
  return block.repeat(copies).padEnd(29600, " ");
}
