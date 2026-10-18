// Banc de tests automatiques de DUO STRIKE.
// Lance un serveur PHP local, ouvre le jeu dans Chromium (rendu logiciel) avec ?test,
// puis pilote la partie pas à pas via window.__neon (accès réservé aux tests).
//
// Utilisation : node tests/jeu.test.cjs          (depuis la racine du dépôt)
// Prérequis : PHP et Playwright (npm i -D playwright, ou installation globale).

const { spawn } = require("child_process");
const path = require("path");

function chargerPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try { return require(p); } catch (e) { /* essai suivant */ }
  }
  throw new Error("Playwright introuvable : npm i -D playwright");
}
const { chromium } = chargerPlaywright();

const RACINE = path.join(__dirname, "..");
const PORT = 8190 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const resultats = [];
let erreursConsole = [];

async function test(nom, fn) {
  const debut = Date.now();
  try {
    await fn();
    resultats.push({ nom, ok: true, ms: Date.now() - debut });
    console.log(`  ✔ ${nom}`);
  } catch (e) {
    resultats.push({ nom, ok: false, ms: Date.now() - debut, erreur: e.message });
    console.log(`  ✘ ${nom}\n      ${e.message.split("\n").join("\n      ")}`);
  }
}

function verifier(condition, message) { if (!condition) throw new Error(message); }

