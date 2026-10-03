// Le monde du temps : nébuleuses d'années, de mois et de semaines (avec étiquettes), jours vides, et tout ce qui dépend du zoom.
// À chaque distance de caméra, seul le niveau qui a du sens est visible ; en zoomant, on traverse la nébuleuse et le niveau suivant apparaît.
import * as THREE from 'three';
import { GEO, posAnnee, posMois, posSemaine, posJour, nbSemaines, joursDeSemaine, NOMS_MOIS, cleMois, nbJoursMois, libelleSemaine } from './temps.js';
import { cleJour } from './store.js';
import { saisonDuMois } from './rythme.js';

import { MOIS_COURT as ABR } from './langue.js';
const plage = dates => { const a = dates[0], b = dates[dates.length - 1]; return a.getMonth() === b.getMonth() ? a.getDate() + ' – ' + b.getDate() + ' ' + ABR[b.getMonth()] : a.getDate() + ' ' + ABR[a.getMonth()] + ' – ' + b.getDate() + ' ' + ABR[b.getMonth()]; };

// [fondu d'entrée, fondu de sortie] en multiples du rayon : visible quand on est à 4–12 rayons (le niveau juste au-dessus)
const PLAGES = { semaine: [[3.5, 6.5], [10, 16]], mois: [[2.6, 4.2], [10, 18]], annee: [[1.8, 3.2], [12, 20]] };
const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function creerMonde({ scene, camera, controls, melange, pr }) {
  const groupe = new THREE.Group(); scene.add(groupe);
  let y0 = new Date().getFullYear(), y1 = y0;
  let noeuds = { annees: [], mois: [], semaines: [] }, vides = null, vuesEtiquettes = true, brumeVides = 1;   // brumeVides : 0 tant que le ciel n'a pas ses nébuleuses
  let theme = { clair: false, encre: '#f1ece4' };
  const _v = new THREE.Vector3();

  // texture de nuage : des taches douces qui s'estompent vers le bord
  const texNeb = (() => {
    const T = 256, c = document.createElement('canvas'); c.width = c.height = T; const g = c.getContext('2d'); let s = 11;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 30; i++) {
      const x = T / 2 + (r() - .5) * T * .55, y = T / 2 + (r() - .5) * T * .55, R = 26 + r() * 70, gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(255,255,255,${.1 + r() * .12})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, T, T);
    }
    const m = g.createRadialGradient(T / 2, T / 2, T * .1, T / 2, T / 2, T / 2); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = m; g.fillRect(0, 0, T, T);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  function spriteNeb(couleur, rayon) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texNeb, color: couleur, blending: melange(), transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0 }));
    s.scale.setScalar(rayon * 2.6); s.renderOrder = -2; return s;
  }
  function spriteTexte(txt, hauteur, italique) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 192; const g = c.getContext('2d');
    g.font = (italique ? 'italic ' : '') + '110px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = theme.clair ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.8)'; g.shadowBlur = 22; g.fillStyle = theme.encre; g.fillText(txt, 512, 98);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0 }));
    s.scale.set(hauteur * 1024 / 192, hauteur, 1); s.renderOrder = 20; return s;
  }
  const neutre = m => new THREE.Color(m == null ? (theme.clair ? '#8a7f6a' : '#7c8cc4') : saisonDuMois(m).vide);      // une nébuleuse vide prend la couleur de sa saison

  function vider() {
    groupe.children.slice().forEach(o => { groupe.remove(o); if (o.material) { if (o.material.map && o.material.map !== texNeb) o.material.map.dispose(); o.material.dispose(); } if (o.geometry) o.geometry.dispose(); });
    noeuds = { annees: [], mois: [], semaines: [] }; vides = null;
  }

  // jours : Map cle -> { n, couleur }
  function reconstruire({ y0: a, y1: b, jours }) {
    y0 = a; y1 = b; vider();
    const acc = (m, k, n, c) => { const o = m.get(k) || { n: 0, nj: 0, r: 0, g: 0, b: 0 }; o.n += n; o.nj += 1; o.r += c.r * n; o.g += c.g * n; o.b += c.b * n; m.set(k, o); };
    const aY = new Map(), aM = new Map(), aW = new Map();
    for (const [cle, j] of jours) {
      const [y, m, dj] = cle.split('-').map(Number), w = Math.floor((dj - 1 + ((new Date(y, m - 1, 1).getDay() + 6) % 7)) / 7);
      acc(aY, y, j.n, j.couleur); acc(aM, y + '-' + (m - 1), j.n, j.couleur); acc(aW, y + '-' + (m - 1) + '-' + w, j.n, j.couleur);
    }
    const noeud = (type, cle, centre, rayon, a2, extra) => {
      const c = a2 && a2.n ? new THREE.Color(a2.r / a2.n, a2.g / a2.n, a2.b / a2.n) : neutre(extra && extra.m);
      const n = { type, cle, centre, rayon, n: a2 ? a2.n : 0, nbJours: a2 ? a2.nj : 0, couleur: c, ...extra };
      n.sprite = spriteNeb(c, rayon); n.sprite.position.copy(centre); groupe.add(n.sprite); return n;
    };
    for (let y = y0; y <= y1; y++) {
      const na = noeud('annee', String(y), posAnnee(y, y0), GEO.rayonAnnee, aY.get(y), { y, libelle: String(y) });
      na.label = spriteTexte(String(y), GEO.rayonAnnee * .34, true); na.label.position.copy(na.centre); na.label.position.y += GEO.rayonAnnee * .12; groupe.add(na.label); noeuds.annees.push(na);
      for (let m = 0; m < 12; m++) {
        const nm = noeud('mois', cleMois(y, m), posMois(y, m, y0), GEO.rayonMoisNoeud, aM.get(y + '-' + m), { y, m, libelle: NOMS_MOIS[m] + ' ' + y });
        nm.label = spriteTexte(NOMS_MOIS[m], GEO.rayonMoisNoeud * .3, true); nm.label.position.copy(nm.centre); nm.label.position.y += GEO.rayonMoisNoeud * .1; groupe.add(nm.label); noeuds.mois.push(nm);
        const nb = nbSemaines(y, m);
        for (let w = 0; w < nb; w++) {
          const dates = joursDeSemaine(y, m, w);
          const courante = dates.some(d => cleJour(d) === cleJour(new Date())), txt = (courante ? '● ' : '') + plage(dates);
          const ns = noeud('semaine', cleMois(y, m) + '-s' + w, posSemaine(y, m, w, y0), GEO.rayonSemaine, aW.get(y + '-' + m + '-' + w), { y, m, w, cleMois: cleMois(y, m), dates, courante, texteLabel: txt, libelle: libelleSemaine(dates[0]) });
          ns.label = spriteTexte(txt, GEO.rayonSemaine * .2, courante ? false : true); ns.label.position.copy(ns.centre); ns.label.position.y += GEO.rayonSemaine * .08; groupe.add(ns.label);
          noeuds.semaines.push(ns);
        }
      }
    }
    // jours vides : de petits points tamisés, un par jour sans entrée (le zoom les révèle ; on peut y écrire)
    const pos = [];
    for (let y = y0; y <= y1; y++) for (let m = 0; m < 12; m++) for (let j = 1; j <= nbJoursMois(y, m); j++) {
      const d = new Date(y, m, j, 12); if (jours.has(cleJour(d))) continue; const p = posJour(d, y0); pos.push(p.x, p.y, p.z);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: melange(), uniforms: { uCol: { value: new THREE.Color(theme.clair ? theme.encre : '#b8c4ff') }, uPR: { value: pr } },
      vertexShader: `uniform float uPR; varying float vA; void main(){ float d = distance(cameraPosition, position); vA = (1. - smoothstep(55., 140., d)); gl_Position = projectionMatrix*viewMatrix*vec4(position, 1.); gl_PointSize = uPR*(2.4 + 5.*(1. - smoothstep(10., 60., d))); }`,
      fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(uCol, smoothstep(.5, .1, d)*vA*.5); }`,
    });
    vides = new THREE.Points(g, mat); vides.frustumCulled = false; vides.renderOrder = 1; groupe.add(vides);
  }

  let fonduEtiq = 1;                                   // 0 pendant l'entrée animée : les dates ne clignotent pas en traversant les niveaux
  // v20 : une seule sorte de date à la fois, celle du niveau regardé (jour : aucune ; semaine : les semaines ; mois : les mois ; année : les années)
  const TYPE_ETIQ = { jour: null, semaine: 'semaine', mois: 'mois', annee: 'annee', annees: 'annee' }, porte = { semaine: 0, mois: 0, annee: 0 };
  function update(niveau = 'semaine') {
    const voulu = TYPE_ETIQ[niveau] ?? null;
    for (const k in porte) porte[k] += ((k === voulu ? 1 : 0) - porte[k]) * .12;
    const cam = camera.position, claire = theme.clair ? .6 : 1;
    for (const liste of [noeuds.annees, noeuds.mois, noeuds.semaines]) for (const n of liste) {
      const d = cam.distanceTo(n.centre), r = n.rayon, [a, b] = PLAGES[n.type];        // chaque nébuleuse n'apparaît qu'au niveau où elle a du sens
      n.sprite.material.opacity = lisse(r * a[0], r * a[1], d) * (1 - lisse(r * b[0], r * b[1], d)) * (n.n ? .26 : .06 * brumeVides) * claire * (n.courante ? 1.5 : 1);
      if (n.label) n.label.material.opacity = vuesEtiquettes ? fonduEtiq * porte[n.type] * lisse(r * .8, r * 1.6, d) * (1 - lisse(r * b[0], r * b[1], d)) * (n.n ? .9 : .5) : 0;
    }
  }

  const plusProche = (liste, p) => { let b = null, d0 = 1e18; for (const n of liste) { const d = n.centre.distanceToSquared(p); if (d < d0) { d0 = d; b = n; } } return b; };
  // l'endroit regardé : année, mois, semaine et jour les plus proches du point de mire
  function foyer() {
    const t = controls.target, a = plusProche(noeuds.annees, t); if (!a) return {};
    const m = plusProche(noeuds.mois.filter(n => n.y === a.y), t), s = plusProche(noeuds.semaines.filter(n => n.cleMois === m.cle), t);
    let j = null, dj = 1e18; for (const d of s.dates) { const p = posJour(d, y0), dd = p.distanceToSquared(t); if (dd < dj) { dj = dd; j = d; } }
    return { annee: a, mois: m, semaine: s, date: j, jour: j ? cleJour(j) : null };
  }

  const pxParUnite = d => innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360) * Math.max(1, d));
  // nébuleuse sous le curseur (selon le niveau de zoom : années, mois ou semaines)
  function nebuleuseSous(x, y, niveau, f) {
    const liste = niveau === 'annees' ? noeuds.annees : niveau === 'annee' ? noeuds.mois.filter(n => !f.annee || n.y === f.annee.y) : niveau === 'mois' ? noeuds.semaines.filter(n => !f.mois || n.cleMois === f.mois.cle) : [];
    let best = null, score = 1;
    for (const n of liste) {
      _v.copy(n.centre).project(camera); if (_v.z > 1) continue;
      const sx = (_v.x + 1) / 2 * innerWidth, sy = (1 - _v.y) / 2 * innerHeight, rp = n.rayon * pxParUnite(camera.position.distanceTo(n.centre)) * .92, q = Math.hypot(x - sx, y - sy) / Math.max(8, rp);
      if (q < score) { score = q; best = n; }
    }
    return best;
  }
  // jour vide sous le curseur (dans le mois regardé)
  function jourVideSous(x, y, f, remplis) {
    if (!f.mois) return null; let best = null, db = 18;
    for (let j = 1; j <= nbJoursMois(f.mois.y, f.mois.m); j++) {
      const d = new Date(f.mois.y, f.mois.m, j, 12); if (remplis.has(cleJour(d)) || d > new Date()) continue;
      _v.copy(posJour(d, y0)).project(camera); if (_v.z > 1) continue;
      const q = Math.hypot(x - (_v.x + 1) / 2 * innerWidth, y - (1 - _v.y) / 2 * innerHeight); if (q < db) { db = q; best = d; }
    }
    return best;
  }

  function regler({ clair, encre }) {
    theme = { clair, encre };
    for (const liste of [noeuds.annees, noeuds.mois, noeuds.semaines]) for (const n of liste) {
      n.sprite.material.blending = melange(); n.sprite.material.needsUpdate = true;
      if (n.label) { n.label.material.map.dispose(); const txt = n.texteLabel || (n.type === 'annee' ? n.libelle : n.libelle.split(' ')[0]); const h = n.label.scale.y, nl = spriteTexte(txt, h, true); n.label.material.map = nl.material.map; n.label.material.needsUpdate = true; nl.material.dispose(); }
    }
    if (vides) { vides.material.blending = melange(); vides.material.needsUpdate = true; vides.material.uniforms.uCol.value.set(clair ? encre : '#b8c4ff'); }
  }

  return {
    get noeuds() { return noeuds; }, get y0() { return y0; }, get y1() { return y1; },
    reconstruire, update, foyer, nebuleuseSous, jourVideSous, regler,
    etiquettes(v) { vuesEtiquettes = v; },
    fonduEtiquettes(f) { fonduEtiq = f; },
    vides(k) { brumeVides = k; },
    posJour: d => posJour(d, y0),
    centreAnnee: y => posAnnee(y, y0), centreMois: (y, m) => posMois(y, m, y0), centreSemaine: (y, m, w) => posSemaine(y, m, w, y0),
  };
}
