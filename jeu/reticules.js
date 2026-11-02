// Réticules de visée (clic droit) : 12 pour les viseurs point rouge / holographiques (DS-7 Vecteur, Pulsar P-07)
// et 6 pour la lunette de l'Aiguille. Un seul catalogue sert au jeu (texture de la vitre, calque de la lunette)
// et aux vignettes du menu Paramètres.
import * as THREE from "three";

const lueur = (g, c, b) => { g.shadowColor = c; g.shadowBlur = b; };
const disque = (g, r) => { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); };
const cercle = (g, r) => { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };

// Viseurs holographiques : dessin centré sur (0, 0), environ 50 px de large
export const RETICULES_HOLO = [
  { id: "pointRouge", nom: "Point rouge", texte: "Le classique", couleur: "#ff3b3b", dessin: (g) => disque(g, 3.2) },
  { id: "cerclePoint", nom: "Cercle et point", texte: "Réticule d'origine", couleur: "#ff4650", dessin: (g) => { g.lineWidth = 2.4; cercle(g, 20); disque(g, 3); } },
  { id: "pointOr", nom: "Point d'or", texte: "Aux couleurs du jeu", couleur: "#ffcf5a", dessin: (g) => { disque(g, 3.4); g.lineWidth = 1.4; g.globalAlpha = 0.6; cercle(g, 9); } },
  { id: "chevron", nom: "Chevron", texte: "Pointe vers la cible", couleur: "#ff3b3b", dessin: (g) => { g.lineWidth = 2.6; g.lineJoin = "round"; g.beginPath(); g.moveTo(-10, 9); g.lineTo(0, -2); g.lineTo(10, 9); g.stroke(); g.fillRect(-1.2, -9, 2.4, 3); } },
  { id: "doubleCercle", nom: "Holo double cercle", texte: "Rapide de près", couleur: "#ff4fd8", dessin: (g) => { g.lineWidth = 2; cercle(g, 24); g.lineWidth = 1.2; g.globalAlpha = 0.7; cercle(g, 12); g.globalAlpha = 1; disque(g, 2.6); } },
  { id: "segments", nom: "Cercle segmenté", texte: "Quatre arcs et un point", couleur: "#ffcf5a", dessin: (g) => { g.lineWidth = 2.4; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(0, 0, 20, k * Math.PI / 2 + 0.25, k * Math.PI / 2 + Math.PI / 2 - 0.25); g.stroke(); } disque(g, 2.6); } },
  { id: "croixFine", nom: "Croix fine", texte: "Très précise", couleur: "#43ff6a", dessin: (g) => { g.fillRect(-14, -0.9, 10, 1.8); g.fillRect(4, -0.9, 10, 1.8); g.fillRect(-0.9, -14, 1.8, 10); g.fillRect(-0.9, 4, 1.8, 10); disque(g, 1.4); } },
  { id: "triangle", nom: "Triangle", texte: "Style futuriste", couleur: "#00ffd0", dessin: (g) => { g.lineWidth = 2; g.lineJoin = "round"; g.beginPath(); g.moveTo(0, -16); g.lineTo(14, 9); g.lineTo(-14, 9); g.closePath(); g.stroke(); disque(g, 2.2); } },
  { id: "crochets", nom: "Crochets", texte: "Cadre de visée", couleur: "#ffcf5a", dessin: (g) => { g.lineWidth = 2.2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 12, -14); g.lineTo(s * 18, -14); g.lineTo(s * 18, 14); g.lineTo(s * 12, 14); g.stroke(); } disque(g, 2.4); } },
  { id: "tactique", nom: "T tactique", texte: "Lecture de la chute", couleur: "#ff3b3b", dessin: (g) => { g.fillRect(-16, -1, 32, 2); g.fillRect(-1, -1, 2, 18); for (const y of [6, 11, 16]) g.fillRect(-4, y, 8, 1.4); } },
  { id: "losange", nom: "Losange", texte: "Bien visible", couleur: "#ff4fd8", dessin: (g) => { g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, -12); g.lineTo(12, 0); g.lineTo(0, 12); g.lineTo(-12, 0); g.closePath(); g.stroke(); disque(g, 2); } },
  { id: "etoile", nom: "Étoile Duo Strike", texte: "Hexagone doré", couleur: "#ffcf5a", dessin: (g) => {
    const hexa = (r) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    g.lineWidth = 2; hexa(16); g.stroke(); g.globalAlpha = 0.85; hexa(7); g.fill(); g.globalAlpha = 1; g.shadowBlur = 0; g.fillStyle = "#1a1208"; disque(g, 2.2);
  } },
];

