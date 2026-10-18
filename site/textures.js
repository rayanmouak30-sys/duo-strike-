// Textures générées au chargement (aucune image à télécharger) : métal brossé, dalles du sol,
// brume douce et halo lumineux. Petites tailles, répétées sur les surfaces.
import * as THREE from "three";

function toile(taille) {
  const c = document.createElement("canvas");
  c.width = c.height = taille;
  return [c, c.getContext("2d")];
}

function hasard(graine) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// Rugosité du métal brossé : fines stries horizontales irrégulières
export function textureBrossee(anisotropie = 4) {
  const [c, ctx] = toile(256);
  const a = hasard(11);
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = 90 + a() * 90;
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.18 + a() * 0.3})`;
    ctx.lineWidth = 0.5 + a();
    const y = a() * 256, x = a() * 256, l = 30 + a() * 200;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + (a() - 0.5) * 1.5); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.anisotropy = anisotropie;
  return t;
}

// Dalles du sol : joints fins, légère variation de teinte et de rugosité d'une dalle à l'autre
export function textureDalles(anisotropie = 4) {
  const [c, ctx] = toile(512);
  const a = hasard(5);
  const n = 4, cote = 512 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 128 + a() * 22;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i * cote, j * cote, cote, cote);
    // micro-rayures
    for (let k = 0; k < 18; k++) {
      const w = 150 + a() * 40;
      ctx.strokeStyle = `rgba(${w},${w},${w},0.25)`;
      ctx.lineWidth = 0.6;
      const x = i * cote + a() * cote, y = j * cote + a() * cote;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (a() - 0.5) * 40, y + (a() - 0.5) * 40); ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgb(30,30,30)";
  ctx.lineWidth = 3;
  for (let k = 0; k <= n; k++) {
    ctx.beginPath(); ctx.moveTo(k * cote, 0); ctx.lineTo(k * cote, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * cote); ctx.lineTo(512, k * cote); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropie;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Brume : bruit doux (taches floues superposées), répétable horizontalement
export function textureBrume() {
  const [c, ctx] = toile(256);
  const a = hasard(23);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 70; i++) {
    const x = a() * 256, y = a() * 256, r = 20 + a() * 60;
    for (const dx of [-256, 0, 256]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.05 + a() * 0.08})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Halo : dégradé radial (lueur du Noyau, reflets au sol)
export function textureHalo() {
  const [c, ctx] = toile(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,0.55)");
  g.addColorStop(0.45, "rgba(255,255,255,0.14)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
