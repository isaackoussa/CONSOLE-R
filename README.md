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
régulièrement une sauvegarde complète (.json).

## Compte et sauvegarde en ligne (e-mail)

Onglet **Fichiers → Compte** : on se connecte avec son e-mail (code reçu par e-mail, sans mot de passe). Scripts,
onglets ouverts, notes, historique et liste de paquets sont alors sauvegardés en ligne et synchronisés entre les
appareils, automatiquement (quelques secondes après chaque modification, à la fermeture et à la réouverture).
La fusion garde, pour chaque script et chaque entrée d’historique, la version la plus récente ; les suppressions suivent.

Mise en place (une fois, gratuit) avec [Supabase](https://supabase.com) :

1. Créer un compte puis un projet (*New project*).
2. **SQL Editor → New query** : coller le contenu de [`supabase.sql`](supabase.sql) puis *Run*.
3. **Authentication → URL Configuration** : *Site URL* = `https://isaackoussa.github.io/CONSOLE-R/`
   (et l’ajouter aussi dans *Redirect URLs*).
4. **Authentication → Emails → Magic Link** : pour recevoir un code à taper, ajouter `{{ .Token }}` dans le modèle
   (ex. « Votre code : {{ .Token }} »). Sans cela, l’e-mail contient seulement un lien de connexion, qui marche aussi.
5. **Project Settings → API** : copier *Project URL* et la clé *anon public* dans `js/config.js`.

La clé *anon* est faite pour être publique : la sécurité repose sur les règles de la table (chaque compte ne lit
que sa propre sauvegarde). Le service d’e-mail intégré de Supabase est limité à quelques e-mails par heure ;
pour plus, brancher un SMTP (Authentication → Emails → SMTP Settings).



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
js/sync.js            compte e-mail et sauvegarde en ligne (Supabase)
js/config.js          adresse et clé publique du projet Supabase
supabase.sql          table et règles d'accès à créer dans Supabase
sw.js                 service worker (hors ligne, cache de R et des paquets)
manifest.webmanifest  application installable
icons/                icônes
```