// Lunettes : dessin centré, r = rayon du champ de la lunette (en pixels)
export const RETICULES_LUNETTE = [
  { id: "croixFine", nom: "Croix fine", texte: "Simple et nette", couleur: "#111111", dessin: (g, r, k) => { g.fillRect(-r, -0.8 * k, r * 2, 1.6 * k); g.fillRect(-0.8 * k, -r, 1.6 * k, r * 2); } },
  { id: "pointRouge", nom: "Point rouge lumineux", texte: "Croix ouverte et point éclairé", couleur: "#111111", dessin: (g, r, k) => {
    for (const s of [-1, 1]) { g.fillRect(s > 0 ? r * 0.2 : -r, -k, r * 0.8, 2 * k); g.fillRect(-k, s > 0 ? r * 0.2 : -r, 2 * k, r * 0.8); }
    g.fillStyle = "#ff3030"; lueur(g, "#ff3030", 8 * k); disque(g, 2.6 * k);
  } },
  { id: "duplex", nom: "Duplex", texte: "Épais au bord, fin au centre", couleur: "#111111", dessin: (g, r, k) => {
    g.fillRect(-r, -0.7 * k, r * 2, 1.4 * k); g.fillRect(-0.7 * k, -r, 1.4 * k, r * 2);
    for (const s of [-1, 1]) { g.fillRect(s > 0 ? r * 0.45 : -r, -2.5 * k, r * 0.55, 5 * k); g.fillRect(-2.5 * k, s > 0 ? r * 0.45 : -r, 5 * k, r * 0.55); }
  } },
  { id: "milDot", nom: "Mil-dot", texte: "Points de distance", couleur: "#111111", dessin: (g, r, k) => {
    g.fillRect(-r, -0.7 * k, r * 2, 1.4 * k); g.fillRect(-0.7 * k, -r, 1.4 * k, r * 2);
    const pas = r * 0.11;
    for (let i = -4; i <= 4; i++) if (i) { g.beginPath(); g.arc(i * pas, 0, 2 * k, 0, 7); g.fill(); g.beginPath(); g.arc(0, i * pas, 2 * k, 0, 7); g.fill(); }
  } },
  { id: "chevron", nom: "Chevron gradué", texte: "Pointe et chute de balle", couleur: "#111111", dessin: (g, r, k) => {
    g.fillRect(-r, -0.7 * k, r * 0.8, 1.4 * k); g.fillRect(r * 0.2, -0.7 * k, r * 0.8, 1.4 * k);
    g.lineWidth = 1.6 * k; g.beginPath(); g.moveTo(-7 * k, 7 * k); g.lineTo(0, 0); g.lineTo(7 * k, 7 * k); g.stroke();
    for (const y of [0.16, 0.28, 0.4]) g.fillRect(-6 * k, r * y, 12 * k, 1.4 * k);
    g.fillRect(-0.7 * k, 8 * k, 1.4 * k, r);
  } },
  { id: "or", nom: "Or illuminé", texte: "Réticule doré lumineux", couleur: "#ffcf5a", dessin: (g, r, k) => {
    lueur(g, "#ffcf5a", 6 * k);
    g.fillRect(-r, -0.8 * k, r * 0.85, 1.6 * k); g.fillRect(r * 0.15, -0.8 * k, r * 0.85, 1.6 * k); g.fillRect(-0.8 * k, r * 0.15, 1.6 * k, r * 0.85);
    g.lineWidth = 1.4 * k; cercle(g, 9 * k); disque(g, 1.6 * k);
  } },
];

