// Motifs des skins : textures procédurales tuilables (aucune image à télécharger) et patch de matériau
// qui les projette sur les modèles en coordonnées objet (projection triplanaire) avec des lueurs animées.
//
// Une texture de motif est un masque RGBA :
//   R = zone de la couleur secondaire, G = détails (gravures, filets, joints), B = zones lumineuses, A = usure / rugosité.
// Le patch mélange trois couleurs (A, B, C) et trois finitions (rugosité, métal) selon ces masques.
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Bruit tuilable
// ---------------------------------------------------------------------------
function hasard(graine) {
  let s = (graine * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Bruit de valeur tuilable (fréquence entière = nombre de cellules sur la largeur)
function bruit(T, frequence, octaves, graine) {
  const out = new Float32Array(T * T);
  let amp = 1, total = 0, f = frequence;
  for (let o = 0; o < octaves; o++) {
    const r = hasard(graine * 31 + o * 7);
    const grille = new Float32Array(f * f);
    for (let i = 0; i < grille.length; i++) grille[i] = r();
    for (let y = 0; y < T; y++) {
      const gy = (y / T) * f, y0 = Math.floor(gy), ty = gy - y0, sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % f) * f, yb = ((y0 + 1) % f) * f;
      for (let x = 0; x < T; x++) {
        const gx = (x / T) * f, x0 = Math.floor(gx), tx = gx - x0, sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % f, xb = (x0 + 1) % f;
        const v = (grille[ya + xa] * (1 - sx) + grille[ya + xb] * sx) * (1 - sy) + (grille[yb + xa] * (1 - sx) + grille[yb + xb] * sx) * sy;
        out[y * T + x] += v * amp;
      }
    }
    total += amp; amp *= 0.5; f *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Voronoï tuilable : distances au premier et au second germe, identifiant de cellule
function voronoi(T, n, graine) {
  const r = hasard(graine);
  const cell = Math.ceil(Math.sqrt(n));
  const pts = [];
  for (let gy = 0; gy < cell; gy++) for (let gx = 0; gx < cell; gx++) pts.push([(gx + r()) / cell * T, (gy + r()) / cell * T, r()]);
  const f1 = new Float32Array(T * T), f2 = new Float32Array(T * T), id = new Float32Array(T * T);
  const taille = T / cell;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let d1 = 1e9, d2 = 1e9, c = 0;
    const cx = Math.floor(x / taille), cy = Math.floor(y / taille);
    for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
      const gx = (cx + ox + cell) % cell, gy = (cy + oy + cell) % cell;
      const p = pts[gy * cell + gx];
      let dx = Math.abs(p[0] - x), dy = Math.abs(p[1] - y);
      if (dx > T / 2) dx = T - dx;
      if (dy > T / 2) dy = T - dy;
      const d = Math.hypot(dx, dy);
      if (d < d1) { d2 = d1; d1 = d; c = p[2]; } else if (d < d2) d2 = d;
    }
    const i = y * T + x;
    f1[i] = d1; f2[i] = d2; id[i] = c;
  }
  return { f1, f2, id, taille };
}

const sat = (v) => Math.max(0, Math.min(1, v));
const lisse = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// Dessin vectoriel tuilable : la fonction de tracé est appelée 9 fois (décalages ±T)
function canal2D(T, tracer) {
  const c = document.createElement("canvas");
  c.width = c.height = T;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, T, T);
  for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) { g.save(); g.translate(ox, oy); tracer(g); g.restore(); }
  const d = g.getImageData(0, 0, T, T).data;
  const out = new Float32Array(T * T);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}

