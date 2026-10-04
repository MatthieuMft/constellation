// v59 : ses trouvailles. De petits objets célestes que la lueur rapporte de ses balades : une par jour écrit au plus, jamais achetables.
// Clé à part (constellation.trouvailles.v1) : { liste: [{ id, jour }], dernier: 'AAAA-MM-JJ' }. Rien d'autre n'est touché.
// Chaque objet est dessiné en vraie 3D par un petit moteur à part (un seul WebGLRenderer, 256 px), puis copié dans des toiles 2D.
import * as THREE from 'three';
import { t } from './langue.js';

const CLE = 'constellation.trouvailles.v1';
const charger = () => { try { const o = JSON.parse(localStorage.getItem(CLE)) || {}; return { liste: Array.isArray(o.liste) ? o.liste : [], dernier: o.dernier || null }; } catch (e) { return { liste: [], dernier: null }; } };

// r : 0 commun, 1 rare, 2 très rare
export const CATALOGUE = [
  { id: 'eclat-comete', nom: 'Éclat de comète', txt: 'Tombé de la queue d’une comète qui passait par là.', g: 'eclat', c: '#9fd8ff' },
  { id: 'grain-lune', nom: 'Grain de lune', txt: 'Un peu de poussière grise, ramassée sur la face cachée.', g: 'galet', c: '#d9d6cc', cr: 1 },
  { id: 'caillou-mars', nom: 'Caillou de Mars', txt: 'Rouge comme sa planète. Il sent un peu la rouille.', g: 'galet', c: '#c8643c' },
  { id: 'plume-aurore', nom: 'Plume d’aurore', txt: 'Elle a ondulé toute une nuit au-dessus du pôle.', g: 'plume', c: '#7dffc4', c2: '#8a7dff' },
  { id: 'goutte-nebuleuse', nom: 'Goutte de nébuleuse', txt: 'Une étoile est peut-être en train de naître dedans.', g: 'goutte', c: '#ff8fd8' },
  { id: 'meteorite', nom: 'Petite météorite', txt: 'Encore tiède. Elle a traversé le ciel pour arriver jusqu’ici.', g: 'galet', c: '#6b6560', m: 1 },
  { id: 'glace-saturne', nom: 'Glace de Saturne', txt: 'Un glaçon tombé des anneaux. Il ne fond pas.', g: 'grappe', c: '#e8f4ff' },
  { id: 'anneau-mini', nom: 'Anneau de poche', txt: 'Un anneau de planète, juste à ta taille.', g: 'planete', c: '#f0d7a0' },
  { id: 'etoile-tombee', nom: 'Étoile tombée', txt: 'Elle s’est décrochée du ciel. Elle brille encore un peu.', g: 'etoile', c: '#ffe08a' },
  { id: 'flocon-cosmique', nom: 'Flocon cosmique', txt: 'Il ne fond jamais : il fait bien trop froid là-haut.', g: 'flocon', c: '#cfe6ff' },
  { id: 'perle-aurore', nom: 'Perle d’aurore', txt: 'Une perle verte qui ondule quand on la regarde.', g: 'orbe', c: '#8dffb5' },
  { id: 'larme-etoile', nom: 'Larme d’étoile', txt: 'Une étoile a pleuré de joie. La voici.', g: 'goutte', c: '#ffffff' },
  { id: 'coquille-galaxie', nom: 'Coquille de galaxie', txt: 'Approche-la de ton oreille : on entend le ciel tourner.', g: 'spirale', c: '#c9a8ff' },
  { id: 'fiole-poussiere', nom: 'Fiole de poussière', txt: 'Une pincée de poussière d’étoiles, bien bouchée.', g: 'fiole', c: '#ffd98a' },
  { id: 'quartz-lunaire', nom: 'Quartz lunaire', txt: 'Il pousse en silence dans les cratères.', g: 'grappe', c: '#f2e6ff' },
  { id: 'bille-soleil', nom: 'Bille de soleil', txt: 'Un tout petit morceau de lever de soleil.', g: 'orbe', c: '#ffb347' },
  { id: 'asteroide', nom: 'Fragment d’astéroïde', txt: 'Il vient de la ceinture, entre Mars et Jupiter.', g: 'galet', c: '#8f8778' },
  { id: 'lentille', nom: 'Lentille de télescope', txt: 'Perdue par un astronome distrait.', g: 'lentille', c: '#bfe3ff' },
  { id: 'graine-nebuleuse', nom: 'Graine de nébuleuse', txt: 'Plante-la dans le ciel. Qui sait ce qui poussera ?', g: 'orbe', c: '#9fb4ff', p: .6 },
  { id: 'etoile-dormante', nom: 'Étoile endormie', txt: 'Elle dort. Ne la réveille pas.', g: 'etoile', c: '#b8c4ff' },
  { id: 'fil-comete', nom: 'Fil de comète', txt: 'Un fil de lumière, enroulé pour le voyage.', g: 'fil', c: '#9fe8ff' },
  { id: 'mini-lune', nom: 'Lune de poche', txt: 'Une lune toute ronde. Elle a ses phases, elle aussi.', g: 'lune', c: '#e6e2d6' },
  { id: 'cristal-aurore', nom: 'Cristal d’aurore', txt: 'Vert d’un côté, violet de l’autre.', g: 'eclat', c: '#a07dff', c2: '#7dffc4' },
  { id: 'sablier-etoiles', nom: 'Sablier d’étoiles', txt: 'Le temps y coule en poussière bleue.', g: 'fiole', c: '#9fc8ff' },
  { id: 'arc-lunaire', nom: 'Arc-en-ciel de lune', txt: 'Un arc-en-ciel de nuit, tout pâle.', g: 'arc', c: '#ffd0f0' },
  { id: 'eclat-supernova', nom: 'Éclat de supernova', txt: 'Le reste d’une étoile qui a explosé, il y a très longtemps.', g: 'eclat', c: '#ff7a4a', r: 1 },
  { id: 'lune-bleue', nom: 'Pierre de lune bleue', txt: 'On n’en trouve qu’une fois tous les trente-six du mois.', g: 'galet', c: '#7aa8ff', r: 1, cr: 1 },
  { id: 'pepite-or', nom: 'Pépite d’or stellaire', txt: 'Fabriquée au cœur d’une étoile géante.', g: 'galet', c: '#ffcf5a', m: 1, r: 1 },
  { id: 'filante-bocal', nom: 'Étoile filante en bocal', txt: 'Elle tourne en rond, toute contente.', g: 'fiole', c: '#ffffff', r: 1 },
  { id: 'coeur-etoile', nom: 'Cœur d’étoile', txt: 'Le cœur d’une étoile, tout chaud. Le plus rare de tous.', g: 'orbe', c: '#ffe7a0', r: 2, p: 1.15 },
];
const POIDS = [10, 3, 1];

