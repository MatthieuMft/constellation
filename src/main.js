import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MOODS, TYPES, charger, sauver, surSauvegarde, cleJour, dateDeCle, nouvelId, humeurDuJour } from './store.js';
import * as media from './media.js';
import { creerEditeur } from './editeur.js';
import * as sauv from './sauvegarde.js';
import { legere, chargerProfond, profonde, cos } from './embed.js';
import { avecCache, empreinte, ecrire as ecrireIDB } from './cache.js';
import { monterAnalyse } from './panneaux.js';
import { monterPalette } from './palette.js';
import { creerEtoilesFilantes, creerPoussiere } from './ciel.js';
import { creerVolume } from './volume.js';
import { creerFinition } from './finition.js';
import { creerEvenements } from './evenements.js';
import { creerScenes } from './scenes.js';
import { creerCreature } from './creature.js';
import { creerMonde } from './monde.js';
import { monterJour } from './jour.js';
import { DIST, GEO, niveauPour, distAnnees, libelleJour, NOMS_MOIS, nbJoursMois } from './temps.js';
import * as rappels from './rappels.js';
import { THEMES } from './themes.js';
import { creerCiel, creerDOF, creerParticules } from './rendu.js';
import * as rythme from './rythme.js';
import * as dates from './dates.js';
import { creerMarques } from './marques.js';
import { monterPerso } from './lueur-ui.js';
import { chargerReglages, sauverReglages, monterReglages, DEFAUT } from './reglages.js';
import * as etoiles from './etoiles.js';
import { monterBoutique } from './boutique.js';
import { monterCielPerso } from './ciel-ui.js';
import { creerDecor } from './decor.js';
import { monterAccueil, dejaVu as accueilVu, marquerVu as marquerAccueil } from './accueil.js';
import { t, tn, LOC, LANGUE, EN, choisie as langueChoisie, memoriser as memoriserLangue, changer as changerLangue, traduirePage, DP } from './langue.js';

traduirePage();

const $ = id => document.getElementById(id);
const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const aujourdhui = () => cleJour(new Date());

// ───────────── Réglages / thème ─────────────
let R = chargerReglages();
if (!THEMES[R.theme]) R.theme = 'nuit';
// v11 : ce qui était déjà personnalisé avant que tout s'achète est offert une fois ; le rendu n'utilise que ce qui est acheté (Re)
{ let P0 = {}; try { P0 = (JSON.parse(localStorage.getItem('constellation.creature.v1')) || {}).perso || {}; } catch (e) {} etoiles.migrer({ reglages: R, perso: P0 }); }
let Re = etoiles.reglagesEffectifs(R);
const majEffectifs = () => { Re = etoiles.reglagesEffectifs(R); };
const T = () => THEMES[Re.theme] || THEMES.nuit;
const cm = k => Re.humeurs[k] || (T().humeurs && T().humeurs[k]) || MOODS[k].color;   // couleur d'une humeur
const melange = () => T().clair ? THREE.NormalBlending : THREE.AdditiveBlending;

// ───────────── Données : des entrées rangées par jour ─────────────
let { items, jours: meta } = charger();          // items : toutes les entrées ; meta : humeur choisie par jour
let jours = [];                                  // une pseudo-entrée par jour qui a du contenu (une étoile chacune)
let joursHumeur = [];                            // ceux qui ont une humeur (analyses, petite lueur)
let vecs = [];
let mode = (() => { try { return localStorage.getItem('constellation.mode') || 'legere'; } catch (e) { return 'legere'; } })();
let selection = null;                            // clé du jour ouvert
let chargementInitial = true;                    // au premier chargement, les étoiles s'allument une à une
let surbrillance = null;                         // Map clé -> 0..1 pendant une recherche
const visuels = new Map();                       // clé de jour -> étoile
const visuelsVisibles = new Map();               // celles assez proches pour être vues (sert à la lueur, aux lucioles, aux clics)
const sauverTout = () => { sauver(items, meta); if (items.some(i => i.jour === aujourdhui())) ecrireIDB('rappel-dernier-ecrit', aujourdhui()); };

let mesDates = dates.charger();                  // dates qui comptent
let serieInfo = null;                            // série d'écriture courante
let tagActif = null;                             // étiquette dont on filtre les jours
const tagsDe = i => [...new Set(((i.titre || '') + ' ' + (i.texte || '')).toLowerCase().match(/#[\p{L}\d_-]{2,30}/gu) || [])].map(t => t.slice(1));
const tousLesTags = () => { const m = new Map(); items.forEach(i => tagsDe(i).forEach(t => { const o = m.get(t) || { n: 0, jours: new Set() }; o.n++; o.jours.add(i.jour); m.set(t, o); })); return m; };
const datesDuJour = cle => dates.pourJour(mesDates, cle).map(d => ({ ...d, depuis: d.annuelle ? +cle.slice(0, 4) - +d.jour.slice(0, 4) : 0 }));

// ───────────── Rendu ─────────────
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let scenesRef = null;                       // renseigné plus bas (redim() est appelé avant la création des scènes)
const mobile = matchMedia('(pointer: coarse), (max-width: 720px)').matches;   // appareil tactile ou petit écran : rendu allégé
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 2));   // mobile : 1 pixel d'image = 1 pixel CSS (le gros du gain de fluidité)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 9000);
camera.position.set(0, 20, 50);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.zoomToCursor = true; controls.zoomSpeed = 1.15; controls.screenSpacePanning = true;   // la molette / le pincement plonge vers ce qu'on regarde
controls.autoRotate = false; controls.minDistance = 5; controls.maxDistance = 3000;

const ciel = creerCiel(); scene.add(ciel);
const skyHaut = new THREE.Color(), skyBas = new THREE.Color(), _tc = new THREE.Color(), teinteCour = [0, 0, 0];
const sceneUI = new THREE.Scene();                  // calque de la lueur : dessiné après les effets, avec la caméra du monde
const U = { uClair: { value: 0 }, uTw: { value: 1 }, uCroix: { value: 0 } };   // uniforms partagés (uCroix : objet « Croix de lumière »)

// Rendu principal avec profondeur lisible pour le flou de champ. Le composer clone sa cible en partageant la texture de profondeur
// (boucle de rétroaction) : on lui fournit donc deux cibles indépendantes, chacune avec sa propre profondeur.
const creerCible = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, depthTexture: mobile ? null : new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });   // mobile : pas de flou de champ, donc pas de texture de profondeur
let echelleDyn = 1;                          // résolution dynamique : baisse toute seule si l'appareil peine (voir boucle)
const composer = new EffectComposer(renderer, creerCible());
composer.renderTarget1 = composer.readBuffer = creerCible();
composer.renderTarget2 = composer.writeBuffer = creerCible();
composer.addPass(new RenderPass(scene, camera));
const dof = creerDOF(); composer.addPass(dof);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.6, 0.35);
composer.addPass(bloom);
const finition = creerFinition(mobile); composer.addPass(finition);
const volume = creerVolume(scene, camera, renderer, mobile);
composer.addPass(new OutputPass());

function redim() {
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio() * echelleDyn;
  renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h);
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.depthTexture) { rt.depthTexture.image.width = rt.width; rt.depthTexture.image.height = rt.height; rt.depthTexture.needsUpdate = true; }
  dof.uniforms.uRes.value.set(w * pr, h * pr); dof.uniforms.uMax.value = 11 * pr; finition.uniforms.uRes.value.set(w * pr, h * pr); volume.redim(w, h, pr); if (scenesRef) scenesRef.redim(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener("resize", redim); redim();
const particules = creerParticules(scene, camera, renderer.getPixelRatio());

// ───────────── Textures procédurales ─────────────
function textureRadiale(taille, arrets) {
  const c = document.createElement('canvas'); c.width = c.height = taille;
  const g = c.getContext('2d'), r = g.createRadialGradient(taille / 2, taille / 2, 0, taille / 2, taille / 2, taille / 2);
  arrets.forEach(([o, a]) => r.addColorStop(o, `rgba(255,255,255,${a})`));
  g.fillStyle = r; g.fillRect(0, 0, taille, taille);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const texHalo = textureRadiale(128, [[0, 1], [.18, .55], [.5, .12], [1, 0]]);

// ───────────── Fond d'étoiles (très loin : il reste en place quand on traverse les années) ─────────────
{
  const N = mobile ? 1600 : 3200, pos = new Float32Array(N * 3), tai = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 6.283, c = Math.random() * 2 - 1, s = Math.sqrt(1 - c * c), Rr = 3600 + Math.random() * 1500;
    pos.set([Math.cos(u) * s * Rr, c * Rr, Math.sin(u) * s * Rr], i * 3);
    tai[i] = Math.random() ** 3 * 2.6 + .6; ph[i] = Math.random() * 6.283;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(tai, 1));
  g.setAttribute('aP', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uCol: { value: new THREE.Color(.85, .9, 1) } },
    vertexShader: `attribute float aS; attribute float aP; uniform float uT; uniform float uPR; varying float vA;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = aS*uPR*1.4; vA = .35 + .65*(.5+.5*sin(uT*.8+aP)); }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard;
        gl_FragColor = vec4(uCol*vA, vA*(1.-d*2.)); }`,
  });
  const etoiles = new THREE.Points(g, m); etoiles.frustumCulled = false; scene.add(etoiles);
  scene.userData.etoiles = m;
}

