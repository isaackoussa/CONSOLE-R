# Console R

R complet dans le navigateur, pensé pour le téléphone. R 4 est compilé en WebAssembly par
[webR](https://docs.r-wasm.org/webr/latest/) et tourne entièrement sur l’appareil : aucun serveur, aucune donnée envoyée.

## Fonctions

- **Plusieurs scripts ouverts en même temps**, en onglets comme dans RStudio : « + » ouvre une feuille, toucher l’onglet
  actif le nomme (et l’enregistre dans *Mes scripts*), « × » le ferme ; les onglets sont conservés à la réouverture.
- **Script** : éditeur, « Tout exécuter », « Ligne / sélection » (Ctrl+Entrée), ouverture de fichiers `.R` du téléphone.
- **Assistant de code** (comme IntelliSense dans VS Code) : en tapant, des propositions apparaissent au-dessus du
  clavier — fonctions, objets, arguments (`na.rm =`), colonnes après `$`, fonctions d’un paquet après `::`, noms de
  paquets dans `library()` — fournies par le moteur de complétion de R ; la signature de la fonction en cours
  (`mean(x, ...)`) s’affiche ; modèles de code ⚡ (`for`, `if`, `fun`, `ggplot`, `lm`, `ts`, `arima`, `readcsv`…).
  Un appui ou Tab insère la proposition ; Ctrl+Espace force l’affichage, Échap le masque.
- **Lire des séries sur internet** : `read.csv("https://…")`, `scan(url)`, `download.file()`, `url()` passent par le
  serveur de l’application (`/api/fetch`), car le navigateur bloque la plupart des sites de données (CORS).
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
  Le dépôt de webR (compilé pour la version de webR utilisée) est toujours prioritaire ; R-universe ne sert que pour
  les paquets qui n’y sont pas, afin de ne jamais mélanger des paquets compilés pour des versions différentes.
  Un simple `library(dplyr)` installe le paquet s’il manque ; `install.packages()` fonctionne aussi.
  Option : réinstaller automatiquement ses paquets à chaque démarrage (depuis le cache).
- **Import** depuis le téléphone (CSV, Excel, RDS, SPSS/Stata/SAS, JSON…) dans le répertoire de travail.
- **Aide** : `?mean`, `help(lm)` affichent la page d’aide dans la console.
- Barre de touches R au-dessus du clavier : `<-`, `|>`, parenthèses, crochets, `$`, `~`, `#`…
- Thème clair/sombre, exemples prêts à lancer (régression, tests, dplyr, ggplot2, ACP, lme4, survie, rpart, forecast…).

Le premier lancement télécharge R (~25 Mo) ; le service worker garde R et les paquets installés en cache,
l’application fonctionne ensuite hors ligne. Limites : un calcul sans fin ne peut pas être interrompu
(« Redémarrer R » dans le menu ⋯) ; sans compte, scripts, notes et historique ne sont stockés que dans le navigateur.

## Compte et progression (e-mail)

Comme Éloquence, Anglais 365 et MasterGraf : au premier lancement, on entre son **e-mail** et un **code à 6 chiffres**
reçu par e-mail (envoyé par Brevo), sans mot de passe. La progression — scripts, onglets ouverts, notes, historique,
paquets — est alors **sauvegardée en ligne automatiquement** (Netlify Blobs) quelques secondes après chaque
modification, et retrouvée sur tous les appareils connectés avec le même e-mail. Fusion : pour chaque script et chaque
entrée d’historique, la version la plus récente l’emporte ; les suppressions suivent. « Continuer sans compte » reste
possible (progression sur l’appareil seulement).

Le compte nécessite l’hébergement **Netlify** (fonctions `netlify/functions/*`). Variables d’environnement du site Netlify :

| Variable | Rôle |
|---|---|
| `BREVO_API_KEY` | clé API Brevo (la même que pour Éloquence) |
| `MAIL_FROM` | adresse d’expéditeur validée dans Brevo |
| `MAIL_FROM_NAME` | nom d’expéditeur (facultatif, « Console R » par défaut) |
| `ADMIN_KEY` | clé de la console admin (`admin.html`) |

Sur GitHub Pages (sans serveur), l’application fonctionne sans compte et propose à la place une **sauvegarde par
e-mail** : la progression part en pièce jointe, restaurable avec *Fichiers → Restaurer une sauvegarde*.

**Console admin** : page séparée `admin.html` (ex. `https://consolerstudio.netlify.app/admin.html`), sans aucun lien
depuis l’application, non indexée et jamais mise en cache. Protégée par la variable Netlify `ADMIN_KEY` (clé demandée à
l’ouverture, gardée le temps de l’onglet). On y voit le nombre d’utilisateurs, les actifs et nouveaux sur 7 jours,
et pour chaque compte : inscription, dernière visite et sauvegarde, connexions, scripts, onglets, historique, paquets ;
on peut bloquer/débloquer, supprimer un compte (et sa progression) et exporter la liste en CSV.

Test en local avec les vraies fonctions (e-mails simulés, code affiché dans le terminal ; clé admin `admin-local`) : `npm install` puis `npm run dev`.

## Publier et installer sur le téléphone

1. **Netlify** (avec compte) : nouveau site relié au dépôt `CONSOLE-R` (la configuration est dans `netlify.toml`),
   puis les variables Brevo ci-dessus. Ou **GitHub Pages** (sans compte) : *Settings → Pages → Branch : `main`, `/ (root)`*.
2. Ouvrir l’adresse du site puis :
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
admin.html            console admin, page séparée (non liée à l'application)
css/app.css           thème clair/sombre, mise en page mobile
js/app.js             démarrage de webR, exécution, graphiques, onglets de scripts, historique, fichiers, paquets
sw.js                 service worker (hors ligne, cache de R et des paquets)
js/cloud.js           compte : code e-mail, sauvegarde et lecture de la progression
netlify/functions/    API : envoi du code, vérification, progression, compte, admin, relais de téléchargement
netlify/lib/          stockage (Netlify Blobs), e-mails Brevo
tests/serveur-local.mts  serveur de test local (npm run dev)
manifest.webmanifest  application installable
icons/                icônes
```
