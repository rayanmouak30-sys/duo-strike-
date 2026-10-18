// Page d'accueil : scène 3D noir et or derrière le bouton JEU, puis plongée vers le jeu au clic.
const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
let monde = null;

const finIntro = () => document.body.classList.add("pret");
const secours = setTimeout(finIntro, 4000); // la page n'attend jamais la 3D plus de 4 s

function repli(raison) {
  if (raison) console.warn("Scène 3D désactivée :", raison);
  document.body.classList.add("sans-webgl");
  clearTimeout(secours);
  finIntro();
}

function webglDisponible() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

if (webglDisponible()) {
  import("./scene.js")
    .then(({ Monde }) => {
      monde = new Monde(document.getElementById("scene3d"), {
        reduit,
        quandPret: () => { document.body.classList.add("scene-prete"); clearTimeout(secours); setTimeout(finIntro, 300); },
      });
    })
    .catch(repli);
} else repli();

// Clic sur JEU : la caméra plonge dans le Noyau, un voile doré couvre l'écran, puis le jeu s'ouvre
const lien = document.getElementById("jouer");
lien.addEventListener("click", (e) => {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  if (reduit) { location.href = lien.href; return; }
  document.body.classList.add("depart");
  if (monde) monde.plonger();
  setTimeout(() => { location.href = lien.href; }, 950);
});
addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("depart"); });

// Le bouton suit légèrement le curseur
const aimant = (e) => {
  const r = lien.getBoundingClientRect();
  lien.style.setProperty("--x", ((e.clientX - (r.left + r.width / 2)) * 0.06).toFixed(1) + "px");
  lien.style.setProperty("--y", ((e.clientY - (r.top + r.height / 2)) * 0.08).toFixed(1) + "px");
};
if (!reduit && matchMedia("(hover: hover)").matches) addEventListener("pointermove", aimant, { passive: true });

addEventListener("pagehide", (e) => { if (!e.persisted && monde) { monde.detruire(); monde = null; } });
