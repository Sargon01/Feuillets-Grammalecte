/* Type-only copy of Feuillets' public companion contract.
 *
 * The standalone plugin must typecheck from its own clone; these declarations
 * describe the same runtime API and add no code to the bundle. Keep the API
 * version in sync with Feuillets when the contract changes. */

export interface TextAnalysisInput {
  text: string;
  filePath?: string;
  selectionStart?: number;
  selectionEnd?: number;
}

export type TextAnalysisSeverity = "info" | "warning" | "error";

export interface TextAnalysisIssue {
  id?: string;
  message: string;
  category?: string;
  severity?: TextAnalysisSeverity;
  filePath?: string;
  start: number;
  end: number;
  suggestions?: string[];
  ruleId?: string;
  text?: string;
  canLearn?: boolean;
}

export type LinguisticVocabEntry = [string, number];

export interface LinguisticAnalysisResult {
  richness?: number;
  uniqueLemmas?: number;
  contentTotal?: number;
  hapaxCount?: number;
  favoriteVerbs?: LinguisticVocabEntry[];
  weakVerbs?: LinguisticVocabEntry[];
  weakTotal?: number;
  weakPct?: number;
  favoriteAdjs?: LinguisticVocabEntry[];
  favoriteAdvs?: LinguisticVocabEntry[];
  mentAdverbs?: LinguisticVocabEntry[];
  mentTotal?: number;
  mentPct?: number;
  passiveCount?: number;
  grammaticalCategories?: Record<string, number>;
}

export interface TextAnalysisProvider {
  id: string;
  name: string;
  analyze(input: TextAnalysisInput): Promise<TextAnalysisIssue[]>;
  suggest?(word: string, issue?: TextAnalysisIssue): Promise<string[]> | string[];
  ignoreOccurrence?(issue: TextAnalysisIssue): Promise<void> | void;
  learnWord?(word: string, issue?: TextAnalysisIssue): Promise<void> | void;
  analyzeLinguistics?(input: TextAnalysisInput): Promise<LinguisticAnalysisResult | null>;
}

export interface FeuilletsPublicApi {
  readonly apiVersion: number;
  registerAnalysisProvider(provider: TextAnalysisProvider): void;
  unregisterAnalysisProvider(providerId: string): void;
  getAnalysisProvider(providerId?: string): TextAnalysisProvider | null;
}