// ───────────── Voie lactée (palier des 100 jours) : une bande de points très loin, sur un grand cercle incliné ─────────────
const lactee = (() => {
  const N = mobile ? 2600 : 5200, pos = new Float32Array(N * 3), tai = new Float32Array(N), ph = new Float32Array(N);
  const ax = new THREE.Vector3(.35, 1, .2).normalize(), u = new THREE.Vector3(1, 0, 0).cross(ax).normalize(), w = ax.clone().cross(u), p = new THREE.Vector3();
  const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / .58;
  for (let i = 0; i < N; i++) {
    const a = Math.random() * 6.283, l = gauss() * .09 * (1 + .4 * Math.sin(a * 3)), R0 = 3300 + Math.random() * 900;
    p.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(w, Math.sin(a)).addScaledVector(ax, l).normalize().multiplyScalar(R0);
    pos.set([p.x, p.y, p.z], i * 3); tai[i] = Math.random() ** 2 * 2 + .5; ph[i] = Math.random() * 6.283;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(tai, 1)); g.setAttribute('aP', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uA: { value: 0 } },
    vertexShader: `attribute float aS; attribute float aP; uniform float uT; uniform float uPR; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = aS*uPR*2.4; vA = .3 + .5*(.5+.5*sin(uT*.5+aP)); }`,
    fragmentShader: `uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor = vec4(vec3(.92,.9,1.)*vA, vA*(1.-d*2.)*uA); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false; pts.userData.ax = ax; scene.add(pts); return pts;
})();

// ───────────── Étoiles : une par jour ─────────────
// Cœur vif, halo, branches de diffraction (4, 6 ou 8 selon la richesse de la journée) et scintillement propre.
const geoQuad = new THREE.PlaneGeometry(1, 1), geoSphere = new THREE.SphereGeometry(1, 12, 8);
const vertexEtoile = `uniform float uSize; varying vec2 vUv;
  void main(){ vUv = position.xy*2.; float s = length(modelMatrix[0].xyz);
    vec4 mv = modelViewMatrix*vec4(0.,0.,0.,1.); mv.xy += position.xy*uSize*s; gl_Position = projectionMatrix*mv; }`;
const fragEtoile = `uniform vec3 uColor; uniform float uT; uniform float uB; uniform float uSeed; uniform float uN; uniform float uTw; uniform float uClair; uniform float uCroix; varying vec2 vUv;
  void main(){
    float r = length(vUv); if (r > 1.) discard;
    float tw = 1. + uTw*(.28*sin(uT*(1.3 + uSeed*1.7) + uSeed*40.) + .12*sin(uT*3.1 + uSeed*17.));
    float ang = uSeed*6.2831 + uT*.03;
    float spikes = 0.;
    for (int k = 0; k < 4; k++) {
      if (float(k) >= uN) break;
      float a = ang + float(k)*3.14159/uN;
      vec2 q = vec2(dot(vUv, vec2(cos(a), sin(a))), dot(vUv, vec2(-sin(a), cos(a))));
      float w = (k == 1 && uN > 2.5) ? .7 : 1.;
      spikes += w * exp(-abs(q.y)*34.) * exp(-abs(q.x)*(3.2/tw));
    }
    // « Croix de lumière » : une grande croix fine qui traverse tout le halo
    spikes += uCroix * 1.3 * (exp(-abs(vUv.y)*60.)*exp(-abs(vUv.x)*1.4) + exp(-abs(vUv.x)*60.)*exp(-abs(vUv.y)*1.4));
    float core = exp(-r*r*70.), glow = exp(-r*4.6)*.4;
    float I = (core*1.5 + glow + spikes*.85) * uB * (1. - smoothstep(.82, 1., r)) * (.88 + .12*tw);
    vec3 col = mix(uColor, vec3(1.), clamp(core*.85 + spikes*.35, 0., 1.));
    col = mix(col, uColor*.45, uClair);
    gl_FragColor = vec4(col, mix(I, min(I, 1.), uClair));
  }`;

// la couleur d'une étoile est toujours l'humeur du jour (neutre s'il n'y en a pas)
function couleurPour(e) { return { couleur: new THREE.Color(e.color || (e.mood ? cm(e.mood) : T().etoile)), eclat: 1 }; }
const hashId = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

function creerVisuel(e) {
  const longueur = e.text.length, branches = e.n >= 6 || longueur > 420 ? 4 : e.n >= 3 || longueur > 140 ? 3 : 2;      // 4, 6 ou 8 branches
  const taille = .62 + Math.min(1, e.n / 6) * .42 + Math.min(1, longueur / 600) * .3;
  const { couleur, eclat } = couleurPour(e), seed = hashId(e.id);

  const groupe = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertexEtoile, fragmentShader: fragEtoile, transparent: true, depthWrite: false, depthTest: false, blending: melange(),
    uniforms: { uColor: { value: couleur.clone() }, uT: { value: 0 }, uB: { value: eclat }, uSeed: { value: seed }, uN: { value: branches },
                uTw: U.uTw, uClair: U.uClair, uCroix: U.uCroix, uSize: { value: taille * 4.8 } },
  });
  const etoile = new THREE.Mesh(geoQuad, mat); etoile.frustumCulled = false; etoile.renderOrder = 3;
  // volume invisible : cible du clic, et profondeur écrite pour le flou de champ
  const cristal = new THREE.Mesh(geoSphere, new THREE.MeshBasicMaterial({ colorWrite: false }));
  cristal.scale.setScalar(taille * 1.5); cristal.userData.id = e.id;

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: couleur, blending: melange(), depthWrite: false, depthTest: false, transparent: true, opacity: .2 * eclat }));
  halo.scale.setScalar(taille * 4.4);

  groupe.add(halo, etoile, cristal); scene.add(groupe);
  return { id: e.id, groupe, cristal, etoile, halo, mat, taille, eclat, vitesse: .15 + seed * .25, cible: new THREE.Vector3(), pulse: 0, lueur: 1, lod: 1 };
}

// ───────────── Le monde du temps ─────────────
const monde = creerMonde({ scene, camera, controls, melange, pr: renderer.getPixelRatio() });
const posDuJour = cle => monde.posJour(dateDeCle(cle));
const marques = creerMarques({ scene, camera, controls, melange, posJour: posDuJour, repere: $('repere'), surRepere: () => volerAujourdhui() });
let niveau = 'semaine', foyer = {}, cleNiveau = '', dernierFoyer = 0, ignorerJour = null, fonduVolume = 0;

function construireJours() {
  const par = new Map(); items.forEach(i => { if (!par.has(i.jour)) par.set(i.jour, []); par.get(i.jour).push(i); });
  jours = [...par.entries()].map(([cle, liste]) => {
    const h = humeurDuJour(cle, items, meta);
    const texte = liste.map(i => i.type === 'media' ? (i.legende || '') : [i.titre, i.texte].filter(Boolean).join('. ')).filter(Boolean).join(' ');
    return { id: cle, date: dateDeCle(cle).getTime(), mood: h ? h.mood : null, color: h && h.color ? h.color : undefined, text: texte, touched: Math.max(...liste.map(i => i.touched || i.date)), sample: liste.every(i => i.sample), n: liste.length };
  }).sort((a, b) => a.date - b.date);
  joursHumeur = jours.filter(j => j.mood);
}
// ───────────── Ton ciel à toi : ce qui pousse en écrivant ─────────────
const joursEcrits = () => jours.filter(j => !j.sample).map(j => j.id);
let nEcrits = 0;
const pousse = cle => etoiles.debloque(cle, nEcrits);
function majPaliers(annoncer = false) {
  const avant = nEcrits; nEcrits = joursEcrits().length;
  monde.vides(pousse('nebuleuses') ? 1 : 0);
  if (annoncer && nEcrits > avant) for (const p of etoiles.PALIERS) if (p.j > 1 && avant < p.j && nEcrits >= p.j) setTimeout(() => toast(t('Nouveau dans ton ciel : {nom}', { nom: p.nom.charAt(0).toLowerCase() + p.nom.slice(1) })), 3200);
}
function reconstruireMonde() {
  const annees = jours.map(j => new Date(j.date).getFullYear()), an = new Date().getFullYear();
  const y0 = Math.min(an, ...annees), y1 = Math.max(an, ...annees);
  monde.reconstruire({ y0, y1, jours: new Map(jours.map(j => [j.id, { n: j.n, couleur: couleurPour(j).couleur }])) });
  monde.regler({ clair: T().clair, encre: T().ui.ink });
  controls.maxDistance = distAnnees(y0, y1) * 1.5;
  serieInfo = rythme.series(jours.map(j => j.id), aujourdhui());
  marques.reconstruire({ chaines: pousse('constellation') ? serieInfo.chaines.filter(c => c.length > 1) : [], dates: dates.occurrences(mesDates, y0, y1), jour: aujourdhui() });
  marques.regler(T().clair, melange());
}

// ───────────── Données → scène ─────────────
async function embarquer(texte, memo = true) {
  if (mode !== 'profonde') return legere(texte);
  return memo ? avecCache('minilm:' + empreinte(texte), () => profonde(texte)) : profonde(texte);   // vecteurs déjà calculés : lus en cache
}

const signature = e => [e.n, e.mood, e.color, Math.round(e.text.length / 40)].join('|');          // ce qui change l'aspect d'une étoile
async function recalculer(annoncer = false) {
  construireJours(); majPaliers(annoncer);
  vecs = []; for (const e of jours) vecs.push(await embarquer(e.text || ' '));
  reconstruireMonde();
  const ids = new Set(jours.map(e => e.id));
  for (const [id, v] of visuels) if (!ids.has(id)) { scene.remove(v.groupe); visuels.delete(id); }
  jours.forEach(e => {
    let v = visuels.get(e.id);
    if (!v) { v = creerVisuel(e); v.sig = signature(e); visuels.set(e.id, v); v.groupe.position.copy(posDuJour(e.id)); v.groupe.scale.setScalar(.001); v.entree = performance.now() + (chargementInitial ? 1800 + visuels.size * 40 : 0); }
    else if (v.sig !== signature(e)) {                                  // la journée a changé : forme, taille et couleur suivent
      const ancien = v; scene.remove(ancien.groupe); v = creerVisuel(e); v.sig = signature(e); v.groupe.position.copy(ancien.groupe.position); v.pulse = 1; visuels.set(e.id, v);
    }
    v.cible.copy(posDuJour(e.id));
  });
  majCompte(); cleNiveau = ''; majNiveau(performance.now(), true);
}

function majCompte() {
  $('compte').textContent = tn(jours.length, '{n} jour écrit', '{n} jours écrits') + ' · ' + tn(items.length, '{n} entrée', '{n} entrées') + (serieInfo && serieInfo.actuelle >= 2 ? ' · ' + t('série de {n} jours', { n: serieInfo.actuelle }) : '') + (items.some(e => e.sample) ? ' · ' + t('exemples') : '');
  majBilan();
  $('exemples').hidden = !items.some(e => e.sample);
}

// ───────────── Niveau de zoom, fil d'Ariane, nébuleuses ─────────────
function majNiveau(now, force = false) {
  const d = camera.position.distanceTo(controls.target), n = niveauPour(d);
  if (force || now - dernierFoyer > 160) { foyer = monde.foyer(); dernierFoyer = now; }
  const cle = [n, foyer.annee && foyer.annee.cle, foyer.mois && foyer.mois.cle, foyer.semaine && foyer.semaine.cle, (n === 'jour' || n === 'semaine') ? foyer.jour : ''].join('|');
  niveau = n;
  if (cle === cleNiveau) return; cleNiveau = cle;
  majFil(); cuireVolumeNiveau(); fonduVolume = 0;
  // plonger dans une journée ouvre ses entrées ; s'éloigner les referme
  if (n !== 'jour') ignorerJour = null;
  if (n === 'jour' && foyer.jour && foyer.jour !== ignorerJour && selection !== foyer.jour && jours.some(j => j.id === foyer.jour) && !intro.actif && $('ecrire').hidden) choisir(foyer.jour, { relire: false, voler: false });
  else if ((n === 'mois' || n === 'annee' || n === 'annees') && selection && !parcours && $('ecrire').hidden) fermerFiche();
}
// une phrase sur la période regardée : jours écrits, humeur dominante, saison
function majBilan() {
  const p = $('bilan'); let txt = '';
  const parCle = new Map(jours.map(j => [j.id, j])), maj = x => x.charAt(0).toUpperCase() + x.slice(1);
  const f = foyer || {};
  if ((niveau === 'semaine' || niveau === 'jour') && f.semaine) {
    const d = f.semaine.dates; txt = maj(rythme.saisonDuMois(d[0].getMonth()).nom) + ' · ' + rythme.bilan(d.map(x => parCle.get(cleJour(x))).filter(Boolean), d.length, f.semaine.courante ? t('Cette semaine') : t('Semaine du {d}', { d: d[0].getDate() + ' ' + NOMS_MOIS[d[0].getMonth()] }));
  } else if (niveau === 'mois' && f.mois) {
    const m = f.mois, liste = jours.filter(j => { const d = new Date(j.date); return d.getFullYear() === m.y && d.getMonth() === m.m; }), now = new Date();
    txt = maj(rythme.saisonDuMois(m.m).nom) + ' · ' + rythme.bilan(liste, nbJoursMois(m.y, m.m), m.y === now.getFullYear() && m.m === now.getMonth() ? t('Ce mois-ci') : t('En {mois}', { mois: NOMS_MOIS[m.m] }));
  } else if (niveau === 'annee' && f.annee) {
    const n = jours.filter(j => new Date(j.date).getFullYear() === f.annee.y).length; txt = f.annee.y + DP + tn(n, '{n} jour écrit', '{n} jours écrits') + '.';
  } else if (serieInfo) txt = serieInfo.record >= 2 ? t('Série actuelle : {a} · record : {r}', { a: tn(serieInfo.actuelle, '{n} jour', '{n} jours'), r: serieInfo.record }) : '';
  p.textContent = txt;
}
function majFil() {
  majBilan();
  const f = $('fil'); f.replaceChildren();
  const seg = [[t('Années'), () => volerGeneral()]];
  if (niveau !== 'annees' && foyer.annee) seg.push([foyer.annee.libelle, () => voler(foyer.annee.centre, DIST.annee)]);
  if (['mois', 'semaine', 'jour'].includes(niveau) && foyer.mois) seg.push([NOMS_MOIS[foyer.mois.m], () => voler(foyer.mois.centre, DIST.mois)]);
  if (['semaine', 'jour'].includes(niveau) && foyer.semaine) seg.push([foyer.semaine.libelle, () => voler(foyer.semaine.centre, DIST.semaine)]);
  if (niveau === 'jour' && foyer.date) seg.push([libelleJour(foyer.date), () => voler(monde.posJour(foyer.date), DIST.jour)]);
  seg.forEach(([txt, fn], i) => { if (i) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '›'; f.append(s); } const b = document.createElement('button'); b.textContent = txt; b.addEventListener('click', fn); f.append(b); });
  f.scrollLeft = f.scrollWidth;
}
function volerGeneral() { voler(monde.centreAnnee((monde.y0 + monde.y1) / 2), distAnnees(monde.y0, monde.y1)); }
function volerAujourdhui() {                           // d'abord dans la nébuleuse de la semaine, puis (deuxième appui) dans la journée
  const cle = aujourdhui(), p = posDuJour(cle);
  if (camera.position.distanceTo(p) < DIST.semaine * 1.6 && controls.target.distanceTo(p) < 16) { choisir(cle); return; }
  voler(p, DIST.semaine);
}
$('zoom-aujourdhui').addEventListener('click', volerAujourdhui);
function remonter() {                                  // un niveau au-dessus
  if (niveau === 'jour' && foyer.semaine) voler(foyer.semaine.centre, DIST.semaine);
  else if (niveau === 'semaine' && foyer.mois) voler(foyer.mois.centre, DIST.mois);
  else if (niveau === 'mois' && foyer.annee) voler(foyer.annee.centre, DIST.annee);
  else if (niveau === 'annee') volerGeneral();
}
function descendre() {                                 // un niveau plus près
  if (niveau === 'annees' && monde.noeuds.annees.length) { const a = monde.noeuds.annees.slice().sort((x, y) => x.centre.distanceTo(controls.target) - y.centre.distanceTo(controls.target))[0]; voler(a.centre, DIST.annee); }
  else if (niveau === 'annee' && foyer.mois) voler(foyer.mois.centre, DIST.mois);
  else if (niveau === 'mois' && foyer.semaine) voler(foyer.semaine.centre, DIST.semaine);
  else if (niveau === 'semaine' && foyer.date) voler(monde.posJour(foyer.date), DIST.jour);
}
$('zoom-plus').addEventListener('click', descendre);
$('zoom-moins').addEventListener('click', remonter);
function plonger(n) { voler(n.centre, n.type === 'annee' ? DIST.annee : n.type === 'mois' ? DIST.mois : DIST.semaine); }

// Les nébuleuses volumineuses du niveau courant : ce que l'on regarde de loin devient un nuage de gaz coloré par les humeurs.
function cuireVolumeNiveau() {
  const f = foyer, L = [], neb = pousse('nebuleuses'), blob = (n, k, w) => ({ pos: n.centre, couleur: n.couleur, rayon: n.rayon * k, poids: neb ? w : 0 });
  if (niveau === 'annees') monde.noeuds.annees.forEach(n => L.push(blob(n, .78, n.n ? .55 : .15)));
  else if (niveau === 'annee' && f.annee) monde.noeuds.mois.filter(n => n.y === f.annee.y).forEach(n => L.push(blob(n, 1, n.n ? .35 + Math.min(.45, n.nbJours * .03) : .1)));
  else if (niveau === 'mois' && f.mois) monde.noeuds.semaines.filter(n => n.cleMois === f.mois.cle).forEach(n => L.push(blob(n, 1.15, n.n ? .45 : .1)));
  else if (f.semaine) f.semaine.dates.forEach(d => { const v = visuels.get(cleJour(d)); if (v) L.push({ pos: v.groupe.position, couleur: v.mat.uniforms.uColor.value, rayon: 4 + v.taille * 3, poids: .6 }); });
  volume.cuire(L);
}

// ───────────── Mots magiques et surprises ─────────────
// Un mot écrit dans une pensée peut déclencher une scène dans le ciel (pluie, mer, lune, feu…), au plus une toutes les 7 secondes.
let dernierMot = 0, dernierTexte = 0, ouvertureEcriture = 0;     // dernière frappe, ouverture de l'éditeur (la mascotte patiente)
function motsMagiques(texte, delai = 0) {
  const nom = scenes.motMagique(texte); if (!nom || R.animation <= 0) return;
  const jouer = () => { if (performance.now() - dernierMot < 7000) return; dernierMot = performance.now(); scenes.jouer(nom); };
  delai ? setTimeout(jouer, delai) : jouer();
}
function surprise() {                                    // « Surprends-moi » : une surprise au hasard, tout de suite
  const clair = T().clair, choix = ['comete', 'dessin', 'baleine', 'satellite', ...(clair ? [] : ['aurore', 'planete'])];
  if (Math.random() < .35) { const n = scenes.liste().filter(k => k !== 'etoile'); scenes.jouer(n[Math.floor(Math.random() * n.length)]); }
  else evenements.declencher(choix[Math.floor(Math.random() * choix.length)]);
}

// ───────────── Entrée cinématique ─────────────
// La caméra plonge des années vers la semaine en cours, dans un flou de zoom ; puis les étoiles s'allument une à une.
const intro = { actif: false, t0: 0, duree: 5600 };
const vueInitiale = () => { const cible = monde.posJour(new Date()), dir = new THREE.Vector3(.15, .55, .82).normalize(); return { cible, dir }; };
function demarrerIntro() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finIntro(true); return; }
  intro.actif = true; intro.t0 = performance.now(); controls.enabled = false; controls.maxDistance = 6000;
  document.body.classList.add('intro');
}
function finIntro(direct = false) {
  if (!intro.actif && !direct) return;
  intro.actif = false; controls.enabled = true; controls.maxDistance = distAnnees(monde.y0, monde.y1) * 1.5;
  const v = vueInitiale(); camera.fov = 55; camera.updateProjectionMatrix(); camera.position.copy(v.cible).addScaledVector(v.dir, DIST.semaine); controls.target.copy(v.cible);
  finition.uniforms.uWarp.value = 0; document.body.classList.remove("intro"); apresIntro();
}
function animerIntro(now) {
  if (!intro.actif) return;
  const k = Math.min(1, (now - intro.t0) / intro.duree), e = 1 - Math.pow(1 - k, 3.2), v = vueInitiale();
  const dist = Math.exp(Math.log(2400) * (1 - e) + Math.log(DIST.semaine) * e);               // zoom régulier : on traverse les niveaux
  camera.position.copy(v.cible).addScaledVector(v.dir, dist); controls.target.copy(v.cible);
  camera.fov = 55 + (1 - e) * 30; camera.updateProjectionMatrix();
  finition.uniforms.uWarp.value = (1 - e) * .14;
  if (k >= 1) finIntro();
}
['pointerdown', 'keydown'].forEach(t => addEventListener(t, () => { if (intro.actif && performance.now() - intro.t0 > 500) intro.t0 = performance.now() - intro.duree; }));

// ───────────── Boucle ─────────────
const horloge = new THREE.Clock();
let fonduEtiq = 0;                                // les noms de dates arrivent en douceur après l'entrée
let survole = null, eclatDans = 3;                 // étoile sous le curseur, minuteur d'éclats
const meteores = creerEtoilesFilantes(scene, camera), poussiere = creerPoussiere(scene, renderer.getPixelRatio(), mobile ? 450 : 900);

// secousse d'écran (éclair, supernova) : décalage de la projection, qui ne s'accumule jamais
let tremble = { amp: 0, t0: 0, dur: 0 };
const secousse = (amp, dur) => { tremble = { amp, t0: performance.now(), dur: dur * 1000 }; };
const evenements = creerEvenements({ scene, camera, melange, texHalo, pr: renderer.getPixelRatio() });
const lucioles = evenements.creerLucioles(() => visuelsVisibles);
const decor = creerDecor({ scene, camera });
const scenes = creerScenes({ scene, camera, particules, meteores, melange, texHalo, evenements, secousse }); scenesRef = scenes; scenes.redim(innerWidth, innerHeight);

// La petite lueur : un esprit de lumière qui vit dans la galaxie, dessiné nettement par-dessus les effets (voir creature.js).
const creature = creerCreature({
  sceneUI, camera, controls, particules, texHalo, entrees: () => joursHumeur, couleurDe: e => new THREE.Color(e.color || cm(e.mood)), surMessage: t => statutTemporaire(t, 6500),
  etoiles: () => visuelsVisibles, ouvrirPensee: id => choisir(id), mobile,
});
const pointeur = { x: 0, y: 0, t: -1e9 };
{ // elle réagit au ciel : orage, pluie, baleine…
  const jouer = scenes.jouer.bind(scenes), declencher = evenements.declencher.bind(evenements);
  scenes.jouer = nom => { creature.reagir(nom); return jouer(nom); };
  evenements.declencher = (nom, arg) => { creature.reagir(nom); return declencher(nom, arg); };
}
let vol_cam = null;                 // vol de caméra
const ease = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
const _p = new THREE.Vector3();

let msMoy = 16, msComptes = 0, msDernier = 0;
function regulerResolution(now) {       // moyenne glissante du temps d'image ; trop lent -> on baisse la résolution interne, très fluide -> on la remonte
  if (msDernier) msMoy += (Math.min(now - msDernier, 100) - msMoy) * .08;
  msDernier = now;
  if (++msComptes < 45) return;
  msComptes = 0;
  const plancher = mobile ? .5 : .65;
  let n = echelleDyn;
  if (msMoy > 24 && n > plancher) n = Math.max(plancher, n - .15);
  else if (msMoy < 15 && n < 1) n = Math.min(1, n + .1);
  if (n !== echelleDyn) { echelleDyn = n; redim(); }
}
// joystick virtuel (v22) : un carré en bas à gauche ; on pousse le petit carré du doigt pour se déplacer dans le ciel
const joy = { x: 0, y: 0 }, _joyD = new THREE.Vector3(), _joyH = new THREE.Vector3();
{
  const z = $('joystick'), pion = z.querySelector('i'), R = 28; let id = null, cx = 0, cy = 0;
  const poser = (dx, dy) => { const l = Math.hypot(dx, dy), k = l > R ? R / l : 1; dx *= k; dy *= k; pion.style.transform = `translate(${dx}px, ${dy}px)`; joy.x = dx / R; joy.y = -dy / R; };
  z.addEventListener('pointerdown', e => { id = e.pointerId; const r = z.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; z.setPointerCapture(id); poser(e.clientX - cx, e.clientY - cy); e.preventDefault(); });
  z.addEventListener('pointermove', e => { if (e.pointerId === id) poser(e.clientX - cx, e.clientY - cy); });
  const fin = e => { if (e.pointerId !== id) return; id = null; poser(0, 0); };
  z.addEventListener('pointerup', fin); z.addEventListener('pointercancel', fin);
}
function boucle() {
  const dt = Math.min(horloge.getDelta(), .05), t = horloge.elapsedTime, now = performance.now();
  if (!document.hidden) regulerResolution(now);
  scene.userData.etoiles.uniforms.uT.value = t; lactee.material.uniforms.uT.value = t;

  visuelsVisibles.clear();
  for (const v of visuels.values()) {
    const g = v.groupe;
    const d = g.position.distanceTo(v.cible);
    if (d > .005) g.position.lerp(v.cible, 1 - Math.exp(-dt * 2.2));
    const ent = v.entree ? Math.min(1, (now - v.entree) / 1400) : 1;
    if (ent < 1) g.scale.setScalar(Math.max(.001, ease(ent))); else if (v.entree) { g.scale.setScalar(1); v.entree = 0; }
    v.lod = 1 - lisse(110, 240, camera.position.distanceTo(g.position));          // de loin, les nébuleuses prennent le relais
    g.visible = v.lod > .01; if (v.lod > .3) visuelsVisibles.set(v.id, v);
    v.pulse = Math.max(0, v.pulse - dt * .6);
    const cible = surbrillance ? (surbrillance.get(v.id) || 0) * 1 + .12 : 1, sel = v.id === selection ? 1.6 : (v.id === survole ? 1.35 : 1);
    v.lueur += (cible * sel - v.lueur) * Math.min(1, dt * 6);
    const charge = v.id === chargeId ? Math.min(1, (now - chargeT0) / 800) : 0;          // maintien du clic : l'étoile gonfle et vibre
    v.mat.uniforms.uT.value = t; v.mat.uniforms.uB.value = (v.eclat * (.3 + .7 * Math.min(1.5, v.lueur)) + v.pulse * .9 + charge * .9) * v.lod;
    v.mat.uniforms.uSize.value = v.taille * 4.8 * (1 + v.pulse * .55 + (sel > 1 ? .18 : 0) + charge * charge * .9);
    v.halo.material.opacity = (.16 * v.eclat * Math.min(1.5, v.lueur) + v.pulse * .5) * v.lod;
    v.halo.scale.setScalar(v.taille * (4.4 + v.pulse * 4));
  }
  // éclats : une étoile visible s'embrase de temps en temps
  eclatDans -= dt;
  if (eclatDans <= 0 && R.animation > 0 && visuelsVisibles.size) { const a = [...visuelsVisibles.values()]; a[Math.floor(Math.random() * a.length)].pulse = .8; eclatDans = (2.5 + Math.random() * 5) / R.animation; }
  meteores.update(dt, etoiles.actif('filantes-or') ? R.animation * 2.5 : etoiles.actif('filantes') ? R.animation : 0);
  poussiere.update(t, R.animation, controls.target, camera.position.distanceTo(controls.target), etoiles.actif('poussiere') ? 1 : 0);
  lactee.material.uniforms.uA.value += ((etoiles.actif('lactee') ? 1 : 0) - lactee.material.uniforms.uA.value) * Math.min(1, dt * 1.2); lactee.visible = lactee.material.uniforms.uA.value > .01;
  fonduEtiq = intro.actif ? 0 : Math.min(1, fonduEtiq + dt * .8); monde.fonduEtiquettes(fonduEtiq * fonduEtiq);
  monde.update(niveau);
  majNiveau(now);
  fonduVolume = Math.min(1, fonduVolume + dt * 1.6); volume.gain(Re.brume * fonduVolume);

  const dAvant = creature.memoriser();                 // la lueur suit tous les mouvements de caméra qui suivent
  if (vol_cam) {
    const k = Math.min(1, (now - vol_cam.t0) / vol_cam.duree), e = ease(k);
    controls.target.lerpVectors(vol_cam.t1, vol_cam.t2, e); camera.position.lerpVectors(vol_cam.c1, vol_cam.c2, e);
    if (k >= 1) vol_cam = null;
  }
  if (joy.x || joy.y) {                                 // v22 : le joystick fait glisser la vue, plus vite quand on est loin
    vol_cam = null; const d = camera.position.distanceTo(controls.target), k = Math.max(8, d) * .9 * dt;
    _joyD.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(joy.x * k).addScaledVector(_joyH.setFromMatrixColumn(camera.matrixWorld, 1), joy.y * k);
    camera.position.add(_joyD); controls.target.add(_joyD);
  }
  animerIntro(now);
  controls.autoRotate = niveau === 'annees' && !selection && !vol_cam && $('ecrire').hidden && Re.vitesse > 0 && !intro.actif;
  controls.autoRotateSpeed = Re.vitesse;
  controls.update();
  creature.suivre(dAvant);
  marques.update(t, { niveau, masquer: intro.actif });
  { // saison : le ciel prend une légère teinte de la saison du mois regardé
    const m = foyer && foyer.mois && niveau !== 'annees' ? foyer.mois.m : new Date().getMonth(), tg = rythme.saisonDuMois(m).teinte, k = Math.min(1, dt * .9), f = T().clair ? .2 : 1;
    for (let i = 0; i < 3; i++) teinteCour[i] += (tg[i] * f - teinteCour[i]) * k;
    _tc.setRGB(teinteCour[0], teinteCour[1], teinteCour[2]); ciel.material.uniforms.uHaut.value.copy(skyHaut).add(_tc); ciel.material.uniforms.uBas.value.copy(skyBas).add(_tc);
  }

  // mise au point : sur le point regardé, avec retard doux
  const foc = camera.position.distanceTo(controls.target);
  dof.uniforms.uFocus.value += (foc - dof.uniforms.uFocus.value) * Math.min(1, dt * 5);
  dof.uniforms.uAper.value = Re.flou * 3; dof.enabled = Re.flou > 0.01 && !mobile;
  particules.update(dt); animerParcours(dt);
  evenements.update(dt, R.animation, T().clair, { cometes: etoiles.actif('cometes'), aurores: etoiles.actif('aurores'), dessins: etoiles.actif('dessins'), baleine: etoiles.actif('baleine'), satellites: etoiles.actif('satellites'), planetes: decor.PLANETES.some(etoiles.actif), lune: etoiles.actif('lune') });
  lucioles.maj(dt, R.animation, etoiles.actif('lucioles') ? 1 : 0); decor.update(dt, R.animation); scenes.update(dt);
  { const h = new Date().getHours(), occupe = palette.ouverte() || ["fiche", "reglages", "analyse", "nommer", "perso", "dateqc", "menu", "boutique"].some(id => !$(id).hidden), ecr = !$("ecrire").hidden, ta = $("texte");
    if (ecr && (ta.value.length === 0 ? now - ouvertureEcriture > 10000 : now - dernierTexte > 12000)) creature.patiente();
    creature.update(dt, t, { W: innerWidth, H: innerHeight, ecriture: ecr, rectEcriture: ecr ? $("ecrire").getBoundingClientRect() : null, caret: (ta.selectionStart % 50) / 50,
      selection: selection && visuelsVisibles.get(selection) ? visuelsVisibles.get(selection).groupe.position : null,
      guide: parcours && parcours.courbe ? parcours.courbe.getPoint(Math.min(1, parcours.t + .07)) : null,
      curseur: pointeur, curseurActif: now - pointeur.t < 12000 && !intro.actif, curseurImmobile: (now - pointeur.t) / 1000, inactivite: (now - dernierGeste) / 1000,
      pose: persoUI.ouvert() ? persoUI.rect() : null, phrases: phrasesLueur(),
      nuit: (h >= 23 || h < 6) && !accueil.actif(), occupe, meteores: meteores.vives() }); }
  if (tremble.dur) { const k = 1 - (now - tremble.t0) / tremble.dur; if (k > 0) { const a = tremble.amp * k * k, W = innerWidth, H = innerHeight; camera.setViewOffset(W, H, (Math.random() - .5) * 2 * a, (Math.random() - .5) * 2 * a, W, H); } else { camera.clearViewOffset(); tremble.dur = 0; } }

  // scène complète, puis flou de champ et lueur
  finition.uniforms.uTime.value = t; volume.rendre(t);
  creature.rendreVignettes(renderer);                  // vignettes 3D de la boutique en attente (dans un coin de l'écran, recouvert juste après)
  composer.render();
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(sceneUI, camera); renderer.autoClear = true;   // la mascotte : nette, jamais floutée ; profondeur vidée (la passe de sortie la laisse à 0), elle s'occulte elle-même
  copierCiel();
  requestAnimationFrame(boucle);
}

// vol de caméra vers un point, à une distance qui correspond à un niveau de zoom
function voler(position, dist = DIST.jour, vue = null) {     // vue (facultatif) : direction du regard voulue à l'arrivée (pour montrer une planète)
  const dir = vue ? vue.clone().negate().normalize() : camera.position.clone().sub(controls.target); if (dir.lengthSq() < 1e-6) dir.set(.15, .55, .82); dir.normalize(); if (!vue && dir.y < .3) { dir.y = .3; dir.normalize(); }
  const c2 = position.clone().addScaledVector(dir, dist), saut = camera.position.distanceTo(c2);
  vol_cam = { t0: performance.now(), duree: Math.min(2800, Math.max(1100, 800 + Math.log10(saut + 10) * 650)), t1: controls.target.clone(), t2: position.clone(), c1: camera.position.clone(), c2 };
}

// ───────────── Une journée : ses entrées ─────────────
const fmtDate = ms => new Date(ms).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const itemsDuJour = cle => items.filter(i => i.jour === cle);

const panneauJour = monterJour($('f-contenu'), {
  items: itemsDuJour, humeur: cle => humeurDuJour(cle, items, meta), couleur: cm, aujourdhui: aujourdhui(),
  setHumeur: async (cle, mood, couleur) => { meta[cle] = { humeur: mood, couleur: couleur || undefined }; sauverTout(); await recalculer(); },
  ajouter: cle => ouvrirEcrire({ jour: cle }), modifier: item => ouvrirEcrire({ item }),
  supprimer: item => supprimerItem(item), basculerFait: (item, fait) => { item.fait = fait; item.touched = Date.now(); sauverTout(); },
  voirMedia: (item, med) => voirMedia(item, med), mediaUrl: k => media.url(k),
  tagsDe, filtrer: t => filtrerPar(t), datesDuJour, editerDate: (cle, d) => ouvrirDate(cle, d),
});

// ───────────── Étiquettes (#mot dans le texte) ─────────────
function filtrerPar(tag) {
  const o = tousLesTags().get(tag); if (!o) { statutTemporaire(t('Aucune entrée avec #{tag}', { tag })); return; }
  jetonRecherche++; tagActif = tag; surbrillance = new Map([...o.jours].map(j => [j, 1]));
  const b = $('filtre'); b.hidden = false; b.textContent = '#' + tag + ' · ' + o.n + ' ×';
  const dernier = [...o.jours].sort().pop(); if (dernier) voler(posDuJour(dernier), DIST.mois);
}
function effacerFiltre() { if (!tagActif) return; tagActif = null; surbrillance = null; $('filtre').hidden = true; }
$('filtre').addEventListener('click', effacerFiltre);

// ───────────── Dates qui comptent ─────────────
let dqEdition = null;
function ouvrirDate(cle, existante = null) {
  dqEdition = { cle, id: existante ? existante.id : null };
  $('dateqc-jour').textContent = fmtDate(dateDeCle(cle).getTime()); $('dateqc-titre').value = existante ? existante.titre : '';
  $('dateqc-annuelle').checked = existante ? !!existante.annuelle : true; $('dateqc-suppr').hidden = !existante; $('dateqc').hidden = false; $('dateqc-titre').focus();
}
function fermerDate() { $('dateqc').hidden = true; dqEdition = null; }
async function appliquerDates() { dates.sauver(mesDates); await recalculer(); if (selection) panneauJour.rendre(selection); }
$('dateqc-ok').addEventListener('click', async () => {
  const titre = $('dateqc-titre').value.trim(); if (!titre || !dqEdition) { $('dateqc-titre').focus(); return; }
  const annuelle = $('dateqc-annuelle').checked;
  if (dqEdition.id) { const d = mesDates.find(x => x.id === dqEdition.id); if (d) { d.titre = titre; d.annuelle = annuelle; } } else mesDates.push({ id: nouvelId(), jour: dqEdition.cle, titre, annuelle });
  const cle = dqEdition.cle; fermerDate(); await appliquerDates();
  if (cle === aujourdhui()) creature.fete(t('Aujourd’hui : {titre} !', { titre })); else statutTemporaire('★ ' + titre);
});
$('dateqc-suppr').addEventListener('click', async () => { if (dqEdition && dqEdition.id) mesDates = mesDates.filter(x => x.id !== dqEdition.id); fermerDate(); await appliquerDates(); });
$('dateqc-annuler').addEventListener('click', fermerDate);
$('dateqc-titre').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('dateqc-ok').click(); } if (e.key === 'Escape') { e.preventDefault(); fermerDate(); } e.stopPropagation(); });
$('f-date').addEventListener('click', () => { if (!selection) return; const l = datesDuJour(selection); ouvrirDate(selection, l[0] || null); });

// ───────────── Phrases de la lueur (série, dates, saison) ─────────────
let phrasesCache = { t: 0, l: [] };
function phrasesLueur() {
  const now = performance.now(); if (now - phrasesCache.t < 20000) return phrasesCache.l;
  const l = [], s = serieInfo, h = new Date().getHours();
  if (s) {
    if (s.actuelle >= 2) l.push(t('{n} jours d’affilée. Continue !', { n: s.actuelle }));
    if (s.record >= 5 && s.actuelle === s.record) l.push(t('C’est ton record de série !'));
    if (!s.ecritAujourdhui && h >= 18) l.push(t('Et si on racontait aujourd’hui ?'));
  }
  const pr = dates.prochaine(mesDates, aujourdhui());
  if (pr) { const n = Math.round((dateDeCle(pr.cle) - dateDeCle(aujourdhui())) / 864e5); if (n === 0) l.push(t('Aujourd’hui : {titre} !', { titre: pr.titre })); else if (n <= 7) l.push(t('Dans {n} : {titre}.', { n: tn(n, '{n} jour', '{n} jours'), titre: pr.titre })); }
  const sa = rythme.saisonDuMois(new Date().getMonth()).cle;
  l.push(t(sa === 'hiver' ? 'Il fait froid dehors, pas ici.' : sa === 'printemps' ? 'Ça sent le printemps.' : sa === 'ete' ? 'Les nuits d’été sont les plus douces.' : 'J’aime l’automne et ses couleurs.'));
  phrasesCache = { t: now, l }; return l;
}

function choisir(cle, { relire = true, voler: aller = true } = {}) {
  selection = cle; ignorerJour = null;
  const v = visuels.get(cle); if (v) v.pulse = .6;
  if (relire) { itemsDuJour(cle).forEach(i => { i.touched = Date.now(); }); sauverTout(); const e = jours.find(j => j.id === cle); if (e) motsMagiques(e.text, 700); }
  $('fiche').hidden = false; panneauJour.rendre(cle);
  if (aller) voler(posDuJour(cle), DIST.jour);
}
function fermerFiche() { arreterParcours(); if (niveau === 'jour' && selection) ignorerJour = selection; selection = null; $('fiche').hidden = true; }
$('fermer').addEventListener('click', fermerFiche);
function jourVoisin(delta) {
  if (!selection) return; const d = dateDeCle(selection); d.setDate(d.getDate() + delta);
  const k = cleJour(d); if (k > aujourdhui()) return; choisir(k, { relire: true, voler: true });
}
$('f-prec').addEventListener('click', () => jourVoisin(-1));
$('f-suiv').addEventListener('click', () => jourVoisin(1));
// glisser vers le bas sur l'en-tête (tactile) ferme la feuille
function glisserPourFermer(feuille, fermer) {
  let y0 = null, dy = 0;
  [feuille.querySelector('.p-grip'), feuille.querySelector('.p-tete')].forEach(z => { if (!z) return;
    z.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; feuille.style.transition = 'none'; }, { passive: true });
    z.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); feuille.style.transform = dy ? `translateY(${dy}px)` : ''; }, { passive: true });
    z.addEventListener('touchend', () => { feuille.style.transition = ''; feuille.style.transform = ''; if (dy > 90) fermer(); y0 = null; dy = 0; });
  });
}
glisserPourFermer($('fiche'), fermerFiche);

async function supprimerItem(item) {
  if (!confirm(t(item.type === 'media' ? 'Supprimer ce média ?' : 'Supprimer cette entrée ?'))) return;
  if (item.media && item.media.cle) await media.supprimer(item.media.cle);
  for (const m of item.medias || []) if (m && m.cle) await media.supprimer(m.cle);
  items = items.filter(i => i.id !== item.id); sauverTout(); await recalculer();
  if (selection) { if (itemsDuJour(selection).length) panneauJour.rendre(selection); else { panneauJour.rendre(selection); } }
}

// visionneuse de médias
async function voirMedia(item, med = item.media) {
  const u = await media.url(med.cle); if (!u) return;
  if (med.kind === 'fichier') { Object.assign(document.createElement('a'), { href: u, download: med.nom || 'fichier' }).click(); return; }
  const c = $('vis-contenu'); c.replaceChildren();
  const m = med.kind === 'video' ? Object.assign(document.createElement('video'), { src: u, controls: true, autoplay: true, playsInline: true }) : Object.assign(document.createElement('img'), { src: u, alt: item.legende || '' });
  c.append(m); if (item.type === 'media' && item.legende) { const p = document.createElement('p'); p.textContent = item.legende; c.append(p); }
  $('visionneuse').hidden = false;
}
function fermerVisionneuse() { const v = $('vis-contenu').querySelector('video'); if (v) v.pause(); $('vis-contenu').replaceChildren(); $('visionneuse').hidden = true; }
$('vis-fermer').addEventListener('click', fermerVisionneuse);
$('visionneuse').addEventListener('click', e => { if (e.target === $('visionneuse') || e.target === $('vis-contenu')) fermerVisionneuse(); });

// ───────────── Pointeur ─────────────
const ray = new THREE.Raycaster(), souris = new THREE.Vector2(); let bas = null;
// ce qui est sous le curseur : la lueur, une étoile, un jour vide, ou une nébuleuse (selon le niveau de zoom)
function sous(ev) {
  souris.set(ev.clientX / innerWidth * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(souris, camera);
  if (creature.touche(ev.clientX, ev.clientY)) return { type: 'creature' };
  const touche = ray.intersectObjects([...visuelsVisibles.values()].map(v => v.cristal), false)[0];
  if (touche) return { type: 'etoile', id: touche.object.userData.id };
  if (niveau === 'jour' || niveau === 'semaine' || niveau === 'mois') { const d = monde.jourVideSous(ev.clientX, ev.clientY, foyer, new Set(jours.map(j => j.id))); if (d) return { type: 'vide', date: d, cle: cleJour(d) }; }
  const n = monde.nebuleuseSous(ev.clientX, ev.clientY, niveau, foyer); if (n) return { type: 'noeud', noeud: n };
  return null;
}
// Maintenir le clic sur une étoile : elle se charge, puis explose en supernova.
let maintien = null, chargeId = null, chargeT0 = 0, superFaite = false;
function annulerMaintien() { clearTimeout(maintien); maintien = null; chargeId = null; }
function supernovaDe(id) {
  const v = visuels.get(id), i = jours.findIndex(e => e.id === id); if (!v) return;
  v.pulse = 2.4; scenes.supernova(v.groupe.position.clone(), v.mat.uniforms.uColor.value.clone()); creature.choc(v.groupe.position);
  [i - 1, i + 1].forEach(j => { const w = jours[j] && visuels.get(jours[j].id); if (w) w.pulse = Math.max(w.pulse, .7); });
}
let calinMinuteur = null, calinFait = false;
canvas.addEventListener('pointerdown', e => {
  bas = [e.clientX, e.clientY]; superFaite = false; const s = sous(e);
  if (s && s.type === 'creature') { calinFait = false; calinMinuteur = setTimeout(() => { calinFait = true; creature.calin(true); }, 550); return; }      // maintenir : câlin
  if (s && s.type === 'etoile' && R.animation > 0) { chargeId = s.id; chargeT0 = performance.now(); maintien = setTimeout(() => { superFaite = true; chargeId = null; supernovaDe(s.id); }, 800); }
});
canvas.addEventListener('pointerup', e => {
  annulerMaintien(); if (superFaite) { superFaite = false; return; }
  clearTimeout(calinMinuteur); if (calinFait) { calinFait = false; creature.calin(false); return; }
  if (!bas || Math.hypot(e.clientX - bas[0], e.clientY - bas[1]) > 5) return;
  const s = sous(e);
  if (!s) {
    effacerRecherche(); if (selection) fermerFiche();
    if (R.animation > 0 && !intro.actif) scenes.onde(ray.ray.at(26, new THREE.Vector3()));          // une onde de lumière dans le vide
  }
  else if (s.type === 'creature') creature.caresse();                  // un clic : une caresse
  else if (s.type === 'etoile') choisir(s.id);
  else if (s.type === 'vide') choisir(s.cle);
  else if (s.type === 'noeud') plonger(s.noeud);
});
canvas.addEventListener('pointermove', e => {
  const s = sous(e), tip = $('infobulle');
  if (maintien && bas && Math.hypot(e.clientX - bas[0], e.clientY - bas[1]) > 6) annulerMaintien();
  survole = s && s.type === 'etoile' ? s.id : null; canvas.style.cursor = s ? "pointer" : "grab"; pointeur.t = performance.now(); pointeur.x = e.clientX; pointeur.y = e.clientY;
  let txt = null;
  if (s && s.type === 'creature') txt = creature.nom() || t('une petite lueur');
  else if (s && s.type === 'etoile') { const j = jours.find(x => x.id === s.id); txt = libelleJour(new Date(j.date)) + ' · ' + tn(j.n, '{n} entrée', '{n} entrées') + (j.mood ? ' · ' + (j.color ? t('couleur libre') : MOODS[j.mood].label) : '') + (j.sample ? ' · ' + t('exemple') : ''); }
  else if (s && s.type === 'vide') txt = libelleJour(s.date) + ' · ' + t('journée vide, cliquez pour écrire');
  else if (s && s.type === 'noeud') txt = s.noeud.libelle + ' · ' + (s.noeud.nbJours ? tn(s.noeud.nbJours, '{n} jour écrit', '{n} jours écrits') : t('rien d’écrit'));
  if (txt) { tip.hidden = false; tip.textContent = txt; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; } else tip.hidden = true;
});

// ───────────── Recherche par le sens ─────────────
let jetonRecherche = 0;
async function chercher(q) {                       // allume les jours proches par le sens, et la caméra va vers le premier
  const mien = ++jetonRecherche; if (tagActif) { tagActif = null; $('filtre').hidden = true; }
  const vq = await embarquer(q, false); if (mien !== jetonRecherche || !vecs.length) return;
  const scores = vecs.map(v => cos(vq, v)), ordre = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  const seuil = Math.max(.07, ordre[0][0] * .55), m = new Map();
  ordre.slice(0, 6).forEach(([s, i]) => { if (s >= seuil) m.set(jours[i].id, Math.min(1.4, .6 + s * 2)); });
  surbrillance = m.size ? m : new Map();
  if (m.size) voler(posDuJour([...m.keys()][0]), DIST.semaine);
}
function effacerRecherche() { jetonRecherche++; if (!parcours && !tagActif) surbrillance = null; }

// ───────────── Écrire : le journal du jour ─────────────
// Un seul type d'écriture (décision du 2 oct. 2026) : le + ouvre directement le journal ; une photo ou une vidéo peut s'y glisser.
// Les anciennes notes, tâches et médias se modifient toujours ici (leur type est gardé), mais on n'en crée plus.
let humeur = 'calme', couleurLibre = null, edition = null, fichiersEnAttente = [];
const boiteHumeurs = $('humeurs');
const libre = document.createElement('label'); libre.className = 'libre'; libre.title = t('Choisir n’importe quelle couleur');
const pastille = document.createElement('input'); pastille.type = 'color'; pastille.value = '#c9a0ff'; pastille.setAttribute('aria-label', t('Couleur libre'));
libre.append(t('Libre') + ' ', pastille);
{
  Object.entries(MOODS).forEach(([k, m]) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.textContent = m.label; b.dataset.k = k;
    b.style.borderLeftColor = cm(k);
    b.addEventListener('click', () => choisirHumeur(k, null));
    boiteHumeurs.append(b);
  });
  pastille.addEventListener('input', () => choisirHumeur(plusProche(pastille.value), pastille.value));
  boiteHumeurs.append(libre);
}
// l'humeur la plus proche d'une couleur libre sert d'étiquette (distance dans l'espace RVB)
function plusProche(hex) {
  const c = new THREE.Color(hex); let meilleur = 'calme', d0 = 9;
  for (const k of Object.keys(MOODS)) { const m = new THREE.Color(MOODS[k].color), d = (m.r - c.r) ** 2 + (m.g - c.g) ** 2 + (m.b - c.b) ** 2; if (d < d0) { d0 = d; meilleur = k; } }
  return meilleur;
}
const typeEdite = () => edition ? edition.type : 'journal';
function choisirHumeur(k, couleur) {
  humeur = k; couleurLibre = couleur;
  boiteHumeurs.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', !couleur && b.dataset.k === k));
  libre.setAttribute('aria-checked', !!couleur);
  if (couleur) pastille.value = couleur;
  if (!$('ecrire').hidden && typeEdite() === 'journal') creature.imiter(k, couleur || cm(k));          // la mascotte imite l'humeur choisie
}
choisirHumeur('calme', null);

// une ancienne entrée garde ses champs : titre pour une note, légende pour un média, pas d'humeur hors journal
function configurer(type) {
  $('humeurs').hidden = type !== 'journal'; $('note-titre').hidden = type !== 'note';
  $('zone-media').hidden = type !== 'journal';
  $('texte').placeholder = type === 'media' ? t('Une légende (facultatif)') : t('Écrivez. Ce texte ne quitte jamais cet appareil.');
  $('texte').rows = type === 'media' ? 2 : type === 'tache' ? 2 : 5;
  $('ecrire-titre').textContent = edition ? t('Modifier') : t('Journal');
  $('titre-ecrire').textContent = edition ? '' : t('Qu’est-ce qui traverse ?'); $('titre-ecrire').hidden = !!edition;
  if (type === 'journal') creature.imiter(humeur, couleurLibre || cm(humeur)); else creature.finEcriture();
  majSugg();
}
// étiquettes déjà utilisées : un appui pour les réinsérer dans le texte
function majSugg() {
  const z = $('tags-sugg'), liste = [...tousLesTags()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  z.replaceChildren(); z.hidden = !liste.length || typeEdite() === 'media';
  liste.forEach(([t]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tag'; b.textContent = '#' + t; b.addEventListener('click', () => {
    const ta = $('texte'), v = ta.value, avant = v && !/\s$/.test(v) ? ' ' : ''; ta.value = v + avant + '#' + t + ' '; ta.dispatchEvent(new Event('input')); ta.focus(); }); z.append(b); });
}

function jourParDefaut() {
  const a = aujourdhui();
  if (selection && selection <= a) return selection;
  if ((niveau === 'jour' || niveau === 'semaine') && foyer.jour && foyer.jour <= a) return foyer.jour;
  return a;
}
function ouvrirEcrire({ jour = null, item = null } = {}) {
  const brouillon = !item ? lireBrouillon() : null;
  edition = item; fichiersEnAttente = []; rendreVignettes();
  const ty = item ? item.type : 'journal';
  $('texte').value = item ? item.texte || item.legende || '' : ''; $('nbc').textContent = $('texte').value.length + ' / 4000';
  $('note-titre').value = item && item.titre ? item.titre : '';
  const d = $('ecrire-date'); d.max = aujourdhui(); d.value = item ? item.jour : (jour || jourParDefaut());
  if (item && item.type === 'journal') choisirHumeur(item.mood || 'calme', item.color || null); else if (!item) { const h = humeurDuJour(d.value, items, meta); choisirHumeur(h ? h.mood : 'calme', h && h.color ? h.color : null); }
  configurer(ty);
  if (brouillon && (brouillon.texte || '').trim()) { $('texte').value = brouillon.texte || ''; $('nbc').textContent = $('texte').value.length + ' / 4000'; if (brouillon.jour && brouillon.jour <= aujourdhui() && !jour) d.value = brouillon.jour; $('interim').textContent = t('Brouillon retrouvé.'); }
  $('valider').textContent = item ? t('Enregistrer') : t('Cristalliser');
  $('ecrire').hidden = false; document.body.classList.add('ecriture'); accueil.surPlus();
  $('editeur').dataset.ph = $('texte').placeholder;   // v22 : pas de clavier d'office, on touche le texte pour écrire
  ouvertureEcriture = performance.now(); dernierTexte = ouvertureEcriture;
}
const CLE_BROUILLON = 'constellation.brouillon';
function garderBrouillon() {
  if (edition) return;
  try { const texte = $('texte').value; if (texte.trim()) localStorage.setItem(CLE_BROUILLON, JSON.stringify({ type: 'journal', texte, jour: $('ecrire-date').value })); else localStorage.removeItem(CLE_BROUILLON); } catch (e) {}
}
function lireBrouillon() { try { return JSON.parse(localStorage.getItem(CLE_BROUILLON)); } catch (e) { return null; } }
function effacerBrouillon() { try { localStorage.removeItem(CLE_BROUILLON); } catch (e) {} }
$('texte').addEventListener('input', () => { $('interim').textContent = ''; garderBrouillon(); });
function fermerEcrire() { fermerBlocs(); montrerBarre(false); garderBrouillon(); creature.finEcriture(); arreterDictee(); edition = null; fichiersEnAttente = []; document.body.classList.remove('ecriture'); $('ecrire').hidden = true; $('texte').value = ''; $('note-titre').value = ''; $('nbc').textContent = '0'; accueil.surEcrireFerme(); }
// « + » : ouvre directement le journal
$('nouveau').addEventListener('click', () => { fermerMenu(); if ($('ecrire').hidden) ouvrirEcrire(); else fermerEcrire(); });
$('voile-menu').addEventListener('click', () => fermerMenu());
$('annuler').addEventListener('click', fermerEcrire);
$('ecrire-fermer').addEventListener('click', fermerEcrire);
// menu de blocs, comme dans Notion : « + Ajouter » au-dessus du texte, ou « / » en début de ligne.
// Le texte reste du texte : « # », « ## », « ### » pour les titres, « - » pour les puces, « 1. » pour les listes numérotées.
// v22 : l'éditeur affiche les blocs tels quels (editeur.js) ; le texte enregistré garde « # », « - », « 1. », « > », « --- ».
const ed = creerEditeur($('editeur'), $('texte'));
const ENTREES = { image: ['fichiers-media', 'image/*'], video: ['fichiers-media', 'video/*'], fichier: ['fichiers-autres', ''] };
let blocSlash = false;                                                   // menu ouvert par un « / » tapé, à effacer quand on choisit
function ouvrirBlocs(slash = false) { blocSlash = slash; $('bloc-menu').hidden = false; $('bloc-plus').setAttribute('aria-expanded', 'true'); requestAnimationFrame(() => $('bloc-menu').scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
function fermerBlocs() { blocSlash = false; $('bloc-menu').hidden = true; $('bloc-plus').setAttribute('aria-expanded', 'false'); }
function poserBloc(k) {
  if (blocSlash) ed.retirerSlash();
  fermerBlocs();
  if (ENTREES[k]) { const [id, acc] = ENTREES[k], f = $(id); if (acc) f.accept = acc; f.click(); return; }
  ed.poser(k);
}
ed.surSlash(() => ouvrirBlocs(true));
$('bloc-plus').addEventListener('mousedown', e => e.preventDefault());
$('bloc-plus').addEventListener('click', () => $('bloc-menu').hidden ? ouvrirBlocs() : fermerBlocs());
document.querySelectorAll('#bloc-menu button').forEach(b => { b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => poserBloc(b.dataset.bloc)); });
$('editeur').addEventListener('keydown', e => { if (e.key === 'Escape' && !$('bloc-menu').hidden) { e.preventDefault(); e.stopPropagation(); fermerBlocs(); } });
$('texte').addEventListener('input', e => { if (blocSlash && !(e.inputType || '').startsWith('insert')) fermerBlocs(); });
document.addEventListener('pointerdown', e => { if (!$('bloc-menu').hidden && !e.target.closest('.bloc-outils, #barre-clavier')) fermerBlocs(); });

// barre au-dessus du clavier (mobile first, à la Notion) : tous les blocs à portée du pouce
const barre = $('barre-clavier'), tactile = matchMedia('(pointer: coarse)');
function placerBarre() {
  const vv = window.visualViewport, bas = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  document.documentElement.style.setProperty('--clavier', bas + 'px');
}
function montrerBarre(on) { $('barre-clavier').hidden = !on; document.body.classList.toggle('barre-on', on); if (on) placerBarre(); else fermerBlocs(); }
$('editeur').addEventListener('focus', () => { if (tactile.matches || innerWidth < 700) montrerBarre(true); });
$('editeur').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('editeur') && $('bloc-menu').hidden) montrerBarre(false); }, 150));
if (window.visualViewport) { visualViewport.addEventListener('resize', placerBarre); visualViewport.addEventListener('scroll', placerBarre); }
barre.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });   // garder le clavier ouvert
barre.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.barre === 'menu') { $('bloc-menu').hidden ? ouvrirBlocs() : fermerBlocs(); return; }
  if (b.dataset.barre === 'fermer') { fermerBlocs(); $('texte').blur(); montrerBarre(false); return; }
  poserBloc(b.dataset.bloc);
});
$('texte').addEventListener('input', () => { $('nbc').textContent = $('texte').value.length + ' / 4000'; });

// photos et vidéos en attente d'enregistrement (glissées dans l'entrée du jour)
function rendreVignettes() {
  const z = $('vignettes-ecrire'); z.replaceChildren();
  fichiersEnAttente.forEach((f, i) => {
    const d = document.createElement('div'), u = URL.createObjectURL(f); d.className = 'mini';
    const sorte = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'img' : null;
    d.append(sorte ? Object.assign(document.createElement(sorte), { src: u, muted: true }) : Object.assign(document.createElement('span'), { className: 'mini-fichier', textContent: f.name || t('Fichier') }));
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', t('Retirer')); x.addEventListener('click', () => { fichiersEnAttente.splice(i, 1); rendreVignettes(); }); d.append(x); z.append(d);
  });
}
$('choisir-media').addEventListener('click', () => $('fichiers-media').click());       // sur téléphone, le choix propose aussi l'appareil photo
for (const id of ['fichiers-media', 'fichiers-autres']) $(id).addEventListener('change', ev => { fichiersEnAttente.push(...ev.target.files); ev.target.value = ''; rendreVignettes(); });

addEventListener('keydown', e => {
  const dansChamp = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if ((e.key === 'n' || e.key === 'N') && !dansChamp && $('ecrire').hidden) { e.preventDefault(); ouvrirEcrire(); }
  if ((e.key === 'Backspace' || e.key === '-') && !dansChamp && $('ecrire').hidden && $('palette').hidden) { e.preventDefault(); remonter(); }
  if (e.key === 'Escape') {
    if (!$('menu').hidden) fermerMenu();
    else if (!$('visionneuse').hidden) fermerVisionneuse();
    else if (!$('aide').hidden) fermerAide();
    else if (!$('dateqc').hidden) fermerDate();
    else if (persoUI.ouvert()) fermerPerso();
    else if (cielUI.ouvert()) cielUI.fermer();
    else if (boutique.ouvert()) boutique.fermer();
    else if (!$('ecrire').hidden) fermerEcrire(); else if (!$('nommer').hidden) validerNom(); else if (!$('reglages').hidden) $('reglages').hidden = true; else if (!$('analyse').hidden) $('analyse').hidden = true; else if (tagActif) effacerFiltre(); else { effacerRecherche(); fermerFiche(); }
  }
});

const heureDe = (jour, k = 0) => jour === aujourdhui() ? Date.now() + k : dateDeCle(jour).getTime() + (8 + k) * 3600000 % 43200000;
async function stockerFichiers() {
  const l = [];
  if (fichiersEnAttente.length) $('statut').textContent = t('Enregistrement des médias…');
  for (const f of fichiersEnAttente) { try { l.push(await media.stocker(f)); } catch (err) { statutTemporaire((f.name || t('Fichier')) + DP + err.message, 5000); } }
  $('statut').textContent = ''; return l;
}
async function valider() {
  const jour = $('ecrire-date').value || aujourdhui(), texte = $('texte').value.trim(), type = typeEdite();
  const manque = m => { $('interim').textContent = m; $('texte').focus(); $('ecrire').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 }); };
  if (type === 'journal' && texte.length < 3 && !fichiersEnAttente.length && !(edition && (edition.medias || []).length)) return manque(t('Écrivez au moins quelques mots.'));
  if (type === 'tache' && !texte) return manque(t('Une tâche par ligne.'));
  if (type === 'note' && !texte && !$('note-titre').value.trim()) return manque(t('Une note vide ne dit rien.'));

  const medias = type === 'journal' ? await stockerFichiers() : [];
  if (edition) {
    const i = edition; i.touched = Date.now(); i.jour = jour; delete i.sample;
    if (type === 'media') i.legende = texte; else i.texte = texte;
    if (type === 'note') i.titre = $('note-titre').value.trim();
    if (type === 'journal') { i.mood = humeur; if (couleurLibre) i.color = couleurLibre; else delete i.color; meta[jour] = { humeur, couleur: couleurLibre || undefined }; if (medias.length) i.medias = [...(i.medias || []), ...medias]; }
  } else {
    items.push({ id: nouvelId(), jour, date: heureDe(jour), type: 'journal', texte, mood: humeur, color: couleurLibre || undefined, medias: medias.length ? medias : undefined, touched: Date.now() });
    meta[jour] = { humeur, couleur: couleurLibre || undefined };
  }
  const nouvelle = !edition;
  sauverTout(); effacerBrouillon(); fermerEcrire(); effacerBrouillon();

  if (nouvelle && texte) {                // le texte se dissout en lettres, puis l'étoile s'éveille
    const vol = $('vol'); vol.replaceChildren();
    texte.slice(0, 160).split(/(\s+)/).forEach(w => { const s = document.createElement('span'); s.textContent = w; vol.append(s); });
    const spans = [...vol.children]; spans.forEach((s, i) => { s.style.transitionDelay = (i * 55) + 'ms'; });
    requestAnimationFrame(() => requestAnimationFrame(() => spans.forEach(s => s.classList.add('part'))));
    setTimeout(() => vol.replaceChildren(), 3500);
  }
  await recalculer(true);
  const gain = etoiles.crediter(joursEcrits());                // ✦10 pour un jour écrit pour la première fois
  if (accueil.ecrireEnCours()) { accueil.surEntree(gain); const v = visuels.get(jour); if (v) v.pulse = 1.4; voler(posDuJour(jour), DIST.semaine * .7); }
  else {
    choisir(jour, { relire: false });                    // on va voir la journée, entrées comprises
    if (gain) setTimeout(() => toast(t('+ ✦{n} poussière d’étoiles', { n: gain })), 1500);
  }
  const v = visuels.get(jour); if (v) { v.pulse = 1; setTimeout(() => creature.celebrer(jour), 1800); }
  if (type === 'journal') motsMagiques(texte, 2600);
}
$('valider').addEventListener('click', valider);

// ───────────── Dictée vocale ─────────────
// Utilise la reconnaissance du navigateur (Chrome / Edge) : le son peut transiter par les serveurs du navigateur.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let reco = null, dictee = false;
const bDicter = $('dicter');
if (!SR) bDicter.hidden = true;
function arreterDictee() {
  dictee = false; bDicter.setAttribute('aria-pressed', 'false'); bDicter.textContent = t('Dicter'); $('interim').textContent = '';
  if (reco) { try { reco.stop(); } catch (e) {} reco = null; }
}
function ajouterTexte(t) {
  const ta = $('texte'), sep = ta.value && !/\s$/.test(ta.value) ? ' ' : '';
  ta.value = (ta.value + sep + t.trim()).slice(0, 4000);
  ta.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true }));
}
bDicter.addEventListener('click', () => {
  if (dictee) return arreterDictee();
  let ok = false; try { ok = localStorage.getItem('constellation.dictee') === '1'; } catch (e) {}
  if (!ok) {
    if (!confirm(t('La dictée utilise la reconnaissance vocale de votre navigateur : avec Chrome ou Edge, le son est envoyé à leurs serveurs pour être transcrit. Ce que vous écrivez au clavier, lui, reste sur votre appareil.') + '\n\n' + t('Activer la dictée ?'))) return;
    try { localStorage.setItem('constellation.dictee', '1'); } catch (e) {}
  }
  reco = new SR(); reco.lang = LOC; reco.continuous = true; reco.interimResults = true;
  reco.onresult = ev => {
    let provisoire = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) ajouterTexte(r[0].transcript); else provisoire += r[0].transcript; }
    $('interim').textContent = provisoire;
  };
  reco.onerror = ev => {
    if (ev.error === 'no-speech' || ev.error === 'aborted') return;
    $('statut').textContent = ev.error === 'not-allowed' ? t('Micro refusé : autorisez-le dans le navigateur.') : t('Dictée indisponible ({e}).', { e: ev.error });
    setTimeout(() => { $('statut').textContent = ''; }, 4000); arreterDictee();
  };
  reco.onend = () => { if (dictee && reco) { try { reco.start(); } catch (e) {} } };      // la reconnaissance s'arrête seule après un silence : on relance
  dictee = true; bDicter.setAttribute('aria-pressed', 'true'); bDicter.textContent = t('Arrêter la dictée');
  try { reco.start(); } catch (e) { arreterDictee(); }
});

// ───────────── Sens profond ─────────────
function majBoutonProfond() { $('profond').textContent = t('Sens profond') + DP + t(mode === 'profonde' ? 'oui' : 'non'); }
$('profond').addEventListener('click', async () => {
  const cible = mode === 'profonde' ? 'legere' : 'profonde';
  if (cible === 'profonde' && !confirm(t('Télécharger un petit modèle de langage (≈120 Mo) pour mieux comprendre le sens ? Il s’exécute sur votre appareil, vos textes ne sont pas envoyés.'))) return;
  try {
    if (cible === 'profonde') await chargerProfond(m => { $('statut').textContent = m; });
    mode = cible; try { localStorage.setItem('constellation.mode', mode); } catch (e) {}
    $('statut').textContent = t('Recalcul…'); await recalculer(); $('statut').textContent = '';
  } catch (err) { $('statut').textContent = t('Modèle indisponible : on reste en mode léger.'); mode = 'legere'; }
  majBoutonProfond();
});

// ───────────── Export / import / exemples ─────────────
async function effacerExemples(demander = true) {
  if (demander && !confirm(t('Effacer les entrées d’exemple ?'))) return false;
  items = items.filter(e => !e.sample); sauverTout(); fermerFiche(); await recalculer();
  statutTemporaire(t('Exemples effacés. Le ciel est à vous.'), 5000); return true;
}
$('exemples').addEventListener('click', () => effacerExemples());
$('exporter').addEventListener('click', async () => {
  const sortie = { version: 2, exporte: new Date().toISOString(), jours: meta, dates: mesDates, items: [] }; let videos = 0;
  for (const i of items) {
    const c = { ...i };
    if (i.type === 'media' && i.media) { if (i.media.kind === 'image') c.donnee = await media.enDataURL(i.media.cle); else { videos++; c.media = { ...i.media, absent: true }; } }
    if (i.medias) c.medias = await Promise.all(i.medias.map(async m => m.kind === 'image' ? { ...m, donnee: await media.enDataURL(m.cle) } : (videos++, { ...m, absent: true })));
    sortie.items.push(c);
  }
  const nomFichier = 'constellation-' + new Date().toISOString().slice(0, 10) + '.json', texte = JSON.stringify(sortie, null, 2);
  if (window.AndroidBridge) { AndroidBridge.sauver(nomFichier, texte); } else {
    const blob = new Blob([texte], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nomFichier; a.click(); URL.revokeObjectURL(a.href);
  }
  if (videos) statutTemporaire(tn(videos, '{n} vidéo ou fichier non inclus dans l’export (trop lourd).', '{n} vidéos ou fichiers non inclus dans l’export (trop lourds).'), 6000);
});
$('importer').addEventListener('change', async ev => {
  const f = ev.target.files[0]; if (!f) return;
  try {
    let donnees = JSON.parse(await f.text()), liste;
    if (Array.isArray(donnees) || (donnees && Array.isArray(donnees.pensees))) {          // ancien format : une pensée = une étoile
      liste = (Array.isArray(donnees) ? donnees : donnees.pensees).map(e => ({ id: e.id, jour: cleJour(e.date), date: e.date, type: 'journal', texte: e.text, mood: e.mood, color: e.color, touched: e.touched || e.date, sample: e.sample }));
      if (!liste.every(e => e && typeof e.texte === 'string' && MOODS[e.mood] && e.id && e.date)) throw 0;
    } else if (donnees && Array.isArray(donnees.items)) {
      liste = donnees.items; if (!liste.every(e => e && e.id && e.jour && TYPES[e.type])) throw 0; Object.assign(meta, donnees.jours || {}); if (Array.isArray(donnees.dates)) { const ids = new Set(mesDates.map(d => d.id)); donnees.dates.forEach(d => { if (d && d.id && d.jour && d.titre && !ids.has(d.id)) mesDates.push(d); }); dates.sauver(mesDates); }
    } else throw 0;
    const connus = new Set(items.map(e => e.id));
    for (const e of liste) {
      if (connus.has(e.id)) continue;
      if (e.type === 'media') { if (e.donnee) { e.media = { ...e.media, cle: await media.depuisDataURL(e.donnee) }; delete e.donnee; } else if (!e.media || e.media.absent) continue; }
      if (Array.isArray(e.medias)) { const l = []; for (const m of e.medias) { if (m && m.donnee) { const { donnee, ...reste } = m; l.push({ ...reste, cle: await media.depuisDataURL(donnee) }); } } e.medias = l.length ? l : undefined; }
      items.push({ ...e, touched: e.touched || e.date });
    }
    sauverTout(); await recalculer(); etoiles.crediter(joursEcrits());
  } catch (e) { $('statut').textContent = t('Fichier non reconnu.'); setTimeout(() => $('statut').textContent = '', 3000); }
  ev.target.value = '';
});

// ───────────── Application des réglages ─────────────
function recolorer() {
  jours.forEach(e => {
    const v = visuels.get(e.id); if (!v) return;
    const { couleur, eclat } = couleurPour(e);
    v.mat.uniforms.uColor.value.copy(couleur); v.eclat = eclat; v.halo.material.color.copy(couleur);
  });
  $("humeurs").querySelectorAll("button").forEach(b => { b.style.borderLeftColor = cm(b.dataset.k); });
  reconstruireMonde(); cuireVolumeNiveau();
}
function appliquerTheme() {
  const t = T(), clair = t.clair;
  skyHaut.set(t.haut); skyBas.set(t.bas); ciel.material.uniforms.uHaut.value.copy(skyHaut); ciel.material.uniforms.uBas.value.copy(skyBas);
  const css = document.documentElement.style;
  Object.entries(t.ui).forEach(([k, v]) => css.setProperty('--' + k, v));
  document.documentElement.toggleAttribute('data-clair', clair);
  U.uClair.value = clair ? 1 : 0;
  const m = melange();
  const et = scene.userData.etoiles; et.blending = m; et.uniforms.uCol.value.set(t.etoile); et.needsUpdate = true;
  particules.material.blending = m; particules.material.needsUpdate = true;
  for (const v of visuels.values()) { for (const s of [v.halo, v.etoile]) { s.material.blending = m; s.material.needsUpdate = true; } }
  meteores.regler(clair, m, t.ui.ink); poussiere.regler(clair, m, clair ? t.ui.ink : t.etoile);
  creature.regler(clair); marques.regler(clair, m); evenements.regler(clair, t.ui.ink); scenes.regler(clair, t.ui.ink); lucioles.m.blending = m; lucioles.m.uniforms.uCol.value.set(clair ? t.ui.ink : "#ffe9a0"); lucioles.m.needsUpdate = true;
  decor.regler({ planetes: decor.PLANETES.filter(etoiles.actif), clair, direct: true });
  recolorer(); appliquerCurseurs();
}
function appliquerCurseurs() {
  majEffectifs();
  U.uTw.value = Re.scintillement;
  bloom.enabled = !T().clair; bloom.strength = Re.lueur;
  finition.uniforms.uCinema.value = Re.cinema; finition.uniforms.uClair.value = T().clair ? 1 : 0; volume.regler(T().clair, Re.brume);
}
function majReglage(patch) {
  const avant = Re.theme;
  R = { ...R, ...patch }; sauverReglages(R); majEffectifs();
  const theme = Re.theme !== avant;
  if (theme) appliquerTheme(); else { if ('humeurs' in patch) recolorer(); appliquerCurseurs(); }
}
const rendreReglages = monterReglages($('reglages'), {
  extras: () => [
    [t('Mes données'), [
      ...(!$('btn-sauvegarde').hidden ? [[$('btn-sauvegarde').textContent, () => $('btn-sauvegarde').click()]] : []),
      [t('Exporter le journal'), () => $('exporter').click()], [t('Importer un journal'), () => $('importer').click()],
      ...(items.some(e => e.sample) ? [[t('Effacer les entrées d’exemple'), () => $('exemples').click()]] : []),
    ]],
    [t('Aide'), [
      [t('Comment voyager dans le ciel'), () => { $('reglages').hidden = true; ouvrirAide(); }],
      ...(invitationInstall ? [[t('Installer l’application'), () => $('installer').click()]] : []),
    ]],
  ],
  lire: () => R, maj: majReglage, themes: THEMES, moods: MOODS, couleur: cm,
  remplacer: r => { const av = Re.theme; R = { ...DEFAUT, ...r }; sauverReglages(R); majEffectifs(); const th = Re.theme !== av; th ? appliquerTheme() : (recolorer(), appliquerCurseurs()); },
  rappel: {
    config: rappels.config, permission: rappels.permission, supporte: rappels.supporte,
    maj: async patch => { const c = rappels.config(), r = await rappels.activer('actif' in patch ? patch.actif : c.actif, patch.heure, creature.nom()); statutTemporaire(r.message, 6000); return r; },
    tester: async () => { if (!(await rappels.tester(messageRappel()))) statutTemporaire(t('Pour tester, activez d’abord le rappel et autorisez les notifications.'), 5000); },
  },
});
$('btn-reglages').addEventListener('click', () => { const z = $('reglages'); z.hidden = !z.hidden; if (!z.hidden) rendreReglages(); });

// poussière de lumière à chaque lettre écrite
const _ray = new THREE.Raycaster();
$('texte').addEventListener('input', ev => {
  dernierTexte = performance.now(); creature.taper(ev.target.value, ev.target.selectionStart);       // la mascotte lit ce qu'on écrit
  if (!/^insert/.test(ev.inputType || '')) return;
  const r = $('editeur').getBoundingClientRect();
  const x = r.left + r.width * (0.15 + 0.7 * ((ev.target.value.length * 37) % 100) / 100), y = r.top + 6;
  _ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const p = _ray.ray.at(9, new THREE.Vector3());
  particules.burst(p, new THREE.Color(couleurLibre || cm(humeur)), T().clair ? 3 : 6);
});

// ───────────── Étiquettes du temps ─────────────
let noms = (() => { try { return localStorage.getItem('constellation.noms') !== '0'; } catch (e) { return true; } })();
$('btn-noms').addEventListener('click', () => {
  noms = !noms; monde.etiquettes(noms); $('btn-noms').setAttribute('aria-pressed', noms);
  try { localStorage.setItem('constellation.noms', noms ? '1' : '0'); } catch (e) {}
});
$('btn-noms').setAttribute('aria-pressed', noms); monde.etiquettes(noms);

// ───────────── Parcours caméra (survol d'un mois, jour après jour) ─────────────
let parcours = null, ligneParcours = null, comete = null;
function arreterParcours() {
  if (!parcours) return;
  parcours.stop = true; parcours = null;
  if (ligneParcours) { scene.remove(ligneParcours); ligneParcours.geometry.dispose(); ligneParcours.material.dispose(); ligneParcours = null; }
  if (comete) { scene.remove(comete); comete.material.dispose(); comete = null; }
  surbrillance = null; $('parcours').hidden = true;
}
const attendre = (ms, jeton) => new Promise(res => { const t0 = performance.now(); const tick = () => (jeton.stop || performance.now() - t0 >= ms) ? res() : setTimeout(tick, 80); tick(); });
async function parcourir(ids, titre) {
  arreterParcours(); ids = ids.filter(id => visuels.has(id)); if (ids.length < 2) return;
  const jeton = { stop: false, courbe: null, t: 0, tCible: 0 }; parcours = jeton;
  jeton.courbe = new THREE.CatmullRomCurve3(ids.map(id => posDuJour(id)), false, 'catmullrom', .5);
  ligneParcours = new THREE.Line(new THREE.BufferGeometry().setFromPoints(jeton.courbe.getPoints(ids.length * 40)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(T().ui.ink), transparent: true, opacity: .7, blending: melange(), depthWrite: false, depthTest: false }));
  scene.add(ligneParcours);
  comete = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: new THREE.Color(T().clair ? '#222222' : '#ffffff'), blending: melange(), transparent: true, depthWrite: false, depthTest: false, opacity: .9 }));
  comete.scale.setScalar(2.4); scene.add(comete);
  surbrillance = new Map(ids.map(id => [id, 1]));       // le reste du ciel s'efface pendant le parcours
  $('parcours').hidden = false; $('par-titre').textContent = titre;
  for (let i = 0; i < ids.length && !jeton.stop; i++) {
    $('par-etape').textContent = (i + 1) + ' / ' + ids.length; jeton.tCible = i / (ids.length - 1);
    choisir(ids[i], { relire: false });
    await attendre(i === 0 ? 3600 : 4300, jeton);
  }
  if (!jeton.stop) arreterParcours();
}
function animerParcours(dt) {
  if (!parcours || !comete) return;
  parcours.t += (parcours.tCible - parcours.t) * Math.min(1, dt * .9);
  comete.position.copy(parcours.courbe.getPoint(Math.min(1, Math.max(0, parcours.t))));
  comete.material.opacity = .65 + .3 * Math.sin(performance.now() / 180);
}
$('par-stop').addEventListener('click', arreterParcours);

// ───────────── Analyses : météo intérieure, bilan du mois ─────────────
const rendreAnalyse = monterAnalyse($('analyse'), {
  entries: () => joursHumeur, couleur: k => cm(k), encre: () => T().ui.ink,
  survoler: (ids, titre) => { $('analyse').hidden = true; parcourir(ids, titre); },
});
$('btn-analyse').addEventListener('click', () => { const z = $('analyse'); z.hidden = !z.hidden; if (!z.hidden) { $('reglages').hidden = true; rendreAnalyse(); } });
$('btn-reglages').addEventListener('click', () => { if (!$('reglages').hidden) $('analyse').hidden = true; });

// ───────────── Palette de commandes ─────────────
// Les anciens boutons existent toujours (cachés dans #outils) : la palette les déclenche, chacun garde sa logique.
const clic = id => () => $(id).click();
const palette = monterPalette($('palette'), {
  rechercher: chercher, effacer: effacerRecherche,
  commandes: () => {
    const l = [
      { nom: t('Écrire dans le journal'), mots: t('nouvelle pensee journal intime photo video'), raccourci: 'N', action: () => ouvrirEcrire() },
      { nom: t('Boutique'), mots: t('poussiere etoiles acheter objets'), etat: '✦ ' + etoiles.solde(), action: () => ouvrirBoutique() },
      { nom: t('Aller à aujourd’hui'), mots: t('maintenant jour present etoile'), action: volerAujourdhui },
      { nom: t('Personnaliser ma lueur'), mots: t('creature mascotte couleur accessoire chapeau lunettes yeux taille objets'), action: () => ouvrirPerso() },
      { nom: t('Personnaliser mon ciel'), mots: t('ciel ambiance planetes lune aurores brume'), action: () => ouvrirCielPerso() },
      { nom: t('Marquer une date qui compte'), mots: t('anniversaire evenement important date etoile doree'), action: () => ouvrirDate(selection || (niveau === 'jour' && foyer.jour) || aujourdhui()) },
      { nom: t('Prochaine date qui compte'), mots: t('anniversaire evenement a venir'), action: () => { const pr = dates.prochaine(mesDates, aujourdhui()); if (pr) { voler(posDuJour(pr.cle), DIST.semaine); statutTemporaire('★ ' + pr.titre + ' · ' + fmtDate(dateDeCle(pr.cle).getTime()), 5000); } else statutTemporaire(t('Aucune date marquée. Ouvrez un jour, puis ☆.')); } },
      ...[...tousLesTags()].sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([tg, o]) => ({ nom: t('#') + tg + ' · ' + tn(o.n, '{n} entrée', '{n} entrées'), mots: t('etiquette tag filtre') + ' ' + tg, action: () => filtrerPar(tg) })),
      ...(tagActif ? [{ nom: t('Retirer le filtre #{tag}', { tag: tagActif }), mots: t('etiquette filtre effacer'), action: effacerFiltre }] : []),
      { nom: t('Vue d’ensemble : toutes les années'), mots: t('dezoomer annees general'), action: volerGeneral },
      { nom: t('Remonter d’un niveau'), mots: t('dezoomer parent'), raccourci: '⌫', action: remonter },
      { nom: t('Rappel du soir'), mots: t('notification rappel rituel heure'), action: () => ouvrirReglages() },
      { nom: t('Météo intérieure'), mots: t('humeur courbe analyses ciel'), action: () => ouvrirAnalyse('meteo') },
      { nom: t('Bilan du mois'), mots: t('analyses resume survol mois'), action: () => ouvrirAnalyse('bilan') },
      { nom: t('Réglages'), mots: t('apparence lumiere couleurs looks optique'), action: () => ouvrirReglages() },
      { nom: t(noms ? 'Masquer les noms des mois et des années' : 'Afficher les noms des mois et des années'), mots: t('noms etiquettes'), action: clic('btn-noms') },
    ];
    Object.entries(THEMES).forEach(([k, th]) => l.push({ nom: t('Ciel : {nom}', { nom: th.nom }), mots: t('theme ambiance') + ' ' + k, etat: Re.theme === k ? t('actuel') : null, action: () => { if (k !== 'nuit' && !etoiles.possede('theme-' + k)) { boutique.ouvrir('ciel', 'theme-' + k); return; } majReglage({ theme: k, humeurs: {} }); rendreReglages(); } }));
    l.push({ nom: t('Sens profond'), mots: t('modele langage ia comprendre'), etat: t(mode === 'profonde' ? 'oui' : 'non'), action: clic('profond') });
    if (!$('btn-sauvegarde').hidden) l.push({ nom: t('Sauvegarde automatique'), mots: t('dossier copie backup'), etat: $('btn-sauvegarde').textContent.replace(t('Sauvegarde') + DP, ''), action: clic('btn-sauvegarde') });
    l.push({ nom: t('Exporter le journal'), mots: t('telecharger json'), action: clic('exporter') }, { nom: t('Importer un journal'), mots: t('fichier json'), action: () => $('importer').click() });
    if (items.some(e => e.sample)) l.push({ nom: t('Effacer les entrées d’exemple'), mots: t('exemples demo fictives'), action: clic('exemples') });
    if (invitationInstall) l.push({ nom: t('Installer l’application'), action: clic('installer') });
    l.push({ nom: EN ? 'Language: Français' : 'Langue : English', mots: 'langue language english anglais francais french', action: () => changerLangue(EN ? 'fr' : 'en') });
    l.push({ nom: t('Raconte-moi un souvenir'), mots: t('souvenir ancienne pensee rappel creature lueur'), action: () => { if (!creature.souvenirMaintenant()) statutTemporaire(t('Pas encore de souvenir à portée de ciel.')); } },
      { nom: t('Appeler {nom}', { nom: creature.nom() || t('la petite lueur') }), mots: t('creature lueur venir'), action: () => creature.appeler() },
      { nom: t('Renommer la petite lueur'), mots: t('creature nom lueur'), action: () => ouvrirNommer() },
      { nom: t(creature.visible() ? 'Laisser la petite lueur dormir (la masquer)' : 'Réveiller la petite lueur'), mots: t('creature masquer afficher'), action: () => { if (creature.basculer()) statutTemporaire(t('Elle est de retour.')); } });
    l.push({ nom: t('Aide : comment voyager dans le ciel'), mots: t('aide tutoriel zoom comment'), action: ouvrirAide });
    l.push({ nom: t('Surprends-moi'), mots: t('surprise hasard comete aurore baleine easter egg'), action: surprise });
    l.push({ nom: t(document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran'), mots: t('immersif'), action: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen() });
    return l;
  },
});
$('btn-palette').addEventListener('click', () => $('menu').hidden ? ouvrirMenu() : fermerMenu());

// ───────────── Menu « ⋯ » : trois lignes, chacune dit ce qu'elle fait ─────────────
function lignesMenu() {
  return [
    { titre: t('Personnalisation'), sous: t('La boutique et ta lueur'), d: '✦ ' + etoiles.solde(), items: () => [
      { nom: t('Boutique'), sous: t('Des objets pour ta lueur et ton ciel'), d: '✦ ' + etoiles.solde(), action: () => ouvrirBoutique() },
      { nom: t('Personnaliser ma lueur'), sous: t('Ce que tu as débloqué dans la boutique'), action: () => ouvrirPerso() },
      { nom: t('Personnaliser mon ciel'), sous: t('Ambiance, astres et animations débloqués'), action: () => ouvrirCielPerso() },
      { nom: t('Raconte-moi un souvenir'), sous: t('Elle va relire une ancienne pensée'), action: () => { if (!creature.souvenirMaintenant()) statutTemporaire(t('Pas encore de souvenir à portée de ciel.')); } },
      { nom: t('Renommer'), sous: creature.nom() || null, action: ouvrirNommer },
    ] },
    { titre: t('Suivi'), sous: t('Tes humeurs sur 30 jours et le résumé du mois'), action: () => ouvrirAnalyse('meteo') },
    { titre: t('Réglages'), sous: t('Rappel du soir, langue, sauvegarde, aide'), action: () => ouvrirReglages() },
  ];
}
function ligneMenu({ nom, sous, d, chev }, action) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'm-ligne';
  const tx = document.createElement('span'); tx.className = 'm-t'; tx.textContent = nom;
  if (sous) { const s = document.createElement('small'); s.textContent = sous; tx.append(s); }
  b.append(tx);
  if (d) { const e = document.createElement('span'); e.className = 'm-d'; e.textContent = d; b.append(e); }
  if (chev) { const e = document.createElement('span'); e.className = 'm-chev'; e.textContent = '›'; b.append(e); }
  b.addEventListener('click', action); return b;
}
function rendreMenu(groupe = null) {
  const L = $('menu-liste'); L.replaceChildren(); L.scrollTop = 0;
  $('menu-retour').hidden = !groupe; $('menu-zone-recherche').hidden = !!groupe; $('menu').classList.toggle('dedans', !!groupe);
  $('menu-titre').textContent = groupe ? groupe.titre : t('Menu');
  if (!groupe) { lignesMenu().forEach(g => L.append(ligneMenu({ nom: g.titre, sous: g.sous, d: g.d, chev: !!g.items }, g.items ? () => rendreMenu(g) : () => { fermerMenu(); g.action(); }))); return; }
  groupe.items().forEach(i => {
    if (i.note) { const p = document.createElement('p'); p.className = 'm-note'; p.textContent = i.note; L.append(p); }
    else L.append(ligneMenu(i, () => { fermerMenu(); i.action(); }));
  });
}
function ouvrirMenu() { $('reglages').hidden = true; boutique.fermer(); $('analyse').hidden = true; $('menu-champ').value = ''; rendreMenu(); $('menu').hidden = false; $('voile-menu').hidden = false; }
function fermerMenu() { $('menu').hidden = true; $('voile-menu').hidden = true; }
$('menu-fermer').addEventListener('click', fermerMenu);
$('menu-retour').addEventListener('click', () => rendreMenu());
// la recherche du menu passe la main à la palette (commandes + pensées par le sens)
$('menu-champ').addEventListener('input', e => {
  const v = e.target.value; if (!v) return;
  fermerMenu(); palette.ouvrir(); const c = $('palette').querySelector('input'); c.value = v; c.dispatchEvent(new Event('input'));
});
function ouvrirReglages() { $('analyse').hidden = true; $('reglages').hidden = false; rendreReglages(); }
function ouvrirAnalyse(onglet) { $('reglages').hidden = true; rendreAnalyse.ouvrir(onglet); }

// Mode calme : l'interface s'efface quand on ne touche à rien, il ne reste que le ciel.
let dernierGeste = performance.now();
const reveiller = () => { dernierGeste = performance.now(); document.body.classList.remove('calme'); };
['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(t => addEventListener(t, reveiller, { passive: true }));
setInterval(() => {
  const occupe = !palette.ouverte() ? ['ecrire', 'fiche', 'reglages', 'analyse', 'menu', 'boutique', 'accueil', 'perso', 'perso-ciel'].some(id => !$(id).hidden) || !!parcours : true;
  document.body.classList.toggle('calme', !occupe && performance.now() - dernierGeste > 4500);
}, 500);

// ───────────── Sauvegarde automatique dans un dossier ─────────────
const bSauv = $('btn-sauvegarde');
let toastMinuteur = null;
function toast(txt, ms = 2800) { const e = $('toast'); e.textContent = txt; e.classList.add('on'); clearTimeout(toastMinuteur); toastMinuteur = setTimeout(() => e.classList.remove('on'), ms); }
function statutTemporaire(t, ms = 3500) { $('statut').textContent = t; setTimeout(() => { if ($('statut').textContent === t) $('statut').textContent = ''; }, ms); }
async function majBoutonSauvegarde() {
  const e = await sauv.etat();
  bSauv.hidden = e === 'indisponible';
  bSauv.textContent = t('Sauvegarde') + DP + (e === 'actif' ? sauv.nomDossier() : e === 'a-reconnecter' ? t('reconnecter') : t('non'));
  bSauv.setAttribute('aria-pressed', e === 'actif');
}
bSauv.addEventListener('click', async () => {
  try {
    const e = await sauv.etat();
    if (e === 'a-reconnecter') { if (await sauv.reconnecter()) { await sauv.sauvegarder({ items, jours: meta }); statutTemporaire(t('Sauvegarde reprise.')); } }
    else if (e === 'actif') { if (confirm(t('Arrêter la sauvegarde automatique ? Les fichiers déjà écrits restent dans le dossier.'))) await sauv.arreter(); }
    else { const nom = await sauv.choisir(); await sauv.sauvegarder({ items, jours: meta }); statutTemporaire(t('Sauvegarde dans « {nom} » (les photos et vidéos n’y sont pas copiées).', { nom }), 6000); }
  } catch (err) { if (err && err.name !== 'AbortError') statutTemporaire(t('Sauvegarde impossible : {e}', { e: err.message || err })); }
  majBoutonSauvegarde();
});
surSauvegarde(donnees => sauv.planifier(donnees, (ok, err) => { if (err) { statutTemporaire(t('Sauvegarde interrompue : reconnectez le dossier.')); majBoutonSauvegarde(); } }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { majBoutonSauvegarde(); rappels.rattraper(); } });

// ───────────── Application installable (PWA) ─────────────
let invitationInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); invitationInstall = e; $('installer').hidden = false; });
addEventListener('appinstalled', () => { invitationInstall = null; $('installer').hidden = true; statutTemporaire(t('Constellation est installée.')); });
$('installer').addEventListener('click', async () => { if (!invitationInstall) return; invitationInstall.prompt(); await invitationInstall.userChoice; invitationInstall = null; $('installer').hidden = true; });
// Service worker : la page vient du cache (ouverture instantanée). Quand une nouvelle version est en ligne, elle s'installe
// en arrière-plan puis la page se recharge toute seule (pas pendant l'écriture : le rechargement attend la fermeture de l'éditeur).
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.AndroidBridge) {
  const avait = !!navigator.serviceWorker.controller;   // première visite : pas de rechargement, la page est déjà neuve
  navigator.serviceWorker.register('sw.js').then(reg => {
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let recharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!avait || recharge) return; recharge = true;
    const essayer = () => { if ($('ecrire').hidden) location.reload(); else setTimeout(essayer, 1500); };
    essayer();
  });
}

// ───────────── Rappel du soir ─────────────
const messageRappel = () => ({ titre: 'Constellation', corps: t('{nom} vous attend : une pensée pour ce soir ?', { nom: creature.nom() || t('Votre lueur') }) });
function inviteDuSoir(forcer = false) {
  const h = new Date().getHours(), jour = aujourdhui();
  if (!forcer && (h < 19 || items.some(e => e.jour === jour))) return;
  try { if (!forcer && localStorage.getItem('constellation.invite') === jour) return; localStorage.setItem('constellation.invite', jour); } catch (e) {}
  statutTemporaire(t('Le jour s’éteint… une pensée pour ce soir ?'), 9000); creature.dire(t('Une pensée pour ce soir ?'), { priorite: true, duree: 7000 });
  $('nouveau').animate([{ boxShadow: '0 0 0 0 rgba(255,255,255,.7)' }, { boxShadow: '0 0 0 14px rgba(255,255,255,0)' }], { duration: 1600, iterations: 4 });
}
rappels.planifier({ ecritAujourdhui: () => items.some(i => i.jour === aujourdhui()), message: messageRappel, invite: () => inviteDuSoir(true) });
rappels.synchroniserSW(items.some(i => i.jour === aujourdhui()) ? aujourdhui() : null);

// ───────────── La petite lueur : première rencontre ─────────────
function ouvrirNommer() { $('nom-champ').value = creature.nom(); $('nommer').hidden = false; $('nom-champ').focus(); }
function validerNom() {
  creature.renommer($('nom-champ').value); $('nommer').hidden = true; creature.celebrer(null);
  statutTemporaire(t('Bienvenue, {nom}.', { nom: creature.nom() }), 5000);
}
$('nom-ok').addEventListener('click', validerNom);
$('nom-champ').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); validerNom(); } e.stopPropagation(); });
function ouvrirAide() {
  const ex = items.some(e => e.sample);                // au premier lancement : dire que les entrées visibles sont des exemples inventés
  $('aide-exemples').hidden = !ex; $('aide-effacer').hidden = !ex; $('aide').hidden = false;
}
$('aide-effacer').addEventListener('click', async () => { fermerAide(); await effacerExemples(false); });
function fermerAide() { $('aide').hidden = true; try { localStorage.setItem('constellation.aide', '1'); } catch (e) {} }
$('aide-ok').addEventListener('click', fermerAide);
// Premier lancement (rien d'écrit, accueil jamais vu) : l'accueil raconté. Sinon la lueur apparaît quand la caméra est arrivée.
const accueil = monterAccueil({
  montrerLueur: () => creature.montrer(), nom: () => creature.nom(), renommer: n => creature.renommer(n),
  ouvrirBoutique: () => ouvrirBoutique(null, 'lueur'), toast, fini: () => { creature.celebrer(null); },
});
function apresIntro() {
  if (!accueilVu() && !joursEcrits().length) { setTimeout(() => accueil.demarrer(), 700); return; }
  marquerAccueil(); creature.montrer();
  setTimeout(() => { const l = datesDuJour(aujourdhui()); if (l.length) creature.fete(t('Aujourd’hui : {titre} !', { titre: l[0].titre })); }, 2500);
  if (new URLSearchParams(location.search).get('ecrire') === '1') setTimeout(() => ouvrirEcrire(), 1200);       // depuis la notification du rappel
}

// ───────────── Ma lueur, mon ciel : ce qui a été débloqué ─────────────
// aperçus du ciel (v20) : sur téléphone, les panneaux du ciel couvrent l'écran ; on y recopie le ciel en direct, juste après son rendu
const apercusCiel = [], petitEcran = matchMedia('(max-width: 720px)');
function copierCiel() {
  if (!petitEcran.matches) return; const src = renderer.domElement;
  for (const c of apercusCiel) {
    if (!c.offsetParent) continue;
    const sw = Math.min(src.width, src.height * c.width / c.height * .8), sh = sw * c.height / c.width;
    c.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  }
}
const persoUI = monterPerso({ zone: $('perso'), corps: $('perso-corps'), creature, nommer: () => ouvrirNommer(),
  objets: { basculer: cle => { etoiles.basculer(cle); appliquerObjets(); }, boutique: cle => { fermerPerso(); ouvrirBoutique(cle); } } });
function fermerPanneaux() { $('reglages').hidden = true; $('analyse').hidden = true; boutique.fermer(); if (persoUI.ouvert()) fermerPerso(); cielUI.fermer(); }
function ouvrirPerso(cle) { fermerPanneaux(); persoUI.ouvrir(cle); document.body.classList.add('ecriture'); }
function fermerPerso() { persoUI.fermer(); document.body.classList.remove('ecriture'); }
$('perso-fermer').addEventListener('click', fermerPerso);
const cielUI = monterCielPerso({ zone: $('perso-ciel'), corps: $('ciel-corps'), ctx: {
  apercuCiel: c => apercusCiel.push(c),
  lire: () => R, maj: majReglage, themes: THEMES, moods: MOODS, couleur: cm,
  remplacer: r => { const av = Re.theme; R = { ...DEFAUT, ...r }; sauverReglages(R); majEffectifs(); Re.theme !== av ? appliquerTheme() : (recolorer(), appliquerCurseurs()); },
  basculer: cle => { etoiles.basculer(cle); appliquerObjets(); montrerDansLeCiel(cle); },
  boutique: cle => { cielUI.fermer(); ouvrirBoutique(cle, 'ciel'); },
} });
function ouvrirCielPerso(cle) { fermerPanneaux(); cielUI.ouvrir(cle); }
glisserPourFermer($('perso-ciel'), () => cielUI.fermer());

// ───────────── Boutique (✦) : chaque objet acheté s'allume tout de suite ─────────────
function appliquerObjets() {
  majEffectifs(); appliquerCurseurs();
  U.uCroix.value = etoiles.actif('croix') ? 1 : 0;
  creature.yeuxEtoiles(etoiles.actif('yeux-etoiles'));
  meteores.dorees(etoiles.actif('filantes-or'), etoiles.actif('filantes') ? .6 : 1);
  decor.regler({ planetes: decor.PLANETES.filter(etoiles.actif), clair: T().clair });
  // la lueur ne porte que ce qui est acheté (et allumé)
  const P = creature.perso(), E = etoiles.persoEffectif(P), diff = {};
  for (const k of Object.keys(E)) if (JSON.stringify(E[k]) !== JSON.stringify(P[k])) diff[k] = E[k];
  if (Object.keys(diff).length) creature.personnaliser(diff, true);
  if (persoUI.ouvert()) persoUI.rendre(); if (cielUI.ouvert()) cielUI.rendre();
}
function ouvrirBoutique(cle, onglet) { const a = cle && etoiles.article(cle); fermerPanneaux(); boutique.ouvrir(a ? a.cat : (onglet || 'lueur'), cle); }
const boutique = monterBoutique($('boutique'), {
  surChange: cle => { appliquerObjets(); montrerDansLeCiel(cle); },
  vignette3D: (toile, o) => creature.vignette(toile, o),   // vignettes de la lueur : la vraie lueur 3D portant l'article
  apercu: toile => creature.apercu(toile),                 // l'aperçu fixe en haut : la lueur telle qu'elle est
  apercuCiel: c => apercusCiel.push(c),                    // onglet « Ton ciel » (téléphone) : le ciel en direct
  equipe: a => etoiles.porte(a, creature.perso(), R) || (a.type === 'interrupteur' && etoiles.actif(a.cle)),
  equiper: (a, oui) => {
    if (a.type === 'interrupteur') { if (etoiles.actif(a.cle) !== !!oui) etoiles.basculer(a.cle); }
    else { const p = etoiles.patch(a, oui); a.source === 'reglage' ? majReglage(p) : creature.personnaliser(p); }
    appliquerObjets();
  },
  ouvrirReglage: a => { boutique.fermer(); a.cat === 'lueur' ? ouvrirPerso(a.cle) : ouvrirCielPerso(a.cle); },
  surAchat: cle => {
    const a = etoiles.article(cle); toast(a.nom);
    if (a.cat === 'lueur') creature.celebrer(null);   // le ciel : montrerDansLeCiel (surChange)
    accueil.surAchat();
  },
});
glisserPourFermer($('boutique'), () => boutique.fermer());
// v22 : sur téléphone, le panneau plein écran descend quelques secondes pour laisser voir tout le ciel (un toucher le fait remonter)
let minuteurCiel = 0;
function voirLeCiel(duree = 4800) {
  if (!petitEcran.matches || !(boutique.ouvert() || cielUI.ouvert())) return;
  document.body.classList.add('voir-ciel'); clearTimeout(minuteurCiel); minuteurCiel = setTimeout(rendreLePanneau, duree);
}
function rendreLePanneau() { clearTimeout(minuteurCiel); document.body.classList.remove('voir-ciel'); }
addEventListener('pointerdown', () => { if (document.body.classList.contains('voir-ciel')) setTimeout(rendreLePanneau, 0); }, true);
// v22 : regarder une planète un peu de côté, pour que l'étoile du jour (au centre) ne la cache pas
function decale(dir) {
  const demiH = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect), demiV = camera.fov * Math.PI / 360;
  const v = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan(Math.tan(demiH) * .5));
  const droite = new THREE.Vector3().crossVectors(v, new THREE.Vector3(0, 1, 0)).normalize();
  return v.applyAxisAngle(droite, -Math.atan(Math.tan(demiV) * .45)).normalize();   // en haut à droite, loin des étoiles du centre
}
// v21 : allumer un astre ou une animation du ciel le montre tout de suite (la vue tourne vers la planète, l'animation se joue)
function montrerDansLeCiel(cle) {
  const a = etoiles.article(cle); if (!a || a.cat !== 'ciel' || a.type !== 'interrupteur' || !etoiles.actif(cle)) return;
  voirLeCiel(); if (selection && petitEcran.matches) fermerFiche();
  const d0 = Math.max(DIST.semaine, camera.position.distanceTo(controls.target));   // jamais collé à une étoile : elle cacherait tout
  if (decor.PLANETES.includes(cle)) { voler(controls.target.clone(), d0, decale(decor.direction(cle))); setTimeout(() => decor.apparaitre(cle), 900); return; }
  if (cle === 'lactee') {                               // la vue tourne vers la bande, qui traverse l'écran en biais
    const ax = lactee.userData.ax, v = new THREE.Vector3(); camera.getWorldDirection(v); v.addScaledVector(ax, -v.dot(ax)).normalize();
    voler(controls.target.clone(), d0, decale(v)); return;
  }
  if (cle === 'filantes-or' || cle === 'filantes') { meteores.rafale(3); return; }
  const ev = { aurores: 'aurore', cometes: 'comete', baleine: 'baleine', dessins: 'dessin', satellites: 'satellite', lune: 'lune' }[cle];
  if (ev) { if (camera.position.distanceTo(controls.target) < d0 - 1) voler(controls.target.clone(), d0); setTimeout(() => evenements.declencher(ev), ev === 'lune' ? 400 : 1300); return; }
  if (cle === 'croix' || cle === 'lucioles') voler(posDuJour(aujourdhui()), DIST.semaine);
}

// ───────────── Démarrage ─────────────
// Première visite : choisir la langue (présélection selon le navigateur). Une autre langue que la présélection recharge la page.
function choisirLangue() {
  return new Promise(res => {
    const z = $('langue-choix'), ch = $('chargement'); ch.classList.add('choix'); z.hidden = false;
    z.querySelectorAll('button').forEach(b => {
      if (b.dataset.langue === LANGUE) b.classList.add('plein');
      b.addEventListener('click', () => {
        memoriserLangue(b.dataset.langue);
        if (b.dataset.langue !== LANGUE) { location.reload(); return; }
        z.hidden = true; ch.classList.remove('choix'); res();
      });
    });
    z.querySelector('button.plein').focus();
  });
}

(async () => {
  const T0 = performance.now(), etape = (v, nom) => { window.__charge?.(v); console.info('chargement', v + ' %', nom, Math.round(performance.now()) + ' ms depuis l’ouverture'); };
  etape(62, 'modules');
  if (!langueChoisie) await choisirLangue();
  majBoutonProfond();
  if (mode === 'profonde') { try { await chargerProfond(m => { $('statut').textContent = m; }); $('statut').textContent = ''; } catch (e) { mode = 'legere'; majBoutonProfond(); } }
  appliquerTheme();
  await recalculer(); etoiles.crediter(joursEcrits()); appliquerObjets(); etape(72, 'données');
  { const v = vueInitiale(); camera.position.copy(v.cible).addScaledVector(v.dir, DIST.semaine); controls.target.copy(v.cible); }
  // compiler les shaders avant la première image, sans geler la page quand le navigateur sait le faire en parallèle (mobiles surtout)
  // on compile TOUT, y compris ce qui est caché pour l'instant (autres niveaux de zoom) : sinon le premier zoom saccade
  etape(78, 'ciel');
  { const caches = []; scene.traverse(o => { if (!o.visible) { caches.push(o); o.visible = true; } });
    try {
      renderer.setRenderTarget(composer.readBuffer);
      if (renderer.extensions.has('KHR_parallel_shader_compile')) { const p = renderer.compileAsync(scene, camera); renderer.setRenderTarget(null); await Promise.race([p, new Promise(r => setTimeout(r, 3000))]); }
      else { renderer.compile(scene, camera); renderer.setRenderTarget(null); renderer.compile(sceneUI, camera); }   // sous l'écran de chargement : le temps d'attente ne se voit pas
      etape(90, 'shaders'); creature.prechauffer(renderer, camera); etape(97, 'lueur');         // la lueur 3D et TOUTES ses parties (même pas encore achetées) : rien ne fige au premier affichage ni au premier achat
    } catch (e) { renderer.setRenderTarget(null); }
    caches.forEach(o => { o.visible = false; }); }
  majBoutonSauvegarde(); chargementInitial = false; demarrerIntro(); setTimeout(() => inviteDuSoir(), 9500);
  boucle(); window.__charge_fini = true; etape(100, 'prêt');
  const ch = $('chargement'); if (ch) { ch.classList.add('fin'); setTimeout(() => ch.remove(), 1200); }
})();
window.__constellation = { etoiles, boutique, accueil, nEcrits: () => nEcrits, items: () => items, jours: () => jours, visuels, visuelsVisibles, camera, controls, composer, renderer, scene, dof, bloom, U, parcourir, arreterParcours, meteores, evenements, scenes, lucioles, creature, monde,
  niveau: () => niveau, foyer: () => foyer, voler, choisir, recalculer, meta: () => meta, ouvrirPerso, ouvrirCielPerso };
