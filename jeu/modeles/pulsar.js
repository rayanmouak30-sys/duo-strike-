// Pulsar P-07 haute fidélité (vue à la première personne, armurerie, vitrine).
// Mêmes points d'accroche que le modèle simple : mains, chargeur, levier, viseur et bouche ne bougent pas,
// donc les animations (tir, rechargement, inspection) et le cadrage restent valables.
// Repère : avant = -Z, haut = +Y ; profil() dessine vu de côté avec [avant, haut].
import * as THREE from "three";
import { boiteRonde, profil, revolution } from "../formes.js";
import { balayage } from "./outils.js";

// Volume lissé le long de l'axe de l'arme : sections [{ z, y (centre), l (demi-largeur), h (demi-hauteur), e }],
// de l'avant (z le plus négatif) vers l'arrière. e : 2 = ellipse, 4-6 = boîte aux coins arrondis.
function fuseau(sections, { segments = 28, pas = 4, fermer = true } = {}) {
  const s = sections.map((c) => ({ y: -c.z, z: c.y, x: c.x || 0, rx: c.l, rz: c.h, e: c.e ?? 5 }));
  const geo = balayage(s, { segments, pas, fermerHaut: fermer, fermerBas: fermer });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

// Même volume légèrement gonflé sur une tranche courte : joint de panneau qui fait le tour de la coque
function joint(sections, z, largeur = 0.0035, gonfle = 0.0012) {
  const at = (zz) => {
    let a = sections[0], b = sections[sections.length - 1];
    for (let i = 0; i < sections.length - 1; i++) if (zz >= sections[i].z && zz <= sections[i + 1].z) { a = sections[i]; b = sections[i + 1]; break; }
    const t = b.z === a.z ? 0 : (zz - a.z) / (b.z - a.z), u = t * t * (3 - 2 * t);
    const m = (k, d) => (a[k] ?? d) + ((b[k] ?? d) - (a[k] ?? d)) * u;
    return { z: zz, y: m("y", 0), l: m("l") + gonfle, h: m("h") + gonfle, e: m("e", 5) };
  };
  return fuseau([at(z - largeur / 2), at(z + largeur / 2)], { pas: 1 });
}

// Vis à tête hexagonale creuse, posée sur une face (normale : "x+", "x-", "y+")
function vis(A, p, face = "x+", r = 0.0032) {
  const tete = new THREE.CylinderGeometry(r, r * 1.08, 0.0018, 6);
  const creux = new THREE.CylinderGeometry(r * 0.42, r * 0.42, 0.0006, 6);
  creux.translate(0, 0.0011, 0);
  const rot = face === "y+" ? [0, 0, 0] : face === "x+" ? [0, 0, -Math.PI / 2] : [0, 0, Math.PI / 2];
  A.ajouter(tete, "acier", { p, r: rot });
  A.ajouter(creux, "caoutchouc", { p, r: rot });
}

export function piecesPulsarHD(A, C, mob) {
  // ===== Coque supérieure sculptée (blanche) =====
  const coque = [
    { z: -0.506, y: 0.031, l: 0.03, h: 0.019, e: 4 },
    { z: -0.492, y: 0.032, l: 0.039, h: 0.029, e: 5 },
    { z: -0.452, y: 0.034, l: 0.041, h: 0.046, e: 5.5 },
    { z: -0.405, y: 0.033, l: 0.041, h: 0.053, e: 6 },
    { z: -0.06, y: 0.033, l: 0.041, h: 0.053, e: 6 },
    { z: 0.05, y: 0.031, l: 0.041, h: 0.051, e: 6 },
    { z: 0.118, y: 0.024, l: 0.04, h: 0.043, e: 5.5 },
    { z: 0.142, y: 0.022, l: 0.033, h: 0.034, e: 4.5 },
  ];
  A.ajouter(fuseau(coque, { segments: 32 }), "coque");
  for (const z of [-0.405, -0.3, -0.115, 0.05]) A.ajouter(joint(coque, z), "acierSombre");
  // Arête dorsale (épine) qui court sur le dessus, plus sombre
  A.ajouter(fuseau([
    { z: -0.47, y: 0.081, l: 0.004, h: 0.004, e: 3 }, { z: -0.44, y: 0.086, l: 0.014, h: 0.006, e: 4 },
    { z: -0.08, y: 0.086, l: 0.014, h: 0.006, e: 4 }, { z: -0.05, y: 0.085, l: 0.006, h: 0.004, e: 3 },
  ], { segments: 16, pas: 3 }), "coqueGrise");

  // ===== Carcasse inférieure, puits de chargeur et garde-main =====
  A.ajouter(profil([[-0.13, -0.016], [0.3, -0.016], [0.3, -0.044], [0.26, -0.06], [0.225, -0.064], [0.0, -0.064], [-0.04, -0.052], [-0.13, -0.044]], 0.07, 0.005), "coqueGrise");
  // Évasement du puits de chargeur
  A.ajouter(profil([[0.072, -0.058], [0.172, -0.058], [0.176, -0.072], [0.068, -0.072]], 0.064, 0.004), "coqueGrise");
  // Garde-main ajouré (fentes de fixation) de part et d'autre du tube
  const fentes = [];
  for (let i = 0; i < 4; i++) { const f = 0.255 + i * 0.042; fentes.push([[f, -0.052], [f + 0.026, -0.052], [f + 0.026, -0.04], [f, -0.04]]); }
  A.ajouter(profil([[0.24, -0.02], [0.44, -0.02], [0.45, -0.032], [0.44, -0.062], [0.24, -0.062]], 0.068, 0.004, fentes), "coqueGrise");
  A.ajouter(boiteRonde(0.058, 0.03, 0.2, 0.004), "acierSombre", { p: [0, -0.044, -0.34] });

  // ===== Plaques latérales vissées et fenêtres d'énergie =====
  for (const sx of [-1, 1]) {
    // Plaque arrière (sur le boîtier de culasse)
    A.ajouter(profil([[-0.118, 0.004], [0.085, 0.004], [0.112, 0.036], [0.104, 0.07], [-0.096, 0.07], [-0.118, 0.052]], 0.006, 0.0018), "plaque", { p: [sx * 0.0425, 0, 0] });
    for (const [z, y] of [[0.105, 0.012], [0.09, 0.062], [-0.08, 0.062], [-0.08, 0.012]]) vis(A, [sx * 0.0457, y, z], sx > 0 ? "x+" : "x-", 0.0028);
    // Fenêtre d'énergie : cadre, noyau lumineux et barreaux qui le segmentent
    A.ajouter(boiteRonde(0.007, 0.034, 0.3, 0.003), "acierSombre", { p: [sx * 0.0412, 0.028, -0.212] });
    A.ajouter(new THREE.BoxGeometry(0.004, 0.017, 0.27), "lumiere", { p: [sx * 0.0444, 0.028, -0.212] });
    for (let i = 0; i < 10; i++) A.ajouter(boiteRonde(0.005, 0.021, 0.004, 0.0012, 1), "acierSombre", { p: [sx * 0.0448, 0.028, -0.09 - i * 0.027] });
  }
  // Fenêtre d'éjection (flanc droit) avec son volet
  A.ajouter(boiteRonde(0.004, 0.026, 0.064, 0.003), "caoutchouc", { p: [0.0428, 0.052, -0.058] });
  A.ajouter(boiteRonde(0.003, 0.006, 0.07, 0.0015), "acier", { p: [0.0436, 0.036, -0.058] });
  // Arrêtoir de culasse et sélecteur de tir (flanc gauche)
  A.ajouter(boiteRonde(0.005, 0.014, 0.024, 0.002), "acier", { p: [-0.0455, -0.03, 0.02] });
  A.ajouter(new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 16).rotateZ(Math.PI / 2), "acier", { p: [-0.0375, -0.03, 0.078] });
  A.ajouter(boiteRonde(0.004, 0.006, 0.026, 0.002), "acier", { p: [-0.041, -0.024, 0.07], r: [0.5, 0, 0] });
  A.ajouter(new THREE.BoxGeometry(0.001, 0.003, 0.003), "accent", { p: [-0.0416, -0.02, 0.059] });
  // Bouton de chargeur (flanc droit)
  A.ajouter(new THREE.CylinderGeometry(0.005, 0.005, 0.005, 14).rotateZ(Math.PI / 2), "acier", { p: [0.037, -0.044, -0.068] });

  // ===== Rail supérieur =====
  A.ajouter(boiteRonde(0.026, 0.008, 0.37, 0.002), "acierSombre", { p: [0, 0.091, -0.25] });
  const cran = boiteRonde(0.031, 0.0055, 0.0062, 0.0012, 1);
  for (let i = 0; i < 27; i++) A.ajouter(cran, "acierSombre", { p: [0, 0.0975, -0.088 - i * 0.0128] });

  // ===== Viseur holographique sur rehausse =====
  // Embase avec écrou de serrage
  A.ajouter(boiteRonde(0.036, 0.016, 0.06, 0.004), "acierSombre", { p: [0, 0.104, -0.042] });
  A.ajouter(boiteRonde(0.03, 0.036, 0.046, 0.006), "acierSombre", { p: [0, 0.128, -0.04] });
  A.ajouter(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 6).rotateZ(Math.PI / 2), "acier", { p: [0.02, 0.104, -0.036] });
  A.ajouter(boiteRonde(0.005, 0.01, 0.026, 0.002), "acier", { p: [-0.02, 0.104, -0.04] });
  // Capot du viseur : cadre profilé avec visière, ouverture dégagée
  const cadre = new THREE.Shape();
  cadre.moveTo(-0.025, 0.141); cadre.lineTo(0.025, 0.141); cadre.lineTo(0.025, 0.176);
  cadre.quadraticCurveTo(0.025, 0.188, 0.012, 0.189); cadre.lineTo(-0.012, 0.189);
  cadre.quadraticCurveTo(-0.025, 0.188, -0.025, 0.176); cadre.lineTo(-0.025, 0.141);
  const ouverture = new THREE.Path();
  ouverture.moveTo(-0.0205, 0.1455); ouverture.lineTo(0.0205, 0.1455); ouverture.lineTo(0.0205, 0.176);
  ouverture.quadraticCurveTo(0.0205, 0.1825, 0.012, 0.1835); ouverture.lineTo(-0.012, 0.1835);
  ouverture.quadraticCurveTo(-0.0205, 0.1825, -0.0205, 0.176); ouverture.lineTo(-0.0205, 0.1455);
  cadre.holes.push(ouverture);
  A.ajouter(new THREE.ExtrudeGeometry(cadre, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0018, bevelSegments: 2, curveSegments: 6 }), "acierSombre", { p: [0, 0, -0.062] });
  // Liseré lumineux sur l'avant du capot et lentille teintée (anneau)
  A.ajouter(new THREE.BoxGeometry(0.04, 0.0016, 0.002), "lumiere", { p: [0, 0.1425, -0.0645] });
  // Commandes de luminosité et compartiment de pile
  for (const z of [-0.05, -0.036]) A.ajouter(boiteRonde(0.004, 0.007, 0.009, 0.0015), "caoutchouc", { p: [-0.0276, 0.124, z] });
  A.ajouter(new THREE.CylinderGeometry(0.009, 0.009, 0.007, 20).rotateZ(Math.PI / 2), "acier", { p: [0.0185, 0.126, -0.04] });
  A.ajouter(new THREE.TorusGeometry(0.0088, 0.0012, 6, 20).rotateY(Math.PI / 2), "acierSombre", { p: [0.022, 0.126, -0.04] });
  A.ajouter(new THREE.BoxGeometry(0.03, 0.0025, 0.03), "lumiere", { p: [0, 0.1445, -0.042] });

  // ===== Bloc avant à double canon =====
  const blocHaut = [
    { z: -0.681, y: 0.034, l: 0.03, h: 0.019, e: 4 }, { z: -0.668, y: 0.034, l: 0.037, h: 0.024, e: 5 },
    { z: -0.52, y: 0.036, l: 0.037, h: 0.025, e: 5 }, { z: -0.49, y: 0.036, l: 0.034, h: 0.023, e: 4.5 },
  ];
  A.ajouter(fuseau(blocHaut), "acierSombre");
  A.ajouter(joint(blocHaut, -0.6, 0.004, 0.001), "coqueGrise");
  const blocBas = [
    { z: -0.651, y: -0.024, l: 0.028, h: 0.017, e: 4 }, { z: -0.638, y: -0.024, l: 0.035, h: 0.021, e: 5 },
    { z: -0.5, y: -0.022, l: 0.035, h: 0.022, e: 5 }, { z: -0.47, y: -0.02, l: 0.032, h: 0.02, e: 4.5 },
  ];
  A.ajouter(fuseau(blocBas), "acierSombre");
  // Capot supérieur blanc du bloc avant, biseauté vers l'avant
  A.ajouter(fuseau([
    { z: -0.632, y: 0.063, l: 0.03, h: 0.004, e: 4 }, { z: -0.615, y: 0.064, l: 0.041, h: 0.009, e: 5 },
    { z: -0.51, y: 0.064, l: 0.041, h: 0.01, e: 5 }, { z: -0.495, y: 0.062, l: 0.036, h: 0.008, e: 4 },
  ], { segments: 24, pas: 3 }), "coqueGrise");
  // Ailettes de refroidissement inclinées et témoins lumineux
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) A.ajouter(boiteRonde(0.004, 0.034, 0.005, 0.0012, 1), "coqueGrise", { p: [sx * 0.037, 0.035, -0.53 - i * 0.017], r: [0.4, 0, 0] });
    for (let i = 0; i < 3; i++) A.ajouter(new THREE.BoxGeometry(0.0035, 0.007, 0.026), "lumiere", { p: [sx * 0.0352, -0.022, -0.53 - i * 0.04] });
    vis(A, [sx * 0.0372, 0.05, -0.508], sx > 0 ? "x+" : "x-", 0.0026);
    vis(A, [sx * 0.0352, -0.006, -0.49], sx > 0 ? "x+" : "x-", 0.0026);
  }
  // Bouches : couronne usinée, anneau lumineux et âme sombre
  for (const [y, z, r] of [[0.034, -0.681, 0.019], [-0.024, -0.651, 0.017]]) {
    A.ajouter(revolution([[0.0, 0], [r * 0.62, 0], [r * 0.62, 0.003], [r, 0.006], [r * 1.02, 0.014], [r * 0.95, 0.018]], 24).rotateX(Math.PI / 2), "acier", { p: [0, y, z - 0.012] });
    A.ajouter(new THREE.TorusGeometry(r * 0.66, r * 0.09, 8, 24), "lumiere", { p: [0, y, z - 0.0125] });
    A.ajouter(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.004, 20).rotateX(Math.PI / 2), "caoutchouc", { p: [0, y, z - 0.011] });
    // Évents du compensateur
    for (const a of [-0.9, 0.9]) A.ajouter(boiteRonde(0.004, 0.003, 0.008, 0.001, 1), "caoutchouc", { p: [Math.sin(a) * r * 1.0, y + Math.cos(a) * r * 0.75, z - 0.004] });
  }

  // ===== Tube sous le canon (accélérateur) =====
  A.ajouter(revolution([[0.0, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.3], [0.039, 0.306], [0.039, 0.33], [0.034, 0.34], [0.022, 0.344], [0.0, 0.344]], 28).rotateX(-Math.PI / 2), "acierSombre", { p: [0, -0.078, -0.18] });
  A.ajouter(new THREE.CylinderGeometry(0.0378, 0.0378, 0.02, 28).rotateX(Math.PI / 2), "cable", { p: [0, -0.078, -0.476] });
  for (let i = 0; i < 5; i++) A.ajouter(new THREE.TorusGeometry(0.0362, 0.0026, 8, 28), "coqueGrise", { p: [0, -0.078, -0.205 - i * 0.05] });
  // Lentille d'émission au bout du tube
  A.ajouter(new THREE.CylinderGeometry(0.016, 0.016, 0.003, 24).rotateX(Math.PI / 2), "lentille", { p: [0, -0.078, -0.5245] });
  A.ajouter(new THREE.TorusGeometry(0.0185, 0.0018, 6, 24), "lumiere", { p: [0, -0.078, -0.524] });
  // Collier de fixation tube / carcasse
  for (const z of [-0.2, -0.44]) {
    A.ajouter(boiteRonde(0.05, 0.016, 0.018, 0.003), "acierSombre", { p: [0, -0.046, z] });
    vis(A, [0.0255, -0.046, z], "x+", 0.0024); vis(A, [-0.0255, -0.046, z], "x-", 0.0024);
  }
  // Câbles d'alimentation gainés avec embouts
  for (const sx of [-1, 1]) {
    const courbe = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.044, 0.002, -0.07), new THREE.Vector3(sx * 0.053, -0.03, -0.12),
      new THREE.Vector3(sx * 0.046, -0.058, -0.19), new THREE.Vector3(sx * 0.031, -0.07, -0.25),
    ]);
    A.ajouter(new THREE.TubeGeometry(courbe, 28, 0.0062, 10), "cable");
    for (const t of [0.22, 0.5, 0.78]) {
      const p = courbe.getPointAt(t), dir = courbe.getTangentAt(t);
      const bague = new THREE.TorusGeometry(0.0068, 0.0016, 6, 14);
      bague.lookAt(dir);
      A.ajouter(bague, "acierSombre", { p: [p.x, p.y, p.z] });
    }
    for (const [t, rr] of [[0, 0.009], [1, 0.0085]]) {
      const p = courbe.getPointAt(t), dir = courbe.getTangentAt(t);
      const embout = new THREE.CylinderGeometry(rr, rr, 0.016, 14);
      embout.rotateX(Math.PI / 2); embout.lookAt(dir);
      A.ajouter(embout, "acier", { p: [p.x, p.y, p.z] });
    }
  }

  // ===== Poignée pistolet, détente et pontet =====
  A.ajouter(profil([[-0.028, -0.046], [-0.086, -0.046], [-0.093, -0.07], [-0.1, -0.098], [-0.108, -0.126], [-0.118, -0.156], [-0.112, -0.174], [-0.1, -0.18], [-0.072, -0.176],
    [-0.066, -0.162], [-0.06, -0.146], [-0.064, -0.13], [-0.054, -0.116], [-0.058, -0.1], [-0.047, -0.086], [-0.05, -0.07], [-0.04, -0.058]], 0.035, 0.005), "polymere");
  // Panneaux d'adhérence striés sur les deux flancs de la poignée
  for (const sx of [-1, 1]) {
    A.ajouter(profil([[-0.07, -0.06], [-0.088, -0.06], [-0.104, -0.15], [-0.088, -0.16], [-0.074, -0.15], [-0.066, -0.1]], 0.003, 0.001), "caoutchouc", { p: [sx * 0.0175, 0, 0] });
    for (let i = 0; i < 8; i++) A.ajouter(boiteRonde(0.0015, 0.002, 0.016, 0.0006, 1), "polymere", { p: [sx * 0.0192, -0.072 - i * 0.0105, 0.082 + i * 0.0021], r: [0.22, 0, 0] });
  }
  A.ajouter(boiteRonde(0.036, 0.008, 0.044, 0.003), "acierSombre", { p: [0, -0.178, 0.09], r: [-0.2, 0, 0] });
  A.ajouter(profil([[-0.07, -0.042], [0.024, -0.042], [0.03, -0.05], [0.02, -0.082], [-0.07, -0.082]], 0.012, 0.0018, [[[-0.058, -0.048], [0.012, -0.048], [0.016, -0.054], [0.01, -0.074], [-0.058, -0.074]]]), "coqueGrise");
  const detente = new THREE.Shape();
  detente.moveTo(0, 0); detente.lineTo(0.004, 0); detente.quadraticCurveTo(0.012, -0.014, 0.004, -0.026); detente.lineTo(0.0, -0.025); detente.quadraticCurveTo(0.006, -0.013, 0, 0);
  const geoDetente = new THREE.ExtrudeGeometry(detente, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 6 });
  geoDetente.translate(0, 0, -0.003); geoDetente.rotateY(Math.PI / 2);
  A.ajouter(geoDetente, "acier", { p: [0, -0.046, 0.016] });

  // ===== Crosse : tube amortisseur, crosse squelette réglable, appui-joue et talon =====
  A.ajouter(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 20).rotateX(Math.PI / 2), "acierSombre", { p: [0, 0.008, 0.25] });
  for (let i = 0; i < 6; i++) A.ajouter(new THREE.TorusGeometry(0.0162, 0.0016, 6, 20), "acier", { p: [0, 0.008, 0.21 + i * 0.022] });
  A.ajouter(profil([[-0.14, 0.05], [-0.33, 0.062], [-0.37, 0.058], [-0.382, 0.04], [-0.382, -0.086], [-0.37, -0.1], [-0.33, -0.104], [-0.29, -0.097], [-0.16, -0.038], [-0.14, -0.028]], 0.046, 0.006,
    [[[-0.322, 0.034], [-0.2, 0.03], [-0.322, -0.07]], [[-0.355, 0.03], [-0.338, 0.03], [-0.338, -0.074], [-0.355, -0.08]]]), "coqueGrise");
  // Appui-joue rembourré
  A.ajouter(fuseau([
    { z: 0.165, y: 0.066, l: 0.012, h: 0.006, e: 4 }, { z: 0.185, y: 0.07, l: 0.021, h: 0.011, e: 5 },
    { z: 0.33, y: 0.072, l: 0.021, h: 0.012, e: 5 }, { z: 0.36, y: 0.068, l: 0.016, h: 0.008, e: 4 },
  ], { segments: 20, pas: 3 }), "plaque");
  // Levier de réglage
  A.ajouter(boiteRonde(0.01, 0.008, 0.03, 0.003), "acier", { p: [0, -0.034, 0.215] });
  // Talon caoutchouc rainuré
  A.ajouter(boiteRonde(0.052, 0.17, 0.024, 0.007), "caoutchouc", { p: [0, -0.022, 0.392] });
  for (let i = 0; i < 9; i++) A.ajouter(boiteRonde(0.046, 0.004, 0.004, 0.0012, 1), "caoutchouc", { p: [0, -0.094 + i * 0.018, 0.4045] });
  // Anneau de sangle
  A.ajouter(new THREE.TorusGeometry(0.009, 0.0022, 8, 20).rotateY(Math.PI / 2), "acier", { p: [0, -0.098, 0.35] });

  // ===== Chargeur : cellule d'énergie à fenêtre (sort au rechargement) =====
  C.ajouter(profil([[0.062, -0.058], [0.158, -0.058], [0.16, -0.08], [0.172, -0.196], [0.08, -0.202], [0.066, -0.08]], 0.046, 0.005), "polymere");
  C.ajouter(profil([[0.076, -0.194], [0.176, -0.188], [0.181, -0.2], [0.178, -0.216], [0.08, -0.222], [0.074, -0.208]], 0.052, 0.003), "coqueGrise");
  for (const sx of [-1, 1]) {
    // Fenêtre du noyau : cadre, noyau lumineux, bagues
    C.ajouter(boiteRonde(0.004, 0.09, 0.03, 0.003), "acierSombre", { p: [sx * 0.0232, -0.135, -0.118], r: [0.07, 0, 0] });
    C.ajouter(new THREE.BoxGeometry(0.003, 0.078, 0.016), "lumiere", { p: [sx * 0.0252, -0.135, -0.118], r: [0.07, 0, 0] });
    for (let i = 0; i < 4; i++) C.ajouter(boiteRonde(0.0045, 0.003, 0.022, 0.001, 1), "acierSombre", { p: [sx * 0.0256, -0.105 - i * 0.02, -0.116 - i * 0.0014], r: [0.07, 0, 0] });
    // Nervures de prise
    for (let i = 0; i < 4; i++) C.ajouter(boiteRonde(0.003, 0.004, 0.02, 0.001, 1), "polymere", { p: [sx * 0.0238, -0.12 - i * 0.016, -0.154 + i * 0.001], r: [0.07, 0, 0] });
  }
  // Contacts dorés en tête de cellule
  for (const x of [-0.01, 0, 0.01]) C.ajouter(boiteRonde(0.004, 0.004, 0.012, 0.001, 1), "laiton", { p: [x, -0.056, -0.11] });

  // ===== Levier d'armement (flanc droit, animé) =====
  mob.levier.ajouter(boiteRonde(0.016, 0.014, 0.032, 0.004), "acierSombre", { p: [0.05, 0.05, 0.02] });
  for (let i = 0; i < 3; i++) mob.levier.ajouter(boiteRonde(0.0175, 0.0155, 0.0025, 0.0008, 1), "acier", { p: [0.05, 0.05, 0.01 + i * 0.009] });
  mob.levier.ajouter(boiteRonde(0.008, 0.008, 0.026, 0.002), "acier", { p: [0.043, 0.05, 0.02] });

  return {
    mainDroite: [0, -0.082, 0.07], mainGauche: [0, -0.082, -0.33], chargeur: [0, -0.14, -0.11], levier: [0.05, 0.05, 0.02],
    ejection: [0.04, 0.03, -0.06], bouche: [0, 0.034, -0.69], viseur: [0, 0.163, -0.04], reticule: true,
  };
}
