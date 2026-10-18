// Catalogue centralisé des skins (cosmétiques uniquement : aucun effet sur les dégâts, la précision ou la vitesse).
//   - RARETES : standard, rare, épique, légendaire
//   - COLLECTIONS : dix lignes artistiques
//   - SKINS_ARMES : appliqués aux modèles d'armes (vue à la première personne, armurerie)
//   - SKINS_AGENTS : tenues des personnages (vitrine, partie, bots)
// Les matériaux sont construits une fois par skin et par qualité, puis réutilisés par toutes les armes :
// les géométries ne sont jamais dupliquées pour un skin.
import * as THREE from "three";
import { textureMotif, appliquerMotif, animerMotifs } from "./motifs.js";

export const RARETES = {
  standard: { id: "standard", nom: "Standard", couleur: "#a9b2c0", rang: 0 },
  rare: { id: "rare", nom: "Rare", couleur: "#4fa3ff", rang: 1 },
  epique: { id: "epique", nom: "Épique", couleur: "#b56bff", rang: 2 },
  legendaire: { id: "legendaire", nom: "Légendaire", couleur: "#ffb547", rang: 3 },
};

export const COLLECTIONS = {
  usine: { nom: "Industriel militaire", texte: "Matériel de dotation : peintures de chantier, carbone, camouflages." },
  neoncyber: { nom: "Néon Cyber", texte: "Les nuits de Bas-Néon : pistes de circuits et grilles qui pulsent." },
  obsidienne: { nom: "Obsidienne", texte: "Verre volcanique poli, veines de magma refroidi." },
  prototype: { nom: "Technologie expérimentale", texte: "Composites blancs des laboratoires Halcyon, relevés topographiques." },
  plasma: { nom: "Énergie plasma", texte: "Énergie contenue sous la coque, qui circule le long de l'arme." },
  cristal: { nom: "Cristal", texte: "Facettes taillées, reflets prismatiques." },
  royale: { nom: "Édition royale", texte: "Ivoire, acier damassé, filigrane d'or et rubis." },
  holo: { nom: "Technologie holographique", texte: "Surfaces irisées dont la couleur change selon l'angle de vue." },
  futuriste: { nom: "Univers futuriste", texte: "Cartographies orbitales et nébuleuses lointaines." },
  legende: { nom: "Collection légendaire « Tempête »", texte: "Deux pièces uniques : la foudre et le dragon." },
};

