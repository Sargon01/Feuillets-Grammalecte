import assert from "node:assert/strict";
import test from "node:test";
import type { AssetMap } from "../src/grammalecte-assets.ts";
import { GrammalecteWorkerRunner } from "../src/grammalecte-worker-runner.ts";

type Listener = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: Listener | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  messages: Array<{ id: number; method: string; word?: string; maxSuggestions?: number }> = [];
  constructor(_url: string) {
    FakeWorker.instances.push(this);
  }
  postMessage(message: { id: number; method: string }): void {
    this.messages.push(message);
    if (message.method === "analyze") {
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, result: [] } } as MessageEvent<{ id: number; result: unknown }>));
    }
    if (message.method === "suggest") {
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, result: ["quoa", "quou", "quouas", "quouai", "quouan", "quoi", "quoique", "quoiquefois", "quoique part", "quois"] } } as MessageEvent<{ id: number; result: unknown }>));
    }
  }
  terminate(): void {
    this.terminated = true;
  }
}

function installFakeWorker(): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: FakeWorker });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, "Worker", descriptor);
    else Reflect.deleteProperty(globalThis, "Worker");
    FakeWorker.instances.length = 0;
  };
}

function runnerWithAssets(loadAssets: () => AssetMap = () => new Map()): GrammalecteWorkerRunner {
  return new GrammalecteWorkerRunner(loadAssets, () => "self.onmessage = () => {}; ");
}

test("worker : les premières requêtes simultanées partagent une seule instance", async () => {
  const restore = installFakeWorker();
  try {
    const runner = runnerWithAssets();
    await Promise.all([
      runner.analyze("Premier texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 }),
      runner.analyze("Second texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 }),
    ]);
    assert.equal(FakeWorker.instances.length, 1);
  } finally {
    restore();
  }
});

test("worker : les suggestions passent par la requête dédiée", async () => {
  const restore = installFakeWorker();
  try {
    const runner = runnerWithAssets();
    assert.deepEqual(await runner.suggest("quoua", 10), ["quoa", "quou", "quouas", "quouai", "quouan", "quoi", "quoique", "quoiquefois", "quoique part", "quois"]);
    assert.deepEqual(FakeWorker.instances[0].messages[0], { id: 1, method: "suggest", word: "quoua", maxSuggestions: 10 });
  } finally {
    restore();
  }
});

test("worker : une erreur rejette la requête et autorise une nouvelle instance", async () => {
  const restore = installFakeWorker();
  try {
    const runner = runnerWithAssets();
    const pending = runner.analyze("Texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 });
    FakeWorker.instances[0].onerror?.({ message: "échec contrôlé" } as ErrorEvent);
    await assert.rejects(() => pending, /échec contrôlé/);
    await runner.analyze("Texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 });
    assert.equal(FakeWorker.instances.length, 2);
  } finally {
    restore();
  }
});

test("worker : dispose termine l'instance et rejette les requêtes pendantes", async () => {
  const restore = installFakeWorker();
  try {
    const runner = runnerWithAssets();
    const pending = runner.analyze("Texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 });
    runner.dispose();
    await assert.rejects(() => pending, /arrêté/);
    assert.equal(FakeWorker.instances[0].terminated, true);
  } finally {
    restore();
  }
});

test("worker : les ressources restent inertes jusqu'à la première requête et ne sont décodées qu'une fois", async () => {
  const restore = installFakeWorker();
  let loads = 0;
  let builds = 0;
  try {
    const runner = new GrammalecteWorkerRunner(
      () => {
        loads += 1;
        return new Map();
      },
      () => {
        builds += 1;
        return "self.onmessage = () => {};";
      }
    );
    assert.equal(loads, 0);
    assert.equal(builds, 0);
    await runner.analyze("Texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 });
    await runner.suggest("quoua", 10);
    assert.equal(loads, 1);
    assert.equal(builds, 1);
    assert.equal(FakeWorker.instances.length, 1);
  } finally {
    restore();
  }
});
