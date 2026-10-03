# Changelog — Feuillets Grammalecte

Toutes les modifications notables apportées au projet **Feuillets Grammalecte** seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/), et ce projet adhère au versionnage sémantique [Semantic Versioning](https://semver.org/lang/fr/).

---

## [1.1.1] - 2026-10-03

### Changed
- Migrated plugin settings to the searchable declarative settings system available in Obsidian 1.13.0 and later.
- Raised the minimum supported Obsidian version to 1.13.0.
- Removed deprecated imperative settings UI usage.
- Added an attested GitHub Actions release workflow that builds the published assets.

## [1.1.0] - 2026-10-03

### Ajouté
- Correction en direct, centrée sur l’éditeur, via Feuillets ; compatible avec la correction en direct de Feuillets dans l’éditeur normal et Continu.
- Suggestions orthographiques chargées à la demande.
- Mots appris persistants et possibilité d’ignorer une occurrence pour la session.

### Modifié
- Mise à niveau de Grammalecte vers la version 2.3.1.
- Ouverture du menu de correction par clic gauche sur un problème souligné.
- Exécution locale dans un Worker à la place de l’ancienne intégration Node `vm`.
- Ressources regroupées dans une archive Brotli décompressée au premier usage ; bundle réduit d’environ 9,8 Mo à environ 1,9 Mo.
- Collecte de tous les groupes de suggestions Graphspell avant l’application de la limite interactive.

### Corrigé
- L’identité des occurrences distingue désormais un même mot selon sa position et son fichier.
- Démarrage du Worker compatible avec l’environnement Electron/CommonJS.
- Suggestions limitées ou incomplètes dans le menu interactif.

## [1.0.0] - 2026-07-31

### Ajouté
- **Intégration locale du moteur Grammalecte** :
  - Dictionnaire français classique embarqué sans téléchargement réseau.
- **Enregistrement auprès de l'API Feuillets** :
  - Fournisseur linguistique autonome détecté et enregistré dynamiquement.
- **Section d'analyse linguistique** :
  - Mesures de richesse lexicale, lemmes, adverbes en *-ment* et voix passive.