// ---------------------------------------------------------------------------
// Skins d'armes
// couleurs [A, B, C] : fond, zones du motif (R), détails (G) — rugosite / metal : idem
// coque : couleurs des coques peintes (Pulsar) si différentes ; acier : teinte des pièces d'acier
// traceur : couleur cosmétique des traçantes et du flash (lisible, jamais plus discrète que l'original)
// ---------------------------------------------------------------------------
const S = (o) => o;
export const SKINS_ARMES = {
  standard: S({ nom: "Standard", collection: "usine", rarete: "standard", niveau: 1, texte: "Anodisation gris acier, légère usure de service.",
    motif: "usure", graine: 3, echelle: 7, couleurs: [0x343a44, 0x2b3038, 0x5a6270], polymere: 0x1d2026, rugosite: [0.55, 0.62, 0.42], metal: [0.75, 0.7, 0.9], usure: 0.25,
    coque: [0xb9bfc7, 0xa7adb6, 0x2a5bd0], accent: 0x7cffd4, lumiere: 0x45f0ff }),
  atelier: S({ nom: "Atelier", collection: "usine", rarete: "standard", niveau: 1, texte: "Vert de dotation et bandes de danger au pochoir.",
    motif: "rayures", graine: 4, echelle: 6, couleurs: [0x48502f, 0xd9a521, 0x15161a], polymere: 0x24261d, rugosite: [0.72, 0.6, 0.5], metal: [0.2, 0.25, 0.6], usure: 0.4,
    accent: 0xd9a521, lumiere: 0xffc23a }),
  carbone: S({ nom: "Carbone", collection: "usine", rarete: "rare", niveau: 3, texte: "Fibre de carbone tissée sergé, vernis épais.",
    motif: "carbone", graine: 5, echelle: 5, couleurs: [0x111215, 0x2d3038, 0x9aa1ab], polymere: 0x0f1012, rugosite: [0.3, 0.22, 0.3], metal: [0.25, 0.35, 0.9], usure: 0.1, vernis: 1,
    accent: 0xe8e8f0, lumiere: 0xe8e8f0 }),
  arctique: S({ nom: "Arctique", collection: "usine", rarete: "rare", niveau: 4, texte: "Camouflage numérique pour les théâtres enneigés.",
    motif: "camo", graine: 6, echelle: 4, couleurs: [0xdfe4ea, 0x8fa3b5, 0x4f5d6c], polymere: 0x5c6c80, rugosite: [0.62, 0.6, 0.58], metal: [0.1, 0.1, 0.1], usure: 0.2,
    accent: 0x9fe0ff, lumiere: 0x9fe0ff }),
  toxique: S({ nom: "Toxique", collection: "usine", rarete: "epique", niveau: 7, texte: "Coque craquelée d'où suinte une lueur chimique.",
    motif: "fissures", graine: 7, echelle: 5, couleurs: [0x1d2418, 0x3c5a22, 0x0d0f0b], polymere: 0x141a10, rugosite: [0.5, 0.45, 0.6], metal: [0.3, 0.4, 0.2], usure: 0.3,
    lueur: 0x9cff3a, animation: "pulsation", vitesse: 2.2, intensite: 2.2, accent: 0x9cff3a, lumiere: 0x9cff3a }),
  grille: S({ nom: "Grille", collection: "neoncyber", rarete: "rare", niveau: 2, texte: "Nid d'abeille violet, quelques alvéoles sous tension.",
    motif: "hexagones", graine: 8, echelle: 6, couleurs: [0x15121f, 0x2a2140, 0x8a5cff], polymere: 0x100e16, rugosite: [0.4, 0.35, 0.25], metal: [0.6, 0.5, 0.9], usure: 0.1,
    lueur: 0xff3fd4, animation: "pulsation", vitesse: 1.5, intensite: 1.4, accent: 0xff3fd4, lumiere: 0xff3fd4 }),
  neon: S({ nom: "Néon", collection: "neoncyber", rarete: "epique", niveau: 6, texte: "Circuit imprimé dont l'énergie remonte vers la bouche du canon.",
    motif: "circuits", graine: 9, echelle: 5, couleurs: [0x0c0d14, 0x181a26, 0x2a8f9a], polymere: 0x0a0b10, rugosite: [0.35, 0.4, 0.3], metal: [0.5, 0.4, 0.9], usure: 0.1,
    lueur: 0x2ff3ff, animation: "flux", vitesse: 3, frequence: 18, intensite: 2.5, accent: 0xff3fd4, lumiere: 0x2ff3ff, flash: 0x9ffcff }),
  eclipse: S({ nom: "Éclipse", collection: "obsidienne", rarete: "rare", niveau: 3, texte: "Alvéoles de verre noir poli, reflets profonds.",
    motif: "hexagones", graine: 10, echelle: 7, couleurs: [0x0b0b0d, 0x18181c, 0x3a3a40], polymere: 0x09090a, rugosite: [0.12, 0.18, 0.3], metal: [0.6, 0.7, 0.9], usure: 0.05, vernis: 1,
    accent: 0xc9c9d2, lumiere: 0xd9d9e6 }),
  obsidienne: S({ nom: "Obsidienne", collection: "obsidienne", rarete: "epique", niveau: 8, texte: "Verre volcanique et veines de magma qui respirent lentement.",
    motif: "fissures", graine: 11, echelle: 4, couleurs: [0x070708, 0x141416, 0x6b5428], polymere: 0x070708, rugosite: [0.08, 0.12, 0.25], metal: [0.2, 0.3, 1], usure: 0.05, vernis: 1,
    lueur: 0xffa13a, animation: "pulsation", vitesse: 0.8, intensite: 1.4, accent: 0xffa13a, lumiere: 0xffb14a }),
  laboratoire: S({ nom: "Laboratoire", collection: "prototype", rarete: "standard", niveau: 1, texte: "Composite blanc, repères orange d'essai.",
    motif: "usure", graine: 12, echelle: 6, couleurs: [0xd9dcdf, 0xc1c5ca, 0xf26a1b], polymere: 0x2b2d31, rugosite: [0.45, 0.5, 0.4], metal: [0.05, 0.08, 0.3], usure: 0.2,
    coque: [0xe2e4e6, 0xc9ccd0, 0xf26a1b], accent: 0xf26a1b, lumiere: 0xff8a3a }),
  prototype: S({ nom: "Prototype", collection: "prototype", rarete: "rare", niveau: 5, texte: "Relevés topographiques gravés, lignes de test lumineuses.",
    motif: "lignes", graine: 13, echelle: 4, couleurs: [0xe8e9ea, 0xcfd2d6, 0xff6a13], polymere: 0x222326, rugosite: [0.42, 0.48, 0.35], metal: [0.05, 0.08, 0.4], usure: 0.15,
    lueur: 0xff6a13, animation: "pulsation", vitesse: 2.5, intensite: 0.9, accent: 0xff6a13, lumiere: 0xff6a13 }),
  braise: S({ nom: "Braise", collection: "plasma", rarete: "epique", niveau: 6, texte: "Coque calcinée : la chaleur coule dans les fissures.",
    motif: "fissures", graine: 14, echelle: 5, couleurs: [0x1b100d, 0x3a1c16, 0x0a0706], polymere: 0x1e1212, rugosite: [0.6, 0.55, 0.7], metal: [0.4, 0.5, 0.2], usure: 0.3,
    lueur: 0xff6a1f, animation: "flux", vitesse: 1.2, frequence: 6, intensite: 2.6, accent: 0xffa040, lumiere: 0xffa040, flash: 0xffb070 }),
  plasma: S({ nom: "Cœur de plasma", collection: "plasma", rarete: "legendaire", niveau: 12, texte: "Le plasma circule sous la coque et s'enroule dans trois bobines de confinement.",
    motif: "lignes", graine: 15, echelle: 5, couleurs: [0x120a1f, 0x2b0f3d, 0xb04dff], polymere: 0x0d0814, rugosite: [0.3, 0.3, 0.2], metal: [0.6, 0.5, 0.9], usure: 0.05, vernis: 0.6,
    lueur: 0xff4dd2, animation: "flux", vitesse: 2.4, frequence: 12, intensite: 3, accent: 0xff4dd2, lumiere: 0xff4dd2,
    ornement: "bobines", traceur: 0xff5ae0, flash: 0xff8af0, inspection: "virtuose" }),
  givre: S({ nom: "Givre", collection: "cristal", rarete: "rare", niveau: 4, texte: "Glace taillée en facettes, éclats qui scintillent.",
    motif: "facettes", graine: 16, echelle: 5, couleurs: [0xbfd9ea, 0x8fb3cc, 0xffffff], polymere: 0x5f7486, rugosite: [0.12, 0.18, 0.05], metal: [0.2, 0.3, 0.6], usure: 0.05, vernis: 1, iridescence: 0.35,
    lueur: 0xd9f4ff, animation: "scintillement", vitesse: 3, intensite: 0.9, accent: 0xbfefff, lumiere: 0xbfefff }),
  prisme: S({ nom: "Prisme", collection: "cristal", rarete: "legendaire", niveau: 13, texte: "Cristal prismatique : la lumière se décompose sur chaque facette.",
    motif: "facettes", graine: 17, echelle: 4, couleurs: [0xd9d2f0, 0x9f8fd4, 0xffffff], polymere: 0x2a2440, rugosite: [0.06, 0.1, 0.04], metal: [0.1, 0.2, 0.6], usure: 0.02, vernis: 1, iridescence: 1,
    animation: "irisation", vitesse: 1, frequence: 1.2, intensite: 0.55, accent: 0xe6d9ff, lumiere: 0xe6d9ff,
    ornement: "cristaux", traceur: 0xe6d9ff, flash: 0xf2ecff, inspection: "virtuose" }),
  ivoire: S({ nom: "Ivoire", collection: "royale", rarete: "epique", niveau: 9, texte: "Plaques d'ivoire et acier damassé aux reflets d'or.",
    motif: "damas", graine: 18, echelle: 6, couleurs: [0xece4d2, 0xc9bda3, 0xc9a24a], polymere: 0x3a2a1c, rugosite: [0.35, 0.3, 0.2], metal: [0.1, 0.3, 1], usure: 0.1, vernis: 0.6,
    acier: 0xd8b25a, accent: 0xffe08a, lumiere: 0xffe08a }),
  or: S({ nom: "Or royal", collection: "royale", rarete: "legendaire", niveau: 15, texte: "Filigrane gravé à l'or fin, rubis sertis, couronne de bouche.",
    motif: "filigrane", graine: 19, echelle: 5, couleurs: [0xf1ead8, 0xe2d3ae, 0xd4a83c], polymere: 0x4a1c1c, rugosite: [0.3, 0.3, 0.16], metal: [0.05, 0.2, 1], usure: 0.05, vernis: 0.8,
    lueur: 0xff3048, animation: "pulsation", vitesse: 1.2, intensite: 1.6, acier: 0xd8b25a, accent: 0xffe08a, lumiere: 0xffe08a,
    ornement: "joyaux", traceur: 0xffd27a, flash: 0xffe2a0, inspection: "virtuose" }),
  spectre: S({ nom: "Spectre", collection: "holo", rarete: "epique", niveau: 10, texte: "Lignes de relevé irisées qui changent avec l'angle.",
    motif: "lignes", graine: 20, echelle: 5, couleurs: [0x1a1d24, 0x262b35, 0xaab4c8], polymere: 0x14161b, rugosite: [0.25, 0.3, 0.2], metal: [0.6, 0.6, 0.9], usure: 0.05,
    animation: "irisation", vitesse: 1, frequence: 0.6, intensite: 0.45, accent: 0xc8f0ff, lumiere: 0xc8f0ff }),
  hologramme: S({ nom: "Hologramme", collection: "holo", rarete: "legendaire", niveau: 14, texte: "Surface entièrement irisée, anneaux holographiques en rotation autour du canon.",
    motif: "hexagones", graine: 21, echelle: 6, couleurs: [0x0e1016, 0x1a1f2a, 0xdfe8ff], polymere: 0x0b0c10, rugosite: [0.15, 0.2, 0.1], metal: [0.7, 0.7, 1], usure: 0.02, iridescence: 1,
    animation: "irisation", vitesse: 1.6, frequence: 1.5, intensite: 0.6, accent: 0xa0fff0, lumiere: 0xa0fff0,
    ornement: "anneauxHolo", traceur: 0xa0fff0, flash: 0xd0fff8, inspection: "virtuose" }),
  orbite: S({ nom: "Orbite", collection: "futuriste", rarete: "rare", niveau: 5, texte: "Cartographie orbitale gravée sur une coque mate.",
    motif: "lignes", graine: 22, echelle: 3, couleurs: [0x1c1f2b, 0x2a3042, 0xc7cbd6], polymere: 0x141720, rugosite: [0.6, 0.55, 0.3], metal: [0.3, 0.3, 0.9], usure: 0.1,
    lueur: 0xffffff, animation: "pulsation", vitesse: 0.6, intensite: 0.5, accent: 0xdfe6ff, lumiere: 0xdfe6ff }),
  nebuleuse: S({ nom: "Nébuleuse", collection: "futuriste", rarete: "epique", niveau: 11, texte: "Un ciel profond pris dans la coque, étoiles scintillantes.",
    motif: "nebuleuse", graine: 23, echelle: 2.5, couleurs: [0x0a0814, 0x3b1a5c, 0x2a6fb0], polymere: 0x07060d, rugosite: [0.3, 0.25, 0.2], metal: [0.3, 0.3, 0.4], usure: 0.02, vernis: 1,
    lueur: 0xffffff, animation: "scintillement", vitesse: 2, intensite: 2, accent: 0xb48cff, lumiere: 0xb48cff }),
  tempete: S({ nom: "Tempête", collection: "legende", rarete: "legendaire", niveau: 16, texte: "La foudre court sur la coque ; un arc électrique relie les deux paratonnerres.",
    motif: "eclairs", graine: 24, echelle: 3, couleurs: [0x14161c, 0x2b3140, 0x8fd0ff], polymere: 0x0e1014, rugosite: [0.4, 0.35, 0.2], metal: [0.6, 0.5, 0.9], usure: 0.1,
    lueur: 0xbfe6ff, animation: "scintillement", vitesse: 6, intensite: 3.2, accent: 0xbfe6ff, lumiere: 0xbfe6ff,
    ornement: "paratonnerres", traceur: 0xbfe6ff, flash: 0xe6f6ff, inspection: "virtuose" }),
  dragon: S({ nom: "Dragon", collection: "legende", rarete: "legendaire", niveau: 18, texte: "Écailles laquées rouge et or, crête dorsale, œil de braise.",
    motif: "ecailles", graine: 25, echelle: 6, couleurs: [0x3a0c0c, 0x7a1a14, 0xd4a83c], polymere: 0x1a0807, rugosite: [0.35, 0.3, 0.2], metal: [0.4, 0.5, 1], usure: 0.05, vernis: 0.8,
    lueur: 0xff6a1f, animation: "flux", vitesse: 1.5, frequence: 8, intensite: 2, acier: 0xd4a83c, accent: 0xff7a2a, lumiere: 0xff7a2a,
    ornement: "aileron", traceur: 0xff7a2a, flash: 0xffa060, inspection: "virtuose" }),
};
for (const [id, s] of Object.entries(SKINS_ARMES)) s.id = id;

