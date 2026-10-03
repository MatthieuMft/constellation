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

const CLE = 'constellation.figures.v1', MIN = 3, TAILLE = 11;
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

export function semaineDe(cle) {
  const [y, m, d] = cle.split('-').map(Number), w = Math.floor((d - 1 + ((new Date(y, m - 1, 1).getDay() + 6) % 7)) / 7);
  return `${y}-${String(m).padStart(2, '0')}-s${w}`;
}
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
  let objets = [], parSemaine = new Map(), memo = { jours: [], clair: false, encre: '#f1ece4' };
  const pale = new THREE.Color(), _q = new THREE.Quaternion();

  function liberer(o) { o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) { if (x.material.map && x.material.map !== texHalo) x.material.map.dispose(); x.material.dispose(); } }); }
  function vider() { for (const o of objets) { racine.remove(o.g); liberer(o.g); } objets = []; }

  function reconstruire({ jours = memo.jours, clair = memo.clair, encre = memo.encre } = {}) {
    memo = { jours, clair, encre }; vider(); parSemaine = new Map();
    pale.set(clair ? encre : '#c9d3ff');
    for (const j of jours) { const s = semaineDe(j.cle); if (!parSemaine.has(s)) parSemaine.set(s, []); parSemaine.get(s).push(j); }
    const { noms } = lire();
    for (const [s, liste] of parSemaine) {
      const C = constellationDe(s), allume = new Map(liste.map(j => [jourDeSemaine(j.cle), j.couleur])), g = new THREE.Group();
      const c = centreSemaine(s); g.position.copy(c).add(new THREE.Vector3(0, TAILLE * .5 + 2.4, 0)); racine.add(g);   // au-dessus de l'anneau : elle surplombe la semaine sans cacher sa date
      const P = C.e.map(([x, y]) => new THREE.Vector3((x - .5) * TAILLE, (y - .5) * TAILLE, 0));
      // traits : pâles partout, lumineux entre deux étoiles allumées
      const faibles = [], forts = [];
      for (const [a, b] of C.t) (allume.has(a) && allume.has(b) ? forts : faibles).push(P[a].x, P[a].y, 0, P[b].x, P[b].y, 0);
      const traits = (pos, op) => { if (!pos.length) return null; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: pale, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: melange() })); l.userData.op = op; l.renderOrder = 2; l.frustumCulled = false; g.add(l); return l; };
      traits(faibles, clair ? .3 : .26); traits(forts, clair ? .8 : .78);
      // étoiles : petites et pâles, ou allumées à la couleur du jour
      C.e.forEach(([, , eclat], i) => {
        const on = allume.has(i), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: on ? new THREE.Color(allume.get(i)).lerp(new THREE.Color('#ffffff'), .35) : pale, transparent: true, depthTest: false, depthWrite: false, blending: melange(), opacity: 0, fog: false }));
        sp.position.copy(P[i]); sp.scale.setScalar((on ? 2.3 : .95) * (.7 + .5 * eclat)); sp.userData = { op: on ? 1 : (clair ? .55 : .5), on, ph: i * 1.7 }; sp.renderOrder = 3; g.add(sp);
      });
      // noms : le tien (s'il existe), et le vrai nom en petit
      const vrai = texteSprite(en ? C.en : C.nom, noms[s] ? .62 : .8, encre, clair, false); vrai.position.set(0, TAILLE * .5 + (noms[s] ? .9 : 1.2), 0); vrai.userData.op = .55; g.add(vrai);
      if (noms[s]) { const n = texteSprite(noms[s], 1.3, encre, clair); n.position.set(0, TAILLE * .5 + 1.9, 0); n.userData.op = .92; g.add(n); }
      objets.push({ cle: s, g, c: g.position.clone(), n: liste.length });
    }
  }
  function update(t) {
    _q.copy(camera.quaternion);
    for (const o of objets) {
      const d = camera.position.distanceTo(o.c), vis = (1 - lisse(70, 170, d)) * (o.n ? 1 : 0);
      o.g.visible = vis > .01; if (!o.g.visible) continue;
      o.g.quaternion.copy(_q);                                                   // toujours face à toi
      for (const x of o.g.children) {
        const k = x.userData.on ? .85 + .15 * Math.sin(t * 1.6 + x.userData.ph) : (x.userData.ph != null ? .8 + .2 * Math.sin(t * .7 + x.userData.ph) : 1);
        x.material.opacity = vis * x.userData.op * k;
      }
    }
  }
  return {
    reconstruire, update, semaineDe, _objets: () => objets,
    figure(s) { const l = parSemaine.get(s); if (!l || l.length < MIN) return null; const C = constellationDe(s);
      return { cle: s, jours: l.map(j => j.cle).sort(), nom: lire().noms[s] || '', vraiNom: en ? C.en : C.nom }; },
    nommer(s, nom) { const o = lire(); nom = (nom || '').trim().slice(0, 40); if (nom) o.noms[s] = nom; else delete o.noms[s]; try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} reconstruire(); },
    centre(s) { const o = objets.find(x => x.cle === s); return o ? o.c.clone() : null; },
  };
}
