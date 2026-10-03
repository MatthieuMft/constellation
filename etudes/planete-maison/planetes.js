// Tes planètes (v40) : achetées dans la boutique (« Planètes »), chacune avec son nom, ses couleurs et ses éléments.
// Une option achetée une fois (nuages, cerisiers, sapins, maisonnettes, anneaux, double anneau, couleurs libres) vaut pour toutes ;
// on l'active ou non sur chaque planète. Style « doux » validé par Matthieu (étude 2 bis du 3 oct. 2026) : sphères lisses,
// couleurs pastel fondues, lumière enveloppante, liseré et halo comme la lueur, nuages en voiles vaporeux. Tout en vraie 3D.
//
// Données : localStorage 'constellation.planetes.v1' = { liste: [planète], migre: bool } (clé à part : rien d'autre n'est touché).
//   planète = { id, nom, type: 'solide'|'gazeuse', palette, couleurs: { ocean?, terre?, sable?, b1?, b2? }, graine,
//               nuages, arbres: null|'cerisier'|'sapin', maisons, anneaux: null|'fin'|'large'|'penche', double, tempete, allumee }
//
// API :
//   liste() · planete(id) · creer(type) → planète · maj(id, patch) · MAX · PALETTES · OPTIONS (option → clé de la boutique)
//   effective(p) : la planète telle qu'elle se dessine (ce qui n'est pas acheté est retiré) ; visibles() : les allumées, avec leur place
//   construire(p) → { groupe, K } : la planète en 3D (K : demi-côté du cadre, en rayons de planète) ; tourner(groupe, t)
//   photo(toile, p, { az }) : une image fixe (rendue par rendrePhotos(renderer), appelée par la boucle avant le rendu du ciel)
//   EXEMPLES[cle] : la planète montrée sur la vignette d'un article de la boutique
//   migrer() : une seule fois, les 3 anciennes planètes achetées (v11 à v39) deviennent de vraies planètes, avec ce qu'il faut pour leur ressembler
import * as THREE from 'three';
// copie pour l'étude « planète maison » (3 oct. 2026) : sans boutique ni traduction
const t = (s, o = {}) => s.replace(/\{(\w+)\}/g, (m, k) => o[k] ?? m);
const E = { possede: () => true, offrir() {}, eteint: () => false };

const CLE = 'constellation.planetes.v1';
export const MAX = 6;                                   // six places dans le ciel
function lire() { try { const o = JSON.parse(localStorage.getItem(CLE)); if (o && Array.isArray(o.liste)) return o; } catch (e) {} return null; }
const etat = { liste: [], migre: true };
const ecrire = () => {};

// option de la planète → article de la boutique
export const OPTIONS = { nuages: 'pl-nuages', cerisier: 'pl-cerisiers', sapin: 'pl-sapins', maisons: 'pl-maisons', anneaux: 'pl-anneaux', double: 'pl-anneau-double', couleurs: 'pl-couleurs' };