export const skinArme = (id) => SKINS_ARMES[id] || SKINS_ARMES.standard;
export const skinDebloque = (s, niveau) => !!s && niveau >= (s.niveau || 1);

// ---------------------------------------------------------------------------
// Matériaux d'arme
// ---------------------------------------------------------------------------
const cacheArmes = new Map();

function physique(base) {
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.5, ...base });
}

function peinture(s, qualite, couleurs, extra = {}) {
  const m = physique({ clearcoat: s.vernis || 0, clearcoatRoughness: 0.15, iridescence: s.iridescence || 0, iridescenceIOR: 1.5, emissive: 0x000000 });
  return appliquerMotif(m, {
    texture: textureMotif(s.motif, s.graine, qualite),
    echelle: (s.echelle || 6) * (extra.echelle || 1),
    couleurs,
    rugosite: extra.rugosite || s.rugosite,
    metal: extra.metal || s.metal,
    usure: s.usure,
    lueur: s.lueur || 0,
    animation: s.animation || "aucune",
    vitesse: s.vitesse, frequence: s.frequence,
    intensite: (s.intensite ?? 1) * (extra.lueur ?? 1),
  });
}

const eclaircir = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// Jeu de matériaux d'une arme pour un skin (clés attendues par les modèles d'armes.js)
export function materiauxSkinArme(qualite, skinId, communs) {
  const cle = qualite + "|" + skinId;
  if (cacheArmes.has(cle)) return cacheArmes.get(cle);
  const s = skinArme(skinId);
  const [A, B, C] = s.couleurs;
  const coque = s.coque || [eclaircir(A, 1.15), B, C];
  const m = {
    ...communs,
    carcasse: peinture(s, qualite, [A, B, C]),
    carcasseClaire: peinture(s, qualite, [B, A, C], { echelle: 1.3 }),
    coque: peinture(s, qualite, coque),
    coqueGrise: peinture(s, qualite, [eclaircir(A, 0.8), eclaircir(B, 0.8), C], { lueur: 0.6 }),
    plaque: peinture(s, qualite, [B, eclaircir(B, 1.2), C], { echelle: 1.6 }),
    polymere: peinture(s, qualite, [s.polymere, eclaircir(s.polymere, 1.35), eclaircir(C, 0.6)], { echelle: 1.8, rugosite: [0.82, 0.78, 0.6], metal: [0.02, 0.05, 0.4], lueur: 0.4 }),
    accent: new THREE.MeshStandardMaterial({ color: s.accent, emissive: s.accent, emissiveIntensity: s.rarete === "standard" ? 0.7 : 1.4, roughness: 0.4 }),
    lumiere: new THREE.MeshStandardMaterial({ color: s.lumiere, emissive: s.lumiere, emissiveIntensity: 1.4, roughness: 0.3 }),
  };
  if (s.acier) {
    m.acier = new THREE.MeshStandardMaterial({ color: s.acier, roughness: 0.22, metalness: 1 });
    m.lame = peinture(s, qualite, [eclaircir(s.acier, 1.1), s.acier, C], { echelle: 1.4, rugosite: [0.18, 0.22, 0.12], metal: [1, 1, 1] });
  } else if (s.rarete !== "standard") {
    m.lame = peinture(s, qualite, [0xc8ced8, eclaircir(B, 1.4), C], { echelle: 1.4, rugosite: [0.16, 0.25, 0.2], metal: [1, 0.9, 1] });
  }
  cacheArmes.set(cle, m);
  return m;
}