// ---------------------------------------------------------------------------
// Générateurs : chacun remplit R, G, B, A (Float32Array 0..1)
// ---------------------------------------------------------------------------
const GENERATEURS = {
  // Peinture légèrement usée (finition standard)
  usure(T, s) {
    const n = bruit(T, 4, 4, s), fin = bruit(T, 32, 2, s + 1), ecl = bruit(T, 12, 3, s + 2);
    return (i) => [lisse(0.62, 0.7, n[i]) * 0.35, 0, 0, sat(0.5 + (fin[i] - 0.5) * 0.8 + lisse(0.7, 0.8, ecl[i]) * 0.4)];
  },
  // Fibre de carbone : sergé 2/2
  carbone(T, s) {
    const fin = bruit(T, 64, 1, s), k = T / 32;
    return (i, x, y) => {
      const cx = Math.floor(x / k), cy = Math.floor(y / k);
      const sens = ((cx + cy) >> 1) & 1;
      const u = sens ? (x % k) / k : (y % k) / k;
      const fibre = 0.5 + 0.5 * Math.sin(u * Math.PI);
      return [sens ? 0.25 + fibre * 0.5 : 0.1 + fibre * 0.25, 0, 0, 0.35 + fin[i] * 0.3];
    };
  },
  // Camouflage numérique : blocs de pixels à deux échelles, trois tons
  camo(T, s) {
    const a = bruit(T, 6, 3, s), b = bruit(T, 9, 3, s + 5), px = T / 64;
    return (i, x, y) => {
      const j = Math.floor(y / px) * px * T + Math.floor(x / px) * px;
      return [lisse(0.5, 0.52, a[j]), lisse(0.58, 0.6, b[j]) * 0.9, 0, 0.5 + (a[i] - 0.5) * 0.4];
    };
  },
  // Nid d'abeille : cellules teintées, filets gravés, quelques arêtes lumineuses
  hexagones(T, s) {
    const r = hasard(s), cotes = 8, w = T / cotes, h = w * Math.sqrt(3) / 2;
    const lignes = Math.round(T / h);
    const hy = T / lignes;
    const tirage = new Float32Array(cotes * lignes * 2);
    for (let i = 0; i < tirage.length; i++) tirage[i] = r();
    return (i, x, y) => {
      let best = 1e9, second = 1e9, cid = 0;
      for (let ly = -1; ly <= lignes; ly++) for (let lx = -1; lx <= cotes; lx++) {
        const cx = (lx + (ly & 1 ? 0.5 : 0)) * w, cy = ly * hy;
        const d = Math.hypot(x - cx, y - cy);
        if (d < best) { second = best; best = d; cid = ((ly + lignes) % lignes) * cotes + ((lx + cotes) % cotes); } else if (d < second) second = d;
      }
      const bord = 1 - lisse(0, w * 0.05, second - best);
      const t = tirage[cid];
      return [t > 0.6 ? 0.8 : t * 0.4, bord, bord * (t > 0.75 ? 1 : 0) + (t > 0.93 ? 0.35 : 0), 0.45 + t * 0.2];
    };
  },
  // Circuit imprimé : pistes à angles droits et à 45°, pastilles
  circuits(T, s) {
    const r = hasard(s);
    const pistes = canal2D(T, (g) => {
      g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineCap = "round"; g.lineJoin = "round";
      const pas = T / 16;
      const r2 = hasard(s + 3);
      for (let k = 0; k < 26; k++) {
        let x = Math.floor(r2() * 16) * pas, y = Math.floor(r2() * 16) * pas;
        g.lineWidth = r2() < 0.3 ? T / 180 : T / 300;
        g.beginPath(); g.moveTo(x, y);
        for (let e = 0; e < 6; e++) {
          const dir = Math.floor(r2() * 4), l = (1 + Math.floor(r2() * 3)) * pas;
          const diag = r2() < 0.35;
          x += [l, 0, -l, 0][dir] + (diag ? [0, l, 0, -l][dir] * 0.5 : 0);
          y += [0, l, 0, -l][dir] + (diag ? [l, 0, -l, 0][dir] * 0.5 : 0);
          g.lineTo(x, y);
        }
        g.stroke();
        g.beginPath(); g.arc(x, y, T / 120, 0, Math.PI * 2); g.fill();
      }
    });
    const fond = bruit(T, 8, 3, s + 1);
    const flux = bruit(T, 4, 1, s + 2);
    void r;
    return (i) => [fond[i] * 0.3, pistes[i], pistes[i] * lisse(0.45, 0.55, flux[i]), 0.5];
  },
  // Fissures de lave : roche sombre, veines incandescentes
  fissures(T, s) {
    const v = voronoi(T, 22, s), n = bruit(T, 8, 4, s + 1);
    return (i) => {
      const e = v.f2[i] - v.f1[i];
      const veine = 1 - lisse(0, v.taille * 0.06 * (0.6 + n[i]), e);
      return [n[i] * 0.6, lisse(0, v.taille * 0.12, e) * (1 - veine) < 0.6 ? 0.4 : 0, veine, 0.3 + n[i] * 0.5];
    };
  },
  // Cristal facetté : chaque facette a sa teinte, arêtes brillantes, éclats
  facettes(T, s) {
    const v = voronoi(T, 30, s), r = hasard(s + 9);
    const eclats = new Float32Array(T * T);
    for (let k = 0; k < 90; k++) { const x = Math.floor(r() * T), y = Math.floor(r() * T); eclats[y * T + x] = 1; if (x + 1 < T) eclats[y * T + x + 1] = 0.6; }
    return (i) => {
      const e = v.f2[i] - v.f1[i];
      return [v.id[i], 1 - lisse(0, v.taille * 0.04, e), eclats[i] + (1 - lisse(0, v.taille * 0.02, e)) * 0.25, 0.15 + v.id[i] * 0.2];
    };
  },
  // Filigrane : rinceaux gravés à l'or sur fond damassé
  filigrane(T, s) {
    const traits = canal2D(T, (g) => {
      g.strokeStyle = "#fff"; g.lineCap = "round";
      const pas = T / 4;
      for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
        const x = cx * pas + pas / 2, y = cy * pas + pas / 2, sens = (cx + cy) % 2 ? 1 : -1;
        g.lineWidth = T / 220;
        for (let k = 0; k < 2; k++) {
          g.beginPath();
          for (let a = 0; a < Math.PI * 3.2; a += 0.08) {
            const rr = pas * 0.42 * (1 - a / (Math.PI * 3.6));
            const px = x + Math.cos(a * sens + k * Math.PI) * rr, py = y + Math.sin(a * sens + k * Math.PI) * rr;
            if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          g.stroke();
        }
        g.lineWidth = T / 300;
        g.beginPath(); g.ellipse(x, y - pas / 2, pas * 0.12, pas * 0.05, 0, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(x - pas / 2, y); g.quadraticCurveTo(x - pas / 4, y - pas * 0.18, x, y); g.stroke();
      }
    });
    const pierres = canal2D(T, (g) => {
      g.fillStyle = "#fff";
      const pas = T / 4;
      for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) { g.beginPath(); g.arc(cx * pas + pas / 2, cy * pas + pas / 2, T / 110, 0, Math.PI * 2); g.fill(); }
    });
    const damas = bruit(T, 6, 3, s);
    return (i) => [lisse(0.45, 0.55, damas[i]) * 0.25, traits[i], pierres[i], 0.4 + damas[i] * 0.2];
  },
  // Nébuleuse : nuages de gaz et étoiles
  nebuleuse(T, s) {
    const a = bruit(T, 4, 5, s), b = bruit(T, 6, 4, s + 1), r = hasard(s + 2);
    const etoiles = new Float32Array(T * T);
    for (let k = 0; k < 260; k++) {
      const x = Math.floor(r() * T), y = Math.floor(r() * T), v = 0.4 + r() * 0.6;
      etoiles[y * T + x] = v;
      if (r() < 0.15) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) etoiles[((y + dy + T) % T) * T + (x + dx + T) % T] = v * 0.5;
    }
    return (i) => [lisse(0.35, 0.75, a[i]), lisse(0.55, 0.8, b[i]) * 0.8, etoiles[i] + lisse(0.62, 0.85, a[i]) * 0.25, 0.3];
  },
  // Bandes de danger diagonales et liserés
  rayures(T, s) {
    const n = bruit(T, 16, 3, s), largeur = T / 8;
    return (i, x, y) => {
      const u = ((x + y) % (largeur * 2)) / (largeur * 2);
      const bande = lisse(0.48, 0.5, u) * (1 - lisse(0.98, 1, u));
      const zone = (y % (T / 2)) < T * 0.18 ? 1 : 0;
      const liser = Math.abs((y % (T / 2)) - T * 0.18) < T / 160 ? 1 : 0;
      return [bande * zone, liser, 0, sat(0.5 + (n[i] - 0.5) * 0.9)];
    };
  },
  // Éclairs ramifiés sur fond orageux
  eclairs(T, s) {
    const r = hasard(s);
    const branches = canal2D(T, (g) => {
      g.strokeStyle = "#fff"; g.lineCap = "round";
      const trait = (x, y, a, l, w, n) => {
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < n; k++) {
          a += (r() - 0.5) * 1.1;
          x += Math.cos(a) * l; y += Math.sin(a) * l;
          g.lineTo(x, y);
          if (r() < 0.18 && w > 1) { g.stroke(); trait(x, y, a + (r() - 0.5) * 1.6, l * 0.7, w * 0.6, Math.floor(n / 2)); g.beginPath(); g.moveTo(x, y); g.lineWidth = w; }
        }
        g.stroke();
      };
      for (let k = 0; k < 5; k++) trait(r() * T, r() * T, r() * Math.PI * 2, T / 30, T / 140, 22);
    });
    const nuages = bruit(T, 5, 5, s + 1);
    return (i) => [nuages[i], branches[i] * 0.6, branches[i], 0.4 + nuages[i] * 0.3];
  },
  // Acier damassé : strates ondulées
  damas(T, s) {
    const n = bruit(T, 4, 4, s), m = bruit(T, 8, 2, s + 1);
    return (i, x, y) => {
      const v = 0.5 + 0.5 * Math.sin((y / T) * Math.PI * 2 * 14 + n[i] * 18 + m[i] * 4);
      return [lisse(0.35, 0.65, v), lisse(0.92, 0.98, v) * 0.6, 0, 0.3 + v * 0.3];
    };
  },
  // Écailles de dragon superposées
  ecailles(T, s) {
    const r = hasard(s), cols = 10, l = T / cols, h = l * 0.62, lignes = Math.round(T / h), hh = T / lignes;
    const tirage = new Float32Array(cols * lignes);
    for (let i = 0; i < tirage.length; i++) tirage[i] = r();
    return (i, x, y) => {
      let res = [0, 0, 0, 0.5];
      for (let ly = lignes; ly >= -1; ly--) {
        const decal = ly & 1 ? l / 2 : 0;
        const ix = Math.floor((x - decal) / l);
        const cx = ix * l + decal + l / 2, cy = ly * hh;
        const dx = (x - cx) / (l * 0.55), dy = (y - cy) / (hh * 1.25);
        const d = dx * dx + dy * dy;
        if (d < 1 && y >= cy - hh * 0.2) {
          const t = tirage[(((ly % lignes) + lignes) % lignes) * cols + ((ix % cols) + cols) % cols];
          const bord = lisse(0.75, 0.98, d);
          res = [0.3 + (1 - d) * 0.5 + t * 0.2, bord, t > 0.9 ? (1 - d) * 0.8 : 0, 0.3 + d * 0.3];
        }
      }
      return res;
    };
  },
  // Lignes topographiques (technologie expérimentale)
  lignes(T, s) {
    const n = bruit(T, 3, 4, s), sel = bruit(T, 2, 1, s + 1);
    return (i) => {
      const v = n[i] * 14, f = v - Math.floor(v);
      const ligne = 1 - lisse(0.0, 0.09, Math.min(f, 1 - f));
      return [lisse(0.5, 0.52, n[i]) * 0.5, ligne, ligne * lisse(0.55, 0.6, sel[i]), 0.5];
    };
  },
};