// les palettes, gratuites ; « Couleurs libres » permet ensuite de changer l'océan, la terre, le sable, ou les deux bandes
export const PALETTES = {
  solide: {
    astra:   { nom: t('Printemps'), ocean: '#8fe6ef', profond: '#5aa6e0', sable: '#fff0cf', terre: '#a8e6a0', haute: '#7cc995', neige: '#ffffff', atmo: '#bff0ff', fleurs: '#ffc4dc', sapin: '#8fdcc0', murs: '#fff6ea', toit: '#ff9fb4' },
    peche:   { nom: t('Pêche'), ocean: '#a9c2ff', profond: '#7f8fe8', sable: '#fff1df', terre: '#ffd7a0', haute: '#ffb98a', neige: '#fff8f0', atmo: '#ffd9c4', fleurs: '#fff4f8', sapin: '#a8e6c0', murs: '#ffffff', toit: '#9fb2ff' },
    glacia:  { nom: t('Banquise'), ocean: '#b8e8fa', profond: '#86c0ee', sable: '#f2faff', terre: '#f7fcff', haute: '#e2f1ff', neige: '#ffffff', calotte: .72, atmo: '#d9f3ff', fleurs: '#ffe0ee', sapin: '#8fdcc0', murs: '#ffffff', toit: '#9fd0ff' },
    dune:    { nom: t('Désert'), ocean: '#8ff0e0', profond: '#5cc8d0', sable: '#fff0cc', terre: '#ffdca0', haute: '#ffc48a', neige: '#fff6e6', niveau: .4, calotte: .95, atmo: '#ffe2b8', fleurs: '#ffd0e0', sapin: '#a8e6a0', murs: '#fffaf2', toit: '#8fd8e0' },
    lavande: { nom: t('Lavande'), ocean: '#c9b8ff', profond: '#9a86f0', sable: '#fff0f6', terre: '#f6c8e6', haute: '#e6a8d8', neige: '#ffffff', atmo: '#e6d8ff', fleurs: '#fff0fa', sapin: '#b0e0d8', murs: '#fff8fc', toit: '#b9a0ff' },
    menthe:  { nom: t('Menthe'), ocean: '#a8f0e0', profond: '#6cd0c8', sable: '#fffbe8', terre: '#c8f0b0', haute: '#9adca0', neige: '#ffffff', atmo: '#d0fff0', fleurs: '#ffe6f0', sapin: '#7ccfb0', murs: '#fffdf4', toit: '#ffb0a0' },
  },
  gazeuse: {
    oree:   { nom: t('Or'), bandes: ['#fff0d6', '#ffc98f', '#fffaf0'], atmo: '#ffe8c4', anneau: ['#ffe6b8', '#ffc9a8'] },
    aqua:   { nom: t('Océan'), bandes: ['#c4ecff', '#86c4f0', '#f2fbff'], atmo: '#d0f0ff', anneau: ['#ffd6ec', '#cdeeff'] },
    peche:  { nom: t('Pêche'), bandes: ['#ffe8d6', '#ffbfa0', '#fff8f0'], atmo: '#ffe0cc', anneau: ['#ffe7c4', '#f0b7d8'] },
    braise: { nom: t('Braise'), bandes: ['#ffd2b8', '#f08a6a', '#fff0e0'], atmo: '#ffc8a8', anneau: ['#ffd8b0', '#ff9f8a'] },
    lilas:  { nom: t('Lilas'), bandes: ['#ece0ff', '#b9a0f0', '#fbf6ff'], atmo: '#e0d4ff', anneau: ['#f0e0ff', '#c8d8ff'] },
    menthe: { nom: t('Menthe'), bandes: ['#d8fff0', '#8fdcc8', '#f4fffb'], atmo: '#d0fff0', anneau: ['#e0fff4', '#c0e8ff'] },
  },
};
const NOMS = ['Astra', 'Orée', 'Glacia', 'Aqua', 'Dune', 'Lyra', 'Nova', 'Vega'];

export const liste = () => etat.liste;
export const planete = id => etat.liste.find(p => p.id === id) || null;
export function creer(type = 'solide', base = {}) {
  if (etat.liste.length >= MAX) return null;
  const pris = new Set(etat.liste.map(p => p.nom)), nom = NOMS.find(n => !pris.has(n)) || t('Planète {n}', { n: etat.liste.length + 1 });
  const p = { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), nom, type, palette: type === 'gazeuse' ? 'oree' : 'astra', couleurs: {},
    graine: 1 + Math.floor(Math.random() * 90), nuages: false, arbres: null, maisons: false, anneaux: null, double: false, tempete: false, allumee: true, ...base };
  etat.liste.push(p); ecrire(); return p;
}
export function maj(id, patch) {
  const p = planete(id); if (!p) return null;
  Object.assign(p, patch);
  if (patch.type && !PALETTES[p.type][p.palette]) p.palette = Object.keys(PALETTES[p.type])[0];
  ecrire(); return p;
}

// ce qui n'est pas acheté ne se dessine pas (la planète le retrouve dès que l'option est achetée)
export function effective(p) {
  const a = k => E.possede(OPTIONS[k]);
  return { ...p, nuages: p.type === 'solide' && p.nuages && a('nuages'), arbres: p.type === 'solide' && p.arbres && a(p.arbres) ? p.arbres : null,
    maisons: p.type === 'solide' && p.maisons && a('maisons'), anneaux: p.anneaux && a('anneaux') ? p.anneaux : null,
    double: !!p.anneaux && p.double && a('anneaux') && a('double'), couleurs: a('couleurs') ? p.couleurs || {} : {}, tempete: p.type === 'gazeuse' && p.tempete };
}
export const visibles = () => etat.liste.map((p, place) => ({ ...effective(p), place })).filter(p => p.allumee);