// ---------------------------------------------------------------------------
// Ornements des skins légendaires (pièces ajoutées, sans toucher à la silhouette de l'arme)
// ---------------------------------------------------------------------------
const animes = new Set();   // ornements animés : { maj(t) }

function matLueur(couleur, intensite = 2) {
  return new THREE.MeshStandardMaterial({ color: couleur, emissive: couleur, emissiveIntensity: intensite, roughness: 0.35 });
}

const ORNEMENTS = {
  // Trois bobines de confinement autour du canon, qui s'allument en vague, et un conduit sur le flanc
  bobines(g, s, b, bouche) {
    const r = THREE.MathUtils.clamp(b.h * 0.1, 0.011, 0.02);
    const mats = [];
    for (let i = 0; i < 3; i++) {
      const mat = matLueur(s.lueur, 2);
      mats.push(mat);
      const anneau = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 8, 24), mat);
      anneau.position.set(bouche.x, bouche.y, bouche.z - 0.012 - i * 0.022);
      g.add(anneau);
      const support = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.06, 6, 24), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 1, roughness: 0.3 }));
      support.position.copy(anneau.position);
      g.add(support);
    }
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, b.l * 0.45, 8).rotateX(Math.PI / 2), matLueur(s.lueur, 2.4));
    const zc = b.centre.z - b.l * 0.1, yc = b.centre.y + b.h * 0.05;
    conduit.position.set(b.cote(1, yc, zc) + 0.004, yc, zc);
    g.add(conduit);
    animes.add({ maj: (t) => mats.forEach((m, i) => { m.emissiveIntensity = 1.2 + 2.2 * Math.pow(0.5 + 0.5 * Math.sin(t * 5 - i * 1.4), 2); }) });
  },
  // Éclats de cristal posés sur le dessus de l'arme
  cristaux(g, s, b) {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xf0eaff, roughness: 0.05, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, emissive: 0x6a5aa0, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
    const tailles = [0.028, 0.04, 0.024];
    tailles.forEach((t, i) => {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(t, 0), mat);
      c.scale.set(0.55, 1.6, 0.55);
      const z = b.centre.z + b.l * 0.12 + (i - 1) * 0.04, x = b.centre.x + (i - 1) * 0.006;
      c.position.set(x, b.dessus(x, z) + t * 1.1, z);
      c.rotation.set(-0.35 + i * 0.25, i * 0.7, (i - 1) * 0.3);
      g.add(c);
    });
  },
  // Rubis sertis dans une monture d'or et couronne de bouche
  joyaux(g, s, b, bouche) {
    const or = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 1, roughness: 0.2 });
    const rubis = new THREE.MeshPhysicalMaterial({ color: 0xc0102a, roughness: 0.05, metalness: 0, clearcoat: 1, emissive: 0xff2040, emissiveIntensity: 0.6 });
    for (const sx of [-1, 1]) {
      const monture = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 16), or);
      monture.rotation.y = Math.PI / 2;
      const zj = b.centre.z + b.l * 0.05, yj = b.centre.y + b.h * 0.08;
      monture.position.set(b.cote(sx, yj, zj) + sx * 0.002, yj, zj);
      const pierre = new THREE.Mesh(new THREE.OctahedronGeometry(0.01, 0), rubis);
      pierre.scale.set(0.6, 1, 1);
      pierre.position.copy(monture.position);
      g.add(monture, pierre);
    }
    const r = THREE.MathUtils.clamp(b.h * 0.07, 0.008, 0.013);
    const couronne = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.22, 6, 20), or);
    couronne.position.copy(bouche).add(new THREE.Vector3(0, 0, 0.012));
    g.add(couronne);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pointe = new THREE.Mesh(new THREE.ConeGeometry(r * 0.18, r * 0.6, 5).rotateX(-Math.PI / 2), or);
      pointe.position.set(bouche.x + Math.cos(a) * r, bouche.y + Math.sin(a) * r, bouche.z - r * 0.15);
      g.add(pointe);
    }
    animes.add({ maj: (t) => { rubis.emissiveIntensity = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.2)); } });
  },
  // Deux anneaux holographiques en rotation autour du canon
  anneauxHolo(g, s, b, bouche) {
    const r = THREE.MathUtils.clamp(b.h * 0.14, 0.016, 0.03);
    const anneaux = [];
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: i ? 0xa0fff0 : 0xffa0f0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const a = new THREE.Mesh(new THREE.RingGeometry(r * (1 + i * 0.25), r * (1.08 + i * 0.25), 40, 1, 0, Math.PI * 1.6), mat);
      a.position.set(bouche.x, bouche.y, bouche.z + 0.03 + i * 0.03);
      g.add(a);
      anneaux.push(a);
    }
    animes.add({ maj: (t) => { anneaux[0].rotation.z = t * 1.6; anneaux[1].rotation.z = -t * 1.1; } });
  },
  // Paratonnerres et arc électrique qui se redessine en permanence
  paratonnerres(g, s, b) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a93a3, metalness: 1, roughness: 0.25 });
    const boule = matLueur(s.lueur, 2.5);
    const sommets = [];
    for (const k of [-0.3, 0.2]) {
      const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0035, 0.04, 6), metal);
      const z = b.centre.z + b.l * k;
      const y0 = b.dessus(b.centre.x, z);
      tige.position.set(b.centre.x, y0 + 0.018, z);
      const tete = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), boule);
      tete.position.set(b.centre.x, y0 + 0.04, z);
      g.add(tige, tete);
      sommets.push(tete.position.clone());
    }
    const n = 9;
    const pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const arc = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, toneMapped: false }));
    arc.frustumCulled = false;
    g.add(arc);
    let prochain = 0;
    animes.add({ maj: (t) => {
      if (t < prochain) return;
      prochain = t + 0.06 + Math.random() * 0.08;
      arc.visible = Math.random() > 0.25;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const bosse = Math.sin(k * Math.PI) * 0.012;
        pos[i * 3] = sommets[0].x + (i && i < n - 1 ? (Math.random() - 0.5) * 0.012 : 0);
        pos[i * 3 + 1] = sommets[0].y + bosse + (i && i < n - 1 ? (Math.random() - 0.5) * 0.01 : 0);
        pos[i * 3 + 2] = sommets[0].z + (sommets[1].z - sommets[0].z) * k;
      }
      geo.attributes.position.needsUpdate = true;
    } });
  },
  // Crête dorsale et œil de braise
  aileron(g, s, b) {
    const or = new THREE.MeshStandardMaterial({ color: 0xd4a83c, metalness: 1, roughness: 0.25 });
    for (let i = 0; i < 5; i++) {
      const h = 0.022 - Math.abs(i - 2) * 0.004;
      const pique = new THREE.Mesh(new THREE.ConeGeometry(0.006, h, 4), or);
      const z = b.centre.z + b.l * 0.08 + i * 0.03;
      pique.position.set(b.centre.x, b.dessus(b.centre.x, z) + h * 0.35, z);
      pique.rotation.x = 0.55;
      g.add(pique);
    }
    const oeil = matLueur(0xff6a1f, 2.2);
    for (const sx of [-1, 1]) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), oeil);
      o.scale.set(0.5, 0.6, 1.4);
      const zo = b.centre.z - b.l * 0.12, yo = b.centre.y;
      o.position.set(b.cote(sx, yo, zo) + sx * 0.001, yo, zo);
      g.add(o);
    }
    animes.add({ maj: (t) => { oeil.emissiveIntensity = 1.5 + Math.max(0, Math.sin(t * 0.9)) * 2; } });
  },
};

