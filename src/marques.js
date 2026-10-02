// Ce qui se superpose aux étoiles du temps :
//  - les filaments de série (jours écrits à la suite, reliés par un fil de lumière),
//  - les couronnes dorées des dates qui comptent,
//  - le repère « aujourd'hui » : visible même au dézoom maximal, il indique où est l'étoile du jour (flèche sur le bord si elle est hors champ).
import * as THREE from 'three';

const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function texCouronne() {
  const T = 128, c = document.createElement('canvas'); c.width = c.height = T; const g = c.getContext('2d');
  const gr = g.createRadialGradient(T / 2, T / 2, T * .1, T / 2, T / 2, T / 2); gr.addColorStop(0, 'rgba(255,214,120,0)'); gr.addColorStop(.55, 'rgba(255,214,120,.0)'); gr.addColorStop(.78, 'rgba(255,214,120,.55)'); gr.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, T, T);
  g.strokeStyle = 'rgba(255,236,190,.95)'; g.lineWidth = 2; g.beginPath(); g.arc(T / 2, T / 2, T * .34, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255,244,214,.95)'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(T / 2 + Math.cos(a) * T * .34, T / 2 + Math.sin(a) * T * .34, 3.2, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function creerMarques({ scene, camera, controls, melange, posJour, repere, surRepere }) {
  const groupe = new THREE.Group(); scene.add(groupe);
  const tex = texCouronne();
  let fil = null, couronnes = [], aujourdhui = null, clair = false;
  const _v = new THREE.Vector3();

  function vider() {
    if (fil) { groupe.remove(fil); fil.geometry.dispose(); fil.material.dispose(); fil = null; }
    couronnes.forEach(s => { groupe.remove(s); s.material.dispose(); }); couronnes = [];
  }

  // chaines : [[clé, clé, …]] (≥ 2 jours) · dates : [{ cle, titre }] · jour : clé d'aujourd'hui
  function reconstruire({ chaines, dates, jour }) {
    vider(); aujourdhui = jour;
    const pts = [];
    for (const ch of chaines) for (let i = 1; i < ch.length; i++) { const a = posJour(ch[i - 1]), b = posJour(ch[i]); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    if (pts.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      fil = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: clair ? 0x6a5a30 : 0xffe2a0, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: melange() }));
      fil.frustumCulled = false; fil.renderOrder = 2; groupe.add(fil);
    }
    for (const d of dates) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, blending: melange(), opacity: 0, fog: false }));
      s.position.copy(posJour(d.cle)); s.scale.setScalar(7); s.renderOrder = 3; s.userData = { cle: d.cle, aujourdhui: d.cle === jour }; groupe.add(s); couronnes.push(s);
    }
  }

  function regler(estClair, m) {
    clair = estClair;
    if (fil) { fil.material.color.set(clair ? 0x6a5a30 : 0xffe2a0); fil.material.blending = m; fil.material.needsUpdate = true; }
    couronnes.forEach(s => { s.material.blending = m; s.material.needsUpdate = true; });
  }

  // chaque image : opacité selon la distance, et placement du repère DOM
  function update(t, { niveau, masquer }) {
    const d = camera.position.distanceTo(controls.target);
    if (fil) fil.material.opacity = (1 - lisse(150, 420, d)) * .55 * (.8 + .2 * Math.sin(t * .8));
    for (const s of couronnes) {
      const dd = camera.position.distanceTo(s.position);
      s.material.opacity = (1 - lisse(120, 360, dd)) * (s.userData.aujourdhui ? 1 : .8) * (.75 + .25 * Math.sin(t * 2 + s.position.x));
      s.scale.setScalar(6.5 + Math.sin(t * 1.4 + s.position.x) * .5);
    }
    placerRepere(d, niveau, masquer);
  }

  function placerRepere(d, niveau, masquer) {
    if (!repere || !aujourdhui) return;
    const W = innerWidth, H = innerHeight, p = posJour(aujourdhui); _v.copy(p).project(camera);
    const devant = _v.z < 1, marge = 30;
    let x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * H;
    if (!devant) { x = W - x; y = H - y; }                                     // derrière la caméra : on inverse pour viser le bon bord
    const dedans = devant && x > marge && x < W - marge && y > 90 && y < H - 90;
    // tout près de l'étoile (niveaux jour/semaine) : pas besoin d'un repère par-dessus
    const proche = dedans && d < 60;
    if (masquer || proche) { repere.hidden = true; return; }
    repere.hidden = false;
    if (dedans) { repere.dataset.bord = ''; repere.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; }
    else {
      const cx = W / 2, cy = H / 2; let dx = x - cx, dy = y - cy; if (!dx && !dy) dx = 1;
      const k = Math.min((W / 2 - 36) / Math.abs(dx || 1e-6), (H / 2 - 120) / Math.abs(dy || 1e-6));
      const ex = cx + dx * k, ey = cy + dy * k; repere.dataset.bord = '1';
      repere.style.transform = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px)`; repere.style.setProperty('--angle', Math.atan2(dy, dx) + 'rad');
    }
  }
  if (repere) repere.addEventListener('click', () => surRepere && surRepere());

  return { reconstruire, regler, update };
}