// ───── la 3D : un objet par trouvaille (formes douces et lumineuses, dans l'esprit de la lueur) ─────
let moteur = null;
function creerMoteur() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(256, 256, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 50); camera.position.set(0, .35, 4.2); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x30244a, 1.6));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 4); scene.add(d);
  const d2 = new THREE.DirectionalLight(0xb8a8ff, .8); d2.position.set(-3, -1, -2); scene.add(d2);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const halo = new THREE.CanvasTexture(cv); halo.colorSpace = THREE.SRGBColorSpace;
  return { renderer, scene, camera, halo, objets: new Map() };
}
const bruit = (x, y, z, s) => Math.sin(x * 3.1 + s) * Math.sin(y * 2.7 + s * 1.7) * Math.sin(z * 3.3 + s * .6) + .5 * Math.sin(x * 7.3 + y * 5.1 + s) * Math.sin(z * 6.7 - s);
function construire(it) {
  const M = moteur, c = new THREE.Color(it.c), c2 = new THREE.Color(it.c2 || it.c), grp = new THREE.Group();
  const lum = (col, k = .45, o = {}) => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: k, roughness: .25, metalness: .05, ...o });
  const halo = (col, s, o = .55) => { const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.halo, color: col, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(s); grp.add(h); };
  const seed = it.id.length * 1.7;
  switch (it.g) {
    case 'eclat': case 'grappe': {
      const n = it.g === 'grappe' ? 5 : 1;
      for (let i = 0; i < n; i++) {
        const geo = new THREE.OctahedronGeometry(.42, 0); geo.scale(.55, 1.5, .55);
        if (it.c2) { const p = geo.attributes.position, col = []; for (let k = 0; k < p.count; k++) { const m = c.clone().lerp(c2, (p.getY(k) + .63) / 1.26); col.push(m.r, m.g, m.b); } geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
        const m = lum(c, .4, { flatShading: true, transparent: true, opacity: .92, vertexColors: !!it.c2, roughness: .12, ...(it.c2 ? { color: 0xffffff, emissive: c.clone().lerp(c2, .5) } : {}) });
        const s = new THREE.Mesh(geo, m);
        if (n > 1) { const a = i / n * Math.PI * 2; s.scale.setScalar(i ? .55 + .12 * Math.sin(i * 3) : .85); s.position.set(i ? Math.cos(a) * .3 : 0, i ? -.25 : 0, i ? Math.sin(a) * .3 : 0); s.rotation.set(i ? Math.sin(a) * .6 : 0, a, i ? Math.cos(a) * .6 : 0); }
        else s.rotation.z = .25;
        grp.add(s);
      }
      halo(c, 2.4, .35); break; }
    case 'galet': case 'lune': {
      const geo = new THREE.IcosahedronGeometry(.62, 5), p = geo.attributes.position, col = [], v = new THREE.Vector3(), lune = it.g === 'lune' || it.cr;
      for (let k = 0; k < p.count; k++) {
        v.fromBufferAttribute(p, k).normalize(); let b = bruit(v.x, v.y, v.z, seed), cr = 0;
        if (lune) for (let j = 0; j < 7; j++) { const a = j * 2.4 + seed, cc = new THREE.Vector3(Math.cos(a) * Math.sin(j + 1), Math.cos(j * 1.3 + 1), Math.sin(a) * Math.sin(j + 1)).normalize(); const dd = v.distanceTo(cc), R = .22 + (j % 3) * .1; if (dd < R) cr = Math.max(cr, 1 - dd / R); }
        const r = it.g === 'lune' ? 1 - cr * .05 : 1 + b * .09 - cr * .06; v.multiplyScalar(.62 * r); if (it.g !== 'lune') v.y *= .82; p.setXYZ(k, v.x, v.y, v.z);
        const m = c.clone().multiplyScalar(.82 + b * .12 - cr * .3); col.push(m.r, m.g, m.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
      grp.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: it.m ? .35 : .85, metalness: it.m ? .75 : 0, emissive: c, emissiveIntensity: it.m ? .12 : .06 })));
      if (it.r || it.g === 'lune') halo(c, 2.3, .3); break; }
    case 'orbe': case 'goutte': {
      const k = it.p || 1;
      const geo = it.g === 'goutte' ? new THREE.LatheGeometry(Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI; return new THREE.Vector2(Math.sin(a) * .42 * Math.pow(Math.sin(a / 2), .9) * (1 + .25 * Math.sin(a)), -Math.cos(a) * .62); }), 48) : new THREE.SphereGeometry(.4 * k, 48, 32);
      grp.add(new THREE.Mesh(geo, lum(c, .7, { transparent: true, opacity: .82, roughness: .1 })));
      const coeur = new THREE.Mesh(new THREE.SphereGeometry(.16 * k, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); if (it.g === 'goutte') coeur.position.y = -.18; grp.add(coeur);
      halo(c, Math.min(2.4, 2.6 * k), it.r ? .8 : .6); break; }
    case 'plume': {
      const geo = new THREE.PlaneGeometry(.6, 1.7, 10, 30), p = geo.attributes.position, col = [];
      for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), u = (y + .85) / 1.7, w = Math.sin(Math.PI * Math.min(1, u * 1.05)) * (1 - u * .3); p.setXYZ(k, x * w * 1.6 + Math.sin(u * 3) * .12, y, .25 * (u - .5) ** 2 * 4 - Math.abs(x) * .3); const m = c.clone().lerp(c2, u); col.push(m.r, m.g, m.b); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
      const pl = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .88 })); pl.rotation.z = -.4; grp.add(pl);
      const tige = new THREE.Mesh(new THREE.CylinderGeometry(.012, .02, 1.9, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); tige.rotation.z = -.4; tige.position.set(.05, -.05, .02); grp.add(tige);
      halo(c.clone().lerp(c2, .5), 2.6, .35); break; }
    case 'etoile': {
      const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? .26 : .62; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const geo = new THREE.ExtrudeGeometry(s, { depth: .14, bevelEnabled: true, bevelThickness: .1, bevelSize: .07, bevelSegments: 4 }); geo.center();
      grp.add(new THREE.Mesh(geo, lum(c, it.id === 'etoile-dormante' ? .3 : .6, { roughness: .3 }))); halo(c, 2.6, .55); break; }
    case 'flocon': {
      const m = lum(c, .6, { transparent: true, opacity: .9 });
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, .06, .06), m); b.rotation.z = i * Math.PI / 3; grp.add(b);
        for (const sg of [-1, 1]) for (const e of [.32, .5]) for (const s2 of [-1, 1]) { const br = new THREE.Mesh(new THREE.BoxGeometry(.2 * (1.1 - e), .04, .04), m); const a = i * Math.PI / 3; br.position.set(Math.cos(a) * e * sg, Math.sin(a) * e * sg, 0); br.rotation.z = a + s2 * Math.PI / 3; br.translateX(.07 * (1.1 - e)); grp.add(br); } }
      halo(c, 2.4, .4); break; }
    case 'spirale': case 'fil': {
      const fil = it.g === 'fil';
      const courbe = new (class extends THREE.Curve { getPoint(u, o = new THREE.Vector3()) { const a = u * Math.PI * (fil ? 7 : 5.5); if (fil) return o.set(Math.cos(a) * .42, (u - .5) * .9, Math.sin(a) * .42); const r = .62 * (1 - u * .9); return o.set(Math.cos(a) * r, (u - .5) * .55 + (1 - u) * -.1, Math.sin(a) * r); } })();
      const geo = new THREE.TubeGeometry(courbe, 260, fil ? .035 : .1, 14, false);
      grp.add(new THREE.Mesh(geo, lum(c, fil ? .9 : .4, { roughness: .2, transparent: true, opacity: .95 })));
      if (!fil) { const perle = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); perle.position.set(0, .2, 0); grp.add(perle); }
      halo(c, 2.5, .4); break; }
    case 'fiole': {
      const verre = new THREE.Mesh(new THREE.LatheGeometry([[0, -.5], [.3, -.5], [.34, -.4], [.34, .15], [.16, .32], [.13, .45], [.15, .5], [0, .5]].map(([x, y]) => new THREE.Vector2(x, y)), 40),
        new THREE.MeshStandardMaterial({ color: 0xdfe8ff, transparent: true, opacity: .28, roughness: .05, metalness: .1, depthWrite: false, side: THREE.DoubleSide }));
      const bouchon = new THREE.Mesh(new THREE.CylinderGeometry(.12, .11, .14, 20), new THREE.MeshStandardMaterial({ color: '#6b5a8a', roughness: .8 })); bouchon.position.y = .55;
      const pts = new Float32Array(240 * 3); for (let i = 0; i < 240; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * .28, y = -.46 + Math.pow(Math.random(), 1.6) * (it.id === 'filante-bocal' ? .8 : .5); pts.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      grp.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: c, size: .045, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })));
      if (it.id === 'filante-bocal') { const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); f.position.set(.12, -.05, 0); grp.add(f); }
      grp.add(verre, bouchon); halo(c, 2.4, .45); break; }
    case 'planete': {
      grp.add(new THREE.Mesh(new THREE.SphereGeometry(.32, 40, 28), lum(c, .25, { roughness: .6 })));
      const an = new THREE.Mesh(new THREE.TorusGeometry(.56, .045, 12, 96), lum(new THREE.Color('#fff4dc'), .5, { transparent: true, opacity: .85 })); an.scale.z = .35; an.rotation.x = 1.25; an.rotation.y = .35; grp.add(an);
      halo(c, 2.4, .35); break; }
    case 'lentille': {
      const v = new THREE.Mesh(new THREE.SphereGeometry(.55, 48, 24), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: .4, roughness: .02, metalness: .2, depthWrite: false })); v.scale.z = .18; grp.add(v);
      const bord = new THREE.Mesh(new THREE.TorusGeometry(.55, .05, 14, 80), new THREE.MeshStandardMaterial({ color: '#d8c38a', metalness: .85, roughness: .3 })); grp.add(bord);
      grp.rotation.x = -.2; halo(c, 2.2, .3); break; }
    case 'arc': {
      ['#ff9fb8', '#ffd59f', '#c9ff9f', '#9fe0ff', '#c69fff'].forEach((k, i) => { const a = new THREE.Mesh(new THREE.TorusGeometry(.62 - i * .07, .035, 10, 80, Math.PI), new THREE.MeshBasicMaterial({ color: k, transparent: true, opacity: .75 })); a.position.y = -.25; grp.add(a); });
      halo(c, 2.4, .3); break; }
  }
  return grp;
}
function objet(it) { let o = moteur.objets.get(it.id); if (!o) { o = construire(it); moteur.objets.set(it.id, o); } return o; }
function dessiner(it, toile, angle) {
  if (!moteur) moteur = creerMoteur();
  const o = objet(it); moteur.scene.add(o); o.rotation.y = angle; o.rotation.x = .18 + Math.sin(angle * .7) * .08;
  moteur.renderer.render(moteur.scene, moteur.camera); moteur.scene.remove(o);
  const g = toile.getContext('2d'); g.clearRect(0, 0, toile.width, toile.height); g.drawImage(moteur.renderer.domElement, 0, 0, toile.width, toile.height);
}

