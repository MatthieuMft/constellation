// Scènes déclenchées : « mots magiques » écrits dans une pensée, onde au clic, supernova.
// pluie · neige · mer · soleil · éclair · feu · feux d'artifice · lune · cœur · chat · baleine · étoiles filantes
import * as THREE from 'three';
import { norm } from './embed.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = x => Math.min(1, Math.max(0, x));
const env = (age, vie, ent, sor) => clamp01(Math.min(age / ent, (vie - age) / sor));

// L'ordre compte : la première scène dont un mot apparaît l'emporte.
const MOTS = [
  ['baleine',  /\b(baleines?|whales?)\b/],
  ['eclair',   /\b(orages?|eclairs?|foudre|tonnerre|tempetes?|storms?|stormy|lightning|thunder\w*)\b/],
  ['lune',     /\b(lunes?|lunaire|lunaires|moons?|moonlight)\b/],
  ['pluie',    /\b(pluies?|pleut|pleuvoir|pleur\w*|larmes?|rain\w*|tears?|crying|cried)\b/],
  ['neige',    /\b(neiges?|flocons?|hiver|snow\w*|winter)\b/],
  ['mer',      /\b(mer|mers|oceans?|vagues?|plages?|sable|ecume|sea|seas|waves?|beach\w*|sand)\b/],
  ['feu',      /\b(feux?|flammes?|bougies?|braises?|cheminee|bruler|fire|fires|flames?|candles?|fireplace)\b/],
  ['artifice', /\b(merci|bravo|fiers?|fiere|reussi\w*|felicit\w*|victoire|gagne\w*|thanks|thank|proud|congrat\w*|victory|won|win)\b/],
  ['amour',    /\b(amour|aimes?|aimer|aimee?s?|coeurs?|tendresse|love\w*|hearts?|tenderness)\b/],
  ['chat',     /\b(chats?|chatons?|minou|cats?|kittens?)\b/],
  ['soleil',   /\b(soleils?|ensoleille\w*|lumiere|aube|sun|sunny|sunshine|sunlight|dawn)\b/],
  ['etoile',   /\b(etoiles?|filantes?|ciel|stars?|sky)\b/],
];
export const motMagique = texte => { const t = norm(texte); const m = MOTS.find(([, re]) => re.test(t)); return m ? m[0] : null; };

const MODES = { pluie: 1, neige: 2, mer: 3, soleil: 4 };
const DUREES = { pluie: 9, neige: 11, mer: 10, soleil: 7 };