// passage à la v40 : les anciennes planètes (Planète à anneaux, Planète océan, Géante rouge) deviennent de vraies planètes
export function migrer() {
  if (etat.migre) return [];
  const faites = [];
  const anciennes = [
    ['planete-anneaux', { type: 'gazeuse', nom: 'Orée', palette: 'oree', anneaux: 'large', graine: 2 }, ['pl-anneaux']],
    ['planete-bleue', { type: 'solide', nom: 'Aqua', palette: 'astra', nuages: true, graine: 3 }, ['pl-nuages']],
    ['planete-rouge', { type: 'gazeuse', nom: 'Braise', palette: 'braise', tempete: true, graine: 7 }, []],
  ];
  for (const [cle, base, dons] of anciennes) {
    if (!E.possede(cle) || etat.liste.some(p => p.ancienne === cle)) continue;
    dons.forEach(E.offrir);
    const p = creer(base.type, { ...base, ancienne: cle, allumee: !E.eteint(cle) }); if (p) faites.push(p);
  }
  etat.migre = true; ecrire(); return faites;
}

// ───────── la 3D (reprise de l'étude 2 bis) ─────────
function h3(x, y, z, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const lis = x => x * x * (3 - 2 * x);
function bruit(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = lis(x - xi), v = lis(y - yi), w = lis(z - zi);
  const m = (a, b, k) => a + (b - a) * k, c = (i, j, k) => h3(xi + i, yi + j, zi + k, s);
  return m(m(m(c(0,0,0), c(1,0,0), u), m(c(0,1,0), c(1,1,0), u), v), m(m(c(0,0,1), c(1,0,1), u), m(c(0,1,1), c(1,1,1), u), v), w);
}
export const fbm = (x, y, z, s, o = 5) => { let a = 0, f = 1, tt = 0, k = .5; for (let i = 0; i < o; i++) { a += bruit(x * f, y * f, z * f, s + i) * k; tt += k; f *= 2.03; k *= .5; } return a / tt; };
export const rng = s => () => (s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0, (s >>> 0) / 4294967296);
const C = c => new THREE.Color(c);
const Y = new THREE.Vector3(0, 1, 0);
const LUM = new THREE.Vector3(-.55, .5, .67).normalize();
const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
// les effets lumineux s'ajoutent à la couleur sans toucher à l'opacité (la planète est ensuite posée sur le ciel par decor.js)
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

// matière douce : lumière enveloppante, un peu d'émission, un liseré de lumière au bord
export function doux(o = {}) {
  return new THREE.ShaderMaterial({ transparent: (o.opacite ?? 1) < 1, depthWrite: (o.opacite ?? 1) >= 1, vertexColors: !!o.vertexColors,
    uniforms: { uCol: { value: C(o.couleur || '#ffffff') }, uAtmo: { value: C(o.atmo || o.couleur || '#ffffff') }, uL: { value: LUM }, uEm: { value: o.em ?? .22 }, uRim: { value: o.rim ?? .55 }, uOp: { value: o.opacite ?? 1 }, uSpec: { value: o.spec ?? .12 } },
    vertexShader: `uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main(){ vec4 p = vec4(position, 1.); vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix*p; n = mat3(instanceMatrix)*n;
        #endif
        vec4 w = modelMatrix*p; vN = normalize(mat3(modelMatrix)*n); vV = normalize(cameraPosition - w.xyz); vC = uCol;
        #ifdef USE_COLOR
          vC = color;
        #endif
        gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uL, uAtmo; uniform float uEm, uRim, uOp, uSpec; varying vec3 vN; varying vec3 vV; varying vec3 vC;
      void main(){ vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n;
        float w = clamp(dot(n, uL)*.5 + .5, 0., 1.); w = w*w*(3. - 2.*w);
        vec3 c = vC*(.16 + .78*w) + vC*uEm;
        float rim = pow(1. - clamp(dot(n, v), 0., 1.), 2.4);
        c += mix(vC, uAtmo, .6)*rim*uRim*(.35 + .65*w);
        c += vec3(1., .97, .92)*pow(clamp(dot(reflect(-uL, n), v), 0., 1.), 24.)*uSpec;
        gl_FragColor = vec4(c, uOp);
        #include <colorspace_fragment>
      }` });
}
export function halo(couleur, taille, force) {
  return new THREE.Mesh(new THREE.PlaneGeometry(taille, taille), new THREE.ShaderMaterial({ ...ADD,
    uniforms: { uC: { value: C(couleur) }, uF: { value: force } },
    vertexShader: `varying vec2 vQ; void main(){ vQ = position.xy/${(taille / 2).toFixed(2)}; vec4 mv = modelViewMatrix*vec4(0., 0., 0., 1.); mv.xy += position.xy; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uF; varying vec2 vQ; void main(){ float r = length(vQ); float a = max((exp(-r*r*5.) - .007)*uF, 0.); gl_FragColor = vec4(uC*a, 1.);
      #include <colorspace_fragment>
    }` }));
}
function atmosphere(couleur, r, force) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), new THREE.ShaderMaterial({ ...ADD, side: THREE.BackSide,
    uniforms: { uC: { value: C(couleur) }, uF: { value: force } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position, 1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uF; varying vec3 vN; varying vec3 vV; void main(){ float r = abs(dot(vN, vV)); float a = pow(smoothstep(.0, .75, r), 2.)*uF*(.4 + .6*clamp(dot(vN, normalize(vec3(-.55, .5, .67))) + .3, 0., 1.)); gl_FragColor = vec4(uC*a, 1.);
      #include <colorspace_fragment>
    }` }));
}
// nuages vaporeux : une fine couche de voiles transparents, dessinée par un bruit déformé
function nuages(seed, couleur = '#ffffff') {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.045, 96, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uC: { value: C(couleur) }, uS: { value: .44 }, uGr: { value: seed * 7.31 % 100 }, uOp: { value: .9 } },
    vertexShader: `varying vec3 vO; varying vec3 vN; varying vec3 vV; void main(){ vO = position; vec4 mv = modelViewMatrix*vec4(position, 1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uS, uGr, uOp; varying vec3 vO; varying vec3 vN; varying vec3 vV;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)))*43758.5453); }
      float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = .5, s = 0.; for (int k = 0; k < 5; k++){ s += a*vn(p); p *= 2.03; a *= .5; } return s; }
      void main(){ vec3 p = normalize(vO)*2.4 + uGr; p.x *= .7;
        vec3 q = vec3(fbm(p + 3.1), fbm(p + 8.7), fbm(p + 1.9));
        float a = smoothstep(uS, uS + .16, fbm(p + q*1.6))*smoothstep(.0, .45, dot(vN, vV));
        float w = clamp(dot(vN, normalize(vec3(-.55, .5, .67)))*.6 + .4, 0., 1.);
        gl_FragColor = vec4(uC*(.35 + .75*w), a*uOp*(.45 + .55*w));
        #include <colorspace_fragment>
      }` })));
  g.userData.tourne = true; return g;
}
const ANNEAUX = { fin: { r0: 1.5, r1: 1.8, bandes: 4 }, large: { r0: 1.35, r1: 2.3, bandes: 12 }, penche: { r0: 1.4, r1: 2.1, bandes: 9, inclinaison: 1.05, penche: .5 } };
function anneaux(o) {
  const g = new THREE.Group(), r0 = o.r0, r1 = o.r1;
  const bande = (a, b, n) => {
    const mat = new THREE.ShaderMaterial({ ...ADD, side: THREE.DoubleSide,
      uniforms: { uA: { value: C(o.couleur) }, uB: { value: C(o.couleur2) }, uR: { value: new THREE.Vector2(a, b) }, uBandes: { value: n }, uOp: { value: .41 } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }`,
      fragmentShader: `uniform vec3 uA, uB; uniform vec2 uR; uniform float uBandes, uOp; varying vec3 vP;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
        void main(){ float t = (length(vP.xy) - uR.x)/(uR.y - uR.x);
          float d = .55 + .45*sin(t*uBandes*6.2832 + 1.); d = d*d;
          d *= smoothstep(0., .18, t)*smoothstep(1., .7, t);
          float an = atan(vP.y, vP.x); vec2 q = vec2(an*60., t*40.); float gr = step(.985, h(floor(q)))*.9;
          gl_FragColor = vec4(mix(uA, uB, t)*(d*.6 + gr*d)*uOp, 1.);
          #include <colorspace_fragment>
        }` });
    const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 180, 1), mat); m.rotation.x = -Math.PI / 2; g.add(m);
  };
  bande(r0, r1, o.bandes); if (o.second) bande(r1 + .1, r1 + .35, 1.5);
  g.rotation.set(o.inclinaison ?? .38, 0, o.penche ?? -.28);
  return g;
}

