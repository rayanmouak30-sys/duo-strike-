// KAEL en haute fidélité (personnage de référence de la refonte graphique).
// Même squelette que les autres personnages : les animations, la visée, les capacités et les hitboxes ne changent pas.
//   - corps continu (jambes, torse, cou, bras) avec skinning réparti sur plusieurs os : genoux, coudes et taille se plient
//   - tête sculptée : mâchoire, pommettes, arcade, nez, oreilles, yeux (blanc, iris, pupille), paupières, sourcils,
//     lèvres, barbe courte et cheveux courts en mèches, oreillette
//   - tenue en couches : plastron et plaques, épaulières superposées, ceinture et poches, genouillères, gants à
//     doigts, bottes (semelle crantée, coque, lacets), réacteur dorsal à deux tuyères lumineuses, bandes d'équipe
import * as THREE from "three";
import { balayage, plaqueCourbe, sculpter, rigide, poidsParSommet, placer, lisser, bruitLisse } from "./outils.js";
import { boiteRonde } from "../formes.js";

const PI = Math.PI;

// os : { corps, bassin, colonne, poitrine, tete, jambes: [{cote, hanche, genou, pied}], bras: [{cote, epaule, coude, main}] }
// indice(os) → indice dans le squelette ; detail : 1 = complet, < 1 = version allégée (bots en partie)
export function construireKael(os, indice, detail = 1) {
  const sortie = new Map();
  const seg = (n, min = 6) => Math.max(min, Math.round(n * detail));
  const ajouter = (cle, geo) => { if (!sortie.has(cle)) sortie.set(cle, []); sortie.get(cle).push(geo); };

  // Positions de repos des os dans le repère du corps (le corps peut être mis à l'échelle)
  os.corps.updateMatrixWorld(true);
  const versCorps = new THREE.Matrix4().copy(os.corps.matrixWorld).invert();
  const P = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(versCorps);
  const I = {
    bassin: indice(os.bassin), colonne: indice(os.colonne), poitrine: indice(os.poitrine), tete: indice(os.tete),
  };
  // Une pièce rigide est construite dans le repère local de son os, puis placée en position de repos (repère du corps)
  const local = (b) => new THREE.Matrix4().makeTranslation(...P(b).toArray());
  const rigideSur = (cle, geo, b, t = {}) => ajouter(cle, rigide(placer(geo, t, local(b)), indice(b)));

  // ===================== Jambes (pantalon cargo continu de la hanche à la cheville) =====================
  for (const j of os.jambes) {
    const c = j.cote, h = P(j.hanche), g = P(j.genou), pi = P(j.pied);
    const ih = indice(j.hanche), ig = indice(j.genou), ip = indice(j.pied);
    const x = h.x;
    const sections = [
      { y: 1.02, x: x * 0.7, rx: 0.1, rz: 0.1 },
      { y: 0.95, x: x * 0.95, rx: 0.1, rz: 0.104 },
      { y: 0.84, x, rx: 0.094, rz: 0.098 },
      { y: 0.7, x, rx: 0.082, rz: 0.086 },
      { y: g.y + 0.07, x, rx: 0.068, rz: 0.072 },
      { y: g.y, x, z: 0.004, rx: 0.064, rz: 0.07 },
      { y: g.y - 0.07, x, rx: 0.064, rz: 0.07 },
      { y: 0.33, x, z: -0.006, rx: 0.068, rz: 0.076 },
      { y: 0.2, x, rx: 0.056, rz: 0.06 },
      { y: 0.12, x, rx: 0.052, rz: 0.056 },
    ];
    const poids = (y) => {
      if (y > 0.93) { const t = lisser(0.93, 1.02, y); return [[ih, 1 - t * 0.6], [I.bassin, t * 0.6]]; }
      if (y > g.y + 0.06) return [[ih, 1]];
      if (y > g.y - 0.05) { const t = lisser(g.y - 0.05, g.y + 0.06, y); return [[ih, t], [ig, 1 - t]]; }
      if (y > pi.y + 0.08) return [[ig, 1]];
      const t = lisser(pi.y, pi.y + 0.08, y); return [[ig, t], [ip, 1 - t]];
    };
    // Plis du tissu : légère ondulation qui casse la silhouette parfaite
    const plis = (a, y) => 1 + 0.025 * Math.sin(a * 5 + y * 30) * lisser(0.15, 0.6, y) + 0.015 * Math.sin(a * 9 - y * 50);
    ajouter("tissu", balayage(sections, { segments: seg(22), pas: seg(3, 2), poids, bosse: plis }));

    // Poche cargo sur le côté de la cuisse, rabat et bouton-pression
    const xp = x + c * 0.088;
    rigideSur("tissuClair", boiteRonde(0.04, 0.15, 0.13, 0.014, 2), j.hanche, { p: [c * 0.088, -0.27, 0.01] });
    rigideSur("tissu", boiteRonde(0.046, 0.045, 0.135, 0.01, 2), j.hanche, { p: [c * 0.092, -0.2, 0.01] });
    rigideSur("metal", new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10).rotateZ(PI / 2), j.hanche, { p: [c * 0.116, -0.2, 0.01] });
    void xp;
    // Sangle de cuisse
    rigideSur("cuir", new THREE.TorusGeometry(0.088, 0.008, 6, seg(28)).rotateX(PI / 2), j.hanche, { p: [0, -0.33, 0], s: [1, 1, 1.07] });

    // Genouillère : plaque bombée + coussinet + liseré
    rigideSur("armure", plaqueCourbe(0.11, 0.12, 0.022, 0.07, { courbeY: 0.12 }), j.genou, { p: [0, 0.0, 0.062] });
    rigideSur("poly", plaqueCourbe(0.12, 0.15, 0.012, 0.072, { courbeY: 0.14 }), j.genou, { p: [0, -0.005, 0.055] });
    rigideSur("secondaire", plaqueCourbe(0.112, 0.014, 0.006, 0.072), j.genou, { p: [0, -0.045, 0.084] });

    // ----- Botte -----
    // Tige (sur le tibia) avec revers et sangles
    rigideSur("cuir", new THREE.CylinderGeometry(0.06, 0.056, 0.16, seg(20), 1, true), j.genou, { p: [0, -(g.y - 0.17), 0.004] });
    rigideSur("cuir", new THREE.TorusGeometry(0.06, 0.009, 6, seg(20)).rotateX(PI / 2), j.genou, { p: [0, -(g.y - 0.25), 0.004] });
    for (const yy of [0.13, 0.19]) rigideSur("metal", boiteRonde(0.02, 0.012, 0.012, 0.003), j.genou, { p: [c * 0.058, -(g.y - yy), 0.02] });
    // Semelle crantée (profil de pied extrudé) et talon
    const pied = new THREE.Shape();
    pied.moveTo(-0.045, -0.065);
    pied.bezierCurveTo(-0.055, 0.0, -0.06, 0.12, -0.035, 0.175);
    pied.bezierCurveTo(-0.01, 0.2, 0.03, 0.2, 0.045, 0.17);
    pied.bezierCurveTo(0.062, 0.12, 0.058, 0.0, 0.048, -0.065);
    pied.bezierCurveTo(0.03, -0.085, -0.03, -0.085, -0.045, -0.065);
    const semelle = new THREE.ExtrudeGeometry(pied, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: seg(10, 4) });
    semelle.rotateX(PI / 2);
    rigideSur("semelle", semelle, j.pied, { p: [0, -pi.y + 0.026, 0] });
    for (let k = 0; k < 6; k++) rigideSur("semelle", boiteRonde(0.085, 0.008, 0.012, 0.003), j.pied, { p: [0, -pi.y + 0.002, -0.05 + k * 0.042] });
    // Empeigne : volume du pied lissé (sphère sculptée)
    const empeigne = sculpter(new THREE.SphereGeometry(0.06, seg(20), seg(14)), (v) => {
      v.z *= 2.0; v.y *= 0.9;
      if (v.y < -0.01) v.y = -0.01 + (v.y + 0.01) * 0.25;
      v.x *= 0.88 + 0.12 * lisser(-0.1, 0.05, v.z);
    });
    rigideSur("cuir", empeigne, j.pied, { p: [0, -pi.y + 0.062, 0.055] });
    rigideSur("poly", sculpter(new THREE.SphereGeometry(0.046, seg(16), seg(10), 0, PI * 2, 0, PI * 0.55), (v) => { v.z *= 1.15; }), j.pied, { p: [0, -pi.y + 0.05, 0.13], r: [0.5, 0, 0] });
    // Lacets : barrettes croisées sur le coup-de-pied
    for (let k = 0; k < 4; k++) rigideSur("tissuClair", boiteRonde(0.06, 0.006, 0.01, 0.003), j.pied, { p: [0, -pi.y + 0.105 - k * 0.006, 0.07 - k * 0.025], r: [0.5, 0, k % 2 ? 0.25 : -0.25] });
    rigideSur("cuir", plaqueCourbe(0.1, 0.06, 0.012, 0.05), j.pied, { p: [0, -pi.y + 0.09, -0.045], r: [0, PI, 0] });
  }

  // ===================== Torse continu (sous-couche) et cou =====================
  const bassin = P(os.bassin), colonne = P(os.colonne), poitrine = P(os.poitrine), tete = P(os.tete);
  const poidsTorse = (y) => {
    if (y < colonne.y - 0.03) return [[I.bassin, 1]];
    if (y < colonne.y + 0.05) { const t = lisser(colonne.y - 0.03, colonne.y + 0.05, y); return [[I.bassin, 1 - t], [I.colonne, t]]; }
    if (y < poitrine.y - 0.02) return [[I.colonne, 1]];
    if (y < poitrine.y + 0.06) { const t = lisser(poitrine.y - 0.02, poitrine.y + 0.06, y); return [[I.colonne, 1 - t], [I.poitrine, t]]; }
    if (y < tete.y - 0.04) return [[I.poitrine, 1]];
    const t = lisser(tete.y - 0.04, tete.y + 0.02, y); return [[I.poitrine, 1 - t], [I.tete, t]];
  };
  ajouter("tissu", balayage([
    { y: tete.y - 0.07, rx: 0.075, rz: 0.07, z: 0.0 },
    { y: tete.y - 0.1, rx: 0.12, rz: 0.085 },
    { y: 1.46, rx: 0.19, rz: 0.1, e: 2.6 },
    { y: 1.38, rx: 0.205, rz: 0.118, e: 2.8 },
    { y: 1.28, rx: 0.19, rz: 0.12, e: 2.8 },
    { y: 1.18, rx: 0.172, rz: 0.11, e: 2.6 },
    { y: 1.08, rx: 0.158, rz: 0.104, e: 2.5 },
    { y: 0.99, rx: 0.17, rz: 0.108, e: 2.6 },
    { y: 0.9, rx: 0.17, rz: 0.106, e: 2.6 },
    { y: 0.84, rx: 0.12, rz: 0.08 },
  ], { segments: seg(28), pas: seg(3, 2), poids: (y) => poidsTorse(y), fermerBas: true }));
  // Cou (peau) jusque sous la mâchoire
  ajouter("peau", balayage([
    { y: tete.y + 0.06, z: 0.0, rx: 0.048, rz: 0.05 },
    { y: tete.y - 0.02, z: 0.004, rx: 0.052, rz: 0.054 },
    { y: tete.y - 0.08, rx: 0.06, rz: 0.058 },
  ], { segments: seg(18), pas: 2, poids: (y) => poidsTorse(y) }));
  // Col montant
  rigideSur("tissuClair", new THREE.CylinderGeometry(0.07, 0.085, 0.06, seg(24), 1, true), os.poitrine, { p: [0, tete.y - poitrine.y - 0.075, -0.004] });

  // ===================== Armure du buste =====================
  const pt = os.poitrine;
  // Plastron : plaque principale bombée, deux plaques pectorales, liserés orange
  rigideSur("armure", plaqueCourbe(0.34, 0.2, 0.026, 0.2, { courbeY: 0.5, sx: seg(20), sy: 6 }), pt, { p: [0, 0.11, 0.118] });
  for (const s of [-1, 1]) {
    rigideSur("armure", plaqueCourbe(0.15, 0.1, 0.02, 0.16, { courbeY: 0.3 }), pt, { p: [s * 0.088, 0.17, 0.132], r: [-0.08, s * 0.18, 0] });
    rigideSur("secondaire", plaqueCourbe(0.15, 0.012, 0.008, 0.16), pt, { p: [s * 0.088, 0.122, 0.143], r: [0, s * 0.18, 0] });
  }
  rigideSur("secondaire", boiteRonde(0.05, 0.12, 0.012, 0.004), pt, { p: [0, 0.09, 0.148] });
  rigideSur("accent", boiteRonde(0.02, 0.07, 0.006, 0.002), pt, { p: [0, 0.1, 0.156] });
  // Plaques abdominales (sur la colonne) : deux rangées articulées
  for (let k = 0; k < 2; k++) {
    rigideSur("armure", plaqueCourbe(0.25 - k * 0.02, 0.06, 0.02, 0.17, { courbeY: 0.4 }), os.colonne, { p: [0, 0.075 - k * 0.07, 0.108 - k * 0.004] });
    rigideSur("poly", plaqueCourbe(0.26 - k * 0.02, 0.012, 0.012, 0.17), os.colonne, { p: [0, 0.04 - k * 0.07, 0.104] });
  }
  // Dos : plaque dorsale, sangles d'épaule
  rigideSur("armure", plaqueCourbe(0.32, 0.24, 0.022, 0.22, { courbeY: 0.6 }), pt, { p: [0, 0.1, -0.112], r: [0, PI, 0] });
  for (const s of [-1, 1]) {
    rigideSur("cuir", boiteRonde(0.05, 0.3, 0.012, 0.004), pt, { p: [s * 0.11, 0.1, 0.13], r: [0.1, 0, s * 0.12] });
    rigideSur("metal", boiteRonde(0.034, 0.024, 0.01, 0.004), pt, { p: [s * 0.115, 0.03, 0.142] });
  }
  // Ceinture (sur le bassin) : boucle, cartouchières et poche dorsale
  rigideSur("cuir", balayage([{ y: 0.035, rx: 0.178, rz: 0.116, e: 2.6 }, { y: -0.015, rx: 0.18, rz: 0.118, e: 2.6 }], { segments: seg(32), pas: 2 }), os.bassin, { p: [0, 0, 0] });
  rigideSur("metal", boiteRonde(0.06, 0.04, 0.014, 0.006), os.bassin, { p: [0, 0.01, 0.122] });
  rigideSur("accent", boiteRonde(0.022, 0.01, 0.004, 0.002), os.bassin, { p: [0, 0.01, 0.13] });
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) rigideSur("poly", boiteRonde(0.045, 0.07, 0.035, 0.008), os.bassin, { p: [s * (0.075 + k * 0.05), -0.01, 0.112 - k * 0.02], r: [0, s * (0.25 + k * 0.2), 0] });
    rigideSur("cuir", boiteRonde(0.06, 0.08, 0.05, 0.012), os.bassin, { p: [s * 0.16, -0.02, -0.06], r: [0, s * 0.9, 0] });
  }

  // ===================== Réacteur dorsal (prototype Halcyon) =====================
  rigideSur("coque", boiteRonde(0.2, 0.26, 0.09, 0.03, 3), pt, { p: [0, 0.12, -0.17] });
  rigideSur("metal", boiteRonde(0.24, 0.05, 0.08, 0.015), pt, { p: [0, 0.255, -0.165] });
  rigideSur("equipe", boiteRonde(0.16, 0.014, 0.006, 0.003), pt, { p: [0, 0.2, -0.218] });
  for (const s of [-1, 1]) {
    const x = s * 0.09;
    rigideSur("coque", new THREE.CylinderGeometry(0.045, 0.05, 0.24, seg(20)), pt, { p: [x, 0.07, -0.205], r: [0.12, 0, s * 0.08] });
    rigideSur("metal", new THREE.CylinderGeometry(0.05, 0.04, 0.05, seg(20), 1, true), pt, { p: [x + s * 0.008, -0.07, -0.222], r: [0.12, 0, s * 0.08] });
    rigideSur("accent", new THREE.TorusGeometry(0.044, 0.006, 6, seg(20)).rotateX(PI / 2), pt, { p: [x + s * 0.009, -0.09, -0.224], r: [0.12, 0, s * 0.08] });
    rigideSur("secondaire", new THREE.TorusGeometry(0.048, 0.007, 6, seg(20)).rotateX(PI / 2), pt, { p: [x, 0.13, -0.198], r: [0.12, 0, s * 0.08] });
    for (let k = 0; k < 3; k++) rigideSur("metal", boiteRonde(0.012, 0.03, 0.02, 0.003), pt, { p: [x + s * 0.05, 0.12 + k * 0.035, -0.19] });
  }
  rigideSur("cuir", new THREE.TorusGeometry(0.035, 0.01, 6, seg(14), PI).rotateZ(-PI / 2), pt, { p: [0, 0.26, -0.13] });

  // ===================== Bras continus, épaulières, gants =====================
  for (const b of os.bras) {
    const c = b.cote, e = P(b.epaule), co = P(b.coude), m = P(b.main);
    const ie = indice(b.epaule), ic = indice(b.coude), im = indice(b.main);
    const x = e.x;
    const poids = (y) => {
      if (y > e.y + 0.01) { const t = lisser(e.y + 0.01, e.y + 0.06, y); return [[ie, 1 - t * 0.5], [I.poitrine, t * 0.5]]; }
      if (y > co.y + 0.05) return [[ie, 1]];
      if (y > co.y - 0.04) { const t = lisser(co.y - 0.04, co.y + 0.05, y); return [[ie, t], [ic, 1 - t]]; }
      if (y > m.y + 0.04) return [[ic, 1]];
      const t = lisser(m.y, m.y + 0.04, y); return [[ic, t], [im, 1 - t]];
    };
    ajouter("tissu", balayage([
      { y: e.y + 0.06, x: x * 0.85, rx: 0.07, rz: 0.075 },
      { y: e.y, x, rx: 0.072, rz: 0.074 },
      { y: e.y - 0.08, x, rx: 0.066, rz: 0.068 },
      { y: e.y - 0.17, x, rx: 0.058, rz: 0.062 },
      { y: co.y, x, z: -0.004, rx: 0.05, rz: 0.054 },
      { y: co.y - 0.07, x, rx: 0.052, rz: 0.054 },
      { y: m.y + 0.05, x, rx: 0.04, rz: 0.042 },
      { y: m.y + 0.01, x, rx: 0.036, rz: 0.038 },
    ], { segments: seg(18), pas: seg(3, 2), poids, bosse: (a, y) => 1 + 0.02 * Math.sin(a * 6 + y * 40) }));

    // Épaulière lourde : trois lames superposées, liseré orange, bande d'équipe
    rigideSur("armure", sculpter(new THREE.SphereGeometry(0.095, seg(26), seg(12), 0, PI * 2, 0, PI * 0.5), (v) => { v.x *= 1.06; v.z *= 1.12; v.y *= 0.95; }), b.epaule, { p: [c * 0.01, 0.02, 0], r: [0, 0, c * 0.12] });
    rigideSur("armure", sculpter(new THREE.CylinderGeometry(0.1, 0.104, 0.05, seg(26), 1, true), (v) => { v.x *= 1.06; v.z *= 1.12; }), b.epaule, { p: [c * 0.016, -0.035, 0], r: [0, 0, c * 0.14] });
    for (let k = 0; k < 3; k++) rigideSur("metal", new THREE.SphereGeometry(0.005, 6, 4), b.epaule, { p: [c * 0.03 + Math.sin(k - 1) * 0.06, -0.005, Math.cos(k - 1) * 0.1], r: [0, 0, 0] });
    rigideSur("secondaire", new THREE.TorusGeometry(0.094, 0.006, 6, seg(28)).rotateX(PI / 2), b.epaule, { p: [c * 0.02, -0.035, 0], s: [1.05, 1, 1.1], r: [0, 0, c * 0.22] });
    rigideSur("equipe", new THREE.TorusGeometry(0.068, 0.01, 6, seg(24)).rotateX(PI / 2), b.epaule, { p: [0, -0.15, 0] });
    // Protège-avant-bras et bracelet
    rigideSur("armure", plaqueCourbe(0.08, 0.14, 0.018, 0.05, { courbeY: 0.3 }), b.coude, { p: [0, -0.1, 0.044] });
    rigideSur("poly", new THREE.CylinderGeometry(0.046, 0.044, 0.04, seg(18)), b.coude, { p: [0, -0.22, 0] });
    rigideSur("accent", boiteRonde(0.03, 0.012, 0.005, 0.002), b.coude, { p: [0, -0.215, 0.047] });

    // Gant : paume, dos renforcé, quatre doigts à deux phalanges, pouce, protège-jointures
    rigideSur("cuir", boiteRonde(0.072, 0.085, 0.032, 0.014, 2), b.main, { p: [0, -0.045, 0] });
    rigideSur("poly", plaqueCourbe(0.064, 0.05, 0.01, 0.06), b.main, { p: [0, -0.04, 0.018] });
    rigideSur("armure", boiteRonde(0.068, 0.014, 0.02, 0.005), b.main, { p: [0, -0.083, 0.012] });
    for (let k = 0; k < 4; k++) {
      const xd = (k - 1.5) * 0.017, l1 = 0.03 - Math.abs(k - 1.5) * 0.003;
      rigideSur("cuir", new THREE.CapsuleGeometry(0.0085, l1, 3, seg(8, 5)), b.main, { p: [xd, -0.105, 0.004], r: [0.25, 0, 0] });
      rigideSur("cuir", new THREE.CapsuleGeometry(0.008, l1 * 0.8, 3, seg(8, 5)), b.main, { p: [xd, -0.135, 0.016], r: [0.75, 0, 0] });
    }
    rigideSur("cuir", new THREE.CapsuleGeometry(0.01, 0.03, 3, seg(8, 5)), b.main, { p: [-c * 0.04, -0.04, 0.026], r: [0.9, 0, -c * 0.5] });
  }

  // ===================== Tête sculptée =====================
  // Proportions : yeux à mi-hauteur du crâne, base du nez au tiers inférieur, bouche entre le nez et le menton.
  // Chaque élément du visage est posé sur la surface réelle du crâne (rayons lancés sur le modèle sculpté).
  const tt = os.tete;
  const C = [0, 0.1, 0.008];   // centre du crâne par rapport à l'os de la tête
  const formeCrane = (v, n) => {
    v.x *= 0.9; v.y *= 1.13; v.z *= 1.05;
    const y = n.y, ax = Math.abs(n.x), avant = Math.max(0, n.z);
    const bas = lisser(-0.1, -0.8, y);
    v.x *= 1 - 0.2 * bas;                                                        // mâchoire plus étroite
    v.z += 0.018 * avant * lisser(-0.5, -0.9, y) * (1 - ax);                     // menton marqué
    v.z -= 0.012 * lisser(0.1, -0.6, y) * lisser(0.45, 0.9, ax) * avant;         // joues sous les pommettes
    v.addScaledVector(n, 0.009 * Math.exp(-((y + 0.02) ** 2) / 0.015 - ((ax - 0.62) ** 2) / 0.02) * avant);  // pommettes
    v.z += 0.012 * Math.exp(-((y - 0.2) ** 2) / 0.005 - ((ax - 0.3) ** 2) / 0.04) * avant;                   // arcade sourcilière
    v.z -= 0.02 * Math.exp(-((y - 0.03) ** 2) / 0.006 - ((ax - 0.36) ** 2) / 0.008) * avant;                // orbites
    v.z += 0.006 * Math.exp(-((y - 0.4) ** 2) / 0.05 - (ax ** 2) / 0.1) * avant;                              // front
    if (n.z < -0.3) v.z *= 1.05;                                                 // arrière du crâne
  };
  const crane = sculpter(new THREE.SphereGeometry(0.1, seg(48, 16), seg(40, 12)), formeCrane);
  rigideSur("peau", crane, tt, { p: C });
  // Surface du visage : profondeur z du crâne au point (x, y) (repère de l'os de la tête)
  const sonde = new THREE.Mesh(crane.clone().translate(...C));
  const rayon = new THREE.Raycaster();
  const surface = (x, y) => {
    rayon.set(new THREE.Vector3(x, y, 0.4), new THREE.Vector3(0, 0, -1));
    const h = rayon.intersectObject(sonde, false)[0];
    return h ? h.point.z : 0.1;
  };
  const yeuxY = C[1] + 0.003, nezY = C[1] - 0.042, boucheY = C[1] - 0.066;

  // Yeux : globe dans l'orbite, iris coloré, pupille, reflet, paupières, sourcils
  for (const s of [-1, 1]) {
    const ex = s * 0.034, zs = surface(ex, yeuxY);
    const ez = zs - 0.0045;
    rigideSur("blanc", new THREE.SphereGeometry(0.0122, seg(16, 8), seg(12, 6)), tt, { p: [ex, yeuxY, ez] });
    rigideSur("iris", new THREE.CircleGeometry(0.0062, seg(16, 8)), tt, { p: [ex, yeuxY, ez + 0.0121] });
    rigideSur("semelle", new THREE.CircleGeometry(0.0028, 10), tt, { p: [ex, yeuxY, ez + 0.0124] });
    rigideSur("blanc", new THREE.CircleGeometry(0.0011, 6), tt, { p: [ex + 0.002, yeuxY + 0.002, ez + 0.0126] });
    // Paupière supérieure (recouvre le haut du globe, légèrement tombante) et inférieure
    rigideSur("peau", new THREE.SphereGeometry(0.0133, seg(16, 8), 6, 0, PI * 2, 0, PI * 0.42), tt, { p: [ex, yeuxY + 0.0005, ez], r: [0.65, 0, -s * 0.12] });
    rigideSur("peau", new THREE.SphereGeometry(0.0129, seg(16, 8), 4, 0, PI * 2, PI * 0.74, PI * 0.26), tt, { p: [ex, yeuxY, ez], r: [-0.25, 0, 0] });
    // Sourcil : fines mèches qui suivent l'arcade
    for (let k = 0; k < 3; k++) {
      const bx = s * (0.022 + k * 0.012), by = yeuxY + 0.021 + (k === 2 ? -0.002 : 0.001);
      rigideSur("cheveux", boiteRonde(0.014, 0.0055, 0.006, 0.002), tt, { p: [bx, by, surface(bx, by) + 0.0012], r: [-0.3, s * (0.25 + k * 0.15), -s * (0.12 - k * 0.1)] });
    }
  }
  // Nez : arête, bout arrondi et narines
  const nez = sculpter(new THREE.SphereGeometry(0.014, seg(16, 8), seg(12, 6)), (v) => {
    v.y *= 2.2; v.x *= 0.85;
    v.z *= 0.9;
    v.z += 0.012 * lisser(0.03, -0.025, v.y);        // le bout ressort plus que la racine
    v.x *= 0.75 + 0.35 * lisser(0.0, -0.03, v.y);    // ailes plus larges en bas
  });
  rigideSur("peau", nez, tt, { p: [0, nezY + 0.024, surface(0, nezY + 0.024) - 0.009] });
  for (const s of [-1, 1]) rigideSur("peau", new THREE.SphereGeometry(0.0072, 10, 8), tt, { p: [s * 0.0105, nezY + 0.004, surface(s * 0.0105, nezY + 0.004) - 0.002] });
  // Bouche : lèvres pleines, sillon
  rigideSur("levres", sculpter(new THREE.CapsuleGeometry(0.0052, 0.03, 3, 10).rotateZ(PI / 2), (v) => { v.y *= 0.75; v.y += 0.0015 * Math.cos(v.x * 90); }), tt, { p: [0, boucheY + 0.006, surface(0, boucheY + 0.006) - 0.002] });
  rigideSur("levres", sculpter(new THREE.CapsuleGeometry(0.0058, 0.026, 3, 10).rotateZ(PI / 2), (v) => { v.y *= 0.85; }), tt, { p: [0, boucheY - 0.0045, surface(0, boucheY - 0.0045) - 0.002] });
  // Oreilles : pavillon et creux
  for (const s of [-1, 1]) {
    const oreille = sculpter(new THREE.SphereGeometry(0.027, seg(14, 8), seg(12, 6)), (v) => { v.x *= 0.32; v.z *= 0.68; v.y *= 1.05; if (v.x * s < 0) v.x *= 0.25; });
    rigideSur("peau", oreille, tt, { p: [s * 0.087, yeuxY - 0.006, -0.006] });
    rigideSur("levres", new THREE.SphereGeometry(0.009, 8, 6), tt, { p: [s * 0.093, yeuxY - 0.006, -0.003], s: [0.4, 1.2, 0.8] });
  }
  // Barbe courte : sur la mâchoire et le menton, en dégageant la bouche ; moustache fine
  const barbe = sculpter(new THREE.SphereGeometry(0.1, seg(40, 14), seg(28, 10)), (v, n) => {
    formeCrane(v, n);
    const dansZone = n.y < -0.12 && n.z > -0.35;
    const bouche = Math.abs(n.x) < 0.32 && n.y > -0.66 && n.z > 0.5;
    v.addScaledVector(n, dansZone && !bouche ? 0.0038 + 0.0028 * bruitLisse(v.x * 400, v.y * 400, v.z * 400) : -0.012);
  });
  rigideSur("cheveux", barbe, tt, { p: C });
  rigideSur("cheveux", sculpter(new THREE.CapsuleGeometry(0.0022, 0.03, 3, 8).rotateZ(PI / 2), (v) => { v.y -= Math.abs(v.x) * 0.3; v.z *= 0.6; }), tt, { p: [0, boucheY + 0.014, surface(0, boucheY + 0.014) + 0.0006] });
  // Cheveux courts : implantation dégagée sur le front, côtés plus courts, mèches en relief sur le dessus
  const ligne = (n) => {
    const angle = Math.atan2(n.x, n.z);                      // 0 = devant, ±π = derrière
    const devant = Math.cos(angle);
    return devant > 0 ? 0.42 - 0.24 * (1 - devant) : 0.18 - 0.5 * (-devant);
  };
  const cheveux = sculpter(new THREE.SphereGeometry(0.1, seg(48, 16), seg(36, 12)), (v, n) => {
    formeCrane(v, n);
    const h = n.y - ligne(n);
    if (h < 0) { v.addScaledVector(n, -0.015); return; }      // hors de la chevelure : rentré dans le crâne (invisible)
    const dessus = lisser(0.0, 0.25, h);
    const meche = bruitLisse(n.x * 7 + 11, n.y * 5, n.z * 7 + 3);
    v.addScaledVector(n, 0.0025 + 0.004 * dessus + 0.006 * meche * dessus + 0.003 * lisser(0.5, 0.9, n.z) * dessus);
  });
  rigideSur("cheveux", cheveux, tt, { p: C });
  // Oreillette (accessoire de KAEL) : coque, voyant, micro
  rigideSur("metal", new THREE.CylinderGeometry(0.017, 0.017, 0.012, 14).rotateZ(PI / 2), tt, { p: [0.096, yeuxY - 0.006, -0.004] });
  rigideSur("accent", new THREE.CircleGeometry(0.006, 10).rotateY(PI / 2), tt, { p: [0.103, yeuxY - 0.006, -0.004] });
  rigideSur("poly", new THREE.CapsuleGeometry(0.003, 0.065, 3, 6).rotateX(PI / 2), tt, { p: [0.088, boucheY + 0.02, 0.045], r: [0.35, 0.45, 0] });

  return sortie;
}
