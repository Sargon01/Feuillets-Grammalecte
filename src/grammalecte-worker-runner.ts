import type { LinguisticAnalysisResult, TextAnalysisIssue } from "./feuillets-api.ts";
import {
  analyzeLinguisticsWithEngine,
  grammarErrorToIssue,
  spellTokenToIssue,
  type AnalyseOptions,
  type GrammalecteEngine,
  type GrammalecteError,
  type GrammalecteSpellToken,
} from "./grammalecte-adapter.ts";
import { loadEmbeddedAssets, type AssetMap } from "./grammalecte-assets.ts";
import { buildGrammalecteWorkerSource } from "./grammalecte-worker-builder.ts";

type WorkerIssue =
  | { kind: "grammar"; error: GrammalecteError; paragraphOffset: number }
  | { kind: "spelling"; token: GrammalecteSpellToken; suggestions: string[]; paragraphOffset: number };

type Request = { id: number; method: "analyze"; text: string; options: AnalyseOptions } | { id: number; method: "morph"; word: string } | { id: number; method: "suggest"; word: string; maxSuggestions: number };
type Response = { id: number; result?: unknown; error?: string };
type Pending = { resolve(value: unknown): void; reject(reason: Error): void };
type AssetLoader = () => AssetMap;
type WorkerSourceBuilder = (assets: AssetMap) => string;

export class GrammalecteWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrammalecteWorkerError";
  }
}

export class GrammalecteWorkerRunner {
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private readonly loadAssets: AssetLoader;
  private readonly buildWorkerSource: WorkerSourceBuilder;

  constructor(loadAssets: AssetLoader = loadEmbeddedAssets, buildWorkerSource: WorkerSourceBuilder = buildGrammalecteWorkerSource) {
    this.loadAssets = loadAssets;
    this.buildWorkerSource = buildWorkerSource;
  }

  get isLoaded(): boolean {
    return this.worker !== null;
  }

  async analyze(text: string, options: AnalyseOptions): Promise<TextAnalysisIssue[]> {
    const result = await this.request({ id: this.nextRequestId(), method: "analyze", text, options });
    if (!Array.isArray(result)) throw new GrammalecteWorkerError("Réponse d'analyse Grammalecte invalide.");
    return result.map((item) => this.toIssue(item, options.maxSuggestions)).sort((a, b) => a.start - b.start || a.end - b.end);
  }

  async analyzeLinguistics(text: string): Promise<LinguisticAnalysisResult | null> {
    if (!text || text.trim() === "") return null;
    const words = [...new Set(text.toLowerCase().match(/[\p{L}][\p{L}'-]{1,}/gu) || [])];
    const entries = await Promise.all(words.map(async (word) => [word, await this.request({ id: this.nextRequestId(), method: "morph", word })] as const));
    const morphology = new Map<string, string[]>();
    for (const [word, result] of entries) {
      if (!Array.isArray(result) || !result.every((morph) => typeof morph === "string")) {
        throw new GrammalecteWorkerError("Réponse morphologique Grammalecte invalide.");
      }
      morphology.set(word, result);
    }
    const engine: GrammalecteEngine = {
      paragraphs: () => [],
      setOption: () => {},
      parse: () => [],
      spell: () => [],
      suggest: () => [],
      getMorph: (word) => morphology.get(word) || [],
    };
    return analyzeLinguisticsWithEngine(engine, text);
  }

  async suggest(word: string, maxSuggestions: number): Promise<string[]> {
    const result = await this.request({ id: this.nextRequestId(), method: "suggest", word, maxSuggestions });
    if (!Array.isArray(result) || !result.every((entry) => typeof entry === "string")) {
      throw new GrammalecteWorkerError("Réponse de suggestions Grammalecte invalide.");
    }
    return result;
  }

  dispose(): void {
    this.worker?.terminate();
    if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
    this.worker = null;
    this.workerUrl = null;
    for (const pending of this.pending.values()) pending.reject(new GrammalecteWorkerError("Worker Grammalecte arrêté."));
    this.pending.clear();
  }

  private request(request: Request): Promise<unknown> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      worker.postMessage(request);
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const source = this.buildWorkerSource(this.loadAssets());
    const blob = new Blob([source], { type: "text/javascript" });
    this.workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(this.workerUrl);
    worker.onmessage = (event: MessageEvent<Response>) => this.receive(event.data);
    worker.onerror = (event) => this.failAll(new GrammalecteWorkerError(event.message || "Erreur du Worker Grammalecte."));
    this.worker = worker;
    return worker;
  }

  private receive(response: Response): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (response.error) pending.reject(new GrammalecteWorkerError(response.error));
    else pending.resolve(response.result);
  }

  private failAll(error: GrammalecteWorkerError): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.worker?.terminate();
    if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
    this.worker = null;
    this.workerUrl = null;
  }

  private nextRequestId(): number {
    return this.nextId++;
  }

  private toIssue(value: unknown, maxSuggestions: number): TextAnalysisIssue {
    if (!value || typeof value !== "object" || !("kind" in value)) {
      throw new GrammalecteWorkerError("Signalement Grammalecte invalide.");
    }
    const issue = value as WorkerIssue;
    if (issue.kind === "grammar") return grammarErrorToIssue(issue.error, issue.paragraphOffset, maxSuggestions);
    return spellTokenToIssue(issue.token, issue.suggestions, issue.paragraphOffset, maxSuggestions);
  }
}
