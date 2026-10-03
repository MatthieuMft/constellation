// v46 : la constellation de la semaine (idée de Nightbook, retravaillée dans le ciel 3D).
// Dès 3 jours écrits dans une semaine, leurs étoiles se relient en une figure d'étoile (triangle, pentagramme, hexagramme…),
// un dessin différent du fil doré des séries. On peut lui donner un nom : il s'écrit sous la figure et reste dans le ciel.
// Semaine = celle du ciel (monde.js) : lundi → dimanche, coupée au changement de mois, donc les étoiles sont sur le même anneau.
// Noms dans constellation.figures.v1 = { noms: { 'AAAA-MM-sW': 'nom' } }.
//
// API :
//   const figures = creerFigures({ scene, camera, melange, posJour });
//   figures.reconstruire({ jours: [clé AAAA-MM-JJ écrite, hors exemples], clair, encre })
//   figures.update(t)                       à chaque image
//   figures.semaineDe(cle) -> 'AAAA-MM-sW'  la semaine d'un jour
//   figures.figure(cleSemaine) -> { cle, jours, nom } | null   (null : moins de 3 étoiles)
//   figures.nommer(cleSemaine, nom)          enregistre (nom vide : efface) puis redessine
import * as THREE from 'three';

const CLE = 'constellation.figures.v1', MIN = 3;
const lisse = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const lire = () => { try { const o = JSON.parse(localStorage.getItem(CLE)); return o && o.noms ? o : { noms: {} }; } catch (e) { return { noms: {} }; } };

export function semaineDe(cle) {
  const [y, m, d] = cle.split('-').map(Number), w = Math.floor((d - 1 + ((new Date(y, m - 1, 1).getDay() + 6) % 7)) / 7);
  return `${y}-${String(m).padStart(2, '0')}-s${w}`;
}

// l'ordre de tracé : autour du centre, en sautant une étoile sur deux quand il y en a 5 ou plus (étoile à branches)
function traits(pts) {
  const n = pts.length, c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
  const ordre = pts.map((p, i) => ({ i, a: Math.atan2(p.z - c.z, p.x - c.x) })).sort((a, b) => a.a - b.a).map(o => o.i);
  const seg = [];
  if (n === 3) seg.push([0, 1], [1, 2], [2, 0]);
  else if (n === 4) seg.push([0, 1], [1, 2], [2, 3], [3, 0], [0, 2]);
  else if (n === 6) seg.push([0, 2], [2, 4], [4, 0], [1, 3], [3, 5], [5, 1]);
  else for (let k = 0; k < n; k++) seg.push([k, (k + 2) % n]);                  // 5 : pentagramme ; 7 : heptagramme
  return { c, seg: seg.map(([a, b]) => [ordre[a], ordre[b]]) };
}

function texteSprite(txt, hauteur, encre, clair) {
  const H = 160, police = 'italic 92px Georgia, serif', m = document.createElement('canvas').getContext('2d'); m.font = police;
  const W = Math.min(2048, Math.ceil(m.measureText(txt).width + 80));           // la toile suit la longueur du nom : jamais coupé
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.font = police; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = clair ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.85)'; g.shadowBlur = 20; g.fillStyle = encre; g.fillText(txt, W / 2, 82);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0 }));
  s.scale.set(hauteur * W / H, hauteur, 1); s.renderOrder = 21; return s;
}

export function creerFigures({ scene, camera, melange, posJour }) {
  const groupe = new THREE.Group(); scene.add(groupe);
  let objets = [], parSemaine = new Map(), memo = { jours: [], clair: false, encre: '#f1ece4' };
  const _v = new THREE.Vector3();

  function vider() {
    for (const o of objets) { groupe.remove(o.ligne); o.ligne.geometry.dispose(); o.ligne.material.dispose(); if (o.nom) { groupe.remove(o.nom); o.nom.material.map.dispose(); o.nom.material.dispose(); } }
    objets = [];
  }
  function reconstruire({ jours = memo.jours, clair = memo.clair, encre = memo.encre } = {}) {
    memo = { jours, clair, encre }; vider(); parSemaine = new Map();
    for (const j of jours) { const s = semaineDe(j); if (!parSemaine.has(s)) parSemaine.set(s, []); parSemaine.get(s).push(j); }
    const { noms } = lire();
    for (const [s, liste] of parSemaine) {
      if (liste.length < MIN) continue;
      const pts = liste.slice().sort().map(k => posJour(k).clone()), { c, seg } = traits(pts), pos = [];
      for (const [a, b] of seg) pos.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const ligne = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: clair ? encre : 0xd8e0ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: melange() }));
      ligne.frustumCulled = false; ligne.renderOrder = 2; groupe.add(ligne);
      let nom = null;
      if (noms[s]) { nom = texteSprite(noms[s], 1.5, encre, clair); const avant = pts.reduce((m, p) => Math.max(m, p.z), -Infinity); nom.position.set(c.x, c.y - 1, avant + 2.6); groupe.add(nom); }
      objets.push({ cle: s, ligne, nom, c, nomme: !!noms[s] });
    }
  }
  function update(t) {
    for (const o of objets) {
      const d = camera.position.distanceTo(o.c), vis = 1 - lisse(70, 170, d);
      o.ligne.material.opacity = vis * (o.nomme ? .5 : .32) * (.85 + .15 * Math.sin(t * .9 + o.c.x));
      if (o.nom) o.nom.material.opacity = vis * .9;
    }
  }
  return {
    reconstruire, update, semaineDe,
    figure(s) { const l = parSemaine.get(s); return l && l.length >= MIN ? { cle: s, jours: l.slice().sort(), nom: lire().noms[s] || '' } : null; },
    nommer(s, nom) { const o = lire(); nom = (nom || '').trim().slice(0, 40); if (nom) o.noms[s] = nom; else delete o.noms[s]; try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} reconstruire(); },
    centre(s) { const o = objets.find(x => x.cle === s); return o ? o.c.clone() : null; },
  };
}
