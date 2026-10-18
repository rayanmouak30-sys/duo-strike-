// Point d'entrée du site : l'interface marche toujours ; la scène 3D est ajoutée si WebGL est disponible.
import { Interface } from "./interface.js";

const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ui = new Interface({ reduit });
let monde = null;

const finIntro = () => document.body.classList.add("intro-finie");
const secours = setTimeout(finIntro, 4500); // l'intro ne bloque jamais le site

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
        quandPret: () => {
          document.body.classList.add("scene-prete");
          clearTimeout(secours);
          setTimeout(finIntro, 200);
        },
      });
      ui.brancherMonde(monde);
    })
    .catch(repli);
} else {
  repli();
}

// Libère la carte graphique quand on quitte vraiment la page
addEventListener("pagehide", (e) => {
  if (!e.persisted && monde) { monde.detruire(); monde = null; }
});
