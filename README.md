# OVERCLASH

Site du jeu OVERCLASH, jeu de tir tactique en 3D qui tourne dans le navigateur, créé par **Rayan** et **Clément**.

## Organisation

| Dossier / fichier | Rôle |
|---|---|
| `index.html`, `style.css` | Page d'accueil (contenu et styles) |
| `site/principal.js` | Point d'entrée : lance l'interface, puis la scène 3D si WebGL est disponible |
| `site/scene.js` | Scène 3D (Three.js) traversée au défilement : Noyau, arches, socle des agents, portail |
| `site/interface.js` | Apparitions, cartes inclinables, choix des agents, classement, transition vers le jeu |
| `site/textures.js` | Textures générées au chargement (métal brossé, dalles, brume, halo) |
| `jeu/` | Le jeu lui-même (guide complet dans `jeu/GUIDE.md`) |
| `comptes.php` | Comptes des joueurs (stockés dans `donnees/`, jamais envoyé sur GitHub) |

Le site réutilise la copie de Three.js du jeu (`jeu/vendor/three`) ainsi que ses données et modèles 3D
(`jeu/heros.js`, `jeu/capacites.js`, `jeu/personnages.js`) : aucune dépendance supplémentaire.

Qualité adaptée à l'appareil (3 niveaux, abaissés automatiquement si les images ralentissent),
respect du réglage « réduire les animations », page complète sans WebGL.

## Tester sur son ordinateur

Avec PHP installé, dans ce dossier : `php -S localhost:8000` puis ouvrir http://localhost:8000/

## Mise en ligne (AlwaysData)

Chaque envoi sur la branche `main` met le site en ligne automatiquement (`.github/workflows/deploiement.yml`).
À faire une seule fois, dans GitHub → Settings → Secrets and variables → Actions → New repository secret :

| Secret | Valeur |
|---|---|
| `FTP_SERVER` | `ftp-NOMDUCOMPTE.alwaysdata.net` |
| `FTP_USERNAME` | nom d'utilisateur FTP AlwaysData |
| `FTP_PASSWORD` | mot de passe FTP AlwaysData |
| `SITE_URL` | `https://NOMDUCOMPTE.alwaysdata.net` |
