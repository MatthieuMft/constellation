// v47 : la constellation de la semaine, avec de VRAIES constellations (demande de Matthieu : « reprendre des formes de
// constellations qui existent vraiment », la v46 dessinait des figures géométriques).
// Chaque semaine du ciel reçoit une constellation réelle à 7 étoiles (toujours la même pour cette semaine).
// Elle flotte au centre de l'anneau de la semaine, face à toi : 7 petites étoiles pâles reliées par des traits fins.
// Chaque jour écrit allume l'étoile de son jour (lundi = 1re étoile… dimanche = 7e), à la couleur de son humeur,
// et les traits entre deux étoiles allumées s'éclairent. Tes étoiles de journal ne bougent pas.
// Dès 3 jours écrits, on peut lui donner un nom : il s'écrit dessous, le vrai nom de la constellation en petit.
// Semaine = celle du ciel (monde.js) : lundi → dimanche, coupée au changement de mois.
// Noms dans constellation.figures.v1 = { noms: { 'AAAA-MM-sW': 'nom' } } (même clé et même format qu'en v46).
//
// API :
//   const figures = creerFigures({ scene, camera, melange, centreSemaine, texHalo });
//   figures.reconstruire({ jours: [{ cle, couleur }], clair, encre })   jours écrits, hors exemples
//   figures.update(t)
//   figures.semaineDe(cle) -> 'AAAA-MM-sW'
//   figures.figure(cleSemaine) -> { cle, jours, nom, vraiNom } | null   (null : moins de 3 jours écrits)
//   figures.nommer(cleSemaine, nom) · figures.centre(cleSemaine) -> Vector3 | null
import * as THREE from 'three';