export const TYPES_MOTIFS = Object.keys(GENERATEURS);

// Texture de motif (mise en cache par type, graine et taille)
const cacheMotifs = new Map();
export function textureMotif(type, graine = 1, qualite = "moyenne") {
  const T = qualite === "basse" ? 256 : 512;
  const cle = type + "|" + graine + "|" + T;
  if (cacheMotifs.has(cle)) return cacheMotifs.get(cle);
  const gen = (GENERATEURS[type] || GENERATEURS.usure)(T, graine);
  const data = new Uint8Array(T * T * 4);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x;
    const [r, g, b, a] = gen(i, x, y);
    data[i * 4] = sat(r) * 255; data[i * 4 + 1] = sat(g) * 255; data[i * 4 + 2] = sat(b) * 255; data[i * 4 + 3] = sat(a) * 255;
  }
  const t = new THREE.DataTexture(data, T, T, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  cacheMotifs.set(cle, t);
  return t;
}

// ---------------------------------------------------------------------------
// Patch de matériau : projection triplanaire en coordonnées objet + lueurs animées
// ---------------------------------------------------------------------------
export const ANIMATIONS = { aucune: 0, pulsation: 1, flux: 2, scintillement: 3, irisation: 4 };
const temps = { value: 0 };   // partagé par tous les matériaux à motif