function solide(o) {
  const g = new THREE.Group(), seed = o.graine || 1, pal = o.pal;
  const geo = new THREE.IcosahedronGeometry(1, o.detail || 48), P = geo.attributes.position, col = new Float32Array(P.count * 3), v = new THREE.Vector3(), c = new THREE.Color(), c2 = new THREE.Color();
  const terre = [], cOc = C(pal.ocean), cOc2 = C(pal.profond), cSa = C(pal.sable), cTe = C(pal.terre), cTe2 = C(pal.haute), cNe = C(pal.neige);
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i).normalize();
    const n = fbm(v.x * 1.5 + 11, v.y * 1.5, v.z * 1.5, seed, 4), h = n - (pal.niveau ?? .5), pole = Math.abs(v.y);
    c.copy(cOc).lerp(cOc2, sm(0, .2, -h));
    c2.copy(cSa).lerp(cTe, sm(.01, .05, h)).lerp(cTe2, sm(.06, .25, h));
    c.lerp(c2, sm(-.012, .012, h));
    c.lerp(cNe, Math.max(sm((pal.calotte ?? .86) - .04, (pal.calotte ?? .86) + .04, pole + (n - .5) * .35), sm(.25, .31, h)));
    const r = 1 + Math.max(0, Math.min(h, .3)) * .12;
    if (h > .035 && h < .2 && pole < .78) terre.push(v.clone().multiplyScalar(r));
    P.setXYZ(i, v.x * r, v.y * r, v.z * r); col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, doux({ vertexColors: true, atmo: pal.atmo, em: .06, rim: .55, spec: .08 })));
  const R = rng(seed * 7 + 3);
  const places = [], libre = p => places.every(q => q.distanceToSquared(p) > .01);
  const poser = (n, fn) => { let k = 0; for (let e = 0; e < n * 30 && k < n && terre.length; e++) { const p = terre[Math.floor(R() * terre.length)]; if (libre(p)) { places.push(p); fn(p, k++); } } };
  const orienter = (m, p, s, tourne) => { const q = new THREE.Quaternion().setFromUnitVectors(Y, p.clone().normalize()); q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, tourne)); m.compose(p, q, new THREE.Vector3(s, s, s)); return m; };
  const inst = (gg, mat, n) => { const m = new THREE.InstancedMesh(gg, mat, n); g.add(m); return m; };
  if (o.maisons) {             // d'abord les maisons : elles gardent leur place quand on change d'arbres
    const n = 10, mat = new THREE.Matrix4();
    const ms = [inst(new THREE.CylinderGeometry(.42, .46, .7, 16).translate(0, .35, 0), doux({ couleur: pal.murs, em: .3, rim: .5 }), n),
      inst(new THREE.ConeGeometry(.6, .6, 16).translate(0, 1, 0), doux({ couleur: pal.toit, em: .3, rim: .6 }), n),
      inst(new THREE.CircleGeometry(.12, 12).translate(0, .38, .45), new THREE.MeshBasicMaterial({ color: '#ffe29a' }), n)];
    let k = 0; poser(n, p => { orienter(mat, p, .07 + R() * .012, R() * 6.28); ms.forEach(m => m.setMatrixAt(k, mat)); k++; });
    ms.forEach(m => m.count = k);
  }
  if (o.arbres) {
    const n = o.arbres === 'sapin' ? 45 : 55, mat = new THREE.Matrix4(), mats = [];
    mats.push(inst(new THREE.CylinderGeometry(.08, .12, .9, 8).translate(0, .45, 0), doux({ couleur: '#b98a78', em: .15, rim: .3 }), n));
    if (o.arbres === 'sapin') {
      const prof = []; for (let i = 0; i <= 16; i++) { const k = i / 16; prof.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(k, .7)) * .5 * (1 - k * .55), .6 + k * 1.3)); }
      mats.push(inst(new THREE.LatheGeometry(prof, 16), doux({ couleur: pal.sapin, atmo: '#ffffff', em: .3, rim: .6 }), n));
    } else {
      for (const [x, y, z, r] of [[0, 1.15, 0, .55], [.35, .95, .15, .38], [-.32, 1, -.12, .4]])
        mats.push(inst(new THREE.SphereGeometry(r, 16, 12).translate(x, y, z), doux({ couleur: pal.fleurs, atmo: '#ffffff', em: .2, rim: .6 }), n));
    }
    let k = 0; poser(n, p => { orienter(mat, p, .05 + R() * .02, R() * 6.28); mats.forEach(m => m.setMatrixAt(k, mat)); k++; });
    mats.forEach(m => m.count = k);
  }
  if (o.nuages) g.add(nuages(seed));
  g.add(atmosphere(pal.atmo, 1.1, .45));
  return g;
}
function gazeuse(o) {
  const g = new THREE.Group(), b = o.bandes;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: C(b[0]) }, uB: { value: C(b[1]) }, uC: { value: C(b[2]) }, uTemp: { value: o.tempete ? 1 : 0 }, uL: { value: LUM }, uS: { value: o.graine || 1 }, uAtmo: { value: C(o.atmo) } },
    vertexShader: `varying vec3 vO; varying vec3 vN; varying vec3 vV; void main(){ vO = position; vec4 w = modelMatrix*vec4(position, 1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uA, uB, uC, uL, uAtmo; uniform float uTemp, uS; varying vec3 vO; varying vec3 vN; varying vec3 vV;
      float h(vec3 p){ p = fract(p*.3183 + .1); p *= 17.; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
      float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3. - 2.*f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 p = normalize(vO); float lat = p.y, w = n3(p*2.5 + uS)*.6 + n3(p*5. + uS)*.3;
        float b = lat*5. + w*1.1;
        vec3 c = mix(uA, uB, smoothstep(.15, .85, .5 + .5*sin(b*3.14159)));
        c = mix(c, uC, smoothstep(.55, 1., .5 + .5*sin(b*1.6 + 1.3))*.6);
        if (uTemp > .5) { vec2 q = vec2(atan(p.z, p.x) - .7, lat + .28); float d = length(q*vec2(1., 1.7)); c = mix(c, mix(uC, vec3(1.), .4), smoothstep(.22, .04, d)*.8); }
        vec3 n = normalize(vN), v = normalize(vV);
        float l = clamp(dot(n, uL)*.5 + .5, 0., 1.); l = l*l*(3. - 2.*l);
        vec3 col = c*(.16 + .8*l) + c*.05 + mix(c, uAtmo, .6)*pow(1. - clamp(dot(n, v), 0., 1.), 2.4)*.55*(.35 + .65*l);
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }` });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat));
  g.add(atmosphere(o.atmo, 1.08, .4));
  return g;
}
const fonce = (hex, k) => '#' + C(hex).multiplyScalar(k).getHexString();