// Ajoute les ornements d'un skin à un modèle d'arme (groupe déjà construit, repère de l'arme).
export function ornerArme(groupe, skinId, points) {
  const s = skinArme(skinId);
  if (!s.ornement || !ORNEMENTS[s.ornement]) return null;
  groupe.updateMatrixWorld(true);
  const boite = new THREE.Box3();
  // Boîte calculée dans le repère du groupe (indépendante de sa position à l'écran)
  const inverse = new THREE.Matrix4().copy(groupe.matrixWorld).invert();
  groupe.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    boite.union(bb);
  });
  const taille = boite.getSize(new THREE.Vector3());
  const b = { min: boite.min, max: boite.max, centre: boite.getCenter(new THREE.Vector3()), l: taille.z, h: taille.y };
  // Les ornements sont posés sur la surface réelle du modèle (rayons dans le repère du groupe)
  const maillages = [];
  groupe.traverse((o) => { if (o.isMesh && o.visible && !(o.material && o.material.transparent)) maillages.push(o); });
  const rayon = new THREE.Raycaster();
  const toucher = (origine, direction) => {
    rayon.set(origine.applyMatrix4(groupe.matrixWorld), direction.transformDirection(groupe.matrixWorld));
    const h = rayon.intersectObjects(maillages, false)[0];
    return h ? h.point.applyMatrix4(inverse) : null;
  };
  b.dessus = (x, z) => { const p = toucher(new THREE.Vector3(x, b.max.y + 0.2, z), new THREE.Vector3(0, -1, 0)); return p ? p.y : b.max.y; };
  b.cote = (sens, y, z) => { const p = toucher(new THREE.Vector3(sens > 0 ? b.max.x + 0.2 : b.min.x - 0.2, y, z), new THREE.Vector3(-sens, 0, 0)); return p ? p.x : (sens > 0 ? b.max.x : b.min.x); };
  const bouche = points && points.bouche ? points.bouche.clone() : new THREE.Vector3(b.centre.x, b.centre.y, b.min.z);
  const g = new THREE.Group();
  g.name = "ornement";
  ORNEMENTS[s.ornement](g, s, b, bouche);
  groupe.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// Tenues des personnages