// o : { texture, echelle, couleurs: [A, B, C], rugosite: [A, B, C], metal: [A, B, C], usure, lueur, animation, vitesse, frequence, intensite }
export function appliquerMotif(materiau, o) {
  const u = {
    uMotif: { value: o.texture },
    uEchelle: { value: o.echelle || 8 },
    uCoulA: { value: new THREE.Color(o.couleurs[0]) },
    uCoulB: { value: new THREE.Color(o.couleurs[1]) },
    uCoulC: { value: new THREE.Color(o.couleurs[2]) },
    uRugo: { value: new THREE.Vector3(...(o.rugosite || [0.5, 0.5, 0.3])) },
    uMetal: { value: new THREE.Vector3(...(o.metal || [0.5, 0.5, 1])) },
    uUsure: { value: o.usure ?? 0.15 },
    uLueur: { value: new THREE.Color(o.lueur || 0x000000) },
    uAnim: { value: new THREE.Vector4(ANIMATIONS[o.animation] || 0, o.vitesse || 1, o.frequence || 10, o.intensite ?? 1) },
    uTemps: temps,
  };
  materiau.color.set(0xffffff);
  materiau.map = null;
  materiau.roughnessMap = null;
  materiau.metalnessMap = null;
  materiau.userData.motif = u;
  materiau.customProgramCacheKey = () => "motif";
  materiau.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMotifPos;\nvarying vec3 vMotifNorm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMotifPos = position;\nvMotifNorm = normal;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform sampler2D uMotif; uniform float uEchelle; uniform vec3 uCoulA; uniform vec3 uCoulB; uniform vec3 uCoulC;
uniform vec3 uRugo; uniform vec3 uMetal; uniform float uUsure; uniform vec3 uLueur; uniform vec4 uAnim; uniform float uTemps;
varying vec3 vMotifPos; varying vec3 vMotifNorm;
vec4 motifTriplanaire() {
  vec3 n = pow(abs(normalize(vMotifNorm)), vec3(4.0)); n /= (n.x + n.y + n.z + 1e-5);
  vec3 p = vMotifPos * uEchelle;
  return texture2D(uMotif, p.zy) * n.x + texture2D(uMotif, p.xz) * n.y + texture2D(uMotif, p.xy) * n.z;
}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
vec4 motif = motifTriplanaire();
vec3 couleurMotif = mix(mix(uCoulA, uCoulB, motif.r), uCoulC, motif.g);
diffuseColor.rgb *= couleurMotif;`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = clamp(mix(mix(uRugo.x, uRugo.y, motif.r), uRugo.z, motif.g) + (motif.a - 0.5) * uUsure, 0.03, 1.0);`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
metalnessFactor = mix(mix(uMetal.x, uMetal.y, motif.r), uMetal.z, motif.g);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  float anim = 1.0;
  float type = uAnim.x;
  if (type > 0.5 && type < 1.5) anim = 0.6 + 0.4 * sin(uTemps * uAnim.y);
  else if (type > 1.5 && type < 2.5) anim = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(dot(vMotifPos, vec3(0.15, 0.35, 1.0)) * uAnim.z - uTemps * uAnim.y), 3.0);
  else if (type > 2.5 && type < 3.5) {
    float h = fract(sin(dot(floor(vMotifPos * uEchelle * 6.0) + floor(uTemps * uAnim.y), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    anim = 0.25 + 0.75 * step(0.78, h);
  }
  if (type > 3.5) {
    float f = 1.0 - abs(dot(normalize(vViewPosition), normal));
    vec3 teinte = 0.5 + 0.5 * cos(6.2831 * (f * 1.3 + uTemps * uAnim.y * 0.08 + dot(vMotifPos, vec3(0.3, 0.5, 1.0)) * uAnim.z + vec3(0.0, 0.33, 0.67)));
    totalEmissiveRadiance += teinte * uAnim.w * (0.15 + motif.b * 0.85 + f * 0.5);
  } else {
    totalEmissiveRadiance += uLueur * motif.b * anim * uAnim.w;
  }
}`);
  };
  materiau.needsUpdate = true;
  return materiau;
}

// Fait avancer toutes les lueurs animées (une seule valeur partagée)
export function animerMotifs(t) { temps.value = t; }
