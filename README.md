# Feuillets Grammalecte

Standalone project: [Sargon01/feuillets-grammalecte](https://github.com/Sargon01/Feuillets-Grammalecte).

**Feuillets Grammalecte** is the official language-analysis companion plugin for the [Feuillets](https://github.com/Sargon01/Feuillets) writing studio. It embeds Grammalecte 2.3.1 locally for French spelling and grammar checking directly in Obsidian.

> **Note:** This is an independent integration for Obsidian and is **not** the official Grammalecte project.

## Requirements

- A current version of the **Feuillets** plugin that exposes the text-analysis provider API must be installed and enabled.
- Feuillets Grammalecte supplies local language analysis without adding a grammar engine to Feuillets itself.

## Features

- **French spelling and grammar checking:** Detects spelling, agreement, punctuation, typography, and repetition issues.
- **Editor-first live correction:** Feuillets runs checks for the current document after a short typing pause. Normal correction works directly in the editor; **Relecture** remains an optional review and analysis surface provided by Feuillets.
- **Correction actions:** Left-click an underlined issue to open correction actions. Spelling suggestions are loaded lazily, with up to 10 interactive suggestions. You can also choose *Ignore this occurrence* or *Add to dictionary* for spelling issues.
- **Personal dictionary:** Ignored occurrences last for the current session only. Learned words are saved in the plugin data.
- **Distinct editor diagnostics:** Feuillets renders the companion’s spelling diagnostics with a wavy underline and grammar diagnostics with a visually distinct dotted or dashed underline; the distinction does not depend on colour alone.
- **Linguistic analysis:** Lexical richness, lemmas, *-ment* adverbs, passive verbs, and average sentence length remain available.

Feuillets can use this provider for live correction in both its standard editor integration and Continu view.

## Privacy and local processing

Your text is never sent to an external server. Grammalecte and the `fr-classic` French dictionary are embedded in the plugin, so no network connection or runtime download is required. The compressed resources are loaded locally on first use and run in a reusable local Worker created from a Blob URL.

## Installation

### Community plugins

1. Open **Settings** > **Community plugins**.
2. Search for **Feuillets Grammalecte** and select **Install**.
3. Enable the plugin and make sure **Feuillets** is enabled as well.

### Manual installation

1. Download `main.js` and `manifest.json` from the latest [release](https://github.com/Sargon01/Feuillets-Grammalecte/releases).
2. Create `.obsidian/plugins/feuillets-grammalecte/` in your vault.
3. Copy `main.js` and `manifest.json` into that folder.
4. Reload community plugins in Obsidian and enable **Feuillets Grammalecte**.

## Compatibility and limitations

- Requires Obsidian `v1.7.2` or later.
- Desktop only (`isDesktopOnly: true`): the current implementation and its Feuillets integration are validated for Obsidian Desktop/Electron on macOS, Windows, and Linux. Mobile platforms are not supported.

## License and credits

- **Plugin license:** GNU General Public License v3.0 (`GPL-3.0-only`). See [LICENSE](LICENSE).
- **Grammalecte:** Language engine developed by **Olivier R.** ([https://grammalecte.net](https://grammalecte.net)) and maintained by **Algoo SAS** ([https://algoo.fr](https://algoo.fr)). This plugin embeds Grammalecte 2.3.1 and the `fr-classic` dictionary.
- See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for embedded third-party component details.
