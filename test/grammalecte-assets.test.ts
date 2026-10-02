/* Archive embarquée : encodage au build et reconstitution au premier usage.

   Les tests de bout en bout (moteur réel, 9,3 Mo) ne s'exécutent que si les
   sources ont été restaurées par `npm run resources` — inutile d'imposer ce
   téléchargement pour lancer la suite. */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync } from "node:zlib";
import { decodeArchive, GrammalecteArchiveError } from "../src/grammalecte-assets.ts";
import { buildArchiveBase64 } from "../scripts/build-grammalecte-archive.mjs";
import { buildWorkerSource } from "../scripts/build-grammalecte-worker.mjs";

const RESOURCES_DIR = path.resolve(import.meta.dirname, "..", "resources", "grammalecte");
const HAS_RESOURCES = existsSync(path.join(RESOURCES_DIR, "graphspell", "_dictionaries", "fr-classic.json"));

/** Fabrique une archive minuscule au même format que celle du build. */
function makeArchive(files: Array<[string, string]>): string {
  const buffers = files.map(([, content]) => Buffer.from(content, "utf8"));
  const index = Buffer.from(JSON.stringify(files.map(([name], i) => [name, buffers[i].length])), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(index.length, 0);
  return brotliCompressSync(Buffer.concat([header, index, ...buffers])).toString("base64");
}

/* ---------------------------- archive ------------------------------- */

test("archive : aller-retour d'un fichier texte, contenu et clés préservés", () => {
  const assets = decodeArchive(makeArchive([["fr/conj.js", "var conj = {};"], ["text.js", "var text = {};"]]));

  assert.deepEqual([...assets.keys()], ["fr/conj.js", "text.js"]);
  assert.equal(assets.get("fr/conj.js"), "var conj = {};");
  assert.equal(assets.get("text.js"), "var text = {};");
});

test("archive : l'utf-8 traverse la compression intact", () => {
  const content = "« Élodie mangea des œufs 😀 »";
  const assets = decodeArchive(makeArchive([["fr/x.js", content]]));
  assert.equal(assets.get("fr/x.js"), content);
});

test("archive : un build sans moteur embarqué le dit explicitement", () => {
  // C'est le cas hors build : src/grammalecte-archive.ts est un placeholder
  // vide, esbuild ne le remplit qu'au moment du bundling.
  assert.throws(() => decodeArchive(""), (error: unknown) => {
    assert.ok(error instanceof GrammalecteArchiveError);
    assert.match((error as Error).message, /n'a pas été embarqué/);
    return true;
  });
});

test("archive : données illisibles — erreur explicite, jamais un plantage nu", () => {
  assert.throws(() => decodeArchive("cGFzIGRlIGJyb3RsaQ=="), GrammalecteArchiveError);
  assert.throws(() => decodeArchive(brotliCompressSync(Buffer.from("ab")).toString("base64")), /tronquée/);

  // Index cohérent mais charge utile amputée.
  const index = Buffer.from(JSON.stringify([["fr/x.js", 999]]), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32BE(index.length, 0);
  const truncated = brotliCompressSync(Buffer.concat([header, index, Buffer.from("court")])).toString("base64");
  assert.throws(() => decodeArchive(truncated), /tronquée au fichier « fr\/x\.js »/);
});

/* --------------------- moteur réel (si disponible) ------------------- */

test("build : l'archive réelle contient les 21 fichiers du moteur", { skip: !HAS_RESOURCES }, () => {
  const { base64, files } = buildArchiveBase64(RESOURCES_DIR);
  assert.equal(files, 21, "17 scripts + 3 fichiers de données + le dictionnaire");

  const assets = decodeArchive(base64);
  for (const required of [
    "graphspell/helpers.js",
    "graphspell/_dictionaries/fr-classic.json",
    "fr/gc_engine.js",
    "fr/conj_data.json",
    "text.js",
  ]) {
    assert.ok(assets.get(required), `${required} doit être dans l'archive`);
  }
  assert.equal(assets.has("README.txt"), false, "la documentation n'est pas embarquée");
});

test("worker : les sources et données du moteur sont intégrées statiquement", { skip: !HAS_RESOURCES }, () => {
  const source = buildWorkerSource(RESOURCES_DIR);
  assert.match(source, /gc_engine\.load/);
  assert.match(source, /fr-classic/);
  assert.doesNotMatch(source, /node:vm|require\(["']vm["']\)|new Function|eval\s*\(/);
});

test("worker : les détections CommonJS de Grammalecte sont masquées dans la portée assemblée", { skip: !HAS_RESOURCES }, () => {
  const source = buildWorkerSource(RESOURCES_DIR);
  const wrapper = source.indexOf("const process = undefined;");
  const firstEngineCheck = source.indexOf("typeof(process) !== 'undefined'");

  assert.ok(wrapper >= 0, "la source assemblée définit une portée locale");
  assert.ok(wrapper < firstEngineCheck, "le masque précède les sources Grammalecte");
  assert.match(source, /const require = undefined;/);
  assert.match(source, /const exports = undefined;/);
  assert.match(source, /const module = undefined;/);
  assert.match(source, /\n\}\)\(\);$/);
});
