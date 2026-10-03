/* Archive embarquée : encodage au build et reconstitution au premier usage.

   Les tests de bout en bout (moteur réel, 9,3 Mo) ne s'exécutent que si les
   sources ont été restaurées par `npm run resources` — inutile d'imposer ce
   téléchargement pour lancer la suite. */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync } from "node:zlib";
import { decodeArchive, GrammalecteArchiveError } from "../src/grammalecte-assets.ts";
import { buildGrammalecteWorkerSource, GrammalecteWorkerAssemblyError } from "../src/grammalecte-worker-builder.ts";
import { GRAMMALECTE_WORKER_DATA_FILES, GRAMMALECTE_WORKER_RESOURCE_FILES, GRAMMALECTE_WORKER_SCRIPT_FILES } from "../src/grammalecte-worker-files.ts";
import { buildArchiveBase64 } from "../scripts/build-grammalecte-archive.mjs";

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

test("build : l'archive réelle contient les seules ressources du Worker", { skip: !HAS_RESOURCES }, () => {
  const { base64, files } = buildArchiveBase64(RESOURCES_DIR);
  assert.equal(files, GRAMMALECTE_WORKER_RESOURCE_FILES.length);

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

test("worker : les sources sont assemblées à partir de l'archive", { skip: !HAS_RESOURCES }, () => {
  const { base64 } = buildArchiveBase64(RESOURCES_DIR);
  const source = buildGrammalecteWorkerSource(decodeArchive(base64));
  assert.match(source, /gc_engine\.load/);
  assert.match(source, /fr-classic/);
  assert.doesNotMatch(source, /node:vm|require\(["']vm["']\)|new Function|eval\s*\(/);
});

test("build : aucune source Worker brute n'est injectée dans le bundle", () => {
  const buildConfig = readFileSync(path.resolve(import.meta.dirname, "..", "esbuild.config.mjs"), "utf8");
  assert.doesNotMatch(buildConfig, /buildWorkerSource|grammalecte-worker-source/);
  assert.match(buildConfig, /GRAMMALECTE_ARCHIVE_BASE64/);
});

test("worker : l'ordre de chargement et le masque CommonJS sont préservés", { skip: !HAS_RESOURCES }, () => {
  const { base64 } = buildArchiveBase64(RESOURCES_DIR);
  const source = buildGrammalecteWorkerSource(decodeArchive(base64));
  const wrapper = source.indexOf("const process = undefined;");
  const firstEngineCheck = source.indexOf("typeof(process) !== 'undefined'");

  assert.ok(wrapper >= 0, "la source assemblée définit une portée locale");
  assert.ok(wrapper < firstEngineCheck, "le masque précède les sources Grammalecte");
  assert.match(source, /const require = undefined;/);
  assert.match(source, /const exports = undefined;/);
  assert.match(source, /const module = undefined;/);
  assert.match(source, /\n\}\)\(\);$/);
  let previous = -1;
  for (const name of GRAMMALECTE_WORKER_SCRIPT_FILES) {
    const current = source.indexOf(`// ${name}\n`);
    assert.ok(current > previous, `${name} respecte l'ordre de chargement`);
    previous = current;
  }
});

test("worker : une ressource requise manquante produit une erreur contrôlée", () => {
  const assets = new Map<string, string>(GRAMMALECTE_WORKER_RESOURCE_FILES.map((name) => [name, ""]));
  assets.delete(GRAMMALECTE_WORKER_SCRIPT_FILES[0]);
  assert.throws(() => buildGrammalecteWorkerSource(assets), /graphspell\/helpers\.js/);

  assets.set(GRAMMALECTE_WORKER_SCRIPT_FILES[0], "");
  assets.delete(GRAMMALECTE_WORKER_DATA_FILES[3]);
  assert.throws(() => buildGrammalecteWorkerSource(assets), /fr-classic\.json/);
  assert.throws(() => buildGrammalecteWorkerSource(new Map()), GrammalecteWorkerAssemblyError);
});
