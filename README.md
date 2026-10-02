# Console R

R complet dans le navigateur, pensé pour le téléphone. R 4 est compilé en WebAssembly par
[webR](https://docs.r-wasm.org/webr/latest/) et tourne entièrement sur l’appareil : aucun serveur, aucune donnée envoyée.

## Fonctions

- **Script** : éditeur, « Tout exécuter », « Ligne / sélection » (Ctrl+Entrée), ouverture et enregistrement de fichiers `.R`.
- **Console** : invite `>`, saisie sur plusieurs lignes (`+`), historique ↑/↓, erreurs et avis affichés comme dans R.
- **Graphiques** affichés dans la console (base R, ggplot2, lattice…) ; appui long pour enregistrer l’image.
- **Paquets** : recherche dans tout le dépôt webR (plusieurs milliers de paquets CRAN) et catalogue par thème :
  manipulation de données, import/export, graphiques, statistique, modèles mixtes et survie, économétrie,
  séries temporelles, analyse multivariée, apprentissage automatique, actuariat et finance, texte, calcul numérique.
  Un simple `library(dplyr)` installe le paquet s’il manque ; `install.packages()` fonctionne aussi.
  Option : réinstaller automatiquement ses paquets à chaque démarrage (depuis le cache).
- **Fichiers** : import depuis le téléphone (CSV, Excel, RDS, SPSS/Stata/SAS, JSON…) dans le répertoire de travail.
- **Aide** : `?mean`, `help(lm)` affichent la page d’aide dans la console.
- Barre de touches R au-dessus du clavier : `<-`, `|>`, parenthèses, crochets, `$`, `~`, `#`…
- Thème clair/sombre, exemples prêts à lancer (régression, tests, dplyr, ggplot2, ACP, lme4, survie, rpart, forecast…).

Le premier lancement télécharge R (~25 Mo) ; le service worker garde R et les paquets installés en cache,
l’application fonctionne ensuite hors ligne. Limite : un calcul sans fin ne peut pas être interrompu,
utilisez « Redémarrer R » (menu ⋯).

## Publier et installer sur le téléphone

1. Sur GitHub : **Settings → Pages → Branch : `main`, dossier `/ (root)`**.
   L’adresse sera `https://isaackoussa.github.io/CONSOLE-R/`.
2. Ouvrir cette adresse puis :
   - **Android / Chrome** : menu ⋮ → *Installer l’application* (ou menu ⋯ de la console → « Installer l’application ») ;
   - **iPhone / iPad (Safari)** : *Partager* → *Sur l’écran d’accueil*.

Après une modification des fichiers, incrémentez `VERSION` dans `sw.js` pour que les appareils déjà installés
récupèrent la nouvelle version.

## Lancer en local

```bash
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

## Structure

```
index.html            coque de l'application (onglets Script, Console, Paquets)
css/app.css           thème clair/sombre, mise en page mobile
js/app.js             démarrage de webR, exécution, graphiques, paquets, menu
sw.js                 service worker (hors ligne, cache de R et des paquets)
manifest.webmanifest  application installable
icons/                icônes
```
