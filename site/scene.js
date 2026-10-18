// Scène 3D du site DUO STRIKE : un seul monde continu que la caméra traverse au fil du défilement.
//   Accueil   → le Noyau (cristal de verre épais, cage et anneaux en or brossé) sur son socle
//   Le jeu    → la caméra tourne autour du Noyau
//   Modes     → on passe à travers la grande arche, le couloir de piliers s'ouvre
//   Agents    → socle où apparaît le vrai modèle 3D du personnage choisi (le même que dans le jeu)
//   Classement→ plan large en hauteur
//   Entrer    → face au portail
// Trois niveaux de qualité (choisis selon l'appareil, abaissés automatiquement si les images ralentissent).

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { textureBrossee, textureDalles, textureBrume, textureHalo } from "./textures.js";

// ---------------------------------------------------------------------------
// Qualité
// ---------------------------------------------------------------------------
const NIVEAUX = [
  { nom: "basse", dpr: 1, halo: false, ombres: false, verre: false, particules: 260, eclats: 14, brumes: 3 },
  { nom: "moyenne", dpr: 1.25, halo: true, ombres: false, verre: false, particules: 520, eclats: 26, brumes: 5 },
  { nom: "haute", dpr: 1.75, halo: true, ombres: true, verre: true, particules: 900, eclats: 40, brumes: 7 },
];

