import assert from "node:assert/strict";
import test from "node:test";
import { GrammalecteWorkerRunner } from "../src/grammalecte-worker-runner.ts";

type Listener = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: Listener | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  constructor(_url: string) {
    FakeWorker.instances.push(this);
  }
  postMessage(message: { id: number; method: string }): void {
    if (message.method === "analyze") {
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, result: [] } } as MessageEvent<{ id: number; result: unknown }>));
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

test("worker : les premières requêtes simultanées partagent une seule instance", async () => {
  const restore = installFakeWorker();
  try {
    const runner = new GrammalecteWorkerRunner();
    await Promise.all([
      runner.analyze("Premier texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 }),
      runner.analyze("Second texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 }),
    ]);
    assert.equal(FakeWorker.instances.length, 1);
  } finally {
    restore();
  }
});

test("worker : une erreur rejette la requête et autorise une nouvelle instance", async () => {
  const restore = installFakeWorker();
  try {
    const runner = new GrammalecteWorkerRunner();
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
    const runner = new GrammalecteWorkerRunner();
    const pending = runner.analyze("Texte.", { checkSpelling: true, detectRepetitions: false, maxSuggestions: 5 });
    runner.dispose();
    await assert.rejects(() => pending, /arrêté/);
    assert.equal(FakeWorker.instances[0].terminated, true);
  } finally {
    restore();
  }
});
