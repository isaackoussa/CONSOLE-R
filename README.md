# Console R

R complet dans le navigateur, pensé pour le téléphone. R 4 est compilé en WebAssembly par
[webR](https://docs.r-wasm.org/webr/latest/) et tourne entièrement sur l’appareil : aucun serveur, aucune donnée envoyée.

## Fonctions

- **Plusieurs scripts ouverts en même temps**, en onglets comme dans RStudio : « + » ouvre une feuille, toucher l’onglet
  actif le nomme (et l’enregistre dans *Mes scripts*), « × » le ferme ; les onglets sont conservés à la réouverture.
- **Script** : éditeur, « Tout exécuter », « Ligne / sélection » (Ctrl+Entrée), ouverture de fichiers `.R` du téléphone.
- **Console** : invite `>`, saisie sur plusieurs lignes (`+`), commandes précédentes avec ↑/↓, erreurs et avis affichés comme dans R.
- **Graphiques** affichés dans la console (base R, ggplot2, lattice…) ; appui long pour enregistrer l’image.
- **Historique par script** : chaque script devient une entrée quand on le quitte (changement d’onglet, fermeture de
  l’application, autre script ouvert) ou qu’on le lance en entier ; le modifier ensuite met à jour la même entrée.
  Les commandes tapées dans la console pendant une séance forment, elles aussi, un seul script. Classement par jour,
  recherche ; pour chaque script : ouvrir dans un onglet, relancer, enregistrer en .R, copier, supprimer.
- **Fichiers** :
  - *Mes scripts* : scripts nommés gardés dans l’application ;
  - *Mes notes* : bloc-notes enregistré automatiquement ;
  - *Enregistrer sur le téléphone* : script (.R), notes (.txt), console (.txt), rapport avec graphiques (.html),
    historique (.R), sauvegarde complète (.json, restaurable). Sur téléphone, la feuille de partage s’ouvre
    (Fichiers, Notes, Drive, WhatsApp…), sinon le fichier va dans Téléchargements ;
  - *Fichiers créés par R* (`write.csv`, `saveRDS`, `png`…) à enregistrer d’un geste ; dans le code,
    `enregistrer("resultats.csv")` envoie directement le fichier sur le téléphone.
- **Paquets** : recherche dans deux dépôts de paquets compilés pour le navigateur — celui de webR et
  [R-universe](https://cran.r-universe.dev) (presque tout CRAN) — et catalogue par thème : manipulation de données,
  import/export, graphiques, statistique, modèles mixtes et survie, économétrie, séries temporelles, analyse
  multivariée, apprentissage automatique, actuariat et finance, texte, calcul numérique.
  Un simple `library(dplyr)` installe le paquet s’il manque ; `install.packages()` fonctionne aussi.
  Option : réinstaller automatiquement ses paquets à chaque démarrage (depuis le cache).
- **Import** depuis le téléphone (CSV, Excel, RDS, SPSS/Stata/SAS, JSON…) dans le répertoire de travail.
- **Aide** : `?mean`, `help(lm)` affichent la page d’aide dans la console.
- Barre de touches R au-dessus du clavier : `<-`, `|>`, parenthèses, crochets, `$`, `~`, `#`…
- Thème clair/sombre, exemples prêts à lancer (régression, tests, dplyr, ggplot2, ACP, lme4, survie, rpart, forecast…).

Le premier lancement télécharge R (~25 Mo) ; le service worker garde R et les paquets installés en cache,
l’application fonctionne ensuite hors ligne. Limites : un calcul sans fin ne peut pas être interrompu
(« Redémarrer R » dans le menu ⋯) ; scripts, notes et historique sont stockés dans le navigateur — faites
régulièrement une sauvegarde par e-mail.

## Sauvegarde par e-mail

Onglet **Fichiers → Sauvegarde par e-mail** : on enregistre son adresse une fois, puis « M’envoyer ma sauvegarde »
prépare un e-mail avec toute la progression en pièce jointe (`.json` : scripts, onglets, notes, historique, paquets).
Sur téléphone, la feuille de partage s’ouvre (choisir Gmail, Outlook…) ; sur ordinateur, le fichier est téléchargé et
un e-mail prérempli s’ouvre. Pour retrouver sa progression (autre téléphone, réinstallation) : **Fichiers →
Restaurer une sauvegarde**, puis choisir la pièce jointe. Aucun compte ni serveur ; un rappel s’affiche si la
dernière sauvegarde date de plus d’une semaine.

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
index.html            coque de l'application (onglets Script, Console, Historique, Fichiers, Paquets)
css/app.css           thème clair/sombre, mise en page mobile
js/app.js             démarrage de webR, exécution, graphiques, onglets de scripts, historique, fichiers, paquets
sw.js                 service worker (hors ligne, cache de R et des paquets)
manifest.webmanifest  application installable
icons/                icônes
```