// couleurs : remplacent la palette du personnage (armure, tissu, secondaire, accent) ;
// motif : appliqué à l'armure et aux pièces secondaires (qualités Moyenne et Haute).
// Les bandes d'équipe (bleu / rouge) ne sont jamais modifiées : la lisibilité est conservée.
// ---------------------------------------------------------------------------
export const SKINS_AGENTS = {
  origine: { nom: "Tenue d'origine", collection: "usine", rarete: "standard", niveau: 1, texte: "La tenue de terrain du personnage." },
  atelier: { nom: "Dotation", collection: "usine", rarete: "standard", niveau: 1, texte: "Tenue de dotation olive, bandes de danger sur les protections.",
    couleurs: { armure: 0x4a5236, tissu: 0x2f3324, secondaire: 0x6b6040, accent: 0xd9a521 },
    motif: "rayures", graine: 31, echelle: 2.5, palette: [0x4a5236, 0xd9a521, 0x15161a], rugosite: [0.72, 0.6, 0.5], metal: [0.15, 0.2, 0.5], usure: 0.35 },
  givre: { nom: "Givre", collection: "cristal", rarete: "rare", niveau: 4, texte: "Plaques de glace facettées, tissus blanc cassé.",
    couleurs: { armure: 0xbfd9ea, tissu: 0xd9dee4, secondaire: 0x8fb3cc, accent: 0xbfefff },
    motif: "facettes", graine: 32, echelle: 2, palette: [0xbfd9ea, 0x8fb3cc, 0xffffff], rugosite: [0.15, 0.2, 0.08], metal: [0.2, 0.3, 0.6], usure: 0.05, vernis: 1, iridescence: 0.4,
    lueur: 0xd9f4ff, animation: "scintillement", vitesse: 3, intensite: 0.8 },
  obsidienne: { nom: "Obsidienne", collection: "obsidienne", rarete: "epique", niveau: 8, texte: "Armure de verre volcanique, veines de magma.",
    couleurs: { armure: 0x0b0b0d, tissu: 0x1a1a1d, secondaire: 0x26221c, accent: 0xffa13a },
    motif: "fissures", graine: 33, echelle: 1.8, palette: [0x0a0a0c, 0x18181b, 0x6b5428], rugosite: [0.1, 0.14, 0.25], metal: [0.2, 0.3, 1], usure: 0.05, vernis: 1,
    lueur: 0xffa13a, animation: "pulsation", vitesse: 0.8, intensite: 1.6 },
  neon: { nom: "Néon Cyber", collection: "neoncyber", rarete: "epique", niveau: 6, texte: "Circuits lumineux sur fond noir, énergie qui remonte le long du corps.",
    couleurs: { armure: 0x111219, tissu: 0x15161d, secondaire: 0x1f2130, accent: 0x2ff3ff },
    motif: "circuits", graine: 34, echelle: 2.2, palette: [0x0c0d14, 0x1a1c28, 0x2a8f9a], rugosite: [0.35, 0.4, 0.3], metal: [0.4, 0.4, 0.9], usure: 0.05,
    lueur: 0x2ff3ff, animation: "flux", vitesse: 2.4, frequence: 8, intensite: 2 },
  royale: { nom: "Garde royale", collection: "royale", rarete: "legendaire", niveau: 15, texte: "Plastron d'ivoire au filigrane d'or, tissus pourpres, rubis sertis.",
    couleurs: { armure: 0xf1ead8, tissu: 0x5a1418, secondaire: 0xd4a83c, accent: 0xff3048 },
    motif: "filigrane", graine: 35, echelle: 2.4, palette: [0xf1ead8, 0xe2d3ae, 0xd4a83c], rugosite: [0.3, 0.3, 0.16], metal: [0.05, 0.2, 1], usure: 0.05, vernis: 0.8,
    lueur: 0xff3048, animation: "pulsation", vitesse: 1.2, intensite: 1.4 },
  hologramme: { nom: "Hologramme", collection: "holo", rarete: "legendaire", niveau: 14, texte: "Armure irisée qui change de couleur selon l'angle de vue.",
    couleurs: { armure: 0x1a1f2a, tissu: 0x111319, secondaire: 0x262b35, accent: 0xa0fff0 },
    motif: "hexagones", graine: 36, echelle: 2.6, palette: [0x0e1016, 0x1a1f2a, 0xdfe8ff], rugosite: [0.15, 0.2, 0.1], metal: [0.7, 0.7, 1], usure: 0.02, iridescence: 1,
    animation: "irisation", vitesse: 1.6, frequence: 1.2, intensite: 0.7 },
  dragon: { nom: "Dragon", collection: "legende", rarete: "legendaire", niveau: 18, texte: "Écailles laquées rouge et or, lueur de braise entre les plaques.",
    couleurs: { armure: 0x7a1a14, tissu: 0x2a0b0a, secondaire: 0xd4a83c, accent: 0xff7a2a },
    motif: "ecailles", graine: 37, echelle: 2.8, palette: [0x3a0c0c, 0x7a1a14, 0xd4a83c], rugosite: [0.35, 0.3, 0.2], metal: [0.4, 0.5, 1], usure: 0.05, vernis: 0.8,
    lueur: 0xff6a1f, animation: "flux", vitesse: 1.5, frequence: 4, intensite: 1.8 },
};
for (const [id, s] of Object.entries(SKINS_AGENTS)) s.id = id;
export const skinAgent = (id) => SKINS_AGENTS[id] || SKINS_AGENTS.origine;