export const reticuleHolo = (id) => RETICULES_HOLO.find((r) => r.id === id) || RETICULES_HOLO[1];
export const reticuleLunette = (id) => RETICULES_LUNETTE.find((r) => r.id === id) || RETICULES_LUNETTE[1];

// ----- Texture partagée par toutes les vitres de viseur (un changement de réglage la redessine) -----
let toileHolo = null, texHolo = null;
export function textureReticuleHolo() {
  if (!texHolo) {
    toileHolo = document.createElement("canvas");
    toileHolo.width = toileHolo.height = 128;
    texHolo = new THREE.CanvasTexture(toileHolo);
    texHolo.colorSpace = THREE.SRGBColorSpace;
    texHolo.userData.partage = true;
    dessinerHolo(toileHolo, reticuleHolo("cerclePoint"));
  }
  return texHolo;
}

function dessinerHolo(toile, def) {
  const g = toile.getContext("2d");
  const T = toile.width;
  g.save();
  g.clearRect(0, 0, T, T);
  g.translate(T / 2, T / 2);
  g.scale(T / 128, T / 128);
  g.fillStyle = g.strokeStyle = def.couleur;
  lueur(g, def.couleur, 6);
  def.dessin(g);
  g.restore();
}

export function choisirReticuleHolo(id) {
  textureReticuleHolo();
  dessinerHolo(toileHolo, reticuleHolo(id));
  texHolo.needsUpdate = true;
}

// ----- Lunette : réticule dessiné dans un canvas de la taille du champ de vision -----
export function dessinerLunette(toile, id) {
  const def = reticuleLunette(id);
  const T = toile.width;
  const g = toile.getContext("2d");
  g.clearRect(0, 0, T, T);
  g.save();
  g.translate(T / 2, T / 2);
  g.fillStyle = g.strokeStyle = def.couleur;
  def.dessin(g, T / 2, T / 500);
  g.restore();
}

// ----- Vignettes pour le menu Paramètres (petites images PNG mises en cache) -----
const cacheVignettes = new Map();
export function vignetteReticule(def, type) {
  const cle = type + def.id;
  if (cacheVignettes.has(cle)) return cacheVignettes.get(cle);
  const c = document.createElement("canvas");
  c.width = 96; c.height = 64;
  const g = c.getContext("2d");
  if (type === "holo") {
    const d = g.createLinearGradient(0, 0, 96, 64);
    d.addColorStop(0, "#5a5246"); d.addColorStop(1, "#2a2620");
    g.fillStyle = d; g.fillRect(0, 0, 96, 64);
    g.save(); g.translate(48, 32); g.scale(0.95, 0.95);
    g.fillStyle = g.strokeStyle = def.couleur; lueur(g, def.couleur, 5);
    def.dessin(g);
    g.restore();
  } else {
    g.fillStyle = "#050505"; g.fillRect(0, 0, 96, 64);
    g.save();
    g.beginPath(); g.arc(48, 32, 30, 0, Math.PI * 2); g.clip();
    const d = g.createRadialGradient(48, 32, 4, 48, 32, 30);
    d.addColorStop(0, "#b8ab92"); d.addColorStop(1, "#6e6452");
    g.fillStyle = d; g.fillRect(0, 0, 96, 64);
    g.translate(48, 32);
    g.fillStyle = g.strokeStyle = def.couleur;
    def.dessin(g, 30, 0.6);
    g.restore();
  }
  const url = c.toDataURL();
  cacheVignettes.set(cle, url);
  return url;
}
