import { createRequire, register } from "node:module";

register("./obsidian-hooks.mjs", import.meta.url);

/* En production, esbuild produit du CommonJS et `require` est fourni par
   Obsidian. Les tests
   tournent en ESM, où `require` n'existe pas : on le rétablit à l'identique
   pour que le code testé soit exactement celui qui est livré. */
globalThis.require = createRequire(import.meta.url);