// Palette d'apparence modifiée par une tenue (le reste de l'apparence est conservé)
export function apparenceAvecSkin(apparence, skinId) {
  const s = skinAgent(skinId);
  if (!s.couleurs) return apparence;
  return { ...apparence, couleurs: { ...apparence.couleurs, ...s.couleurs } };
}

// Motif d'une tenue sur les matériaux d'un personnage (armure et pièces secondaires)
export function habillerMateriaux(mats, skinId, qualite) {
  const s = skinAgent(skinId);
  if (!s.motif || qualite === "basse") return;
  const tex = textureMotif(s.motif, s.graine, qualite);
  const options = (couleurs, k = 1) => ({
    texture: tex, echelle: s.echelle * k, couleurs, rugosite: s.rugosite, metal: s.metal, usure: s.usure,
    lueur: s.lueur || 0, animation: s.animation || "aucune", vitesse: s.vitesse, frequence: s.frequence, intensite: s.intensite ?? 1,
  });
  const remplacer = (cle, couleurs, k) => {
    const ancien = mats[cle];
    const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, normalMap: ancien && ancien.normalMap, clearcoat: s.vernis || 0, clearcoatRoughness: 0.2, iridescence: s.iridescence || 0, emissive: 0x000000 });
    mats[cle] = appliquerMotif(m, options(couleurs, k));
  };
  const [A, B, C] = s.palette;
  remplacer("armure", [A, B, C], 1);
  remplacer("secondaire", [B, A, C], 1.4);
}

