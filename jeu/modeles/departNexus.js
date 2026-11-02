// Zone de départ des attaquants sur Nexus : portion de carte de référence, très détaillée.
// Coordonnées à l'échelle 1 de la carte (le groupe est élargi ensuite), mur sud intérieur en z = 22.
// La zone d'apparition (x -4..4, z 18..20.5) reste libre : tout ce qui gêne est hors de cette zone.
import * as THREE from "three";
import { boiteRonde, Assemblage } from "../formes.js";
import { uvMonde } from "../textures.js";

const MUR = 22; // face intérieure du mur sud

// Plan tactique lumineux (table holographique) : carte stylisée de Nexus en traits dorés
function texturePlan() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#070604"; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(240,190,90,0.18)"; g.lineWidth = 1;
  for (let x = 0; x <= 512; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  for (let y = 0; y <= 256; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.strokeStyle = "#f0c060"; g.lineWidth = 4; g.shadowColor = "#ffb030"; g.shadowBlur = 8;
  g.strokeRect(20, 20, 472, 216);
  for (const [x1, y1, x2, y2] of [[176, 20, 176, 120], [176, 150, 176, 236], [336, 20, 336, 120], [336, 150, 336, 236], [20, 168, 140, 168], [372, 168, 492, 168], [210, 168, 300, 168], [20, 72, 120, 72], [392, 72, 492, 72]]) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  g.fillStyle = "rgba(240,190,90,0.25)";
  g.fillRect(380, 80, 100, 80); g.fillRect(32, 80, 100, 80);
  g.shadowBlur = 12; g.fillStyle = "#ffd27a"; g.font = "900 44px Orbitron, Arial Black, Arial, sans-serif"; g.textAlign = "center";
  g.fillText("A", 430, 136); g.fillText("B", 82, 136);
  g.fillStyle = "#ff6a4a"; g.beginPath(); g.arc(256, 214, 9, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Tache d'huile / usure au sol (disque flou)
function textureTache() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const d = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  d.addColorStop(0, "rgba(0,0,0,0.5)"); d.addColorStop(0.55, "rgba(0,0,0,0.28)"); d.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = d; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Inscription au pochoir sur le sol
function texturePochoir(texte) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 256;
  const g = c.getContext("2d");
  g.font = "900 150px Orbitron, Arial Black, Arial, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#e0b040";
  g.fillText(texte, 512, 132);
  // Usure du pochoir : petits manques
  g.globalCompositeOperation = "destination-out";
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { g.globalAlpha = 0.2 + rnd() * 0.6; g.fillRect(rnd() * 1024, rnd() * 256, 2 + rnd() * 8, 2 + rnd() * 5); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Barrière en béton type « jersey » (profil extrudé), longueur selon X avant rotation
function geoJersey(longueur) {
  const f = new THREE.Shape();
  f.moveTo(-0.3, 0); f.lineTo(0.3, 0); f.lineTo(0.3, 0.08); f.lineTo(0.2, 0.26); f.lineTo(0.1, 0.8); f.lineTo(-0.1, 0.8); f.lineTo(-0.2, 0.26); f.lineTo(-0.3, 0.08); f.lineTo(-0.3, 0);
  const g = new THREE.ExtrudeGeometry(f, { depth: longueur, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 1 });
  g.translate(0, 0, -longueur / 2);
  g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  return g;
}

// A : assemblage opaque de la carte (fusionné par matériau) ; mats : matériaux de la carte ;
// renvoie les objets supplémentaires (transparents, lumineux) à ajouter au groupe.
export function habillerDepartNexus({ A, monde, mats, riche }) {
  const ajout = new THREE.Group();
  // Matériaux propres à la zone (fusionnés avec ceux de la carte)
  Object.assign(mats, {
    or: new THREE.MeshStandardMaterial({ color: 0xc9a046, roughness: 0.32, metalness: 1 }),
    orLueur: new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb440, emissiveIntensity: 1.6, roughness: 0.4 }),
    caisseDure: new THREE.MeshStandardMaterial({ color: 0x4a4d3a, roughness: 0.6, metalness: 0.25 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.45, metalness: 0.7 }),
  });
  const danger = mats.danger ? "danger" : "jaune";

  // ===== Grand portail roulant du hangar (dans l'axe de la zone) =====
  const lP = 5.2, hP = 3.6;
  for (let i = 0; i < 30; i++) {
    const y = 0.06 + i * (hP - 0.1) / 30;
    A.ajouter(new THREE.BoxGeometry(lP, 0.1, 0.05), "gris", { p: [0, y + 0.05, MUR - 0.06 + (i % 2) * 0.012] });
  }
  A.ajouter(boiteRonde(lP + 0.1, 0.16, 0.12, 0.02), "sombre", { p: [0, 0.08, MUR - 0.1] });   // barre basse
  for (const s of [-1, 1]) {
    // Montants : rail de guidage et jambage zébré
    A.ajouter(new THREE.BoxGeometry(0.16, hP, 0.2), "sombre", { p: [s * (lP / 2 + 0.08), hP / 2, MUR - 0.1] });
    A.ajouter(uvMonde(new THREE.BoxGeometry(0.34, hP + 0.25, 0.32), 0.34, hP + 0.25, 0.32, 1), danger, { p: [s * (lP / 2 + 0.33), (hP + 0.25) / 2, MUR - 0.16] });
    A.ajouter(new THREE.BoxGeometry(0.42, 0.25, 0.42), "sombre", { p: [s * (lP / 2 + 0.33), 0.125, MUR - 0.2] });
    // Boîtier de commande (bouton doré)
    A.ajouter(boiteRonde(0.28, 0.42, 0.12, 0.02), "graphite", { p: [s * (lP / 2 + 0.85), 1.35, MUR - 0.07] });
    A.ajouter(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16).rotateX(Math.PI / 2), "orLueur", { p: [s * (lP / 2 + 0.85), 1.42, MUR - 0.14] });
    A.ajouter(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12).rotateX(Math.PI / 2), "ledRouge", { p: [s * (lP / 2 + 0.85), 1.28, MUR - 0.14] });
  }
  // Linteau zébré et caisson d'enroulement
  A.ajouter(uvMonde(new THREE.BoxGeometry(lP + 1.0, 0.26, 0.34), lP + 1.0, 0.26, 0.34, 1), danger, { p: [0, hP + 0.13, MUR - 0.17] });
  A.ajouter(new THREE.CylinderGeometry(0.28, 0.28, lP + 0.2, 20).rotateZ(Math.PI / 2), "gris", { p: [0, hP + 0.6, MUR - 0.3] });
  A.ajouter(boiteRonde(lP + 0.5, 0.06, 0.62, 0.02), "sombre", { p: [0, hP + 0.9, MUR - 0.31] });
  // Gyrophares de part et d'autre du portail
  for (const s of [-1, 1]) {
    A.ajouter(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 14), "sombre", { p: [s * (lP / 2 + 0.33), hP + 0.3, MUR - 0.2] });
    A.ajouter(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14), "orLueur", { p: [s * (lP / 2 + 0.33), hP + 0.4, MUR - 0.2] });
  }

  // ===== Râteliers d'armes muraux (deux armoires) =====
  for (const s of [-1, 1]) {
    const x = s * 5.05, z = MUR - 0.3;
    // Caisson ouvert : fond, flancs, toit et socle (les armes restent visibles)
    A.ajouter(new THREE.BoxGeometry(1.6, 2.4, 0.06), "graphite", { p: [x, 1.25, z + 0.25] });
    for (const sx of [-1, 1]) A.ajouter(boiteRonde(0.08, 2.4, 0.56, 0.02), "graphite", { p: [x + sx * 0.76, 1.25, z] });
    A.ajouter(boiteRonde(1.6, 0.1, 0.56, 0.02), "graphite", { p: [x, 2.4, z] });
    A.ajouter(boiteRonde(1.6, 0.14, 0.56, 0.02), "graphite", { p: [x, 0.07, z] });
    A.ajouter(new THREE.BoxGeometry(1.44, 2.2, 0.02), "cadre", { p: [x, 1.25, z + 0.21] });     // panneau perforé du fond
    for (let k = 0; k < 9; k++) A.ajouter(new THREE.BoxGeometry(1.4, 0.012, 0.012), "sombre", { p: [x, 0.3 + k * 0.24, z + 0.2] });
    A.ajouter(new THREE.BoxGeometry(1.56, 0.05, 0.05), "or", { p: [x, 2.42, z - 0.29] });      // liserés dorés
    A.ajouter(new THREE.BoxGeometry(1.56, 0.05, 0.05), "or", { p: [x, 0.1, z - 0.29] });
    for (const sx of [-1, 1]) A.ajouter(new THREE.BoxGeometry(0.05, 2.36, 0.05), "or", { p: [x + sx * 0.78, 1.26, z - 0.29] });
    A.ajouter(new THREE.BoxGeometry(1.38, 0.03, 0.03), "orLueur", { p: [x, 2.33, z - 0.24] });   // bandeau lumineux intérieur
    // Quatre fusils debout (silhouettes détaillées) sur un support
    A.ajouter(new THREE.BoxGeometry(1.3, 0.06, 0.24), "sombre", { p: [x, 0.42, z - 0.1] });
    A.ajouter(new THREE.BoxGeometry(1.3, 0.05, 0.12), "sombre", { p: [x, 1.7, z - 0.16] });
    for (let k = 0; k < 4; k++) {
      const fx = x - 0.48 + k * 0.32;
      A.ajouter(boiteRonde(0.07, 0.62, 0.11, 0.015), "caoutchouc", { p: [fx, 0.78, z - 0.12] });       // crosse + carcasse
      A.ajouter(boiteRonde(0.06, 0.5, 0.08, 0.012), "graphite", { p: [fx, 1.33, z - 0.13] });          // garde-main
      A.ajouter(new THREE.CylinderGeometry(0.013, 0.013, 0.32, 8), "graphite", { p: [fx, 1.74, z - 0.13] }); // canon
      A.ajouter(boiteRonde(0.05, 0.2, 0.09, 0.01), "caoutchouc", { p: [fx, 0.92, z - 0.21], r: [0.25, 0, 0] }); // chargeur
      A.ajouter(boiteRonde(0.05, 0.06, 0.12, 0.01), "sombre", { p: [fx, 1.2, z - 0.06] });             // viseur
    }
    // Étagère du haut : boîtes de munitions
    A.ajouter(new THREE.BoxGeometry(1.4, 0.04, 0.4), "sombre", { p: [x, 2.0, z - 0.04] });
    for (let k = 0; k < 3; k++) A.ajouter(boiteRonde(0.32, 0.18, 0.26, 0.02), "vert" in mats ? "vert" : "caisseDure", { p: [x - 0.42 + k * 0.42, 2.11, z - 0.05] });
    monde.ajouter(x - 0.82, 0, z - 0.3, x + 0.82, 2.45, MUR, { type: "armoire" });
  }

  // ===== Caisses de ravitaillement renforcées (empilées) =====
  const caisseDure = (x, y, z, l, h, p, ry = 0) => {
    A.ajouter(boiteRonde(l, h, p, 0.05), "caisseDure", { p: [x, y + h / 2, z], r: [0, ry, 0] });
    const c = Math.cos(ry), sn = Math.sin(ry);
    const loc = (dx, dz) => [x + dx * c + dz * sn, z - dx * sn + dz * c];
    // Nervures de renfort, coins métalliques, fermoirs dorés, bande peinte
    for (const k of [-0.36, 0.36]) {
      const [px, pz] = loc(k * l, 0);
      A.ajouter(boiteRonde(0.06, h + 0.02, p + 0.02, 0.01), "sombre", { p: [px, y + h / 2, pz], r: [0, ry, 0] });
    }
    for (const sx of [-1, 1]) {
      const [px, pz] = loc(sx * l * 0.2, p / 2 + 0.012);
      A.ajouter(boiteRonde(0.1, 0.12, 0.03, 0.008), "or", { p: [px, y + h - 0.12, pz], r: [0, ry, 0] });
    }
    const [bx, bz] = loc(0, p / 2 + 0.006);
    A.ajouter(new THREE.BoxGeometry(l * 0.5, 0.06, 0.01), "jaune", { p: [bx, y + h * 0.42, bz], r: [0, ry, 0] });
    for (const sx of [-1, 1]) {
      const [px, pz] = loc(sx * (l / 2 + 0.012), 0);
      A.ajouter(boiteRonde(0.03, 0.06, p * 0.4, 0.01), "sombre", { p: [px, y + h * 0.6, pz], r: [0, ry, 0] });   // poignées
    }
  };
  caisseDure(8.6, 0, 20.4, 1.4, 0.7, 0.9, 0.05);
  caisseDure(8.62, 0.7, 20.42, 1.2, 0.55, 0.8, -0.08);
  caisseDure(10.3, 0, 20.9, 1.1, 0.6, 0.8, 0.3);
  monde.ajouter(7.85, 0, 19.9, 11.0, 1.25, 21.4, { type: "ravitaillement" });
  caisseDure(-9.8, 0, 21.1, 1.4, 0.7, 0.9, -0.04);
  monde.ajouter(-10.55, 0, 20.6, -9.05, 0.7, 21.6, { type: "ravitaillement" });

  // ===== Table tactique holographique =====
  const tx = -7.6, tz = 19.6;
  for (const [dx, dz] of [[-0.95, -0.45], [0.95, -0.45], [-0.95, 0.45], [0.95, 0.45]]) A.ajouter(boiteRonde(0.1, 0.9, 0.1, 0.02), "graphite", { p: [tx + dx, 0.45, tz + dz] });
  A.ajouter(boiteRonde(2.2, 0.12, 1.2, 0.03), "graphite", { p: [tx, 0.93, tz] });
  A.ajouter(boiteRonde(2.24, 0.03, 1.24, 0.01), "or", { p: [tx, 0.86, tz] });
  A.ajouter(boiteRonde(1.9, 0.5, 0.9, 0.03), "cadre", { p: [tx, 0.55, tz] });   // caisson électronique
  for (let k = 0; k < 5; k++) A.ajouter(new THREE.BoxGeometry(1.6, 0.025, 0.02), "sombre", { p: [tx, 0.4 + k * 0.07, tz - 0.46] });
  monde.ajouter(tx - 1.1, 0, tz - 0.6, tx + 1.1, 1.0, tz + 0.6, { type: "table" });
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshBasicMaterial({ map: texturePlan(), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  plan.rotation.x = -Math.PI / 2;
  plan.position.set(tx, 0.995, tz);
  ajout.add(plan);
  if (riche) {
    // Projection : cône de lumière et anneaux flottants
    const matHolo = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.45, 0.9, 32, 1, true), matHolo);
    cone.position.set(tx, 1.45, tz);
    cone.scale.z = 0.55;
    ajout.add(cone);
    const matAnneau = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (const [y, r] of [[1.25, 0.5], [1.55, 0.62], [1.82, 0.7]]) {
      const a = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 48).rotateX(Math.PI / 2), matAnneau);
      a.position.set(tx, y, tz);
      a.scale.z = 0.55;
      ajout.add(a);
    }
  }

  // ===== Barrières en béton (couvert à la sortie de la zone) =====
  const jersey = geoJersey(2.4);
  for (const [x, z, ry] of [[-2.95, 15.2, 0.3], [3.3, 15.0, -0.28]]) {
    A.ajouter(jersey, "mur", { p: [x, 0, z], r: [0, ry, 0] });
    A.ajouter(new THREE.BoxGeometry(2.3, 0.04, 0.21), "jaune", { p: [x, 0.81, z], r: [0, ry, 0] });
    for (const k of [-0.7, 0.7]) A.ajouter(new THREE.BoxGeometry(0.12, 0.1, 0.62), "sombre", { p: [x + Math.cos(ry) * k, 0.05, z - Math.sin(ry) * k], r: [0, ry, 0] });
    const dx = Math.abs(Math.cos(ry)) * 1.2 + 0.15, dz = Math.abs(Math.sin(ry)) * 1.2 + 0.3;
    monde.ajouter(x - dx, 0, z - dz, x + dx, 0.82, z + dz, { type: "jersey" });
  }

  // ===== Projecteurs sur mâts (éclairent la zone) =====
  for (const s of [-1, 1]) {
    const x = s * 11.2, z = MUR - 0.5;
    A.ajouter(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 12), "sombre", { p: [x, 2.7, z] });
    A.ajouter(boiteRonde(0.5, 0.06, 0.5, 0.02), "sombre", { p: [x, 0.03, z] });
    A.ajouter(new THREE.BoxGeometry(1.2, 0.08, 0.08), "sombre", { p: [x, 5.3, z] });
    for (const k of [-0.42, 0.42]) {
      A.ajouter(boiteRonde(0.42, 0.3, 0.22, 0.03), "graphite", { p: [x + k, 5.2, z - 0.18], r: [0.55, 0, 0] });
      A.ajouter(new THREE.BoxGeometry(0.34, 0.22, 0.02), "lampe", { p: [x + k, 5.15, z - 0.3], r: [0.55, 0, 0] });
    }
    monde.ajouter(x - 0.14, 0, z - 0.14, x + 0.14, 5.4, z + 0.14, { type: "poteau" });
  }

  // ===== Chemin de câbles, gaines et ventilation sur le mur =====
  A.ajouter(new THREE.BoxGeometry(24, 0.05, 0.36), "cadre", { p: [0, 4.92, MUR - 0.22] });
  for (const s of [-1, 1]) A.ajouter(new THREE.BoxGeometry(24, 0.12, 0.03), "cadre", { p: [0, 4.98, MUR - 0.22 + s * 0.17] });
  for (const [dz, r] of [[-0.1, 0.035], [-0.02, 0.028], [0.06, 0.04]]) A.ajouter(new THREE.CylinderGeometry(r, r, 24, 8).rotateZ(Math.PI / 2), "cable", { p: [0, 4.98, MUR - 0.22 + dz] });
  for (let x = -11.5; x <= 11.5; x += 2.3) A.ajouter(new THREE.BoxGeometry(0.04, 0.3, 0.42), "sombre", { p: [x, 4.82, MUR - 0.21] });
  if (riche) for (let x = -10.35; x < 11; x += 4.6) {
    const courbe = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 4.9, MUR - 0.36), new THREE.Vector3(x + 1.15, 4.35, MUR - 0.4), new THREE.Vector3(x + 2.3, 4.9, MUR - 0.36)]);
    A.ajouter(new THREE.TubeGeometry(courbe, 14, 0.022, 6), "cable");
  }
  // Gaines verticales vers les armoires et le portail
  for (const x of [-5.6, 4.5, -3.75, 3.75]) A.ajouter(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 8), "tuyau", { p: [x, 3.7, MUR - 0.07] });
  // Caisson de ventilation au-dessus de l'armoire est
  A.ajouter(boiteRonde(1.4, 0.7, 0.45, 0.03), "gris", { p: [8.2, 3.3, MUR - 0.24] });
  for (let k = 0; k < 7; k++) A.ajouter(new THREE.BoxGeometry(1.2, 0.025, 0.03), "sombre", { p: [8.2, 3.05 + k * 0.08, MUR - 0.47] });
  A.ajouter(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 14), "tuyau", { p: [8.2, 4.25, MUR - 0.24] });

  // ===== Sol : caniveau, zone d'apparition peinte, pochoir et taches =====
  A.ajouter(new THREE.BoxGeometry(22, 0.02, 0.36), "sombre", { p: [0, 0.01, MUR - 0.55] });
  for (let x = -10.8; x <= 10.8; x += 0.18) A.ajouter(new THREE.BoxGeometry(0.04, 0.025, 0.3), "graphite", { p: [x, 0.015, MUR - 0.55] });
  const SOL = new Assemblage();
  const trait = (x, z, l, p, cle = "peintureOr") => { const g = new THREE.PlaneGeometry(l, p); g.rotateX(-Math.PI / 2); SOL.ajouter(g, cle, { p: [x, 0.009, z] }); };
  // Cadre de la zone d'apparition avec coins renforcés
  trait(0, 17.6, 9.2, 0.14); trait(0, 21.2, 9.2, 0.14); trait(-4.6, 19.4, 0.14, 3.74); trait(4.6, 19.4, 0.14, 3.74);
  for (const [cx, cz, sx, sz] of [[-4.6, 17.6, 1, 1], [4.6, 17.6, -1, 1], [-4.6, 21.2, 1, -1], [4.6, 21.2, -1, -1]]) {
    trait(cx + sx * 0.4, cz + sz * 0.12, 0.8, 0.1, "peintureBlanche"); trait(cx + sx * 0.12, cz + sz * 0.4, 0.1, 0.8, "peintureBlanche");
  }
  // Chevrons vers la sortie (nord)
  for (const x of [-2.2, 0, 2.2]) for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(0.7, 0.16); g.rotateX(-Math.PI / 2); g.rotateY(s * 0.6);
    SOL.ajouter(g, "peintureOr", { p: [x + s * 0.26, 0.009, 17.0] });
  }
  const matsSol = {
    peintureOr: new THREE.MeshStandardMaterial({ color: 0xd9a830, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
    peintureBlanche: new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
  ajout.add(SOL.construire(matsSol, false));
  const pochoir = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: texturePochoir("ATTAQUE"), transparent: true, roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  pochoir.rotation.x = -Math.PI / 2;
  pochoir.position.set(0, 0.01, 20.5);
  ajout.add(pochoir);
  const matTache = new THREE.MeshBasicMaterial({ map: textureTache(), transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -1 });
  const TACHES = new Assemblage();
  for (const [x, z, r] of [[-1.6, 21.3, 1.1], [2.8, 18.9, 0.7], [9.1, 19.2, 1.3], [-8.3, 18.2, 0.9], [0.4, 15.8, 1.6], [-11, 19.6, 1.0], [6.2, 20.9, 0.6]]) {
    const g = new THREE.PlaneGeometry(r * 2, r * 1.6); g.rotateX(-Math.PI / 2); TACHES.ajouter(g, "tache", { p: [x, 0.007, z], r: [0, x * 1.7, 0] });
  }
  ajout.add(TACHES.construire({ tache: matTache }, false));
  return ajout;
}
