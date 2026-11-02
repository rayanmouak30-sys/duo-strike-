// Outils de modélisation haute fidélité : surfaces continues avec poids de skinning répartis sur plusieurs os
// (genoux, coudes, taille et cou se plient comme une peau, sans séparation entre les pièces).
import * as THREE from "three";

export const lisser = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

// Poids de skinning : liste [[indiceOs, poids], ...] → 4 meilleurs, normalisés
export function normaliserPoids(liste) {
  const tri = liste.filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = tri.reduce((s, [, w]) => s + w, 0) || 1;
  const idx = [0, 0, 0, 0], w = [0, 0, 0, 0];
  tri.forEach(([i, p], k) => { idx[k] = i; w[k] = p / total; });
  if (!tri.length) w[0] = 1;
  return { idx, w };
}

// Ajoute skinIndex / skinWeight constants (pièce rigide attachée à un os)
export function rigide(geo, indiceOs) {
  const n = geo.attributes.position.count;
  const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { idx[i * 4] = indiceOs; w[i * 4] = 1; }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(w, 4));
  return geo;
}

// Poids calculés par sommet (fonction de la position)
export function poidsParSommet(geo, fn) {
  const p = geo.attributes.position, n = p.count, v = new THREE.Vector3();
  const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i);
    const r = normaliserPoids(fn(v));
    idx.set(r.idx, i * 4); w.set(r.w, i * 4);
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(w, 4));
  return geo;
}

// Surface balayée le long d'un axe vertical : anneaux interpolés en douceur entre des sections de contrôle.
// sections : [{ y, x, z, rx, rz, e (exposant de super-ellipse, 2 = ellipse) }] du haut vers le bas.
// poids(y, x) → [[os, poids]...] ; segments : sommets par anneau ; pas : anneaux intermédiaires par intervalle.
export function balayage(sections, { segments = 24, pas = 3, poids, fermerHaut = false, fermerBas = false, bosse = null } = {}) {
  const anneaux = [];
  for (let s = 0; s < sections.length - 1; s++) {
    const a = sections[s], b = sections[s + 1];
    for (let k = 0; k < pas; k++) {
      const t = k / pas, u = t * t * (3 - 2 * t);
      const m = (cle, def) => (a[cle] ?? def) + ((b[cle] ?? def) - (a[cle] ?? def)) * u;
      anneaux.push({ y: a.y + (b.y - a.y) * t, x: m("x", 0), z: m("z", 0), rx: m("rx"), rz: m("rz"), e: m("e", 2) });
    }
  }
  const der = sections[sections.length - 1];
  anneaux.push({ y: der.y, x: der.x ?? 0, z: der.z ?? 0, rx: der.rx, rz: der.rz, e: der.e ?? 2 });
  const pos = [], uv = [], ind = [];
  let longueur = 0;
  anneaux.forEach((r, j) => {
    if (j) longueur += Math.abs(anneaux[j - 1].y - r.y);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const ex = 2 / r.e;
      let px = Math.sign(s) * Math.pow(Math.abs(s), ex) * r.rx;   // x : côtés
      let pz = Math.sign(c) * Math.pow(Math.abs(c), ex) * r.rz;   // z : avant (+) / arrière (-)
      if (bosse) { const d = bosse(a, r.y); px *= d; pz *= d; }
      pos.push(r.x + px, r.y, r.z + pz);
      uv.push(i / segments * (r.rx + r.rz) * 3.2, longueur * 2);
    }
  });
  const L = segments + 1;
  for (let j = 0; j < anneaux.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * L + i, b = a + 1, c = a + L, d = c + 1;
    ind.push(a, c, b, b, c, d);
  }
  const ajouterCapot = (r, haut) => {
    const centre = pos.length / 3;
    pos.push(r.x, r.y, r.z); uv.push(0.5, 0.5);
    const base = haut ? 0 : (anneaux.length - 1) * L;
    for (let i = 0; i < segments; i++) haut ? ind.push(centre, base + i, base + i + 1) : ind.push(centre, base + i + 1, base + i);
  };
  if (fermerHaut) ajouterCapot(anneaux[0], true);
  if (fermerBas) ajouterCapot(anneaux[anneaux.length - 1], false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(ind);
  geo.computeVertexNormals();
  if (poids) poidsParSommet(geo, (v) => poids(v.y, v.x, v.z));
  return geo;
}

// Plaque courbée autour d'un axe vertical (pièces d'armure qui épousent le torse ou un membre).
// largeur (x), hauteur (y), epaisseur (z) ; rayon : rayon de courbure (plus petit = plus enveloppant) ;
// courbeY : courbure verticale facultative (plaque bombée).
export function plaqueCourbe(largeur, hauteur, epaisseur, rayon, { courbeY = 0, sx = 16, sy = 6, biseau = 0.25 } = {}) {
  const geo = new THREE.BoxGeometry(largeur, hauteur, epaisseur, sx, sy, 1);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Biseau : la face arrière est un peu plus étroite que la face avant (arêtes adoucies)
    const k = v.z < 0 ? 1 - biseau * epaisseur / Math.max(largeur, 1e-3) : 1;
    v.x *= k;
    let z = v.z;
    if (courbeY) z -= (v.y * v.y) / (2 * courbeY);
    const a = v.x / rayon;
    p.setXYZ(i, Math.sin(a) * (rayon + z), v.y, Math.cos(a) * (rayon + z) - rayon);
  }
  geo.computeVertexNormals();
  return geo;
}

// Déforme les sommets d'une géométrie avec une fonction (v modifié sur place, n = direction normalisée depuis le centre)
export function sculpter(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    n.copy(v).normalize();
    fn(v, n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Petit bruit déterministe (relief des mèches, grain)
export function bruit3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}
export function bruitLisse(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = (t) => t * t * (3 - 2 * t);
  let r = 0;
  for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) {
    const w = (dx ? u(fx) : 1 - u(fx)) * (dy ? u(fy) : 1 - u(fy)) * (dz ? u(fz) : 1 - u(fz));
    r += w * bruit3(ix + dx, iy + dy, iz + dz);
  }
  return r;
}

// Place une géométrie : transformation { p, r, s } puis passage dans un repère (matrice)
export function placer(geo, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}, repere = null) {
  const m = new THREE.Matrix4();
  const sc = typeof s === "number" ? [s, s, s] : s;
  m.compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...sc));
  geo.applyMatrix4(m);
  if (repere) geo.applyMatrix4(repere);
  return geo;
}
