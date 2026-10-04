// v49 (ESSAI, pas en ligne) : les aventures de la lueur, dans le ciel 3D (idée de Finch, retravaillée).
// Chaque jour écrit pour la première fois = une étape du voyage. Un voyage = 7 étapes, puis un objet céleste offert.
// Le chemin de la semaine (demande de Matthieu) : un pointillé qui relie 7 points, un par jour (lundi → dimanche), posés
// à la forme de la constellation que la semaine va dessiner, et dispersés en profondeur. Les jours écrits s'allument
// doucement ; pas de repère pour demain. Quand la semaine finit, figures.js prend le relais (le chemin devient la constellation).
// La lueur ne reste PAS sur le chemin :
// juste après « Cristalliser », elle y vole quelques secondes (la caméra suit), une petite scène 3D se joue, puis elle reste avec toi.
// État dans constellation.voyage.v1 = { n: n° du voyage, etape: 0…7, depart: 'AAAA-MM-JJ', jours: [clés déjà comptées], objets: [] }.
//
// API :
//   const voyage = creerVoyage({ scene, camera, melange, texHalo, posJour, particules, centrePour });
//   voyage.reconstruire({ clair, encre })   voyage.update(t, dt)
//   voyage.jourEcrit(cle) -> null | { etape, texte, point, fin, objet }   (null : jour déjà compté)
//   voyage.etat() · voyage.voyageCourant() · voyage.point(i) · voyage.jouer(i)   (rejoue la scène de l'étape i, 1…7)
import * as THREE from 'three';
import { pointsSemaine, semaineDe, offerts, BLANC_OFFERT } from './figures.js';

const CLE = 'constellation.voyage.v1';
export const VOYAGES = [
  { titre: 'La comète perdue', objet: { nom: 'Traînée de comète', cle: 'traine', ou: 'Ma lueur' }, etapes: [
    { s: 'lointain', t: 'Je pars en voyage ! Au loin, une lumière verte file entre les étoiles.' },
    { s: 'poussiere', t: 'Je traverse un nuage de poussière d’étoiles. Ça chatouille !' },
    { s: 'comete', t: 'Une comète passe, bien trop vite. Je m’accroche à sa traîne !' },
    { s: 'comete-arret', t: 'La comète a perdu son chemin : elle ne retrouve plus le Soleil.' },
    { s: 'route', t: 'Je lui montre la route, grâce aux étoiles que tu as allumées.' },
    { s: 'eclat', t: 'Pour me remercier, la comète me laisse un éclat de glace qui brille.' },
    { s: 'retour', t: 'Je rentre à la maison, avec une traînée de comète rien que pour moi !' }] },
  { titre: 'L’aurore du pôle', objet: { nom: 'Aurores', cle: 'aurores', ou: 'Mon ciel' }, etapes: Array.from({ length: 7 }, (_, i) => ({ s: ['lointain', 'poussiere', 'eclat', 'poussiere', 'route', 'eclat', 'retour'][i], t: i === 6 ? 'Je rentre avec un voile d’aurore pour ton ciel !' : 'Lorem ipsum : étape ' + (i + 1) + ' du voyage vers l’aurore (texte à écrire).' })) },
];
const lire = () => { try { const o = JSON.parse(localStorage.getItem(CLE)); if (o && Array.isArray(o.jours)) return o; } catch (e) {} return null; };
const ecrire = o => { try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} };
const lisse = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

