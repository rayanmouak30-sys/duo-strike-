// Interface du site : apparitions au défilement, navigation, cartes inclinables, boutons magnétiques,
// choix des agents (données reprises du jeu), classement en ligne et transition vers le jeu.
import { HEROS, CATEGORIES, ORDRE_CATEGORIES } from "../jeu/heros.js";
import { CAPACITES } from "../jeu/capacites.js";

const NOMS_ARMES = { pulsar: "Pulsar P-07", fusil: "DS-7 Vecteur", pompe: "Briseur", sniper: "Aiguille", pistolet: "Sentinelle" };
const TOUCHES = ["C", "A", "E", "X"];
const pointeurFin = matchMedia("(hover: hover) and (pointer: fine)");

export class Interface {
  constructor({ reduit = false } = {}) {
    this.reduit = reduit;
    this.monde = null;
    this.agent = "kael";
    this.categorie = "assaut";
    this.agentsProches = false;

    this.apparitions();
    this.navigation();
    this.compteurs();
    if (!reduit && pointeurFin.matches) { this.cartesInclinables(); this.boutonsAimantes(); }
    this.agents();
    this.classement();
    this.departVersJeu();
  }

  brancherMonde(monde) {
    this.monde = monde;
    if (this.agentsProches) this.afficherAgent3D();
  }

  // ----- Apparitions progressives -----
  apparitions() {
    const obs = new IntersectionObserver((entrees) => {
      for (const e of entrees) if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.01 });
    document.querySelectorAll(".section:not(.accueil)").forEach((s) => obs.observe(s));
  }