export function creerTrouvailles() {
  let etat = charger();
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {} };
  const par = id => CATALOGUE.find(i => i.id === id);
  const possedees = () => etat.liste.map(x => x.id);
  function tirer(jour) {                                                // une trouvaille par jour au plus ; les rares sortent moins souvent
    if (etat.dernier === jour) return null;
    const deja = new Set(possedees()), reste = CATALOGUE.filter(i => !deja.has(i.id)); if (!reste.length) return null;
    let tot = reste.reduce((s, i) => s + POIDS[i.r || 0], 0), r = Math.random() * tot, it = reste[0];
    for (const i of reste) { r -= POIDS[i.r || 0]; if (r <= 0) { it = i; break; } }
    etat.liste.push({ id: it.id, jour }); etat.dernier = jour; sauver(); return it;
  }
  let boite = null, anim = 0;
  function fermer() { cancelAnimationFrame(anim); if (boite) boite.remove(); boite = null; }
  function ouvrir(choix = null) {
    fermer(); etat = charger();
    const trouvees = new Map(etat.liste.map(x => [x.id, x.jour]));
    boite = document.createElement('div'); boite.className = 'boite-figure vitrine'; boite.setAttribute('role', 'dialog');
    const h = document.createElement('p'); h.className = 'lab'; h.textContent = t('Ses trouvailles');
    const sous = document.createElement('p'); sous.className = 'sous'; sous.textContent = t('{n} sur {m} · elle en rapporte une par jour où tu écris', { n: trouvees.size, m: CATALOGUE.length });
    const detail = document.createElement('div'); detail.className = 'vit-detail';
    const grand = document.createElement('canvas'); grand.width = grand.height = 256; grand.className = 'vit-grand';
    const info = document.createElement('div'); info.className = 'vit-info';
    const nom = document.createElement('p'); nom.className = 'vit-nom'; const txt = document.createElement('p'); txt.className = 'vit-txt'; const quand = document.createElement('small');
    info.append(nom, txt, quand); detail.append(grand, info);
    let actif = null;
    const montrer = it => {
      actif = it; grand.hidden = !it;
      if (!it) { nom.textContent = t('Rien pour l’instant'); txt.textContent = t('Écris aujourd’hui : elle partira chercher quelque chose pour toi.'); quand.textContent = ''; return; }
      nom.textContent = t(it.nom) + (it.r === 2 ? ' · ' + t('très rare') : it.r ? ' · ' + t('rare') : ''); txt.textContent = t(it.txt);
      const j = trouvees.get(it.id); quand.textContent = j ? t('Trouvée le {d}', { d: new Date(j + 'T12:00').toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long' }) }) : '';
      grille.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === it.id));
    };
    const grille = document.createElement('div'); grille.className = 'vit-grille';
    CATALOGUE.forEach(it => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.id = it.id;
      if (trouvees.has(it.id)) { const c = document.createElement('canvas'); c.width = c.height = 96; b.append(c); b.setAttribute('aria-label', t(it.nom)); b.addEventListener('click', () => montrer(it)); try { dessiner(it, c, .6); } catch (e) { console.warn('trouvaille', e); } }
      else { b.className = 'vide'; b.textContent = '?'; b.disabled = true; }
      grille.append(b);
    });
    const rang = document.createElement('div'); rang.className = 'rang';
    const f = document.createElement('button'); f.type = 'button'; f.className = 'lien'; f.textContent = t('Fermer'); f.addEventListener('click', fermer);
    rang.append(f); boite.append(h, sous, detail, grille, rang); document.body.append(boite);
    const der = etat.liste.length ? par(etat.liste.at(-1).id) : null; montrer(choix ? par(choix) || der : der);
    const t0 = performance.now(); const tour = () => { if (!boite) return; if (actif) try { dessiner(actif, grand, (performance.now() - t0) / 1000 * .7); } catch (e) {} anim = requestAnimationFrame(tour); }; tour();
  }
  // v61 : le retour de la lueur se voit. L'objet sort d'elle en grandissant, tourne en 3D au-dessus d'elle avec des éclats
  // et son nom, puis file se ranger dans le menu (là où sont ses trouvailles). Le toucher ouvre la vitrine.
  let pop = null;
  function celebrer(id, depuis, vers, clic) {
    const it = par(id); if (!it) return;
    if (pop) pop.remove();
    const e = document.createElement('div'); e.className = 'trouvaille-pop'; pop = e;
    const halo = document.createElement('i'); halo.className = 'tp-halo';
    const toile = document.createElement('canvas'); toile.width = toile.height = 192;
    const nom = document.createElement('b'); nom.textContent = t(it.nom);
    const eclats = Array.from({ length: 10 }, (_, i) => { const x = document.createElement('i'); x.className = 'tp-eclat'; x.style.setProperty('--a', (i * 36) + 'deg'); x.style.setProperty('--d', (i * .07) + 's'); return x; });
    e.append(halo, ...eclats, toile, nom); document.body.append(e);
    e.addEventListener('click', () => { fin(); clic && clic(); });
    const t0 = performance.now(), H = 5.2, haut = Math.max(90, Math.min(depuis.y - 70, 150));
    const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    function fin() { if (pop === e) pop = null; e.remove(); }
    (function tour() {
      if (!e.isConnected) return;
      const k = (performance.now() - t0) / 1000;
      if (k > H) { fin(); const b = document.getElementById('btn-palette'); if (b) { b.classList.remove('recoit'); void b.offsetWidth; b.classList.add('recoit'); } return; }
      let x = depuis.x, y = depuis.y - haut * ease(k / .7), sc = .15 + .85 * ease(k / .6), op = Math.min(1, k * 4);
      if (k > 4.3) { const f = ease((k - 4.3) / .9); x += (vers.x - x) * f; y += (vers.y - y) * f; sc *= 1 - .8 * f; op = 1 - f * .6; e.classList.add('part'); }
      y += k > .7 && k < 4.3 ? Math.sin((k - .7) * 2.2) * 5 : 0;
      e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${sc})`; e.style.opacity = op;
      try { dessiner(it, toile, k * 1.6); } catch (err) {}
      requestAnimationFrame(tour);
    })();
  }
  return { tirer, ouvrir, fermer, celebrer, ouverte: () => !!boite, nombre: () => etat.liste.length, total: CATALOGUE.length, dernier: () => etat.dernier, nomDe: id => { const i = par(id); return i ? t(i.nom) : ''; } };
}
