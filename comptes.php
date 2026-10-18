<?php
// Comptes des joueurs de Duo Strike, stockés en JSON dans donnees/ (dossier interdit d'accès web).

const DOSSIER_DONNEES = __DIR__ . "/donnees";

function preparerDossierDonnees(): void {
    if (!is_dir(DOSSIER_DONNEES)) { mkdir(DOSSIER_DONNEES, 0750, true); }
    $htaccess = DOSSIER_DONNEES . "/.htaccess";
    if (!is_file($htaccess)) { file_put_contents($htaccess, "Require all denied\n"); }
}

function lireDonnees(string $nom): array {
    $chemin = DOSSIER_DONNEES . "/" . $nom . ".json";
    if (!is_file($chemin)) { return []; }
    $donnees = json_decode((string) file_get_contents($chemin), true);
    return is_array($donnees) ? $donnees : [];
}

function ecrireDonnees(string $nom, array $donnees): void {
    preparerDossierDonnees();
    file_put_contents(
        DOSSIER_DONNEES . "/" . $nom . ".json",
        json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function nouvelId(): string {
    return bin2hex(random_bytes(8));
}

function utilisateurParId(string $id): ?array {
    foreach (lireDonnees("utilisateurs") as $u) {
        if ($u["id"] === $id) { return $u; }
    }
    return null;
}

function utilisateurConnecte(): ?array {
    if (empty($_SESSION["utilisateur_id"])) { return null; }
    return utilisateurParId($_SESSION["utilisateur_id"]);
}

function utilisateurParIdentifiant(string $identifiant): ?array {
    $identifiant = mb_strtolower(trim($identifiant));
    foreach (lireDonnees("utilisateurs") as $u) {
        if (mb_strtolower($u["pseudo"]) === $identifiant || mb_strtolower($u["email"]) === $identifiant) {
            return $u;
        }
    }
    return null;
}

function connecterUtilisateur(array $u): void {
    session_regenerate_id(true);
    $_SESSION["utilisateur_id"] = $u["id"];
}