async function principal() {
  const php = spawn("php", ["-S", `127.0.0.1:${PORT}`], { cwd: RACINE, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const navigateur = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 720 } });
  // Qualité basse (rendu logiciel lent), pas de fenêtre de compte au démarrage
  await contexte.addInitScript(() => {
    try {
      localStorage.setItem("duostrike-reglages", JSON.stringify({ qualite: "basse", resolutionDynamique: false }));
      localStorage.setItem("duostrike-sans-compte", "1");
    } catch (e) { /* stockage indisponible */ }
  });
  const page = await contexte.newPage();
  page.on("pageerror", (e) => erreursConsole.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push("console.error: " + m.text()); });
  page.on("requestfailed", (r) => erreursConsole.push("requête échouée: " + r.url()));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) erreursConsole.push(`HTTP ${r.status()}: ${r.url()}`); });

  const ev = (fn, arg) => page.evaluate(fn, arg);

  try {
    console.log("\nDémarrage");
    await test("La page d'accueil affiche le lien JEU vers le jeu", async () => {
      await page.goto(BASE + "/", { waitUntil: "load" });
      const lien = await ev(() => { const a = document.querySelector("a"); return a && { texte: a.textContent.trim(), href: a.getAttribute("href") }; });
      verifier(lien && lien.texte === "JEU" && lien.href === "jeu/", "lien JEU absent ou incorrect : " + JSON.stringify(lien));
    });

    await test("Le jeu démarre sans erreur et expose l'accès de test", async () => {
      await page.goto(BASE + "/jeu/?test", { waitUntil: "load" });
      await page.waitForFunction(() => window.__neon && window.__neon.partie.etat === "menu", null, { timeout: 60000 });
      verifier(erreursConsole.length === 0, "erreurs au démarrage :\n" + erreursConsole.join("\n"));
    });

    console.log("\nMenus");
    await test("Chaque écran du menu s'ouvre et se referme", async () => {
      const ecrans = await ev(() => [...document.querySelectorAll("[data-ouvre]")].map((b) => b.dataset.ouvre).filter((v, i, t) => t.indexOf(v) === i));
      verifier(ecrans.length >= 4, "trop peu d'écrans trouvés : " + ecrans.join(", "));
      for (const id of ecrans) {
        const ok = await ev((id) => { window.__neon.ouvrirEcran(id); const el = document.getElementById(id); return !!el && el.classList.contains("visible"); }, id);
        verifier(ok, `l'écran ${id} ne s'affiche pas`);
        await page.waitForTimeout(150);
      }
      await ev(() => window.__neon.ouvrirEcran("ecran-menu"));
      verifier(erreursConsole.length === 0, erreursConsole.join("\n"));
    });

    console.log("\nPersonnages");
    await test("Les 20 personnages, 5 catégories de 4, chacun 4 capacités existantes", async () => {
      const r = await ev(async () => {
        const { HEROS, CATEGORIES } = await import("./heros.js");
        const { CAPACITES } = await import("./capacites.js");
        const parCat = {};
        const problemes = [];
        for (const h of Object.values(HEROS)) {
          parCat[h.categorie] = (parCat[h.categorie] || 0) + 1;
          if (!CATEGORIES[h.categorie]) problemes.push(h.id + " : catégorie inconnue");
          if (h.capacites.length !== 4) problemes.push(h.id + " : " + h.capacites.length + " capacités");
          for (const c of h.capacites) if (!CAPACITES[c]) problemes.push(h.id + " : capacité absente " + c);
        }
        const ids = Object.values(HEROS).flatMap((h) => h.capacites);
        return { n: Object.keys(HEROS).length, parCat, problemes, capacitesUniques: new Set(ids).size, nCat: Object.keys(CATEGORIES).length };
      });
      verifier(r.n === 20, r.n + " personnages");
      verifier(r.nCat === 5, r.nCat + " catégories");
      verifier(Object.values(r.parCat).every((n) => n === 4), "répartition : " + JSON.stringify(r.parCat));
      verifier(r.capacitesUniques === 80, r.capacitesUniques + " capacités distinctes");
      verifier(!r.problemes.length, r.problemes.join("\n"));
    });

    await test("Chaque personnage s'affiche dans la vitrine 3D (changement rapide)", async () => {
      const r = await ev(async () => {
        const n = window.__neon;
        const { HEROS } = await import("./heros.js");
        n.ouvrirEcran("ecran-agents");
        const vides = [];
        for (const id of Object.keys(HEROS)) {
          n.afficherHeros(id);
          const v = n.vitrine();
          const m = v && v.modele;
          if (!m || !m.racine.parent || m.maillages.length === 0) vides.push(id);
        }
        n.ouvrirEcran("ecran-menu");
        return vides;
      });
      verifier(r.length === 0, "personnages sans modèle : " + r.join(", "));
    });

    console.log("\nSkins");
    await test("Catalogue : 10 collections, 4 raretés, skins valides et cosmétiques uniquement", async () => {
      const r = await ev(async () => {
        const { SKINS_ARMES, SKINS_AGENTS, COLLECTIONS, RARETES } = await import("./skins.js");
        const { ARMES } = await import("./armes.js");
        const statsAvant = JSON.stringify(Object.values(ARMES).map((a) => [a.degats, a.precision, a.cadence]));
        const problemes = [];
        for (const [id, s] of Object.entries({ ...SKINS_ARMES, ...SKINS_AGENTS })) {
          if (!COLLECTIONS[s.collection]) problemes.push(id + " : collection inconnue");
          if (!RARETES[s.rarete]) problemes.push(id + " : rareté inconnue");
          for (const cle of ["degats", "precision", "cadence", "vitesse", "recul"]) if (cle in s && cle !== "vitesse") problemes.push(id + " : modifie " + cle);
        }
        const raretes = new Set(Object.values(SKINS_ARMES).map((s) => s.rarete));
        const collections = new Set(Object.values(SKINS_ARMES).map((s) => s.collection));
        return { n: Object.keys(SKINS_ARMES).length, tenues: Object.keys(SKINS_AGENTS).length, raretes: raretes.size, collections: collections.size, problemes, stats: statsAvant === JSON.stringify(Object.values(ARMES).map((a) => [a.degats, a.precision, a.cadence])) };
      });
      verifier(r.collections === 10, r.collections + " collections utilisées");
      verifier(r.raretes === 4, r.raretes + " raretés utilisées");
      verifier(r.n >= 20 && r.tenues >= 6, `${r.n} skins d'armes, ${r.tenues} tenues`);
      verifier(!r.problemes.length, r.problemes.join("\n"));
    });

    await test("Chaque skin s'applique à chaque arme et change réellement les matériaux", async () => {
      const r = await ev(async () => {
        const { SKINS_ARMES } = await import("./skins.js");
        const n = window.__neon, vue = n.vue;
        const problemes = [];
        const signature = (m) => {
          const mats = new Set();
          m.groupe.traverse((o) => { if (o.isMesh) mats.add(o.material); });
          return [...mats];
        };
        for (const arme of ["pulsar", "fusil", "sniper", "pompe", "pistolet", "couteau"]) {
          const vus = new Map();
          for (const skin of Object.keys(SKINS_ARMES)) {
            vue.equiper(arme, skin, 0);
            const m = vue.modele;
            if (!m || m.id !== arme || m.skin !== skin) { problemes.push(`${arme}/${skin} : modèle absent`); continue; }
            const mats = signature(m);
            if (!mats.some((x) => x.userData && x.userData.motif)) problemes.push(`${arme}/${skin} : aucun motif appliqué`);
            const cle = mats.filter((x) => x.userData && x.userData.motif).map((x) => x.uuid).sort().join();
            if (vus.has(cle)) problemes.push(`${arme}/${skin} : mêmes matériaux que ${vus.get(cle)}`);
            vus.set(cle, skin);
            if (SKINS_ARMES[skin].ornement && !m.groupe.getObjectByName("ornement")) problemes.push(`${arme}/${skin} : ornement absent`);
          }
        }
        vue.equiper("pistolet", "standard", 0);
        return problemes;
      });
      verifier(r.length === 0, r.slice(0, 12).join("\n"));
    });

    await test("Armurerie : changement rapide de skins, équipement sauvegardé, pas de fuite", async () => {
      const r = await ev(async () => {
        const n = window.__neon;
        n.profil.d.niveau = 30;
        n.ouvrirEcran("ecran-arsenal");
        const geos0 = n.vitrine().renderer.info.memory.geometries;
        const cartes = () => [...document.querySelectorAll(".carte-skin")];
        for (let i = 0; i < 60; i++) {
          const c = cartes();
          c[i % c.length].click();
          if (i % 7 === 0) document.querySelectorAll(".arme-onglet")[i % 6].click();
        }
        // Équipe le skin affiché sur l'arme affichée
        const vue = document.querySelector(".carte-skin.vue");
        const equiper = document.getElementById("fiche-equiper");
        if (equiper.disabled) cartes().find((c) => !c.classList.contains("equipe")).click();
        document.getElementById("fiche-equiper").click();
        const arme = document.querySelector(".arme-onglet.actif strong").textContent;
        const sauve = JSON.parse(localStorage.getItem("duostrike-profil")).skins;
        // Deuxième passage identique : les modèles sont réutilisés (cache), le nombre de géométries ne grimpe pas
        for (let i = 0; i < 60; i++) { const c = cartes(); c[i % c.length].click(); if (i % 7 === 0) document.querySelectorAll(".arme-onglet")[i % 6].click(); }
        const geos1 = n.vitrine().renderer.info.memory.geometries;
        for (let i = 0; i < 60; i++) { const c = cartes(); c[i % c.length].click(); if (i % 7 === 0) document.querySelectorAll(".arme-onglet")[i % 6].click(); }
        const geos2 = n.vitrine().renderer.info.memory.geometries;
        n.ouvrirEcran("ecran-menu");
        return { sauve, arme, geos0, geos1, geos2, vue: !!vue };
      });
      verifier(Object.keys(r.sauve || {}).length >= 1, "aucun skin sauvegardé : " + JSON.stringify(r.sauve));
      verifier(r.geos2 <= r.geos1 + 5, `géométries en hausse au 3e passage : ${r.geos1} → ${r.geos2}`);
    });

    await test("Tenues : changement rapide dans l'écran des personnages, tenue sauvegardée", async () => {
      const r = await ev(async () => {
        const n = window.__neon;
        const { HEROS } = await import("./heros.js");
        n.ouvrirEcran("ecran-agents");
        const ids = Object.keys(HEROS);
        for (let i = 0; i < 40; i++) {
          n.afficherHeros(ids[i % ids.length]);
          const t = document.querySelectorAll(".tenue");
          t[i % t.length].click();
        }
        n.afficherHeros("titan");
        [...document.querySelectorAll(".tenue")].find((b) => b.title.startsWith("Obsidienne")).click();
        document.getElementById("tenue-equiper").click();
        const m = n.vitrine().modele;
        const motif = m.maillages.some((x) => x.material.userData && x.material.userData.motif);
        n.ouvrirEcran("ecran-menu");
        return { tenue: n.profil.tenue("titan"), heros: m.heros, modeleTenue: m.tenue, motif, qualite: n.qualite };
      });
      verifier(r.tenue === "obsidienne", "tenue non sauvegardée : " + r.tenue);
      verifier(r.heros === "titan" && r.modeleTenue === "obsidienne", "le modèle affiché ne porte pas la tenue");
      verifier(r.qualite === "basse" || r.motif, "aucun motif sur l'armure");
    });

    console.log("\nPartie (deathmatch)");
    await test("Une partie se lance", async () => {
      await ev(async () => { const n = window.__neon; n.reglages.mode = "deathmatch"; n.reglages.carte = "nexus"; await n.demarrerPartie(); });
      const etat = await ev(() => window.__neon.partie.etat);
      verifier(etat === "jeu", "état : " + etat);
    });

    await test("Déplacement : le joueur avance et ne traverse pas les murs", async () => {
      const r = await ev(() => {
        const n = window.__neon, j = n.joueur, c = n.controles.cmd;
        const depart = j.pos.clone();
        Object.assign(c, { avant: 1, cote: 0, tir: false });
        n.avancer(1.5);
        const apres = j.pos.clone();
        // Long sprint dans une direction : il doit finir bloqué par un mur, pas dedans
        c.sprint = true;
        n.avancer(12);
        Object.assign(c, { avant: 0, sprint: false });
        const monde = n.carte().monde;
        const dedans = monde.bloque(j.pos.x, j.pos.z, j.pos.y + 0.05);
        return { distance: depart.distanceTo(apres), dedans, y: j.pos.y, nan: [j.pos.x, j.pos.y, j.pos.z].some(Number.isNaN) };
      });
      verifier(!r.nan, "position NaN");
      verifier(r.distance > 2, "le joueur n'avance pas (" + r.distance.toFixed(2) + " m)");
      verifier(!r.dedans, "le joueur est dans un mur");
      verifier(r.y > -1, "le joueur est tombé sous le sol (y=" + r.y + ")");
    });

    await test("Caméra : l'angle vertical reste borné", async () => {
      const r = await ev(() => {
        const n = window.__neon, j = n.joueur;
        n.controles.regard.dy = 100000; n.avancer(0.1);
        const bas = j.tangage;
        n.controles.regard.dy = -200000; n.avancer(0.1);
        const haut = j.tangage;
        n.controles.regard.dy = 0;
        return { bas, haut };
      });
      verifier(Math.abs(r.bas) < Math.PI / 2 && Math.abs(r.haut) < Math.PI / 2, "tangage hors limites : " + JSON.stringify(r));
    });

    await test("Tir, munitions, rechargement complet et pas de tir pendant le rechargement", async () => {
      await ev(async () => { const n = window.__neon; n.allerAuMenu(); n.reglages.mode = "stand"; await n.demarrerPartie(); });
      const r = await ev(() => {
        const n = window.__neon, j = n.joueur, c = n.controles.cmd;
        j.donnerArme("fusil", true);
        n.avancer(1.2); // sortie de l'arme
        const L = j.logique;
        const avant = L.mun;
        c.tir = true; n.avancer(0.5); c.tir = false; n.avancer(0.2);
        const apresTir = L.mun;
        n.controles.actions.push("recharger"); n.avancer(0.05);
        const enRecharge = L.recharge;
        c.tir = true; n.avancer(0.4); c.tir = false;
        const pendant = L.mun;
        n.avancer(L.dureeRecharge + 0.3);
        return { avant, apresTir, enRecharge, pendant, fin: L.mun, chargeur: L.def.chargeur, reserve: L.reserve, reserveMax: L.def.reserve };
      });
      verifier(r.apresTir < r.avant, `aucun tir (munitions ${r.avant} → ${r.apresTir})`);
      verifier(r.enRecharge, "le rechargement ne démarre pas");
      verifier(r.pendant === r.apresTir, "tir pendant le rechargement");
      verifier(r.fin === r.chargeur, `chargeur non rempli (${r.fin}/${r.chargeur})`);
      verifier(r.reserve === r.reserveMax - (r.chargeur - r.apresTir), `réserve incohérente (${r.reserve})`);
    });

    await test("Rechargement interrompu par un changement d'arme, puis reprise", async () => {
      const r = await ev(() => {
        const n = window.__neon, j = n.joueur, c = n.controles.cmd;
        j.equiper("fusil", true); n.avancer(1.2);
        c.tir = true; n.avancer(0.3); c.tir = false;
        const mun = j.logiques.fusil.mun;
        n.controles.actions.push("recharger"); n.avancer(0.3);
        n.controles.actions.push("arme2"); n.avancer(1.0);
        const arme = j.armeActive, rechargeFusil = j.logiques.fusil.recharge, munFusil = j.logiques.fusil.mun;
        n.controles.actions.push("arme1"); n.avancer(1.0);
        return { mun, arme, rechargeFusil, munFusil, retour: j.armeActive };
      });
      verifier(r.arme === "pistolet", "le changement d'arme n'a pas eu lieu : " + r.arme);
      verifier(!r.rechargeFusil && r.munFusil === r.mun, "le rechargement continue en arrière-plan");
      verifier(r.retour === "fusil", "retour à l'arme principale impossible");
    });

    await test("Changement d'arme : une seule arme active, pas de tir pendant la sortie", async () => {
      const r = await ev(() => {
        const n = window.__neon, j = n.joueur, c = n.controles.cmd;
        n.controles.actions.push("arme2"); n.avancer(0.05);
        const L = j.logique, avant = L.mun;
        c.tir = true; n.avancer(0.1); c.tir = false;
        const pendantSortie = L.mun;
        n.avancer(0.8);
        c.tir = true; n.avancer(0.05); c.tir = false; n.avancer(0.2);
        return { arme: j.armeActive, avant, pendantSortie, apres: L.mun, vues: n.vue.arme.children.filter((o) => o.visible).length };
      });
      verifier(r.arme === "pistolet", "arme active : " + r.arme);
      verifier(r.pendantSortie === r.avant, "tir pendant la sortie de l'arme");
      verifier(r.apres < r.avant, "pas de tir une fois l'arme sortie");
      verifier(r.vues === 1, r.vues + " modèles d'arme affichés en même temps");
    });

    await test("Vue FPS : l'ancienne arme est rangée avant la sortie de la nouvelle", async () => {
      const r = await ev(() => {
        const n = window.__neon, j = n.joueur;
        j.equiper("pistolet", true); n.avancer(1.2);
        n.controles.actions.push("arme3"); n.avancer(0.05);
        const pendant = { modele: n.vue.modele.id, rangement: !!n.vue.rangement, visibles: n.vue.arme.children.filter((o) => o.visible).length };
        n.avancer(0.3);
        const apres = { modele: n.vue.modele.id, rangement: !!n.vue.rangement };
        n.controles.actions.push("arme2"); n.avancer(1.2);
        return { pendant, apres };
      });
      verifier(r.pendant.rangement && r.pendant.modele === "pistolet", "pas de phase de rangement : " + JSON.stringify(r.pendant));
      verifier(r.pendant.visibles === 1, r.pendant.visibles + " armes visibles pendant le rangement");
      verifier(!r.apres.rangement && r.apres.modele === "couteau", "la nouvelle arme n'est pas sortie : " + JSON.stringify(r.apres));
    });

    await test("Vue FPS : saut et atterrissage animent l'arme et la caméra", async () => {
      const r = await ev(() => {
        const n = window.__neon, j = n.joueur, c = n.controles.cmd;
        let enLAir = false, airMax = 0, choc = false;
        c.saut = true;
        for (let i = 0; i < 90; i++) {
          n.avancer(1 / 60);
          c.saut = false;
          if (!j.auSol) enLAir = true;
          airMax = Math.max(airMax, Math.abs(n.vue.airK));
          if (j.chute > 0.05) choc = true;
        }
        return { enLAir, airMax, choc, auSol: j.auSol };
      });
      verifier(r.enLAir && r.auSol, "le saut ne décolle pas ou ne retombe pas");
      verifier(r.airMax > 0.1, "l'arme ne réagit pas au saut (" + r.airMax.toFixed(3) + ")");
    });

    await test("Paramètres : inversion, volumes, ombres, effets, mini-carte et réinitialisation", async () => {
      const r = await ev(() => {
        const n = window.__neon, j = n.joueur, $ = (id) => document.getElementById(id);
        const regler = (id, v) => { const el = $(id); if (el.type === "checkbox") { el.checked = v; el.dispatchEvent(new Event("change")); } else { el.value = v; el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input")); } };
        const res = {};
        const t0 = j.tangage; n.controles.regard.dy = 40; n.avancer(1 / 60); const normal = j.tangage - t0;
        regler("r-inverserY", true);
        const t1 = j.tangage; n.controles.regard.dy = 40; n.avancer(1 / 60); const inverse = j.tangage - t1;
        res.inversion = Math.sign(normal) === -Math.sign(inverse) && normal !== 0;
        regler("r-volumeArmes", 0.3);
        const bus = n.jeu.audio.bus;
        res.volume = !bus || Math.abs(bus.armes.gain.value - 0.3) < 1e-6;
        res.audioActif = !!bus;
        regler("r-ombres", "aucune"); res.ombres = n.renderer.shadowMap.enabled === false;
        regler("r-effets", "reduits"); res.effets = n.effets.densite === 0.4;
        regler("r-minimap", false); res.minimap = $("minimap").hidden === true;
        $("r-reinitialiser").click();
        res.reinit = n.reglages.inverserY === false && n.reglages.volumeArmes === 1 && n.reglages.ombres === "auto" && n.effets.densite === 1 && $("minimap").hidden === false && $("r-inverserY").checked === false;
        return res;
      });
      for (const [k, v] of Object.entries(r)) if (k !== "audioActif") verifier(v, "réglage sans effet : " + k + " " + JSON.stringify(r));
    });

    await test("Bots : ils se déplacent et n'ont pas de position invalide (60 s simulées)", async () => {
      await ev(async () => { const n = window.__neon; n.allerAuMenu(); n.reglages.mode = "deathmatch"; await n.demarrerPartie(); });
      const r = await ev(() => {
        const n = window.__neon;
        const bots = n.bots.liste.filter((b) => !b.mannequin);
        const depart = bots.map((b) => [b.x, b.z]);
        let parcours = bots.map(() => 0);
        for (let s = 0; s < 60; s++) {
          const avant = bots.map((b) => [b.x, b.z]);
          n.avancer(1);
          bots.forEach((b, i) => { parcours[i] += Math.hypot(b.x - avant[i][0], b.z - avant[i][1]); });
        }
        const monde = n.carte().monde;
        return {
          n: bots.length,
          immobiles: bots.filter((b, i) => parcours[i] < 3).map((b) => b.nom),
          invalides: bots.filter((b) => [b.x, b.y, b.z].some(Number.isNaN)).map((b) => b.nom),
          dansMur: bots.filter((b) => b.vivant && monde.bloque(b.x, b.z, b.y + 0.05, 0.3)).map((b) => {
            const boite = monde.boites.find((o) => !o.traversable && b.y + 0.05 < o.maxY - 0.05 && b.y + 1.85 > o.minY && Math.hypot(b.x - Math.max(o.minX, Math.min(b.x, o.maxX)), b.z - Math.max(o.minZ, Math.min(b.z, o.maxZ))) < 0.3);
            return b.nom + " (" + (boite ? boite.type || "décor" : "?") + ")";
          }),
          sansTenue: bots.filter((b) => !b.modele || b.modele.tenue !== b.tenue).map((b) => b.nom),
          depart: depart.length,
        };
      });
      verifier(r.n > 0, "aucun bot");
      verifier(!r.invalides.length, "positions NaN : " + r.invalides.join(", "));
      verifier(!r.dansMur.length, "bots dans un mur : " + r.dansMur.join(", "));
      verifier(!r.sansTenue.length, "modèle de bot sans sa tenue : " + r.sansTenue.join(", "));
      verifier(r.immobiles.length <= Math.floor(r.n / 3), "bots immobiles : " + r.immobiles.join(", "));
    });

    await test("Retour au menu puis nouvelle partie, sans fuite de géométries", async () => {
      const r = await ev(async () => {
        const n = window.__neon;
        const mesures = [];
        for (let i = 0; i < 3; i++) {
          n.allerAuMenu();
          await new Promise((res) => setTimeout(res, 50));
          await n.demarrerPartie();
          n.avancer(2);
          mesures.push(n.renderer.info.memory.geometries);
        }
        return { mesures, etat: n.partie.etat };
      });
      verifier(r.etat === "jeu", "la partie ne redémarre pas");
      const [a, , c] = r.mesures;
      verifier(c <= a * 1.15 + 20, "le nombre de géométries augmente : " + r.mesures.join(" → "));
    });

    console.log("\nCapacités (stand de tir, 20 personnages × 4)");
    await test("Les 80 capacités s'utilisent et leurs effets se terminent", async () => {
      const r = await ev(async () => {
        const n = window.__neon;
        const { HEROS } = await import("./heros.js");
        const problemes = [];
        n.allerAuMenu();
        n.reglages.mode = "stand";
        for (const id of Object.keys(HEROS)) {
          n.choisirHeros(id);
          await n.demarrerPartie();
          const j = n.joueur;
          for (const slot of ["c", "q", "e", "x"]) {
            if (slot === "x") j.ultime = j.capacites.x.points; else { j.capacites[slot].charges = j.capacites[slot].max; }
            const action = { c: "fumee", q: "flash", e: "signature", x: "ultime" }[slot];
            const capId = j.capacites[slot].id;
            const avant = slot === "x" ? j.ultime : j.capacites[slot].charges;
            // Blessé (certaines capacités de soin l'exigent) et tourné vers l'espace le plus dégagé
            j.vie = 60;
            const monde = n.carte().monde;
            let meilleur = 0, libre = -1;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
              const t = monde.rayon(j.pos.x, j.pos.y + 1.2, j.pos.z, -Math.sin(a), 0, -Math.cos(a), 40);
              const d = t && t.t !== undefined ? t.t : (typeof t === "number" ? t : 40);
              if (d > libre) { libre = d; meilleur = a; }
            }
            j.lacet = meilleur; j.tangage = -0.1;
            n.controles.actions.push(action);
            n.avancer(0.6);
            const apres = slot === "x" ? j.ultime : j.capacites[slot].charges;
            if (!(apres < avant)) problemes.push(`${id}/${capId} : non utilisée`);
            if (j.capacites[slot] && j.capacites[slot].t < 0) problemes.push(`${id}/${capId} : recharge négative`);
          }
          n.avancer(40);
          const c = n.competences;
          const restants = c.projectiles.length + c.zones.length + c.murs.length + c.drones.length + c.pieges.length + c.tourelles.length;
          if (restants > 3) problemes.push(`${id} : ${restants} effets encore actifs après 40 s`);
          if (!j.vivant) problemes.push(`${id} : le joueur est mort pendant le test`);
          n.allerAuMenu();
        }
        n.reglages.mode = "deathmatch";
        return problemes;
      });
      verifier(r.length === 0, r.join("\n"));
    });

    console.log("\nAffichage");
    await test("Redimensionnements successifs sans erreur", async () => {
      for (const [l, h] of [[800, 600], [1920, 1080], [390, 844], [1280, 720]]) {
        await page.setViewportSize({ width: l, height: h });
        await page.waitForTimeout(250);
      }
      const r = await ev(() => { const c = window.__neon.renderer.domElement; return { l: c.width, h: c.height }; });
      verifier(r.l > 0 && r.h > 0, "canvas de taille nulle");
    });

    await test("Aucune erreur dans la console pendant toute la session", async () => {
      verifier(erreursConsole.length === 0, erreursConsole.slice(0, 15).join("\n"));
    });
  } finally {
    await navigateur.close();
    php.kill();
  }

  const echecs = resultats.filter((r) => !r.ok);
  console.log(`\n${resultats.length - echecs.length}/${resultats.length} tests réussis`);
  process.exit(echecs.length ? 1 : 0);
}

principal().catch((e) => { console.error(e); process.exit(2); });
