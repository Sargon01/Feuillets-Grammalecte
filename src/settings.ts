/* Réglages du compagnon : trois options, toutes réellement appliquées par
 * Grammalecte. Rien de générique ici (langue d'interface, affichage des
 * résultats, navigation) — tout cela appartient à Feuillets et n'a pas à être
 * dupliqué. Feuillets décide quand les vérifications en direct sont lancées. */

import { PluginSettingTab, type App, type Plugin, type SettingDefinitionItem } from "obsidian";

export type GrammalecteSettings = {
  /** Signaler aussi les mots inconnus du dictionnaire. */
  checkSpelling: boolean;
  /** Règles redon1/redon2 de Grammalecte (répétitions proches), désactivées
   *  par défaut dans Grammalecte lui-même parce qu'elles sont bruyantes. */
  detectRepetitions: boolean;
  /** Suggestions transmises par signalement. 0 = aucune. */
  maxSuggestions: number;
  /** Mots appris par l'utilisateur (persistant dans data.json). */
  learnedWords: string[];
};

export const DEFAULT_SETTINGS: GrammalecteSettings = {
  checkSpelling: true,
  detectRepetitions: false,
  maxSuggestions: 10,
  learnedWords: [],
};

/** Normalise ce qui a été relu depuis data.json : un fichier de réglages
 *  édité à la main ou écrit par une version antérieure ne doit pas produire
 *  un `maxSuggestions` négatif ni un booléen absent. */
export function normalizeSettings(raw: unknown): GrammalecteSettings {
  const data = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<GrammalecteSettings>;
  const max = typeof data.maxSuggestions === "number" && Number.isFinite(data.maxSuggestions)
    ? Math.min(10, Math.max(0, Math.round(data.maxSuggestions)))
    : DEFAULT_SETTINGS.maxSuggestions;
  const learned = Array.isArray(data.learnedWords)
    ? data.learnedWords.filter((w): w is string => typeof w === "string" && w.trim() !== "")
    : DEFAULT_SETTINGS.learnedWords;
  return {
    checkSpelling: typeof data.checkSpelling === "boolean" ? data.checkSpelling : DEFAULT_SETTINGS.checkSpelling,
    detectRepetitions:
      typeof data.detectRepetitions === "boolean" ? data.detectRepetitions : DEFAULT_SETTINGS.detectRepetitions,
    maxSuggestions: max,
    learnedWords: learned,
  };
}

type SettingsHost = Plugin & {
  settings: GrammalecteSettings;
  saveSettings(): Promise<void>;
};

export class GrammalecteSettingTab extends PluginSettingTab {
  constructor(app: App, host: SettingsHost) {
    super(app, host);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Confidentialité",
        desc:
          "L’analyse est entièrement locale : le texte des feuillets ne quitte jamais cet ordinateur. " +
          "Feuillets décide quand les vérifications en direct sont lancées ; ce greffon fournit le moteur d’analyse local.",
      },
      {
        name: "Signaler les mots inconnus",
        desc: "Ajoute la vérification orthographique aux signalements de grammaire.",
        control: { key: "checkSpelling", type: "toggle" },
      },
      {
        name: "Signaler les répétitions proches",
        desc:
          "Active les règles redon1/redon2 de Grammalecte. Désactivées par défaut, y compris " +
          "dans Grammalecte : elles sont bavardes sur un texte littéraire.",
        control: { key: "detectRepetitions", type: "toggle" },
      },
      {
        name: "Suggestions par signalement",
        desc: "Nombre maximal de corrections proposées (0 pour n’en afficher aucune).",
        control: { key: "maxSuggestions", type: "slider", min: 0, max: 10, step: 1 },
      },
    ];
  }
}