export function creerVoyage({ scene, camera, melange, texHalo, posJour, particules, etoilesRecentes, centreSemaine, joursEcrits, aujourdhui, estFinie }) {
  const groupe = new THREE.Group(); scene.add(groupe);
  let etat = lire(), objets = null, scenes = [], clair = false, encre = '#f1ece4';
  const or = new THREE.Color('#ffd98a');

  // le chemin : les 7 points de la semaine d'un jour donné (lundi = 1er point)
  const jds = cle => { const [y, m, d] = cle.split('-').map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; };
  const pointsDe = cleS => pointsSemaine(cleS, centreSemaine(cleS));
  const pointDuJour = cle => pointsDe(semaineDe(cle))[jds(cle)];
  const jourEtape = i => { if (!etat) return null; const l = etat.jours; return l[l.length - etat.etape + i - 1] || null; };
  function vider() { if (objets) { groupe.remove(objets.g); objets.g.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); objets = null; } }
  function reconstruire(o = {}) {
    if ('clair' in o) clair = o.clair; if (o.encre) encre = o.encre; vider();
    const cleS = semaineDe(aujourdhui()); if (estFinie(cleS)) return;         // semaine finie : c'est la constellation qu'on voit
    const tous = joursEcrits(), premier = tous.length ? tous.reduce((a, k) => k < a ? k : a) : aujourdhui();
    const P = pointsDe(cleS), ecrits = new Set(tous.filter(k => semaineDe(k) === cleS).map(jds)), offre = offerts(cleS, premier), g = new THREE.Group(); groupe.add(g);
    const courbe = new THREE.CatmullRomCurve3(P, false, 'centripetal', .4), geo = new THREE.BufferGeometry().setFromPoints(courbe.getPoints(160));
    const ligne = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: clair ? encre : '#e8dcc0', dashSize: .45, gapSize: .55, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: melange() }));
    ligne.computeLineDistances(); ligne.renderOrder = 2; ligne.frustumCulled = false; g.add(ligne);
    const bornes = P.map((p, i) => {
      const don = !ecrits.has(i) && offre.has(i), fait = ecrits.has(i) || don, s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: don ? new THREE.Color(clair ? encre : BLANC_OFFERT) : fait ? or : (clair ? new THREE.Color(encre) : new THREE.Color('#c9d3ff')), transparent: true, depthTest: false, depthWrite: false, blending: melange(), opacity: 0 }));
      s.position.copy(p); s.scale.setScalar(don ? 1.15 : fait ? 1.5 : .9); s.userData = { fait, base: don ? .55 : fait ? .8 : .35 }; s.renderOrder = 3; g.add(s); return s;
    });
    objets = { g, ligne, bornes, c: centreSemaine(cleS) };
  }

  // petites scènes 3D, jouées au point d'étape
  function jouer(i) {
    const V = VOYAGES[etat ? etat.n % VOYAGES.length : 0], E = V.etapes[i - 1], j = jourEtape(i), p = j && pointDuJour(j); if (!p) return;
    const s = { type: E.s, p: p.clone(), t: 0, objs: [] }, sprite = (col, taille) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: col, transparent: true, depthTest: false, depthWrite: false, blending: melange(), opacity: 0 })); sp.scale.setScalar(taille); sp.renderOrder = 5; groupe.add(sp); s.objs.push(sp); return sp; };
    if (E.s === 'poussiere' || E.s === 'eclat') particules.burst(p, new THREE.Color(E.s === 'eclat' ? '#bff1ff' : '#ffe9c0'), E.s === 'eclat' ? 30 : 60, E.s === 'eclat' ? 1.6 : 3.2);
    if (E.s === 'lointain') { s.tete = sprite(new THREE.Color('#9fffc8'), 1.4); s.dir = new THREE.Vector3(1, .15, -.4).normalize(); }
    if (E.s === 'comete' || E.s === 'comete-arret') {
      s.tete = sprite(new THREE.Color('#e8fbff'), 2.4);
      const n = 40, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      const cols = new Float32Array(n * 3); for (let k = 0; k < n; k++) { const a = 1 - k / n; cols.set([.75 * a, .95 * a, 1 * a], k * 3); } geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      s.queue = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .9, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })); s.queue.frustumCulled = false; s.queue.renderOrder = 5; groupe.add(s.queue); s.objs.push(s.queue);
      s.hist = []; s.dir = new THREE.Vector3(-1, -.2, .5).normalize();
    }
    if (E.s === 'route') {                                          // des fils de lumière vers tes dernières étoiles
      const pos = []; for (const q of etoilesRecentes().slice(0, 5)) pos.push(p.x, p.y, p.z, q.x, q.y, q.z);
      if (pos.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        s.fils = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: or, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: melange() })); s.fils.frustumCulled = false; s.fils.renderOrder = 5; groupe.add(s.fils); s.objs.push(s.fils); }
    }
    scenes.push(s);
  }
  function majScenes(dt) {
    for (const s of scenes) {
      s.t += dt; const k = s.t;
      if (s.type === 'lointain' && s.tete) { s.tete.position.copy(s.p).addScaledVector(s.dir, -14 + k * 5).add(new THREE.Vector3(0, 4, 0)); s.tete.material.opacity = Math.sin(Math.min(1, k / 6) * Math.PI) * .9; }
      if ((s.type === 'comete' || s.type === 'comete-arret') && s.tete) {
        const arret = s.type === 'comete-arret', u = arret ? Math.min(1, k / 2.5) : k / 6;
        const pos = arret ? s.p.clone().addScaledVector(s.dir, -10 * (1 - (1 - u) ** 3) + 10).add(new THREE.Vector3(Math.sin(k * 2) * .3 * u, 2 + Math.cos(k * 1.6) * .3 * u, 0)) : s.p.clone().addScaledVector(s.dir, -18 + u * 36).add(new THREE.Vector3(0, 1.5, 0));
        s.tete.position.copy(pos); s.tete.material.opacity = Math.min(1, k * 2) * (arret ? 1 - lisse(5.5, 7, k) : 1 - lisse(5, 6, k));
        s.hist.unshift(pos.clone()); if (s.hist.length > 40) s.hist.pop();
        const a = s.queue.geometry.attributes.position; for (let j = 0; j < 40; j++) { const q = s.hist[Math.min(j, s.hist.length - 1)]; a.setXYZ(j, q.x, q.y, q.z); } a.needsUpdate = true;
        s.queue.material.opacity = .9 * s.tete.material.opacity;
      }
      if (s.fils) s.fils.material.opacity = Math.min(.7, k * .5) * (1 - lisse(6, 8, k));
    }
    for (const s of scenes.filter(x => x.t > 8.5)) s.objs.forEach(o => { groupe.remove(o); if (o.geometry) o.geometry.dispose(); o.material.dispose(); });
    scenes = scenes.filter(x => x.t <= 8.5);
  }

  function update(t, dt) {
    majScenes(dt);
    if (!objets) return;
    const d = camera.position.distanceTo(objets.c), vis = 1 - lisse(150, 260, d);
    objets.ligne.material.opacity = vis * (clair ? .5 : .42);
    objets.bornes.forEach((s, i) => { s.material.opacity = vis * s.userData.base * (s.userData.fait ? .85 + .15 * Math.sin(t * 1.3 + i) : 1); });
  }

  return {
    reconstruire, update, jouer,
    etat: () => etat && { ...etat },
    voyageCourant: () => VOYAGES[etat ? etat.n % VOYAGES.length : 0],
    point: i => { const j = jourEtape(i); return j ? pointDuJour(j) : null; },
    centre: () => objets ? objets.c.clone() : null,
    jourEcrit(cle) {
      if (!etat || etat.etape >= 7) etat = { n: etat ? etat.n + (etat.etape >= 7 ? 1 : 0) : 0, etape: 0, depart: cle, jours: etat ? etat.jours : [], objets: etat ? etat.objets : [] };
      if (etat.jours.includes(cle)) return null;
      etat.jours.push(cle); etat.etape++;
      const V = VOYAGES[etat.n % VOYAGES.length], fin = etat.etape >= 7;
      if (fin) etat.objets.push(V.objet.cle);
      ecrire(etat); reconstruire();
      return { etape: etat.etape, texte: V.etapes[etat.etape - 1].t, point: pointDuJour(cle), fin, objet: fin ? V.objet : null };
    },
    _reinitialiser() { etat = null; try { localStorage.removeItem(CLE); } catch (e) {} reconstruire(); },
  };
}
