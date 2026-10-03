# Notices de composants tiers / Third-Party Notices

Ce projet intègre des ressources et du code sous licence libre provenant du projet **Grammalecte**.

---

## Grammalecte

- **Nom du composant** : Grammalecte
- **Auteurs & Droits d'auteur** : Olivier R. (auteur original) & Algoo SAS (reprise de gestion et maintenance en janvier 2026, [https://algoo.fr](https://algoo.fr))
- **Site officiel** : [https://grammalecte.net](https://grammalecte.net)
- **Dépôt officiel des sources (Fossil)** : [http://code.grammalecte.net:8080/](http://code.grammalecte.net:8080/)
- **Provenance des ressources embarquées** : extraction de l’extension Firefox officielle « Grammalecte by algoo [fr] », version 2.3.1, publiée par Algoo ([https://github.com/algoo/grammalecte](https://github.com/algoo/grammalecte)).
- **Version réellement embarquée dans le plugin** : 2.3.1 (moteur JavaScript et dictionnaire `fr-classic`)
- **Licence** : GNU General Public License v3.0 (`GPL-3.0-only` / `GPL-3.0-or-later`)

### Ressources et fichiers embarqués

Le composant intègre les modules et bases de données linguistiques suivants :
- Moteur de règles grammaticales : `grammalecte/fr/gc_engine.js`, `grammalecte/fr/gc_functions.js`, `grammalecte/fr/gc_rules_graph.js`
- Correcteur orthographique : `grammalecte/graphspell/spellchecker.js`, `grammalecte/graphspell/ibdawg.js`, `grammalecte/graphspell/helpers.js`
- Dictionnaire français classique : `grammalecte/graphspell/_dictionaries/fr-classic.json` (`sDate: "2025-08-13 12:54:56"`)
- Données de conjugaison, phonétique et morphosyntaxe : `grammalecte/fr/conj_data.json`, `grammalecte/fr/phonet_data.json`, `grammalecte/fr/mfsp_data.json`

### Adaptations et transformations effectuées

1. **Empaquetage en archive embarquée** :
   Les 21 ressources JavaScript et de données sélectionnées sont regroupées dans une archive Brotli Base64 intégrée au bundle lors de la phase de build. L’archive est décompressée localement au premier emploi de Grammalecte ; aucun téléchargement réseau ni accès disque aux ressources n’est requis à l’exécution.

2. **Exécution locale dans un Worker** :
   Une carte des ressources est reconstruite en mémoire, puis le code du Worker est assemblé en mémoire et lancé depuis une URL Blob. Les globaux CommonJS `process`, `require`, `exports` et `module` sont masqués lexicalement afin que les branches navigateur/global de Grammalecte soient utilisées.

---

Avis légal : Ce greffon compagnon est un projet indépendant distribué sous licence GNU GPLv3. Il n'est pas édité par l'équipe officielle de Grammalecte ni par Algoo SAS.
