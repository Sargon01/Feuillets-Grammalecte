# Feuillets Grammalecte

Projet autonome : [Sargon01/feuillets-grammalecte](https://github.com/Sargon01/Feuillets-Grammalecte).

**Feuillets Grammalecte** est le greffon compagnon officiel d'analyse linguistique pour le studio d'écriture [Feuillets](https://github.com/Sargon01/Feuillets). Il embarque localement le moteur de correction grammaticale et orthographique **Grammalecte** pour offrir une correction fluide et confidentielle directement dans Obsidian.

> **Avertissement** : Ce projet est une intégration indépendante développée pour Obsidian et **n'est pas le projet officiel Grammalecte**.

---

## 🎯 Rôle du compagnon et dépendance

Ce greffon fournit un moteur de correction linguistique local qui s'enregistre automatiquement auprès du plugin principal **[Feuillets](https://github.com/Sargon01/Feuillets)**.

- **Dépendance requise** : Une version actuelle du plugin **Feuillets**, exposant l’API de fournisseur d’analyse de texte, doit être installée et activée dans Obsidian.
- **Fournisseur autonome** : Feuillets Grammalecte fournit l'analyse linguistique sans ajouter de logique grammaticale lourde dans le cœur de Feuillets.

---

## 🔒 100 % Local et Confidentiel

- **Aucun envoi vers un serveur externe** : Vos manuscrits, romans et notes ne quittent jamais votre ordinateur.
- **Exécution hors ligne** : Le moteur Grammalecte et son dictionnaire français complet sont entièrement embarqués dans le plugin. Aucune connexion internet n'est requise.
- **Exécution locale isolée** : Le moteur s’exécute dans un Worker local créé depuis une URL Blob ; il est réutilisé après son premier chargement.

---

## ✨ Fonctionnalités

- **Correction orthographique et grammaticale** : Détection des fautes d’orthographe, d’accord, de ponctuation, de typographie et des répétitions.
- **Correction directement dans l’éditeur** : Cliquez avec le bouton gauche sur un problème souligné pour ouvrir le menu de correction. Il propose jusqu’à 10 suggestions orthographiques interactives, ainsi que *Ignorer cette occurrence* et *Ajouter au dictionnaire* pour l’orthographe. Les occurrences ignorées ne durent que la session ; les mots ajoutés sont conservés dans les données du greffon.
- **Soulignements dans l’éditeur Markdown** : Feuillets affiche les diagnostics fournis par le compagnon : une vaguelette pour l’orthographe et un soulignement pointillé ou en tirets, visuellement distinct, pour la grammaire. La différence ne repose pas seulement sur la couleur.
- **Analyse en direct** : Feuillets lance les vérifications après une courte pause de frappe, sur le feuillet courant. La correction normale fonctionne dans l’éditeur sans devoir ouvrir Relecture ; Relecture reste une surface optionnelle de revue et d’analyse fournie par Feuillets.
- **Section d'analyse linguistique** :
  - Indicateurs de richesse lexicale, lemmes, adverbes en *-ment*, verbes passifs et longueur moyenne des phrases.

---

## 💻 Installation

### Depuis Obsidian (Recommandé)
1. Ouvrez **Paramètres** > **Plugins tiers**.
2. Recherchez **Feuillets Grammalecte** et cliquez sur **Installer**.
3. Activez le plugin. Assurez-vous que le plugin **Feuillets** est également activé.

### Installation manuelle
1. Téléchargez les fichiers `main.js` et `manifest.json` de la dernière version ([Releases](https://github.com/Sargon01/Feuillets-Grammalecte/releases)).
2. Créez le dossier `.obsidian/plugins/feuillets-grammalecte/` dans votre coffre.
3. Copiez-y `main.js` et `manifest.json`.
4. Rechargez les plugins tiers dans Obsidian et activez **Feuillets Grammalecte**.

---

## ⚠️ Limites connues & Compatibilité

- **Compatibilité Obsidian** : Requiert Obsidian `v1.7.2` ou supérieure.
- **Desktop uniquement (`isDesktopOnly: true`)** : L’implémentation et son intégration Feuillets sont actuellement validées pour Obsidian Desktop/Electron (macOS, Windows et Linux), et ne sont pas disponibles sur mobile (iOS/Android).

---

## 📜 Licence et Crédits

- **Licence du greffon** : Distribué sous licence **GNU General Public License v3.0** (`GPL-3.0-only`). Voir le fichier [LICENSE](LICENSE).
- **Crédits Grammalecte** : Moteur linguistique développé par **Olivier R.** ([https://grammalecte.net](https://grammalecte.net)), projet maintenu par **Algoo SAS** ([https://algoo.fr](https://algoo.fr)). Le greffon embarque Grammalecte v2.3.1 et le dictionnaire `fr-classic`.
- Consultez le fichier [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) pour le détail des composants tiers embarqués.