export function creerScenes({ scene, camera, particules, meteores, melange, texHalo, evenements, secousse }) {
  let clair = false; const encre = new THREE.Color('#1d1a2b');

  // ───── calque plein écran (pluie, neige, mer, soleil, flash d'éclair) ─────
  const matCalque = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: melange(),
    uniforms: { uMode: { value: 0 }, uT: { value: 0 }, uA: { value: 0 }, uFlash: { value: 0 }, uAsp: { value: 1 }, uClair: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `uniform float uMode; uniform float uT; uniform float uA; uniform float uFlash; uniform float uAsp; uniform float uClair; varying vec2 vUv;
      float h1(float x){ return fract(sin(x*91.345)*47453.5453); }
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
      float pluie(vec2 uv){ float s = 0.;
        for (int L = 0; L < 3; L++) { float cols = 46. + float(L)*34.; vec2 p = uv; p.x += p.y*.12; float c = floor(p.x*cols); float r = h1(c + float(L)*17.);
          if (r < .45) continue;
          float y = fract(p.y*(1. + float(L)*.4) + uT*(1.1 + r*.9 + float(L)*.3) + r*9.); float x = abs(fract(p.x*cols) - .5);
          s += smoothstep(.14, .0, y)*smoothstep(.0, .015, y)*smoothstep(.09, .0, x)*(.5 + .25*float(L)); }
        return s; }
      float neige(vec2 uv){ float s = 0.;
        for (int L = 0; L < 4; L++) { float sc = 9. + float(L)*7.; vec2 g = uv*vec2(sc*uAsp, sc); g.y += uT*(.6 + float(L)*.35); g.x += sin(uT*.4 + float(L)*2.)*.6;
          vec2 id = floor(g), f = fract(g) - .5; float r = h2(id + float(L)*13.); f.x += (r - .5)*.6 + sin(uT*1.1 + r*30.)*.12;
          s += smoothstep(.1 + .02*float(L), .0, length(f))*step(.45, r)*(.9 - .12*float(L)); }
        return s; }
      vec3 mer(vec2 uv){ vec3 col = vec3(0.); float off = -.28*(1. - uA);
        for (int i = 0; i < 4; i++) { float fi = float(i); float y0 = .05 + .075*fi + off;
          float w = sin(uv.x*(4. + fi*2.3) + uT*(.7 + fi*.28) + fi*2.1)*.022 + sin(uv.x*17. - uT*1.3)*.007;
          float d = uv.y - (y0 + w); float line = smoothstep(.01, .0, abs(d)); float fill = smoothstep(.0, -.22, d)*(.13 - .025*fi);
          float spark = step(.996, h2(floor(uv*vec2(90., 45.)) + floor(uT*3.)))*fill*7.;
          col += vec3(.12, .72, .9)*(line*.9 + fill) + vec3(.8, 1., 1.)*spark; }
        return col; }
      vec3 soleil(vec2 uv){ vec2 p = uv - vec2(.86, .93); p.x *= uAsp; float r = length(p), ang = atan(p.y, p.x);
        float glow = exp(-r*3.4), rays = pow(abs(sin(ang*8. + uT*.25)), 14.)*exp(-r*1.7);
        return vec3(1., .82, .5)*(glow*.8 + rays*.55); }
      void main(){
        vec3 col = vec3(0.);
        if (uMode > .5 && uMode < 1.5) col = vec3(.55, .72, 1.)*pluie(vUv)*.75;
        else if (uMode > 1.5 && uMode < 2.5) col = vec3(.92, .96, 1.)*neige(vUv);
        else if (uMode > 2.5 && uMode < 3.5) col = mer(vUv);
        else if (uMode > 3.5) col = soleil(vUv);
        col *= uA; col += vec3(.65, .78, 1.)*uFlash*(1. - uClair);
        float lum = max(max(col.r, col.g), col.b);
        vec4 sombre = vec4(col, 1.);
        vec4 papier = vec4(col/max(lum, 1e-4)*.35, clamp(lum*1.3, 0., .6));
        gl_FragColor = mix(sombre, papier, uClair); }`,
  });
  const calque = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matCalque); calque.frustumCulled = false; calque.renderOrder = 50; calque.visible = false; scene.add(calque);
  let calqueActif = null;   // { vie, age }

  // ───── éléments éphémères (anneaux, éclairs, rafales de particules) ─────
  const taches = [];        // { age, vie, maj(dt, age), fin() }
  const ajouter = (vie, maj, fin) => taches.push({ age: 0, vie, maj, fin });
  const ndcVers = (x, y, d) => new THREE.Vector3(x, y, .5).unproject(camera).sub(camera.position).normalize().multiplyScalar(d).add(camera.position);
  const couleurPoussiere = () => clair ? encre : new THREE.Color(1, .95, .85);

  const texAnneau = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.72, 'rgba(255,255,255,0)'); r.addColorStop(.86, 'rgba(255,255,255,.95)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  function anneau(pos, couleur, de, a, vie, opacite = .8) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAnneau, color: couleur, blending: melange(), transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    s.position.copy(pos); s.renderOrder = 8; scene.add(s);
    ajouter(vie, (dt, age) => { const k = age / vie; s.scale.setScalar(de + (a - de) * (1 - Math.pow(1 - k, 2.4))); s.material.opacity = Math.pow(1 - k, 1.6) * opacite; }, () => { scene.remove(s); s.material.dispose(); });
  }

  // éclair : une ligne brisée récursive tirée du haut de l'écran, avec une branche
  function eclairForme() {
    const x0 = rnd(-.45, .45), pts = [[x0, 1.08]]; let x = x0, y = 1.08; const bas = rnd(-.2, .3);
    const fractale = (a, b, amp, n, sortie) => { if (n === 0) { sortie.push(b); return; } const m = [(a[0] + b[0]) / 2 + rnd(-amp, amp), (a[1] + b[1]) / 2]; fractale(a, m, amp / 1.9, n - 1, sortie); fractale(m, b, amp / 1.9, n - 1, sortie); };
    const fin = [x0 + rnd(-.25, .25), bas], ligne = [[x0, 1.08]]; fractale([x0, 1.08], fin, .16, 6, ligne);
    const idx = Math.floor(ligne.length * rnd(.35, .6)), d0 = ligne[idx], br = [d0]; fractale(d0, [d0[0] + rnd(-.35, .35), d0[1] - rnd(.25, .5)], .1, 5, br);
    const pos = []; for (const l of [ligne, br]) for (let i = 0; i < l.length - 1; i++) { const a = ndcVers(l[i][0], l[i][1], 40), b = ndcVers(l[i + 1][0], l[i + 1][1], 40); pos.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({ color: clair ? encre : new THREE.Color(.8, .88, 1), transparent: true, blending: melange(), depthTest: false, depthWrite: false, opacity: 1 });
    const l = new THREE.LineSegments(g, m); l.renderOrder = 60; l.frustumCulled = false; scene.add(l);
    ajouter(.6, (dt, age) => {
      const f = age < .09 ? 1 : age < .17 ? .2 : age < .27 ? .75 : Math.max(0, 1 - (age - .27) / .33);
      m.opacity = f; matCalque.uniforms.uFlash.value = (age < .09 ? .85 : age < .17 ? .15 : age < .27 ? .55 : 0);
    }, () => { scene.remove(l); g.dispose(); m.dispose(); matCalque.uniforms.uFlash.value = 0; });
    secousse && secousse(clair ? 3 : 9, .5);
  }
  function eclair() { eclairForme(); setTimeout(() => { if (Math.random() < .7) eclairForme(); }, 650 + Math.random() * 700); }

  // feu : des braises qui montent depuis le bas de l'écran
  function feu() {
    const couleurs = [new THREE.Color(1, .55, .18), new THREE.Color(1, .75, .3), new THREE.Color(1, .35, .1)];
    ajouter(7, (dt, age) => {
      const n = Math.round(env(age, 7, 1, 2) * 3 * (dt * 60) / 1) ; for (let i = 0; i < Math.min(n, 5); i++) particules.burst(ndcVers(rnd(-.9, .9), -1.02, 16), clair ? encre : couleurs[i % 3], 1, 1.9);
    }, () => {});
  }
  // feux d'artifice : de grosses gerbes sphériques, espacées
  function artifice() {
    const palette = [new THREE.Color(1, .4, .5), new THREE.Color(1, .85, .35), new THREE.Color(.4, .8, 1), new THREE.Color(.7, .5, 1), new THREE.Color(.5, 1, .7)];
    let prochain = 0, k = 0;
    ajouter(5.5, (dt, age) => { if (age >= prochain && k < 6) { k++; prochain = age + rnd(.45, .8); particules.burst(ndcVers(rnd(-.7, .7), rnd(0, .7), 36), clair ? encre : palette[k % palette.length], 90, 3.2, true); } }, () => {});
  }

  function rafaleEtoiles() { meteores.rafale && meteores.rafale(3); }

  const JOUEURS = {
    pluie: () => calquer('pluie'), neige: () => calquer('neige'), mer: () => calquer('mer'), soleil: () => calquer('soleil'),
    eclair, feu, artifice, etoile: rafaleEtoiles,
    lune: () => evenements.declencher('lune'), amour: () => evenements.tout.dessin('coeur'), chat: () => evenements.tout.dessin('chat'), baleine: () => evenements.declencher('baleine'),
  };
  function calquer(nom) { matCalque.uniforms.uMode.value = MODES[nom]; calqueActif = { age: 0, vie: DUREES[nom] }; calque.visible = true; }

  return {
    motMagique,
    jouer(nom) { const f = JOUEURS[nom]; if (f) f(); return !!f; },
    liste: () => Object.keys(JOUEURS),
    // clic dans le vide : une onde de lumière et une poignée d'étincelles
    onde(point, couleur) { anneau(point, couleur || (clair ? encre : new THREE.Color(.85, .92, 1)), 1.5, 26, 1.1, .75); particules.burst(point, couleur || couleurPoussiere(), 14, 1.6, true); },
    // supernova : l'étoile s'embrase, deux ondes de choc, une gerbe de lumière
    supernova(point, couleur) {
      anneau(point, couleur, 3, 90, 1.9, .95); setTimeout(() => anneau(point, new THREE.Color(1, 1, 1), 2, 60, 1.5, .7), 180);
      particules.burst(point, couleur, 170, 3.4, true); particules.burst(point, new THREE.Color(1, 1, 1), 70, 5, true); secousse && secousse(clair ? 4 : 12, .7);
    },
    regler(c, enc) { clair = c; encre.set(enc); matCalque.blending = c ? THREE.NormalBlending : THREE.AdditiveBlending; matCalque.needsUpdate = true; matCalque.uniforms.uClair.value = c ? 1 : 0; },
    redim(w, h) { matCalque.uniforms.uAsp.value = w / h; },
    update(dt) {
      if (calqueActif) {
        calqueActif.age += dt; matCalque.uniforms.uT.value += dt; matCalque.uniforms.uA.value = env(calqueActif.age, calqueActif.vie, 1.6, 2.5);
        if (calqueActif.age >= calqueActif.vie) { calqueActif = null; calque.visible = false; matCalque.uniforms.uMode.value = 0; matCalque.uniforms.uA.value = 0; }
      }
      for (let i = taches.length - 1; i >= 0; i--) { const t = taches[i]; t.age += dt; t.maj(dt, t.age); if (t.age >= t.vie) { t.fin(); taches.splice(i, 1); } }
    },
  };
}