const CLE = 'constellation.figures.v1', MIN = 3;
// v49 : la constellation se dessine SUR la semaine, à la place du chemin pointillé de la lueur. Ses 7 points sont posés
// dans un plan face à la vue d'arrivée (vueInitiale dans main.js), puis décalés en profondeur : vus de face ils dessinent
// la constellation, en tournant on voit qu'ils sont dispersés dans l'espace.
const VUE = new THREE.Vector3(.15, .55, .82).normalize(), DROITE = new THREE.Vector3().crossVectors(VUE.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize(), HAUT = new THREE.Vector3().crossVectors(DROITE, VUE.clone().negate()).normalize();
const FORME = 17, PROFONDEUR = [0, 2.6, -2.2, 1.4, -3, 3.2, -1.2];
export function pointsSemaine(cleS, centre) {
  return constellationDe(cleS).e.map(([x, y], i) => centre.clone().addScaledVector(DROITE, (x - .5) * FORME).addScaledVector(HAUT, (y - .5) * FORME + 2.5).addScaledVector(VUE, PROFONDEUR[i]));
}
export const ordreChemin = cleS => constellationDe(cleS).ordre || [0, 1, 2, 3, 4, 5, 6];
export const lendemain = cle => { const [y, m, d] = cle.split('-').map(Number); return cleJ(new Date(y, m - 1, d + 1)); };
const lisse = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const lire = () => { try { const o = JSON.parse(localStorage.getItem(CLE)); return o && o.noms ? o : { noms: {} }; } catch (e) { return { noms: {} }; } };

// Formes d'après les cartes du ciel (x vers l'est inversé comme on les voit, y vers le haut), éclat = grandeur relative.
// Ordre des étoiles = ordre des jours (lundi → dimanche), choisi pour que la figure se dessine au fil de la semaine.
export const CONSTELLATIONS = [
  { nom: 'Grande Ourse', en: 'Big Dipper', e: [[0, .38, .8], [.17, .5, .9], [.33, .52, 1], [.48, .46, .6], [.52, .22, .8], [.78, .18, .9], [.76, .48, 1]],
    t: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { nom: 'Orion', en: 'Orion', e: [[.22, .95, 1], [.72, .9, .85], [.38, .52, .8], [.48, .55, .85], [.58, .58, .8], [.3, .08, .8], [.78, .12, 1]],
    t: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  { nom: 'Petite Ourse', en: 'Little Dipper', e: [[.02, .62, 1], [.16, .52, .5], [.3, .46, .5], [.46, .42, .6], [.64, .5, .9], [.7, .26, .75], [.5, .2, .5]],
    t: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { nom: 'Cygne', en: 'Cygnus', e: [[.5, 1, 1], [.5, .66, .85], [.5, .38, .55], [.5, .02, .8], [.16, .6, .8], [.02, .38, .55], [.86, .76, .75]],
    t: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 6], [4, 5]] },
  { nom: 'Lion', en: 'Leo', e: [[.2, .1, 1], [.22, .3, .6], [.3, .48, .9], [.26, .68, .6], [.66, .52, .7], [.98, .3, .9], [.66, .26, .6]],
    t: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [6, 0], [4, 6]] },
  { nom: 'Pléiades', en: 'Pleiades', e: [[.12, .44, .7], [.12, .62, .5], [.46, .5, 1], [.66, .36, .7], [.86, .56, .75], [.74, .78, .75], [.9, .9, .55]],
    t: [[0, 1], [0, 2], [2, 3], [3, 4], [4, 5], [5, 2], [5, 6]] },
  { nom: 'Cassiopée', en: 'Cassiopeia', e: [[0, .62, .85], [.2, .28, 1], [.34, .4, .45], [.44, .5, .85], [.66, .3, .8], [.88, .66, .7], [.98, .84, .4]],
    t: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
];

// v49 : la constellation est la récompense de fin de semaine. Une semaine est finie quand son dernier jour est passé,
// ou le dimanche à partir de 18 h (pour la voir naître le soir même).
const cleJ = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export function dernierJour(cleS) {
  const [y, m, sw] = cleS.split('-'), w = +sw.slice(1), n = new Date(+y, +m, 0).getDate(); let der = null;
  for (let d = 1; d <= n; d++) { const k = `${y}-${m}-${String(d).padStart(2, '0')}`; if (semaineDe(k) === cleS) der = k; }
  return der;
}
export function finie(cleS, maintenant = new Date()) {
  const auj = cleJ(maintenant), der = dernierJour(cleS); if (!der) return false;
  return der < auj;                                                          // v64 : à minuit, dans la nuit de dimanche à lundi (avant : dimanche 18 h)
}
export function semaineDe(cle) {
  const [y, m, d] = cle.split('-').map(Number), w = Math.floor((d - 1 + ((new Date(y, m - 1, 1).getDay() + 6) % 7)) / 7);
  return `${y}-${String(m).padStart(2, '0')}-s${w}`;
}
// v61 : étoiles offertes. Une semaine coupée au changement de mois (ex. jeudi 1er → dimanche 4) n'a pas ses 7 jours,
// et les jours d'avant ta toute première note n'ont jamais pu être écrits : ces étoiles-là sont offertes, déjà allumées
// d'un blanc doux, pour que la constellation puisse toujours être complétée avec les jours vraiment possibles.
export function offerts(cleS, premier = null) {
  const [y, m] = cleS.split('-'), n = new Date(+y, +m, 0).getDate(), dans = new Map(), r = new Set();
  for (let d = 1; d <= n; d++) { const k = `${y}-${m}-${String(d).padStart(2, '0')}`; if (semaineDe(k) === cleS) dans.set(jourDeSemaine(k), k); }
  for (let i = 0; i < 7; i++) { const k = dans.get(i); if (!k || (premier && k < premier)) r.add(i); }
  return r;
}
export const BLANC_OFFERT = '#e6e9ff';
const jourDeSemaine = cle => { const [y, m, d] = cle.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; };   // lundi = 0
export const constellationDe = cleS => { const [y, m, sw] = cleS.split('-'), i = (+y * 12 + +m) * 5 + +sw.slice(1); return CONSTELLATIONS[((i % 7) + 7) % 7]; };   // semaines voisines : constellations différentes

function texteSprite(txt, hauteur, encre, clair, italique = true) {
  const H = 160, police = (italique ? 'italic ' : '') + '92px Georgia, serif', m = document.createElement('canvas').getContext('2d'); m.font = police;
  const W = Math.min(2048, Math.ceil(m.measureText(txt).width + 80));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.font = police; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = clair ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.85)'; g.shadowBlur = 20; g.fillStyle = encre; g.fillText(txt, W / 2, 82);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0 }));
  s.scale.set(hauteur * W / H, hauteur, 1); s.renderOrder = 21; return s;
}

export function creerFigures({ scene, camera, melange, centreSemaine, texHalo, en = false }) {
  const racine = new THREE.Group(); scene.add(racine);
  let objets = [], parSemaine = new Map(), memo = { jours: [], clair: false, encre: '#f1ece4' }; const forcees = new Set(), anims = new Map();   // essai : fins de semaine simulées
  const pale = new THREE.Color(), _q = new THREE.Quaternion(), completes = new Set();
  const estFinie = s => forcees.has(s) || completes.has(s) || finie(s);

  function liberer(o) { o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) { if (x.material.map && x.material.map !== texHalo) x.material.map.dispose(); x.material.dispose(); } }); }
  function vider() { for (const o of objets) { racine.remove(o.g); liberer(o.g); } objets = []; }

  function reconstruire({ jours = memo.jours, clair = memo.clair, encre = memo.encre } = {}) {
    memo = { jours, clair, encre }; vider(); parSemaine = new Map();
    pale.set(clair ? encre : '#c9d3ff');
    for (const j of jours) { const s = semaineDe(j.cle); if (!parSemaine.has(s)) parSemaine.set(s, []); parSemaine.get(s).push(j); }
    const { noms } = lire(), premier = jours.reduce((a, j) => !a || j.cle < a ? j.cle : a, null);
    completes.clear();
    for (const [s, liste] of parSemaine) {                                       // v62 : 7 étoiles allumées (écrites ou offertes) = semaine finie, sans attendre dimanche 18 h
      const on = offerts(s, premier); for (const j of liste) on.add(jourDeSemaine(j.cle)); if (on.size === 7) completes.add(s);
    }
    for (const [s, liste] of parSemaine) {
      if (!estFinie(s)) continue;                               // pendant la semaine : rien, juste tes étoiles
      const C = constellationDe(s), allume = new Map(liste.map(j => [jourDeSemaine(j.cle), j.couleur])), offre = offerts(s, premier), g = new THREE.Group(); racine.add(g);
      const c = centreSemaine(s), P = pointsSemaine(s, c);
      // traits : pâles partout, lumineux entre deux étoiles allumées
      const faibles = [], forts = [];
      // v61 (demande de Matthieu) : à la fin de la semaine, la constellation se dessine TOUJOURS en entier. Un jour raté n'est pas puni :
      // son étoile brille d'un blanc doux, un peu plus petite ; les jours écrits gardent la couleur de leur humeur.
      const rate = new Set(); for (let i = 0; i < 7; i++) if (!allume.has(i)) { allume.set(i, null); if (!offre.has(i)) rate.add(i); }
      for (const [a, b] of C.t) (allume.has(a) && allume.has(b) ? forts : faibles).push(P[a].x, P[a].y, P[a].z, P[b].x, P[b].y, P[b].z);
      const traits = (pos, op) => { if (!pos.length) return null; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: pale, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: melange() })); l.userData = { op, trait: true }; l.renderOrder = 2; l.frustumCulled = false; g.add(l); return l; };
      traits(faibles, clair ? .3 : .26); traits(forts, clair ? .85 : .8);
      // étoiles : petites et pâles, ou allumées à la couleur du jour
      C.e.forEach(([, , eclat], i) => {
        const on = allume.has(i), cj = allume.get(i), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: on ? (cj ? new THREE.Color(cj).lerp(new THREE.Color('#ffffff'), .35) : new THREE.Color(clair ? encre : BLANC_OFFERT)) : pale, transparent: true, depthTest: false, depthWrite: false, blending: melange(), opacity: 0, fog: false }));
        const taille = (on ? (cj ? 2.6 : rate.has(i) ? 1.5 : 1.9) : 1.1) * (.7 + .5 * eclat);
        sp.position.copy(P[i]); sp.scale.setScalar(taille); sp.userData = { op: on ? (cj ? 1 : rate.has(i) ? .6 : .75) : (clair ? .55 : .5), on, ph: i * 1.7, i, taille }; sp.renderOrder = 3; g.add(sp);
      });
      // noms au-dessus : le tien (s'il existe), et le vrai nom en petit
      const haut = c.clone().addScaledVector(HAUT, FORME * .5 + 4.5);
      const vrai = texteSprite(en ? C.en : C.nom, noms[s] ? 1.1 : 1.4, encre, clair, false); vrai.position.copy(haut); vrai.userData = { op: .6, texte: true }; g.add(vrai);
      if (noms[s]) { const n = texteSprite(noms[s], 2.2, encre, clair); n.position.copy(haut).addScaledVector(HAUT, 1.9); n.userData = { op: .92, texte: true }; g.add(n); }
      objets.push({ cle: s, g, c: c.clone(), cs: c.clone(), n: liste.length, anim: anims.get(s) || null });
    }
  }
  // v49 : l'animation de fin de semaine : les étoiles s'allument une à une (un tintement chacune), puis paf, toute la constellation
  const PAS = .42;
  function update(t) {
    for (const o of objets) {
      const d = camera.position.distanceTo(o.cs), vis = (1 - lisse(150, 260, d)) * (o.n ? 1 : 0);
      o.g.visible = vis > .01; if (!o.g.visible) continue;
      const A = o.anim; if (A && A.t0 == null) A.t0 = t + .2;
      const ta = A ? t - A.t0 : 99, paf = 7 * PAS + .35;
      if (A) {
        for (let i = 0; i < 7; i++) if (ta >= i * PAS && !A.vus.has(i)) { A.vus.add(i); A.surEtoile && A.surEtoile(i); }
        if (ta >= paf && !A.paf) { A.paf = true; A.surPaf && A.surPaf(); }
        if (ta > paf + 3) { o.anim = null; anims.delete(o.cle); }
      }
      for (const x of o.g.children) {
        const u = x.userData; let k = u.on ? .85 + .15 * Math.sin(t * 1.6 + u.ph) : (u.ph != null ? .8 + .2 * Math.sin(t * .7 + u.ph) : 1);
        if (u.i != null) {                                                         // une étoile : naît à son tour, avec un petit éclat
          const ti = ta - u.i * PAS, f = ta >= paf ? Math.max(0, 1 - (ta - paf) / .6) : 0;
          k *= lisse(0, .15, ti); x.scale.setScalar(u.taille * (1 + 1.3 * Math.max(0, 1 - ti / .5) * (ti >= 0 ? 1 : 0) + .8 * f));
        }
        if (u.trait) k *= ta >= paf ? Math.min(1.6, lisse(paf, paf + .18, ta) * (1 + .8 * Math.max(0, 1 - (ta - paf) / .8))) : 0;
        if (u.texte) k *= lisse(paf + .5, paf + 1.5, ta);
        x.material.opacity = Math.min(1, vis * u.op * k);
      }
    }
  }
  function animer(s, rappels = {}) { anims.set(s, { t0: null, vus: new Set(), paf: false, ...rappels }); const o = objets.find(x => x.cle === s); if (o) o.anim = anims.get(s); }
  return {
    reconstruire, update, semaineDe, animer, _objets: () => objets,
    estFinie,
    finies: () => [...parSemaine.keys()].filter(estFinie).sort(),
    forcer(s) { forcees.add(s); reconstruire(); },
    vraiNom: s => { const C = constellationDe(s); return en ? C.en : C.nom; },
    annoncee(s, oui) { const o = lire(); o.vues = o.vues || []; if (oui === undefined) return o.vues.includes(s); if (!o.vues.includes(s)) o.vues.push(s); try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} },
    figure(s) { const l = parSemaine.get(s); if (!l || l.length < MIN || !estFinie(s)) return null; const C = constellationDe(s);
      return { cle: s, jours: l.map(j => j.cle).sort(), nom: lire().noms[s] || '', vraiNom: en ? C.en : C.nom }; },
    nommer(s, nom) { const o = lire(); nom = (nom || '').trim().slice(0, 40); if (nom) o.noms[s] = nom; else delete o.noms[s]; try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} reconstruire(); },
    centre(s) { const o = objets.find(x => x.cle === s); return o ? o.cs.clone() : null; },
  };
}
