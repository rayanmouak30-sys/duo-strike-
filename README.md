# DUO STRIKE

FPS tactique en 3D qui tourne dans le navigateur, créé par **Rayan** et **Clément**.

- `index.html` : page d'accueil (« JEU » au centre, lien vers le jeu)
- `jeu/` : le jeu (guide complet dans `jeu/GUIDE.md`)
  - `skins.js` : catalogue des skins (collections, raretés, ornements, tenues) ; `motifs.js` : motifs procéduraux et effets
- `comptes.php` : comptes des joueurs (stockés dans `donnees/`, jamais envoyé sur GitHub)
- `tests/jeu.test.cjs` : tests automatiques du jeu

## Tester sur son ordinateur

Avec PHP installé, dans ce dossier : `php -S localhost:8000` puis ouvrir http://localhost:8000/

Tests automatiques : `npm i -D playwright` une fois, puis `node tests/jeu.test.cjs`.

## Mise en ligne (AlwaysData, compte « jeu »)

Adresse du site : https://jeu.alwaysdata.net

Chaque envoi sur la branche `main` met le site en ligne automatiquement (`.github/workflows/deploiement.yml`).
Le mot de passe FTP est dans le secret GitHub `FTP_PASSWORD`.