// Mise à jour par image : lueurs des motifs et ornements animés
export function animerSkins(t) {
  animerMotifs(t);
  for (const a of animes) a.maj(t);
}

// ---------------------------------------------------------------------------
// Vignettes pour les menus : le motif réel du skin, coloré avec sa palette (image PNG en data URL)
// ---------------------------------------------------------------------------
const cacheVignettes = new Map();
export function vignetteSkin(def, taille = 72) {
  if (!def) return "";
  const arme = Array.isArray(def.couleurs);
  const cle = (def.id || "") + "|" + (arme ? "arme" : "tenue") + "|" + taille;
  if (cacheVignettes.has(cle)) return cacheVignettes.get(cle);
  const palette = arme ? def.couleurs : def.palette;
  const c = document.createElement("canvas");
  c.width = c.height = taille;
  const g = c.getContext("2d");
  if (!palette) {
    // Tenue d'origine : fond neutre
    const d = g.createLinearGradient(0, 0, taille, taille);
    d.addColorStop(0, "#3a4252"); d.addColorStop(1, "#1d222c");
    g.fillStyle = d; g.fillRect(0, 0, taille, taille);
  } else {
    const tex = textureMotif(def.motif, def.graine, "basse");
    const { data, width } = tex.image;
    const [A, B, C] = palette.map((h) => new THREE.Color(h).convertLinearToSRGB());
    const L = def.lueur ? new THREE.Color(def.lueur).convertLinearToSRGB() : null;
    const img = g.createImageData(taille, taille);
    const pas = width / taille / 1.5;   // un peu de zoom : le motif est lisible
    for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) {
      const sx = Math.floor(x * pas) % width, sy = Math.floor(y * pas) % width;
      const i = (sy * width + sx) * 4;
      const r = data[i] / 255, gg = data[i + 1] / 255, b = data[i + 2] / 255;
      let cr = A.r + (B.r - A.r) * r, cg = A.g + (B.g - A.g) * r, cb = A.b + (B.b - A.b) * r;
      cr += (C.r - cr) * gg; cg += (C.g - cg) * gg; cb += (C.b - cb) * gg;
      if (L) { cr += L.r * b * 0.9; cg += L.g * b * 0.9; cb += L.b * b * 0.9; }
      if (def.animation === "irisation") { const k = 0.5 + 0.5 * Math.sin((x + y) / taille * 6); cr += 0.25 * k; cg += 0.25 * (1 - k); cb += 0.2; }
      const o = (y * taille + x) * 4;
      img.data[o] = Math.min(255, cr * 255); img.data[o + 1] = Math.min(255, cg * 255); img.data[o + 2] = Math.min(255, cb * 255); img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // Reflet en diagonale : donne du volume à la vignette
    const reflet = g.createLinearGradient(0, 0, taille, taille);
    reflet.addColorStop(0, "rgba(255,255,255,0.18)"); reflet.addColorStop(0.5, "rgba(255,255,255,0)"); reflet.addColorStop(1, "rgba(0,0,0,0.25)");
    g.fillStyle = reflet; g.fillRect(0, 0, taille, taille);
  }
  const url = c.toDataURL();
  cacheVignettes.set(cle, url);
  return url;
}