function choisirNiveau() {
  const tactile = matchMedia("(pointer: coarse)").matches;
  const petitEcran = Math.min(screen.width, screen.height) < 820;
  const coeurs = navigator.hardwareConcurrency || 4;
  const memoire = navigator.deviceMemory || 8;
  if ((tactile && petitEcran) || coeurs <= 2 || memoire <= 2) return 0;
  if (tactile || coeurs <= 4 || memoire <= 4) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// Palette (couleurs données en sRGB, converties automatiquement)
// ---------------------------------------------------------------------------
const OR = new THREE.Color("#d9b46c");
const OR_PALE = new THREE.Color("#f4dca0");
const GRAPHITE = new THREE.Color("#1b1b1e");
const NOIR = new THREE.Color("#060505");
// Couleurs émissives en linéaire (> 1 : elles déclenchent le halo lumineux)
const LUEUR = new THREE.Color(1.0, 0.62, 0.26);

// ---------------------------------------------------------------------------
// Trajet de la caméra : une étape par section (ancre = haut de la section)
// decal : décalage du cadrage (fraction de l'écran) pour laisser la place au texte
// ---------------------------------------------------------------------------
const ETAPES = [
  { section: "accueil", pos: [0.4, 2.9, 12.8], cible: [0, 2.6, 0], decal: [-0.2, 0.04], decalPortrait: [0, 0.17] },
  { section: "jeu", pos: [-7.2, 1.9, 6.8], cible: [0.2, 2.4, 0], decal: [0.22, 0], decalPortrait: [0, 0.22] },
  { section: "modes", pos: [0.6, 3.1, -16.5], cible: [0, 2.6, -46], decal: [0, -0.05], decalPortrait: [0, 0] },
  { section: "agents", pos: [-2.0, 1.55, -29.0], cible: [0, 1.15, -34], decal: [-0.2, 0.02], decalPortrait: [0, 0.2] },
  { section: "agents", fin: true, pos: [2.2, 1.45, -29.2], cible: [0, 1.1, -34], decal: [-0.2, 0.02], decalPortrait: [0, 0.2] },
  { section: "classement", pos: [6.8, 5.6, -26.8], cible: [-0.6, 1.0, -39], decal: [0.24, 0.02], decalPortrait: [0, 0.12] },
  { section: "entrer", pos: [0, 2.7, -40.5], cible: [0, 3.9, -56], decal: [0, 0], decalPortrait: [0, 0] },
];

const SOCLE_AGENT = new THREE.Vector3(0, 0.3, -34);
const lisse = (k, dt) => 1 - Math.exp(-k * dt);
const adoucir = (t) => t * t * (3 - 2 * t);
const borner = (v, a, b) => Math.min(b, Math.max(a, v));

export class Monde {
  constructor(canvas, { reduit = false, quandPret = () => {} } = {}) {
    this.canvas = canvas;
    this.reduit = reduit;
    this.niveau = choisirNiveau();
    this.q = NIVEAUX[this.niveau];
    this.quandPret = quandPret;
    this.jetables = [];          // géométries, matériaux et textures à libérer
    this.ecouteurs = [];

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.niveau > 0, powerPreference: "high-performance", alpha: false });
    r.setClearColor(NOIR, 1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.localClippingEnabled = true;
    r.shadowMap.enabled = this.q.ombres;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = NOIR.clone();
    this.scene.fog = new THREE.FogExp2(new THREE.Color("#070605"), 0.034);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
    this.horloge = new THREE.Timer();
    this.temps = 0;

    this.preparerEnvironnement();
    this.construireSol();
    this.construireNoyau();
    this.construireArchitecture();
    this.construireLumieres();
    this.construireAtmosphere();
    this.construireSocleAgent();
    this.construirePortail();
    this.preparerRendu();

    // État de la caméra
    this.trajet = {
      pos: new THREE.CatmullRomCurve3(ETAPES.map((e) => new THREE.Vector3(...e.pos)), false, "centripetal"),
      cible: new THREE.CatmullRomCurve3(ETAPES.map((e) => new THREE.Vector3(...e.cible)), false, "centripetal"),
    };
    this.ancres = ETAPES.map(() => 0);
    this.t = 0; this.tCible = 0;
    this.souris = new THREE.Vector2(); this.sourisLisse = new THREE.Vector2();
    this.intro = reduit ? 1 : 0;
    this.plongee = -1;
    this.agent = null;
    this.modeles = new Map();
    this.chronoQualite = { somme: 0, images: 0 };
    this.tmp = { p: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), droite: new THREE.Vector3(), haut: new THREE.Vector3() };

    this.installerEvenements();
    this.redimensionner(true);
    this.boucle = this.boucle.bind(this);
    this.idImage = requestAnimationFrame(this.boucle);
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------
  garder(...objets) { this.jetables.push(...objets); return objets[0]; }

  // Reflets : petite pièce sombre éclairée par des bandeaux dorés et une boîte à lumière chaude
  preparerEnvironnement() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene();
    const geoBoite = new THREE.BoxGeometry(24, 12, 24);
    const geoPlan = new THREE.PlaneGeometry(1, 1);
    const fond = new THREE.MeshBasicMaterial({ color: 0x050404, side: THREE.BackSide });
    env.add(new THREE.Mesh(geoBoite, fond));
    const panneau = (couleur, intensite, l, h, x, y, z, rx, ry) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(...couleur).multiplyScalar(intensite), side: THREE.DoubleSide });
      const p = new THREE.Mesh(geoPlan, m);
      p.scale.set(l, h, 1); p.position.set(x, y, z); p.rotation.set(rx, ry, 0);
      env.add(p);
      return m;
    };
    const mats = [
      panneau([1, 0.86, 0.66], 5, 9, 9, 0, 5.9, 0, Math.PI / 2, 0),      // boîte à lumière au plafond
      panneau([1, 0.64, 0.28], 4, 0.5, 8, -11.8, 1.5, -2, 0, Math.PI / 2), // bandeau doré à gauche
      panneau([1, 0.64, 0.28], 3, 0.4, 8, 11.8, 1.5, 3, 0, -Math.PI / 2),  // bandeau doré à droite
      panneau([0.85, 0.85, 0.88], 1.6, 14, 0.5, 0, 2, -11.8, 0, 0),         // ligne froide au fond (contraste)
    ];
    this.scene.environment = pmrem.fromScene(env, 0.035).texture;
    this.scene.environmentIntensity = 0.9;
    this.garder(this.scene.environment);
    geoBoite.dispose(); geoPlan.dispose(); fond.dispose(); mats.forEach((m) => m.dispose());
    pmrem.dispose();

    const anis = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = {
      brosse: this.garder(textureBrossee(anis)),
      dalles: this.garder(textureDalles(anis)),
      brume: this.garder(textureBrume()),
      halo: this.garder(textureHalo()),
    };
    this.materiaux = {
      or: this.garder(new THREE.MeshPhysicalMaterial({ color: OR, metalness: 1, roughness: 0.3, roughnessMap: this.textures.brosse, anisotropy: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.2 })),
      orPoli: this.garder(new THREE.MeshStandardMaterial({ color: OR_PALE, metalness: 1, roughness: 0.16 })),
      graphite: this.garder(new THREE.MeshStandardMaterial({ color: GRAPHITE, metalness: 0.9, roughness: 0.42, roughnessMap: this.textures.brosse })),
      sombre: this.garder(new THREE.MeshStandardMaterial({ color: new THREE.Color("#0e0e10"), metalness: 0.75, roughness: 0.55 })),
      lueur: this.garder(new THREE.MeshBasicMaterial({ color: LUEUR.clone().multiplyScalar(1.5), toneMapped: false })),
      lueurDouce: this.garder(new THREE.MeshBasicMaterial({ color: LUEUR.clone().multiplyScalar(0.7), toneMapped: false })),
    };
  }

  construireSol() {
    const geo = this.garder(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2));
    const dalles = this.textures.dalles;
    dalles.repeat.set(42, 42);
    const mat = this.garder(new THREE.MeshStandardMaterial({ color: new THREE.Color("#0c0b0b"), map: dalles, bumpMap: dalles, bumpScale: 0.5, roughness: 0.6, metalness: 0.2, envMapIntensity: 0.18 }));
    const sol = new THREE.Mesh(geo, mat);
    sol.position.z = -20;
    sol.receiveShadow = this.q.ombres;
    this.scene.add(sol);

    // Lignes dorées incrustées qui guident le regard jusqu'au portail (segments espacés)
    const segment = this.garder(new THREE.BoxGeometry(0.035, 0.01, 1.6));
    const n = 2 * 34;
    const lignes = new THREE.InstancedMesh(segment, this.materiaux.lueurDouce, n);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const x of [-1.9, 1.9]) for (let k = 0; k < 34; k++) { m.makeTranslation(x, 0.006, 10 - k * 2); lignes.setMatrixAt(i++, m); }
    lignes.frustumCulled = false;
    this.scene.add(lignes);

    // Cercles gravés autour du socle du Noyau
    for (const [r, e, mat2] of [[2.7, 0.025, this.materiaux.lueurDouce], [3.6, 0.012, this.materiaux.lueurDouce], [5.2, 0.008, this.materiaux.lueurDouce]]) {
      const g = this.garder(new THREE.RingGeometry(r, r + e, 128).rotateX(-Math.PI / 2));
      const c = new THREE.Mesh(g, mat2);
      c.position.y = 0.007;
      this.scene.add(c);
    }

    // Reflet du Noyau sur le sol brillant (lumière additive, pas de second rendu)
    const reflet = new THREE.Mesh(this.garder(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2)), this.garder(new THREE.MeshBasicMaterial({ map: this.textures.halo, color: LUEUR.clone().multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    reflet.position.y = 0.012;
    this.refletNoyau = reflet;
    this.scene.add(reflet);
  }

  construireNoyau() {
    const noyau = this.noyau = new THREE.Group();
    noyau.position.set(0, 2.45, 0);
    this.scene.add(noyau);
    const mats = this.materiaux;

    // Cristal de verre épais
    const geoCristal = this.garder(new THREE.OctahedronGeometry(1, 0));
    geoCristal.scale(0.74, 1.3, 0.74);
    const verre = this.q.verre
      ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#fff3dd"), metalness: 0, roughness: 0.06, transmission: 1, thickness: 1.4, ior: 1.52, attenuationColor: new THREE.Color("#b07a2e"), attenuationDistance: 1.6, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1, envMapIntensity: 1.3 })
      : new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#2a2116"), metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false });
    this.garder(verre);
    const cristal = new THREE.Mesh(geoCristal, verre);
    cristal.castShadow = this.q.ombres;
    noyau.add(cristal);
    this.cristal = cristal;

    // Cœur lumineux
    const coeur = new THREE.Mesh(this.garder(new THREE.IcosahedronGeometry(0.27, 1)), this.garder(new THREE.MeshBasicMaterial({ color: LUEUR.clone().multiplyScalar(2.6), toneMapped: false })));
    noyau.add(coeur);
    this.coeur = coeur;
    const halo = new THREE.Sprite(this.garder(new THREE.SpriteMaterial({ map: this.textures.halo, color: LUEUR.clone().multiplyScalar(1.1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })));
    halo.scale.setScalar(3.2);
    noyau.add(halo);
    this.haloNoyau = halo;

    // Cage : une poutre d'or sur chaque arête du cristal
    const pos = geoCristal.getAttribute("position");
    const sommets = [];
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      if (!sommets.some((s) => s.distanceTo(v) < 1e-4)) sommets.push(v);
    }
    const geoPoutre = this.garder(new THREE.CylinderGeometry(0.016, 0.016, 1, 6, 1));
    const haut = new THREE.Vector3(0, 1, 0);
    for (let a = 0; a < sommets.length; a++) for (let b = a + 1; b < sommets.length; b++) {
      const d = sommets[a].distanceTo(sommets[b]);
      if (d > 1.6) continue; // sommets opposés : pas une arête
      const p = new THREE.Mesh(geoPoutre, mats.orPoli);
      p.position.copy(sommets[a]).add(sommets[b]).multiplyScalar(0.5).multiplyScalar(1.015);
      p.scale.set(1, d, 1);
      p.quaternion.setFromUnitVectors(haut, sommets[b].clone().sub(sommets[a]).normalize());
      noyau.add(p);
    }
    for (const s of sommets) {
      const bille = new THREE.Mesh(this.garder(new THREE.IcosahedronGeometry(0.04, 1)), mats.orPoli);
      bille.position.copy(s).multiplyScalar(1.015);
      noyau.add(bille);
    }

    // Anneaux usinés (biseautés) qui gravitent lentement
    this.anneaux = [];
    const defs = [
      { r: 1.62, e: 0.07, p: 0.09, mat: mats.or, inclinaison: [1.15, 0, 0.18], vitesse: 0.07 },
      { r: 1.92, e: 0.05, p: 0.16, mat: mats.graphite, inclinaison: [1.42, 0.5, -0.32], vitesse: -0.045, voyants: 14 },
      { r: 2.22, e: 0.035, p: 0.05, mat: mats.or, inclinaison: [1.7, -0.3, 0.55], vitesse: 0.03 },
    ];
    for (const d of defs) {
      const pivot = new THREE.Group();
      pivot.rotation.set(...d.inclinaison);
      const anneau = new THREE.Mesh(this.garder(geometrieAnneau(d.r, d.e, d.p)), d.mat);
      anneau.castShadow = this.q.ombres;
      pivot.add(anneau);
      if (d.voyants) {
        const geoV = this.garder(new THREE.BoxGeometry(0.05, 0.02, 0.17));
        const v = new THREE.InstancedMesh(geoV, mats.lueur, d.voyants);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < d.voyants; i++) {
          const a = (i / d.voyants) * Math.PI * 2;
          q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
          m.compose(new THREE.Vector3(Math.cos(a) * (d.r - d.e / 2), Math.sin(a) * (d.r - d.e / 2), 0.08), q, s);
          v.setMatrixAt(i, m);
        }
        anneau.add(v);
      }
      noyau.add(pivot);
      this.anneaux.push({ anneau, vitesse: d.vitesse });
    }

    // Socle hexagonal
    const socle = new THREE.Group();
    const bas = new THREE.Mesh(this.garder(new THREE.CylinderGeometry(1.55, 1.75, 0.34, 6)), mats.graphite);
    bas.position.y = 0.17;
    const milieu = new THREE.Mesh(this.garder(new THREE.CylinderGeometry(1.18, 1.3, 0.2, 6)), mats.sombre);
    milieu.position.y = 0.44;
    const liseré = new THREE.Mesh(this.garder(new THREE.TorusGeometry(1.36, 0.012, 4, 6).rotateX(Math.PI / 2)), mats.lueur);
    liseré.position.y = 0.345;
    const plaque = new THREE.Mesh(this.garder(new THREE.CylinderGeometry(0.62, 0.7, 0.06, 6)), mats.or);
    plaque.position.y = 0.57;
    for (const m of [bas, milieu, plaque]) { m.castShadow = this.q.ombres; m.receiveShadow = this.q.ombres; }
    socle.add(bas, milieu, liseré, plaque);
    socle.rotation.y = Math.PI / 6;
    this.scene.add(socle);

    // Lumière émise par le cœur
    this.lumiereNoyau = new THREE.PointLight(new THREE.Color("#ffb85c"), 14, 14, 2);
    noyau.add(this.lumiereNoyau);
  }

  construireArchitecture() {
    const mats = this.materiaux;
    // Couloir de piliers : premier plan, second plan, arrière-plan (perdus dans la brume)
    const alea = generateur(7);
    const piliers = [];
    for (let z = 14; z > -78; z -= 3.4) {
      for (const cote of [-1, 1]) {
        const rangs = alea() < 0.5 ? 2 : 3;
        for (let k = 0; k < rangs; k++) {
          const x = cote * (8.5 + k * 4.2 + alea() * 1.6);
          const h = 8 + alea() * 18;
          const l = 0.8 + alea() * 1.6;
          piliers.push({ x, z: z + alea() * 1.2, h, l, p: 0.8 + alea() * 1.4, lumiere: alea() < 0.22 });
        }
      }
    }
    const geoBoite = this.garder(new RoundedBoxGeometry(1, 1, 1, 2, 0.03));
    const instances = new THREE.InstancedMesh(geoBoite, mats.graphite, piliers.length);
    const geoFente = this.garder(new THREE.BoxGeometry(1, 1, 1));
    const fentes = new THREE.InstancedMesh(geoFente, mats.lueurDouce, piliers.filter((p) => p.lumiere).length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    let f = 0;
    piliers.forEach((p, i) => {
      m.compose(v.set(p.x, p.h / 2, p.z), q, s.set(p.l, p.h, p.p));
      instances.setMatrixAt(i, m);
      if (p.lumiere) {
        // Fente lumineuse verticale sur la face tournée vers le couloir
        const face = p.x < 0 ? p.l / 2 + 0.004 : -p.l / 2 - 0.004;
        m.compose(v.set(p.x + face, p.h * 0.45, p.z), q, s.set(0.02, p.h * 0.7, 0.05));
        fentes.setMatrixAt(f++, m);
      }
    });
    instances.receiveShadow = this.q.ombres;
    this.scene.add(instances, fentes);

    // Grande arche que la caméra traverse (accueil → modes)
    const arche = new THREE.Group();
    arche.position.set(0, 2.6, -12);
    const cadre = new THREE.Mesh(this.garder(geometrieAnneau(6.6, 0.55, 0.9, 160)), mats.graphite);
    const filet = new THREE.Mesh(this.garder(new THREE.TorusGeometry(6.02, 0.018, 6, 200)), mats.lueur);
    filet.position.z = 0.46;
    const filet2 = filet.clone(); filet2.position.z = -0.46;
    arche.add(cadre, filet, filet2);
    // Voyants régulièrement espacés sur le cadre
    const geoVoyant = this.garder(new THREE.BoxGeometry(0.08, 0.3, 0.05));
    const voyants = new THREE.InstancedMesh(geoVoyant, mats.lueur, 24);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
      m.compose(v.set(Math.cos(a) * 6.33, Math.sin(a) * 6.33, 0.47), q, s.set(1, 1, 1));
      voyants.setMatrixAt(i, m);
    }
    arche.add(voyants);
    this.scene.add(arche);

    // Seconde arche, plus fine (modes → agents)
    const arche2 = new THREE.Group();
    arche2.position.set(0, 2.2, -25.5);
    arche2.add(new THREE.Mesh(this.garder(geometrieAnneau(5.1, 0.22, 0.4, 140)), mats.or));
    this.scene.add(arche2);

    // Éclats flottants (premier plan) : plaques de métal sombre qui dérivent lentement
    const geoEclat = this.garder(new THREE.TetrahedronGeometry(0.2, 0));
    const matEclat = this.garder(new THREE.MeshStandardMaterial({ color: new THREE.Color("#8a7047"), metalness: 1, roughness: 0.28 }));
    this.eclats = new THREE.InstancedMesh(geoEclat, matEclat, this.q.eclats);
    this.donneesEclats = [];
    for (let i = 0; i < this.q.eclats; i++) {
      let x, y, z;
      do { x = (alea() - 0.5) * 16; y = 0.6 + alea() * 6.5; z = 11 - alea() * 66; } while (Math.abs(x) < 2.8 && y < 4.2);
      this.donneesEclats.push({
        pos: new THREE.Vector3(x, y, z),
        rot: new THREE.Euler(alea() * 6, alea() * 6, alea() * 6),
        vit: new THREE.Vector3((alea() - 0.5) * 0.2, (alea() - 0.5) * 0.2, (alea() - 0.5) * 0.1),
        ech: new THREE.Vector3(0.6 + alea(), 0.12 + alea() * 0.1, 0.5 + alea() * 0.8),
        phase: alea() * 6.28,
      });
    }
    this.majEclats(0);
    this.scene.add(this.eclats);
  }

  majEclats(t) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3();
    this.donneesEclats.forEach((d, i) => {
      e.set(d.rot.x + d.vit.x * t, d.rot.y + d.vit.y * t, d.rot.z + d.vit.z * t);
      p.copy(d.pos); p.y += Math.sin(t * 0.25 + d.phase) * 0.12;
      m.compose(p, q.setFromEuler(e), d.ech);
      this.eclats.setMatrixAt(i, m);
    });
    this.eclats.instanceMatrix.needsUpdate = true;
  }

  construireLumieres() {
    this.scene.add(new THREE.HemisphereLight(new THREE.Color("#3a3326"), new THREE.Color("#050404"), 0.6));

    // Douche de lumière chaude au-dessus du Noyau (porte les ombres)
    const douche = new THREE.SpotLight(new THREE.Color("#ffe4b5"), 260, 34, 0.42, 0.85, 2);
    douche.position.set(0.8, 15, 1.5);
    douche.target.position.set(0, 1.2, 0);
    douche.castShadow = this.q.ombres;
    if (this.q.ombres) { douche.shadow.mapSize.set(1024, 1024); douche.shadow.bias = -0.0004; douche.shadow.radius = 4; douche.shadow.camera.near = 6; douche.shadow.camera.far = 22; }
    this.scene.add(douche, douche.target);

    // Contre-jour froid et discret : détache les silhouettes métalliques du fond
    const contre = new THREE.DirectionalLight(new THREE.Color("#bfb39c"), 0.28);
    contre.position.set(-6, 5, -10);
    this.scene.add(contre);

    // Lumière qui suit le curseur (reflets mobiles sur le métal)
    this.lumiereCurseur = new THREE.PointLight(new THREE.Color("#ffcf86"), 4, 4.5, 2);
    this.lumiereCurseur.position.set(0, 2.5, 3);
    this.scene.add(this.lumiereCurseur);
  }

  construireAtmosphere() {
    // Faisceaux volumétriques (cônes additifs, fondus sur les bords et vers le sol)
    const matFaisceau = (intensite) => this.garder(new THREE.ShaderMaterial({
      uniforms: { uCouleur: { value: new THREE.Color(1, 0.78, 0.5).multiplyScalar(intensite) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH; varying float vD;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vH = uv.y; vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uCouleur; varying vec3 vN; varying vec3 vV; varying float vH; varying float vD;
        void main(){ float bord = pow(abs(dot(vN, vV)), 2.2); float h = pow(vH, 1.3) * smoothstep(0.0, 0.18, vH);
          float brouillard = 1.0 - smoothstep(18.0, 38.0, vD);
          gl_FragColor = vec4(uCouleur * bord * h * brouillard, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    const cone = (rHaut, rBas, h) => this.garder(new THREE.CylinderGeometry(rHaut, rBas, h, 40, 1, true));
    const f1 = new THREE.Mesh(cone(0.25, 3.4, 15), matFaisceau(0.16));
    f1.position.set(0.4, 7.5, 0.7); f1.rotation.z = 0.05;
    this.scene.add(f1);
    const f2 = new THREE.Mesh(cone(0.2, 2.2, 13), matFaisceau(0.2));
    f2.position.set(0, 6.5, -34);
    this.scene.add(f2);
    // Rais obliques qui traversent le couloir
    const oblique = matFaisceau(0.07);
    for (const [x, z, a] of [[-6, -5, -0.5], [6, -19, 0.55], [-5.5, -40, -0.45], [5, -50, 0.5]]) {
      const f = new THREE.Mesh(cone(0.6, 2.4, 22), oblique);
      f.position.set(x, 8, z); f.rotation.z = a;
      this.scene.add(f);
    }

    // Brume basse : plans qui s'estompent quand la caméra s'en approche
    this.matBrume = this.garder(new THREE.ShaderMaterial({
      uniforms: { uCarte: { value: this.textures.brume }, uTemps: { value: 0 }, uCouleur: { value: new THREE.Color(0.55, 0.48, 0.38) } },
      vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uCarte; uniform float uTemps; uniform vec3 uCouleur; varying vec2 vUv; varying float vD;
        void main(){ float n = texture2D(uCarte, vUv*vec2(1.6,1.0) + vec2(uTemps*0.006, 0.0)).r * texture2D(uCarte, vUv*vec2(0.9,0.7) - vec2(uTemps*0.004, 0.0)).r;
          float bords = smoothstep(0.0,0.25,vUv.y)*smoothstep(1.0,0.45,vUv.y)*smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
          float a = n * bords * smoothstep(1.5, 7.0, vD) * (1.0 - smoothstep(30.0, 55.0, vD));
          gl_FragColor = vec4(uCouleur * a * 0.22, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const geoBrume = this.garder(new THREE.PlaneGeometry(36, 5));
    const zBrumes = [3, -7, -20, -30, -40, -50, -60].slice(0, this.q.brumes);
    for (const z of zBrumes) {
      const b = new THREE.Mesh(geoBrume, this.matBrume);
      b.position.set(0, 1.8, z);
      this.scene.add(b);
    }

    // Poussière dorée en suspension : la dérive est calculée par la carte graphique
    const n = this.q.particules;
    const positions = new Float32Array(n * 3), graines = new Float32Array(n), tailles = new Float32Array(n);
    const alea = generateur(3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (alea() - 0.5) * 28;
      positions[i * 3 + 1] = alea() * 11;
      positions[i * 3 + 2] = 14 - alea() * 74;
      graines[i] = alea();
      tailles[i] = alea() < 0.06 ? 0.16 + alea() * 0.14 : 0.025 + alea() * 0.045; // quelques grosses particules floues au premier plan
    }
    const geo = this.garder(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aGraine", new THREE.BufferAttribute(graines, 1));
    geo.setAttribute("aTaille", new THREE.BufferAttribute(tailles, 1));
    this.matPoussiere = this.garder(new THREE.ShaderMaterial({
      uniforms: { uTemps: { value: 0 }, uEchelle: { value: 600 }, uCouleur: { value: new THREE.Color(1, 0.78, 0.45) } },
      vertexShader: `uniform float uTemps; uniform float uEchelle; attribute float aGraine; attribute float aTaille; varying float vA;
        void main(){ vec3 p = position; float g = aGraine * 6.2831;
          p.x += sin(uTemps*0.11 + g) * 0.45; p.y += sin(uTemps*0.08 + g*2.0) * 0.55; p.z += cos(uTemps*0.09 + g*3.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p,1.0); float d = -mv.z; gl_Position = projectionMatrix * mv;
          gl_PointSize = min(aTaille * uEchelle / max(d, 0.1), 70.0);
          vA = smoothstep(0.4, 2.5, d) * (1.0 - smoothstep(16.0, 34.0, d)) * (0.75 + 0.25*sin(uTemps*0.5 + g*7.0)) * (aTaille > 0.15 ? 0.25 : 1.0); }`,
      fragmentShader: `uniform vec3 uCouleur; varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(uCouleur * a * vA * 0.9, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const poussiere = new THREE.Points(geo, this.matPoussiere);
    poussiere.frustumCulled = false;
    this.scene.add(poussiere);
  }

  construireSocleAgent() {
    const mats = this.materiaux;
    const g = new THREE.Group();
    g.position.set(SOCLE_AGENT.x, 0, SOCLE_AGENT.z);
    const disque = new THREE.Mesh(this.garder(new THREE.CylinderGeometry(1.15, 1.28, 0.3, 64)), mats.graphite);
    disque.position.y = 0.15;
    disque.receiveShadow = this.q.ombres; disque.castShadow = this.q.ombres;
    const bord = new THREE.Mesh(this.garder(new THREE.TorusGeometry(1.15, 0.014, 6, 96).rotateX(Math.PI / 2)), mats.lueur);
    bord.position.y = 0.3;
    const halo = new THREE.Mesh(this.garder(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2)), this.garder(new THREE.MeshBasicMaterial({ map: this.textures.halo, color: LUEUR.clone().multiplyScalar(0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    halo.position.y = 0.01;
    for (const r of [1.9, 2.6]) {
      const c = new THREE.Mesh(this.garder(new THREE.RingGeometry(r, r + 0.012, 96).rotateX(-Math.PI / 2)), mats.lueurDouce);
      c.position.y = 0.008;
      g.add(c);
    }
    g.add(disque, bord, halo);
    this.scene.add(g);

    // Anneau de balayage pendant l'apparition d'un agent
    this.matBalayage = this.garder(new THREE.MeshBasicMaterial({ color: LUEUR.clone().multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.balayage = new THREE.Mesh(this.garder(new THREE.RingGeometry(0.35, 0.62, 64).rotateX(-Math.PI / 2)), this.matBalayage);
    this.balayage.position.copy(SOCLE_AGENT);
    this.scene.add(this.balayage);
    this.decoupe = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    this.apparition = 1;

    const lumiere = new THREE.SpotLight(new THREE.Color("#ffe2b0"), 120, 18, 0.38, 0.7, 2);
    lumiere.position.set(1.2, 9, -31.5);
    lumiere.target.position.copy(SOCLE_AGENT).setY(1);
    lumiere.castShadow = this.q.ombres;
    if (this.q.ombres) { lumiere.shadow.mapSize.set(1024, 1024); lumiere.shadow.bias = -0.0004; lumiere.shadow.camera.near = 4; lumiere.shadow.camera.far = 14; }
    const remplissage = new THREE.PointLight(new THREE.Color("#ffd8a0"), 5, 8, 2);
    remplissage.position.set(-2.2, 1.8, -31.5);
    this.scene.add(lumiere, lumiere.target, remplissage);
  }

  construirePortail() {
    const g = new THREE.Group();
    g.position.set(0, 4.2, -56);
    const cadre = new THREE.Mesh(this.garder(geometrieAnneau(4.5, 0.42, 0.7, 180)), this.materiaux.or);
    const filet = new THREE.Mesh(this.garder(new THREE.TorusGeometry(4.05, 0.02, 6, 200)), this.materiaux.lueur);
    filet.position.z = 0.36;
    this.matPortail = this.garder(new THREE.ShaderMaterial({
      uniforms: { uTemps: { value: 0 }, uIntensite: { value: 0.6 } },
      vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTemps; uniform float uIntensite; varying vec2 vUv; varying float vD;
        void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); float a = atan(p.y, p.x);
          float spirale = sin(a*5.0 + r*11.0 - uTemps*0.5) * 0.5 + 0.5;
          float voile = sin(a*3.0 - r*7.0 + uTemps*0.3) * 0.5 + 0.5;
          vec3 or = vec3(1.0, 0.64, 0.27);
          vec3 c = or * (pow(spirale, 4.0) * 0.18 + pow(voile, 6.0) * 0.1) * smoothstep(1.0, 0.2, r);
          c += or * pow(1.0 - r, 5.0) * 1.4;                           // centre
          c += or * smoothstep(0.82, 1.0, r) * 0.5;                    // bord intérieur
          float alpha = smoothstep(1.0, 0.97, r);
          gl_FragColor = vec4(c * uIntensite * (1.0 - smoothstep(17.0, 26.0, vD)), alpha); }`,
      transparent: true, depthWrite: false,
    }));
    const disque = new THREE.Mesh(this.garder(new THREE.CircleGeometry(4.1, 96)), this.matPortail);
    g.add(cadre, filet, disque);
    // Deux piliers qui tiennent le portail
    for (const x of [-5.4, 5.4]) {
      const p = new THREE.Mesh(this.garder(new RoundedBoxGeometry(0.7, 9, 0.9, 2, 0.04)), this.materiaux.graphite);
      p.position.set(x, 0.3, 0);
      g.add(p);
      const f = new THREE.Mesh(this.garder(new THREE.BoxGeometry(0.03, 7, 0.03)), this.materiaux.lueur);
      f.position.set(x + (x < 0 ? 0.36 : -0.36), 0.3, 0.46);
      g.add(f);
    }
    this.scene.add(g);
    const lumiere = new THREE.PointLight(new THREE.Color("#ffb85c"), 30, 22, 2);
    lumiere.position.set(0, 4.2, -54);
    this.scene.add(lumiere);
  }

  preparerRendu() {
    if (!this.q.halo) { this.composer = null; return; }
    const r = this.renderer;
    const cible = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.niveau === 2 ? 4 : 0 });
    this.composer = new EffectComposer(r, cible);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.passeHalo = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.88);
    this.composer.addPass(this.passeHalo);
    this.composer.addPass(new OutputPass());
  }

  // -------------------------------------------------------------------------
  // Événements
  // -------------------------------------------------------------------------
  ecouter(cible, type, fn, options) { cible.addEventListener(type, fn, options); this.ecouteurs.push([cible, type, fn, options]); }

  installerEvenements() {
    this.ecouter(window, "resize", () => this.redimensionner(), { passive: true });
    this.ecouter(window, "pointermove", (e) => {
      if (e.pointerType === "touch") return;
      this.souris.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
      this.aRendre = true;
    }, { passive: true });
    this.ecouter(window, "scroll", () => { this.aRendre = true; }, { passive: true });
    this.ecouter(this.canvas, "webglcontextlost", (e) => { e.preventDefault(); cancelAnimationFrame(this.idImage); document.body.classList.add("sans-webgl"); });
    // Les sections peuvent changer de hauteur (polices, contenu chargé) : ancres recalculées
    this.observateur = new ResizeObserver(() => this.calculerAncres());
    this.observateur.observe(document.body);
  }

  calculerAncres() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    this.ancres = ETAPES.map((e) => {
      const el = document.getElementById(e.section);
      if (!el) return 0;
      const haut = el.getBoundingClientRect().top + scrollY;
      return Math.min(max, e.fin ? haut + Math.max(0, el.offsetHeight - innerHeight) : haut);
    });
    this.aRendre = true;
  }

  redimensionner(force = false) {
    const l = innerWidth, h = innerHeight;
    // Sur téléphone, la barre d'adresse change la hauteur en défilant : on ignore les petites variations
    if (!force && this.taille && this.taille[0] === l && Math.abs(this.taille[1] - h) < 120) return;
    this.taille = [l, h];
    this.dpr = Math.min(devicePixelRatio || 1, this.q.dpr);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(l, h, false);
    this.camera.aspect = l / h;
    this.portrait = l / h < 0.9;
    this.camera.fov = this.portrait ? 54 : l / h < 1.3 ? 44 : 36;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.dpr);
      this.composer.setSize(l, h);
      this.passeHalo.resolution.set(l / 2, h / 2);
    }
    const hauteurPx = h * this.dpr;
    this.matPoussiere.uniforms.uEchelle.value = hauteurPx / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.calculerAncres();
    this.aRendre = true;
  }

  // -------------------------------------------------------------------------
  // Agents : le vrai modèle du jeu, chargé seulement quand on en a besoin
  // -------------------------------------------------------------------------
  async montrerAgent(id) {
    try {
      if (!this.modules) {
        this.modules = Promise.all([import("../jeu/personnages.js"), import("../jeu/heros.js")]);
      }
      const [{ Personnage }, { HEROS }] = await this.modules;
      if (!HEROS[id]) return;
      this.HEROS = HEROS;
      let m = this.modeles.get(id);
      if (!m) {
        m = new Personnage(id, "vitrine", this.niveau === 0 ? "basse" : "moyenne", HEROS[id].arme);
        m.ombre.visible = false;
        for (const mesh of m.maillages) {
          mesh.material.clippingPlanes = [this.decoupe];
          mesh.castShadow = this.q.ombres;
        }
        m.racine.position.copy(SOCLE_AGENT);
        this.modeles.set(id, m);
      }
      if (this.agent && this.agent !== m) this.scene.remove(this.agent.racine);
      this.agent = m;
      this.idAgent = id;
      for (const mesh of m.maillages) mesh.material.clippingPlanes = [this.decoupe];
      m.ressusciter();
      this.scene.add(m.racine);
      this.apparition = this.reduit ? 1 : 0;
      this.aRendre = true;
    } catch (e) {
      console.warn("Aperçu 3D de l'agent indisponible :", e);
      throw e;
    }
  }

  // Transition vers le jeu : la caméra plonge vers l'avant
  plonger() { this.plongee = 0; }

  // -------------------------------------------------------------------------
  // Boucle
  // -------------------------------------------------------------------------
  progressionDefilement() {
    const y = scrollY, a = this.ancres;
    if (y <= a[0]) return 0;
    for (let i = 0; i < a.length - 1; i++) {
      if (y < a[i + 1]) {
        const ecart = a[i + 1] - a[i];
        return ecart <= 0 ? i + 1 : i + adoucir((y - a[i]) / ecart);
      }
    }
    return a.length - 1;
  }

  boucle(maintenant) {
    this.idImage = requestAnimationFrame(this.boucle);
    this.horloge.update(maintenant);
    const dt = Math.min(Math.max(this.horloge.getDelta(), 0), 0.05);

    const anime = !this.reduit || this.intro < 1 || this.plongee >= 0 || this.apparition < 1;
    this.tCible = this.progressionDefilement();
    const bouge = Math.abs(this.tCible - this.t) > 1e-4 || this.sourisLisse.distanceTo(this.souris) > 1e-4;
    if (!anime && !bouge && !this.aRendre) return; // animations réduites : rien n'a changé, pas de rendu
    this.aRendre = false;

    if (!this.reduit) this.temps += dt;
    const t = this.temps;
    this.t = this.reduit ? this.tCible : this.t + (this.tCible - this.t) * lisse(4.2, dt);
    this.sourisLisse.lerp(this.souris, this.reduit ? 1 : lisse(3, dt));

    this.placerCamera(dt);
    this.animerScene(t, dt);

    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);

    if (!this.pret) { this.pret = true; this.quandPret(this); }
    this.surveillerQualite(dt);
  }

  placerCamera(dt) {
    const { p, c, d, droite, haut } = this.tmp;
    const n = ETAPES.length - 1;
    const u = borner(this.t / n, 0, 1);
    this.trajet.pos.getPoint(u, p);
    this.trajet.cible.getPoint(u, c);

    // Cadrage : décalage interpolé entre les deux étapes voisines
    const i = Math.min(Math.floor(this.t), n - 1), f = this.t - i;
    const cle = this.portrait ? "decalPortrait" : "decal";
    const dx = ETAPES[i][cle][0] + (ETAPES[i + 1][cle][0] - ETAPES[i][cle][0]) * f;
    const dy = ETAPES[i][cle][1] + (ETAPES[i + 1][cle][1] - ETAPES[i][cle][1]) * f;

    // Entrée : la caméra recule puis avance doucement vers le Noyau
    if (this.intro < 1) {
      this.intro = Math.min(1, this.intro + dt / 3.2);
      const k = 1 - Math.pow(1 - this.intro, 3);
      p.z += (1 - k) * 9; p.y += (1 - k) * 2.2;
    }

    // Légère dérive organique + parallaxe au curseur (dans le repère de la caméra)
    d.subVectors(c, p).normalize();
    droite.crossVectors(d, this.camera.up).normalize();
    haut.crossVectors(droite, d).normalize();
    const s = this.sourisLisse;
    const respiration = this.reduit ? 0 : 1;
    p.addScaledVector(droite, s.x * 0.42 + Math.sin(this.temps * 0.21) * 0.08 * respiration);
    p.addScaledVector(haut, s.y * 0.24 + Math.sin(this.temps * 0.17 + 1.3) * 0.05 * respiration);
    c.addScaledVector(droite, s.x * 0.12);

    // Plongée vers le jeu
    if (this.plongee >= 0) {
      this.plongee = Math.min(1, this.plongee + dt / 1.0);
      const k = this.plongee * this.plongee;
      p.addScaledVector(d, k * 7);
      this.camera.fov = this.fovBase() + k * 28;
      if (this.passeHalo) this.passeHalo.strength = 0.5 + k * 2.2;
    } else this.camera.fov = this.fovBase();

    this.camera.position.copy(p);
    this.camera.lookAt(c);
    const [l, h] = this.taille;
    this.camera.setViewOffset(l, h, dx * l, dy * h, l, h);
    this.camera.updateProjectionMatrix();
  }

  fovBase() { const a = this.camera.aspect; return a < 0.9 ? 54 : a < 1.3 ? 44 : 36; }

  animerScene(t, dt) {
    // Noyau : flottement lent, anneaux en orbite, réaction au curseur
    const s = this.sourisLisse;
    this.noyau.position.y = 2.45 + Math.sin(t * 0.55) * 0.07;
    this.noyau.rotation.y = t * 0.06 + s.x * 0.35;
    this.noyau.rotation.x = -s.y * 0.12;
    for (const a of this.anneaux) a.anneau.rotation.z = t * a.vitesse * 2.2;
    const pulsation = 0.92 + Math.sin(t * 1.1) * 0.08;
    this.lumiereNoyau.intensity = 14 * pulsation;
    this.haloNoyau.material.opacity = 0.75 * pulsation;
    this.refletNoyau.material.opacity = 0.8 * pulsation;

    // Lumière du curseur : balaie le Noyau (accueil et présentation du jeu), s'éteint ailleurs
    this.lumiereCurseur.position.set(s.x * 2.6, 2.6 + s.y * 1.6, 2.4);
    this.lumiereCurseur.intensity = 4 * (1 - borner(this.t - 1, 0, 1));

    if (!this.reduit) this.majEclats(t);
    this.matBrume.uniforms.uTemps.value = t;
    this.matPoussiere.uniforms.uTemps.value = t;
    this.matPortail.uniforms.uTemps.value = t;

    // Agent : animé seulement quand la caméra est dans sa zone
    if (this.agent && this.t > 2.2 && this.t < 5.4) {
      const m = this.agent;
      const pose = this.HEROS[this.idAgent].pose;
      m.racine.rotation.y = 0.12 + s.x * 0.5;
      m.maj({ dt: this.reduit ? 0 : dt, vitesse: 0, dirX: 0, dirZ: 1, vise: false, tangage: 0, recharge: -1, pose });
      if (this.apparition < 1) {
        this.apparition = Math.min(1, this.apparition + dt / 1.1);
        const k = adoucir(this.apparition);
        const hauteur = SOCLE_AGENT.y + k * 2.15;
        this.decoupe.constant = hauteur;
        this.balayage.position.y = hauteur;
        this.matBalayage.opacity = Math.sin(this.apparition * Math.PI) * 0.9;
      } else {
        this.decoupe.constant = 100;
        this.matBalayage.opacity = 0;
      }
    }
  }

  // Si l'appareil peine (plus de 30 ms par image en moyenne), on allège le rendu par paliers
  surveillerQualite(dt) {
    if (this.reduit || this.intro < 1 || document.hidden) return;
    const c = this.chronoQualite;
    c.somme += dt; c.images++;
    if (c.images < 150) return;
    const moyenne = c.somme / c.images;
    c.somme = 0; c.images = 0;
    if (moyenne < 0.03) return;
    if (this.dpr > 1) {
      this.q = { ...this.q, dpr: Math.max(1, this.dpr - 0.25) };
      this.redimensionner(true);
    } else if (this.composer) {
      this.composer.dispose();
      this.passeHalo.dispose();
      this.composer = null;
      this.passeHalo = null;
    } else if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
  }

  // -------------------------------------------------------------------------
  // Libération de toutes les ressources WebGL
  // -------------------------------------------------------------------------
  detruire() {
    cancelAnimationFrame(this.idImage);
    for (const [cible, type, fn, options] of this.ecouteurs) cible.removeEventListener(type, fn, options);
    this.observateur?.disconnect();
    for (const m of this.modeles.values()) m.racine.traverse((o) => { o.geometry?.dispose(); });
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    for (const j of this.jetables) j.dispose?.();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

// Anneau plat usiné : couronne extrudée avec un léger biseau (accroche la lumière sur les arêtes)
function geometrieAnneau(rayon, largeur, profondeur, segments = 128) {
  const forme = new THREE.Shape();
  forme.absarc(0, 0, rayon, 0, Math.PI * 2, false);
  const trou = new THREE.Path();
  trou.absarc(0, 0, rayon - largeur, 0, Math.PI * 2, true);
  forme.holes.push(trou);
  const b = Math.min(0.02, largeur * 0.2, profondeur * 0.2);
  const g = new THREE.ExtrudeGeometry(forme, { depth: profondeur, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: segments });
  g.translate(0, 0, -profondeur / 2);
  return g;
}

// Hasard reproductible : la scène est identique à chaque visite
function generateur(graine) {
  let s = graine >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