// la planète en 3D, prête à poser dans une scène ; K : demi-côté du cadre (en rayons de planète) pour la voir en entier
export function construire(p, o = {}) {
  const tout = new THREE.Group(), pl = new THREE.Group(); tout.add(pl);
  const cs = p.couleurs || {};
  let atmo, anneau;
  if (p.type === 'gazeuse') {
    const pal = PALETTES.gazeuse[p.palette] || PALETTES.gazeuse.oree, b = [...pal.bandes];
    if (cs.b1) b[0] = cs.b1; if (cs.b2) b[1] = cs.b2;
    pl.add(gazeuse({ bandes: b, atmo: pal.atmo, tempete: p.tempete, graine: p.graine })); atmo = pal.atmo; anneau = pal.anneau;
  } else {
    const pal = { ...(PALETTES.solide[p.palette] || PALETTES.solide.astra) };
    if (cs.ocean) { pal.ocean = cs.ocean; pal.profond = fonce(cs.ocean, .78); }
    if (cs.terre) { pal.terre = cs.terre; pal.haute = fonce(cs.terre, .86); }
    if (cs.sable) pal.sable = cs.sable;
    pl.add(solide({ pal, graine: p.graine, nuages: p.nuages, arbres: p.arbres, maisons: p.maisons, detail: o.detail })); atmo = pal.atmo; anneau = ['#ffffff', pal.atmo];
  }
  if (p.anneaux) tout.add(anneaux({ ...ANNEAUX[p.anneaux], couleur: anneau[0], couleur2: anneau[1], second: p.double }));
  tout.add(halo(atmo, 3.6, .1));
  const K = p.anneaux ? (p.double ? 2.75 : p.anneaux === 'large' ? 2.45 : 2.25) : 1.5;
  tout.userData = { pl, K, atmo };
  return { groupe: tout, K, atmo };
}
export function tourner(groupe, temps) {                // temps en secondes
  const pl = groupe.userData.pl; if (!pl) return;
  pl.rotation.y = -.6 + temps * .05;
  pl.children[0].children.forEach(c => { if (c.userData.tourne) c.rotation.y = temps * .02; });
}
export function liberer(groupe) {
  groupe.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
}