  // ----- En-tête et repère de progression -----
  navigation() {
    const majEntete = () => document.body.classList.toggle("defile", scrollY > 40);
    addEventListener("scroll", majEntete, { passive: true });
    majEntete();

    const liens = [...document.querySelectorAll(".navigation a, .progression a")];
    const obs = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue;
        const id = e.target.id;
        for (const a of liens) {
          if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        }
      }
    }, { rootMargin: "-48% 0px -50% 0px" });
    document.querySelectorAll("main .section").forEach((s) => obs.observe(s));
  }

  // ----- Chiffres qui défilent jusqu'à leur valeur -----
  compteurs() {
    const els = document.querySelectorAll("[data-compteur]");
    if (this.reduit) return;
    const obs = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        const el = e.target, fin = Number(el.dataset.compteur), debut = performance.now();
        const pas = (t) => {
          const k = Math.min(1, (t - debut) / 1400);
          el.textContent = String(Math.round(fin * (1 - Math.pow(1 - k, 4))));
          if (k < 1) requestAnimationFrame(pas);
        };
        el.textContent = "0";
        requestAnimationFrame(pas);
      }
    }, { threshold: 0.6 });
    els.forEach((el) => obs.observe(el));
  }

  // ----- Cartes : inclinaison et lumière qui suivent le curseur -----
  cartesInclinables() {
    for (const carte of document.querySelectorAll(".carte")) {
      let image = 0;
      carte.addEventListener("pointermove", (e) => {
        cancelAnimationFrame(image);
        image = requestAnimationFrame(() => {
          const r = carte.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          carte.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
          carte.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
          carte.style.setProperty("--mx", `${x * 100}%`);
          carte.style.setProperty("--my", `${y * 100}%`);
          carte.style.setProperty("--lumiere", "1");
        });
      });
      carte.addEventListener("pointerleave", () => {
        cancelAnimationFrame(image);
        carte.style.setProperty("--rx", "0deg");
        carte.style.setProperty("--ry", "0deg");
        carte.style.setProperty("--lumiere", "0");
      });
    }
  }

  // ----- Boutons attirés par le curseur -----
  boutonsAimantes() {
    for (const b of document.querySelectorAll(".aimant")) {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.setProperty("--x", `${dx * 0.18}px`);
        b.style.setProperty("--y", `${dy * 0.3}px`);
      });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--x", "0px"); b.style.setProperty("--y", "0px"); });
    }
  }

  // ----- Agents -----
  agents() {
    const onglets = document.querySelector(".categories");
    this.liste = document.querySelector(".liste-agents");
    this.fiche = document.querySelector(".fiche");

    ORDRE_CATEGORIES.forEach((id, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.id = "onglet-" + id;
      b.textContent = CATEGORIES[id].nom;
      b.setAttribute("aria-selected", String(id === this.categorie));
      b.tabIndex = id === this.categorie ? 0 : -1;
      b.addEventListener("click", () => this.choisirCategorie(id));
      b.addEventListener("keydown", (e) => {
        const sens = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!sens) return;
        e.preventDefault();
        const suivant = ORDRE_CATEGORIES[(i + sens + ORDRE_CATEGORIES.length) % ORDRE_CATEGORIES.length];
        this.choisirCategorie(suivant);
        document.getElementById("onglet-" + suivant).focus();
      });
      onglets.appendChild(b);
    });
    this.choisirCategorie(this.categorie, false);

    // Le modèle 3D n'est chargé qu'à l'approche de la section
    const section = document.getElementById("agents");
    const obs = new IntersectionObserver((entrees) => {
      if (!entrees.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      this.agentsProches = true;
      this.afficherAgent3D();
    }, { rootMargin: "120% 0px 120% 0px" });
    obs.observe(section);
  }

  choisirCategorie(id, choisirPremier = true) {
    this.categorie = id;
    for (const b of document.querySelectorAll(".categories button")) {
      const actif = b.id === "onglet-" + id;
      b.setAttribute("aria-selected", String(actif));
      b.tabIndex = actif ? 0 : -1;
    }
    this.liste.setAttribute("aria-labelledby", "onglet-" + id);
    this.liste.textContent = "";
    const agents = Object.values(HEROS).filter((h) => h.categorie === id);
    for (const h of agents) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.agent = h.id;
      const nom = document.createElement("strong"); nom.textContent = h.nom;
      const role = document.createElement("span"); role.textContent = h.role;
      b.append(nom, role);
      b.addEventListener("click", () => this.choisirAgent(h.id));
      this.liste.appendChild(b);
    }
    this.choisirAgent(choisirPremier ? agents[0].id : this.agent);
  }

  choisirAgent(id) {
    const h = HEROS[id];
    if (!h) return;
    this.agent = id;
    for (const b of this.liste.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.agent === id));

    const f = this.fiche;
    f.querySelector(".fiche-role").textContent = `${CATEGORIES[h.categorie].nom} · ${h.role}`;
    f.querySelector(".fiche-nom").textContent = h.nom;
    f.querySelector(".fiche-citation").textContent = h.citation ? `« ${h.citation} »` : "";
    const details = f.querySelector(".fiche-details");
    details.textContent = "";
    const ajouter = (titre, valeur, classe) => {
      const div = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = titre;
      const dd = document.createElement("dd"); dd.textContent = valeur;
      if (classe) dd.className = classe;
      div.append(dt, dd);
      details.appendChild(div);
    };
    ajouter("Difficulté", "★".repeat(h.difficulte) + "☆".repeat(3 - h.difficulte), "difficulte");
    ajouter("Arme", NOMS_ARMES[h.arme] || h.arme);
    const caps = f.querySelector(".fiche-capacites");
    caps.textContent = "";
    h.capacites.forEach((c, i) => {
      const li = document.createElement("li");
      const k = document.createElement("kbd"); k.textContent = TOUCHES[i];
      const n = document.createElement("span"); n.textContent = CAPACITES[c]?.nom || c;
      if (CAPACITES[c]?.texte) li.title = CAPACITES[c].texte;
      li.append(k, n);
      caps.appendChild(li);
    });
    f.classList.remove("change");
    void f.offsetWidth; // relance l'animation d'entrée de la fiche
    f.classList.add("change");

    if (this.agentsProches) this.afficherAgent3D();
  }

  afficherAgent3D() {
    if (!this.monde) return;
    this.monde.montrerAgent(this.agent).catch(() => {
      document.querySelector(".agents-note").textContent = "Aperçu 3D indisponible sur cet appareil";
    });
  }

  // ----- Classement en ligne (API du jeu) -----
  async classement() {
    const corps = document.getElementById("lignes-classement");
    const message = (texte) => {
      corps.textContent = "";
      const tr = document.createElement("tr"), td = document.createElement("td");
      td.colSpan = 6; td.className = "tableau-etat"; td.textContent = texte;
      tr.appendChild(td); corps.appendChild(tr);
    };
    try {
      const controle = new AbortController();
      const delai = setTimeout(() => controle.abort(), 8000);
      const r = await fetch("jeu/api.php?action=classement", { headers: { "X-Requested-With": "duostrike" }, signal: controle.signal });
      clearTimeout(delai);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      const joueurs = (d.joueurs || []).slice(0, 10);
      if (!joueurs.length) { message("Personne au classement pour l'instant. La première place est libre."); return; }
      corps.textContent = "";
      joueurs.forEach((j, i) => {
        const tr = document.createElement("tr");
        const cellules = [String(i + 1).padStart(2, "0"), j.pseudo, j.niveau, j.xp.toLocaleString("fr-FR"), j.victoires, j.kills];
        cellules.forEach((v, k) => {
          const td = document.createElement("td");
          td.textContent = String(v);
          if (k === 1) td.className = "joueur";
          if (k >= 4) td.classList.add("option");
          tr.appendChild(td);
        });
        corps.appendChild(tr);
      });
    } catch (e) {
      message("Classement indisponible pour le moment (il fonctionne sur le site en ligne).");
    }
  }

  // ----- Transition vers le jeu -----
  departVersJeu() {
    for (const lien of document.querySelectorAll("[data-jouer]")) {
      lien.addEventListener("click", (e) => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; // nouvel onglet : comportement normal
        e.preventDefault();
        const adresse = lien.href;
        if (this.reduit) { location.href = adresse; return; }
        document.body.classList.add("depart");
        this.monde?.plonger();
        setTimeout(() => { location.href = adresse; }, 950);
      });
    }
    // Retour arrière depuis le jeu (page restaurée depuis le cache) : on retire le rideau
    addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("depart"); });
  }
}