// vignettes de la boutique : la planète qui montre l'article
const AS = { type: 'solide', palette: 'astra', graine: 3, couleurs: {} };
export const EXEMPLES = {
  'planete-solide': { ...AS, nuages: true },
  'planete-gazeuse': { type: 'gazeuse', palette: 'oree', graine: 2, couleurs: {}, anneaux: 'fin' },
  'pl-nuages': { ...AS, nuages: true },
  'pl-cerisiers': { ...AS, arbres: 'cerisier' },
  'pl-sapins': { ...AS, palette: 'glacia', graine: 8, arbres: 'sapin' },
  'pl-maisons': { ...AS, palette: 'dune', graine: 21, maisons: true },
  'pl-anneaux': { type: 'gazeuse', palette: 'peche', graine: 4, couleurs: {}, anneaux: 'large' },
  'pl-anneau-double': { type: 'gazeuse', palette: 'aqua', graine: 5, couleurs: {}, anneaux: 'fin', double: true, tempete: true },
  'pl-couleurs': { ...AS, palette: 'lavande', graine: 12, couleurs: { ocean: '#ffb0c8', terre: '#fff0a0' } },
};

// ───────── photos (aperçus fixes) : rendues dans un coin de l'écran juste avant le ciel, puis recopiées ─────────
const file = [];
let studio = null;
export function photo(toile, p, o = {}) { const i = file.findIndex(f => f.toile === toile); if (i >= 0) file.splice(i, 1); file.push({ toile, p, o }); }
export function rendrePhotos(renderer) {
  if (!file.length) return; const t0 = performance.now();
  if (!studio) studio = { sc: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, .1, 100), vp: new THREE.Vector4(), sci: new THREE.Vector4(), cc: new THREE.Color(), fond: new THREE.Color('#05060f') };
  const s = studio;
  do {
    const { toile, p, o } = file.shift();
    try {
      const { groupe, K } = construire(p); tourner(groupe, o.temps || 0);
      s.sc.add(groupe);
      const dist = K * 1.04 / Math.tan(15 * Math.PI / 180);
      s.cam.position.set(0, dist * .143, dist); s.cam.lookAt(0, 0, 0);
      const S = Math.min(toile.width, renderer.domElement.width, renderer.domElement.height), pr = renderer.getPixelRatio(), can = renderer.domElement;
      renderer.getViewport(s.vp); renderer.getScissor(s.sci); renderer.getClearColor(s.cc);
      const st = renderer.getScissorTest(), ca = renderer.getClearAlpha(), ac = renderer.autoClear;
      renderer.setRenderTarget(null); renderer.setViewport(0, 0, S / pr, S / pr); renderer.setScissor(0, 0, S / pr, S / pr); renderer.setScissorTest(true);
      renderer.setClearColor(s.fond, 1); renderer.autoClear = true; renderer.render(s.sc, s.cam);
      const x = toile.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(can, 0, can.height - S, S, S, 0, 0, toile.width, toile.height); x.restore();
      renderer.setViewport(s.vp); renderer.setScissor(s.sci); renderer.setScissorTest(st); renderer.setClearColor(s.cc, ca); renderer.autoClear = ac;
      s.sc.remove(groupe); liberer(groupe);
    } catch (e) { console.warn('planète : photo', e); }
  } while (file.length && performance.now() - t0 < 12);
}
