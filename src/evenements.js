// Événements du ciel : surprises rares en arrière-plan.
// comète · aurore · ciel qui dessine · baleine d'étoiles · satellite · planète lointaine · lune réelle · lucioles
// Chacun s'achète dans la boutique (« Ton ciel ») : rien ne part au hasard sans permission.
//
// API :
//   const ev = creerEvenements({ scene, camera, melange, texHalo, pr });
//   ev.update(dt, anim, clair, permis)   à chaque image. permis = { cometes, aurores, dessins, baleine, satellites, planetes, lune } (booléens,
//                                        clés du catalogue ; planetes = au moins une planète possédée ; lune = la vraie lune affichée).
//                                        Un événement non permis ne démarre jamais ; celui qui est en cours finit tranquillement.
//                                        Tout juste permis (achat, interrupteur rallumé) : le premier arrive en 6 à 18 s.
//   ev.declencher(nom, arg)              surprise immédiate, permise ou non (mots magiques) : comete · aurore · dessin · baleine · satellite · planete · lune
//   ev.regler(clair, encre)              thème (ciel papier : encre au lieu de lumière)
//   ev.creerLucioles(visuelsFn)          → { m, maj(dt, anim, presence = 1) } : presence 0/1, fondu doux dans les deux sens
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = x => Math.min(1, Math.max(0, x));
const env = (age, vie, ent, sor) => clamp01(Math.min(age / ent, (vie - age) / sor));          // enveloppe : monte, tient, redescend

// Le ciel qu'on regarde à l'arrivée : la vue de départ (main.js, vueInitiale) plonge vers le bas, selon -(.15, .55, .82).
// Les astres fixes (lune réelle, planètes du décor) s'y accrochent par deux angles en degrés autour de cet axe : ax à droite, ay en haut.
const AXE = new THREE.Vector3(-.15, -.55, -.82).normalize(), AXE_D = AXE.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(), AXE_H = AXE_D.clone().cross(AXE);
export const dansLeCiel = (ax, ay, v = new THREE.Vector3()) => v.copy(AXE).addScaledVector(AXE_D, Math.tan(ax * Math.PI / 180)).addScaledVector(AXE_H, Math.tan(ay * Math.PI / 180)).normalize();
// écran large : les astres s'écartent davantage (téléphone en hauteur : 1, écran 16/10 : 2,2)
export const etalement = camera => 1 + 1.2 * clamp01((camera.aspect - .5) / 1.1);

// repère de la caméra à l'instant T (les événements se placent « dans le ciel qu'on regarde »)
function repere(camera) {
  camera.updateMatrixWorld();
  const avant = new THREE.Vector3(); camera.getWorldDirection(avant);
  return { pos: camera.position.clone(), avant, droite: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), haut: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1) };
}

const VERT_BILLBOARD = `uniform float uSize; varying vec2 vUv;
  void main(){ vUv = position.xy*2.; vec4 mv = modelViewMatrix*vec4(0.,0.,0.,1.); mv.xy += position.xy*uSize; gl_Position = projectionMatrix*mv; }`;

// Bruit pour les shaders de corps célestes
const GLSL_BRUIT = `float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
  float f2(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a*n2(p); p = p*2.1 + 7.3; a *= .5; } return s; }`;

// ───────────── Lune (réelle ou invoquée) ─────────────
const ANCRE_LUNE = Date.UTC(2000, 0, 6, 18, 14), LUNAISON = 29.530588853 * 86400000;
export const agePhase = (date = new Date()) => (((date.getTime() - ANCRE_LUNE) % LUNAISON) + LUNAISON) % LUNAISON / LUNAISON;     // 0 = nouvelle lune, .5 = pleine

// mélange normal dans tous les thèmes : un disque qui couvre le ciel (en addition, elle brûlait sur les ciels clairs Aube et Océan)
function creerLune(scene, tint) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending,
    uniforms: { uSize: { value: 40 }, uPhi: { value: 0 }, uA: { value: 0 }, uClair: { value: tint.clair ? 1 : 0 }, uEncre: { value: tint.encre.clone() } },
    vertexShader: VERT_BILLBOARD,
    fragmentShader: `uniform float uPhi; uniform float uA; uniform float uClair; uniform vec3 uEncre; varying vec2 vUv; ${GLSL_BRUIT}
      void main(){
        vec2 p = vUv*1.6; float r = length(p);                         // disque de rayon 1, halo autour, rien au bord du carré
        float halo = exp(-max(0., r - 1.)*5.) * .16 * (.3 + .7*abs(sin(uPhi*.5))) * smoothstep(1.55, 1.15, r);
        vec3 n = vec3(p, sqrt(max(0., 1. - r*r))), L = normalize(vec3(sin(uPhi), .12, -cos(uPhi)));
        float lit = smoothstep(-.04, .2, dot(n, L)), disque = smoothstep(1., .985, r);
        float maria = f2(p*2.4 + 3.), crat = f2(p*10.);
        if (uClair > .5) {                                             // ciel papier : un lavis d'encre, plus soutenu côté ombre, mers en gris doux
          float a = disque*mix(.26, .07 + .16*smoothstep(.62, .3, maria) + .05*crat, lit)*(.8 + .25*smoothstep(.7, 1., r)) + halo*.35*(1. - disque);
          gl_FragColor = vec4(mix(uEncre, vec3(.36, .42, .58), .4), a*uA); return;
        }
        vec3 base = mix(vec3(.16, .17, .21), vec3(.46, .45, .41), smoothstep(.3, .7, maria)) * (.84 + .24*crat);   // éclairée sans éblouir : on voit ses mers
        vec3 col = base*lit*(.72 + .28*n.z) + vec3(.012, .017, .03)*(1. - lit);
        float ah = min(1., halo*1.75), ad = disque*(.35 + .65*lit);   // halo de lumière, puis le disque (côté nuit : le ciel transparaît)
        vec3 c = col*ad + vec3(.28, .31, .4)*ah*(1. - ad); float a = ad + ah*(1. - ad);
        gl_FragColor = vec4(c/max(a, 1e-4), a*uA);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.frustumCulled = false; m.renderOrder = 1; m.visible = false; scene.add(m);
  return m;
}

export function creerEvenements({ scene, camera, melange, texHalo, pr = 1 }) {
  const actifs = [];                                  // { nom, age, vie, maj(dt, age), fin() }
  const tint = { clair: false, encre: new THREE.Color('#1d1a2b') };
  const blanc = () => tint.clair ? tint.encre : new THREE.Color(1, 1, 1);
  const ajouter = (nom, vie, maj, fin) => actifs.push({ nom, age: 0, vie, maj, fin });
  const effacer = objets => { for (const o of objets) { scene.remove(o); o.traverse && o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); } };
  const mat = (extra) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: melange(), ...extra });

  // ── Comète : une tête vive et une longue queue qui vire du cyan au magenta ──
  function comete() {
    const b = repere(camera), D = rnd(180, 250), sens = Math.random() < .5 ? -1 : 1, NP = 60;
    const tete = b.pos.clone().addScaledVector(b.avant, D).addScaledVector(b.droite, -sens * rnd(95, 130)).addScaledVector(b.haut, rnd(15, 75));
    const vit = b.droite.clone().multiplyScalar(sens * rnd(10, 15)).addScaledVector(b.haut, -rnd(1, 4));
    const hist = Array.from({ length: NP }, () => tete.clone());
    const pos = new Float32Array(NP * 2 * 3), dir = new Float32Array(NP * 2 * 3), u = new Float32Array(NP * 2), cote = new Float32Array(NP * 2), idx = [];
    for (let i = 0; i < NP; i++) { u[i * 2] = u[i * 2 + 1] = i / (NP - 1); cote[i * 2] = -1; cote[i * 2 + 1] = 1; if (i < NP - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(u, 1)); g.setAttribute('aSide', new THREE.BufferAttribute(cote, 1)); g.setIndex(idx);
    const m = mat({ side: THREE.DoubleSide, uniforms: { uW: { value: .85 }, uA: { value: 0 }, uClair: { value: tint.clair ? 1 : 0 } },
      vertexShader: `attribute vec3 aDir; attribute float aU; attribute float aSide; uniform float uW; varying float vU; varying float vS;
        void main(){ vec4 p = viewMatrix*vec4(position,1.); vec2 d = (viewMatrix*vec4(aDir,0.)).xy; float l = length(d); d = l > 1e-4 ? d/l : vec2(1.,0.);
          p.xy += vec2(-d.y, d.x)*aSide*uW*(1. - aU*.9); vU = aU; vS = aSide; gl_Position = projectionMatrix*p; }`,
      fragmentShader: `uniform float uA; uniform float uClair; varying float vU; varying float vS;
        void main(){ float edge = smoothstep(0., .8, 1. - abs(vS)); float a = pow(1. - vU, 1.6)*edge*uA;
          vec3 col = mix(vec3(1., .96, .9), mix(vec3(.3, .8, 1.), vec3(.95, .3, .9), vU), smoothstep(0., .35, vU));
          col = mix(col*1.3, col*.35, uClair); gl_FragColor = vec4(col, a); }` });
    const ruban = new THREE.Mesh(g, m); ruban.frustumCulled = false; ruban.renderOrder = 4;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, color: tint.clair ? tint.encre : 0xfff0d8, blending: melange(), transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    halo.scale.setScalar(10); halo.renderOrder = 4; scene.add(ruban, halo);
    let acc = 0;
    ajouter('comete', 19, (dt, age) => {
      tete.addScaledVector(vit, dt); acc += dt; if (acc > .1) { acc = 0; hist.pop(); hist.unshift(tete.clone()); } else hist[0].copy(tete);
      const a = env(age, 19, 2.5, 4);
      for (let i = 0; i < NP; i++) {
        const p = hist[i], q = i < NP - 1 ? hist[i + 1] : hist[i - 1], s = i < NP - 1 ? 1 : -1;
        const dx = (p.x - q.x) * s, dy = (p.y - q.y) * s, dz = (p.z - q.z) * s, l = Math.hypot(dx, dy, dz) || 1;
        for (let k = 0; k < 2; k++) { const o = (i * 2 + k) * 3; pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z; dir[o] = dx / l; dir[o + 1] = dy / l; dir[o + 2] = dz / l; }
      }
      g.attributes.position.needsUpdate = g.attributes.aDir.needsUpdate = true; m.uniforms.uA.value = a; halo.position.copy(tete); halo.material.opacity = .55 * a;
    }, () => effacer([ruban, halo]));
  }

  // ── Aurore boréale : des rideaux de lumière qui ondulent dans le haut du ciel qu'on regarde ──
  function aurore() {
    const b = repere(camera);
    const m = mat({ side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uA: { value: 0 }, uClair: { value: tint.clair ? 1 : 0 }, uEncre: { value: tint.encre.clone() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uT; uniform float uA; uniform float uClair; uniform vec3 uEncre; varying vec2 vUv;
        float h1(float x){ return fract(sin(x*127.1)*43758.5453); }
        float n1(float x){ float i = floor(x), f = fract(x); f = f*f*(3. - 2.*f); return mix(h1(i), h1(i + 1.), f); }
        void main(){
          float x = vUv.x, y = vUv.y;
          float vague = sin(x*7. + uT*.45)*.1 + sin(x*17. - uT*.33)*.045 + (n1(x*5. + uT*.2) - .5)*.2;
          float h = y - .25 - vague;
          float base = smoothstep(-.04, .09, h) * (exp(-h*2.8) + .45*exp(-max(h, 0.)*16.)) * smoothstep(1., .72, y) * smoothstep(0., .12, y);   // pied vif, voile qui monte, rien aux bords
          float stries = .5 + .38*n1(x*95. + uT*.35 + n1(x*7. + uT*.12)*7.) + .12*n1(x*270. - uT*.25);      // fines stries verticales qui glissent
          float plis = .3 + .7*n1(x*9. - uT*.1);                                                          // les plis du rideau
          vec3 col = mix(vec3(.12, 1., .55), mix(vec3(.25, .8, .95), vec3(.7, .25, 1.), smoothstep(.55, 1., y)), smoothstep(.15, .6, y));
          float bord = smoothstep(0., .18, x)*smoothstep(1., .82, x), I = base*stries*plis*bord*uA;
          if (uClair > .5) { gl_FragColor = vec4(mix(pow(col, vec3(2.2))*.55, uEncre, .2), min(.45, I*.7)); return; }   // papier : un lavis d'aquarelle
          gl_FragColor = vec4(col*I*.72, 1.); }` });
    // le rideau se dresse selon le « haut » de la caméra, centré sur le regard : son pied juste au-dessus du centre de l'écran,
    // ses rayons montent jusqu'au bord haut (la vue plonge vers le bas : un rideau posé à l'horizontale resterait hors champ)
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(210, 210, 95, 72, 1, true, 0, 1.9), m);
    arc.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(b.droite, b.haut, b.avant.clone().negate())); arc.rotateY(Math.PI - .95);
    arc.position.copy(b.pos).addScaledVector(b.haut, 38); arc.frustumCulled = false; arc.renderOrder = -7; scene.add(arc);   // derrière la lune et les planètes du décor (-6)
    ajouter('aurore', 26, (dt, age) => { m.uniforms.uT.value += dt; m.uniforms.uA.value = env(age, 26, 6, 7); }, () => effacer([arc]));
  }

  // ── Ciel qui dessine : des points se relient pour former une figure, puis s'effacent ──
  const arcs = (cx, cy, r, a0, a1, pas) => { const l = []; const n = Math.max(2, Math.round(Math.abs(a1 - a0) / pas)); for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; l.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return l; };
  const FIGURES = {
    croissant: () => ({ pts: [...arcs(0, 0, 1, 56.8, 303.2, 12), ...arcs(.4, 0, .85, 280, 80, 12).map(p => p)], noeuds: 3 }),
    coeur: () => { const l = []; for (let i = 0; i <= 28; i++) { const t = i / 28 * Math.PI * 2; l.push([16 * Math.pow(Math.sin(t), 3) / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17]); } return { pts: l, noeuds: 3 }; },
    etoile: () => { const v = k => [Math.cos((90 + 72 * k) * Math.PI / 180), Math.sin((90 + 72 * k) * Math.PI / 180)]; return { pts: [v(0), v(2), v(4), v(1), v(3), v(0)], noeuds: 1 }; },
    chat: () => ({ pts: [[-.62, -.55], [-.62, .15], [-.8, .78], [-.3, .45], [.3, .45], [.8, .78], [.62, .15], [.62, -.55], [0, -.85], [-.62, -.55]], noeuds: 1 }),
  };
  function dessin(nom) {
    nom = nom || ['croissant', 'coeur', 'etoile', 'chat'][Math.floor(Math.random() * 4)];
    const f = FIGURES[nom](), b = repere(camera), demi = Math.tan(camera.fov * Math.PI / 360) * 190, demiL = demi * camera.aspect;    // moitié visible à 190 unités
    const S = Math.min(rnd(34, 44), Math.min(demi, demiL) * .72);                                                                      // la figure tient toujours à l'écran
    const centre = b.pos.clone().addScaledVector(b.avant, 190).addScaledVector(b.droite, rnd(-1, 1) * Math.max(0, demiL - S * 1.25)).addScaledVector(b.haut, rnd(-.1, .7) * Math.max(0, demi - S * 1.25));
    const mondeDe = ([x, y]) => centre.clone().addScaledVector(b.droite, x * S).addScaledVector(b.haut, y * S);
    // longueur cumulée pour dessiner « au trait »
    const P = f.pts.map(mondeDe); let L = 0; const cum = [0]; for (let i = 1; i < P.length; i++) { L += P[i].distanceTo(P[i - 1]); cum.push(L); }
    const lp = [], lt = []; for (let i = 0; i < P.length - 1; i++) { lp.push(P[i].x, P[i].y, P[i].z, P[i + 1].x, P[i + 1].y, P[i + 1].z); lt.push(cum[i] / L, cum[i + 1] / L); }
    const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); gl.setAttribute('aT', new THREE.Float32BufferAttribute(lt, 1));
    const col = () => tint.clair ? tint.encre : new THREE.Color(.7, .85, 1);
    const ml = mat({ uniforms: { uDraw: { value: 0 }, uA: { value: 0 }, uCol: { value: col() } },
      vertexShader: `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uDraw; uniform float uA; uniform vec3 uCol; varying float vT; void main(){ float a = 1. - smoothstep(uDraw - .006, uDraw + .006, vT); gl_FragColor = vec4(uCol, a*uA*.55); }` });
    const lignes = new THREE.LineSegments(gl, ml); lignes.frustumCulled = false; lignes.renderOrder = 1;
    const np = [], nt = []; P.forEach((p, i) => { if (i % f.noeuds === 0 || i === P.length - 1) { np.push(p.x, p.y, p.z); nt.push(cum[i] / L); } });
    const gn = new THREE.BufferGeometry(); gn.setAttribute('position', new THREE.Float32BufferAttribute(np, 3)); gn.setAttribute('aT', new THREE.Float32BufferAttribute(nt, 1));
    const mn = mat({ uniforms: { uDraw: { value: 0 }, uA: { value: 0 }, uCol: { value: col() }, uT: { value: 0 } },
      vertexShader: `attribute float aT; uniform float uDraw; uniform float uT; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        float pop = smoothstep(uDraw - .001, uDraw + .05, aT); vA = 1. - pop; gl_PointSize = (vA > .5 ? 7. + 3.*sin(uT*3. + aT*20.) : 0.); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(uCol*1.5, smoothstep(.5, 0., d)*uA*vA); }` });
    const noeuds = new THREE.Points(gn, mn); noeuds.frustumCulled = false; noeuds.renderOrder = 1; scene.add(lignes, noeuds);
    ajouter('dessin', 13, (dt, age) => {
      const d = clamp01((age - .8) / 5.2), a = env(age, 13, .8, 3);
      ml.uniforms.uDraw.value = mn.uniforms.uDraw.value = d * 1.02; ml.uniforms.uA.value = mn.uniforms.uA.value = a; mn.uniforms.uT.value += dt;
    }, () => effacer([lignes, noeuds]));
  }

  // ── Baleine d'étoiles : un banc de points qui nage, très loin ──
  function baleine() {
    const b = repere(camera), D = rnd(210, 250), sens = Math.random() < .5 ? -1 : 1, LONG = 95;
    const cx = -sens * 160, y0 = rnd(5, 55), NB = 20;
    // silhouette (x de -1.3 à 1, y selon le profil) : dos, ventre, nageoire caudale, œil
    const base = [];
    for (let i = 0; i <= NB; i++) { const x = -.8 + 1.8 * i / NB, h = Math.sqrt(Math.max(0, 1 - Math.pow((x + .1) / .9, 2))); base.push([x, .22 * h, 1], [x, -.17 * h, 1]); }
    base.push([-.95, .03, .9], [-1.05, .13, .9], [-1.2, .26, .9], [-1.33, .34, .9], [-1.05, -.08, .9], [-1.2, -.2, .9], [-1.33, -.3, .9], [.72, .06, 1.4], [.3, -.2, .8], [.15, -.36, .8], [-.2, .02, .6], [.2, .04, .6], [.5, .0, .6]);
    const N = base.length, pos = new Float32Array(N * 3), tai = new Float32Array(N), ph = new Float32Array(N);
    base.forEach((p, i) => { tai[i] = p[2] * 1.5; ph[i] = Math.random() * 6.28; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aS', new THREE.BufferAttribute(tai, 1)); g.setAttribute('aP', new THREE.BufferAttribute(ph, 1));
    const m = mat({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uPR: { value: pr }, uCol: { value: tint.clair ? tint.encre : new THREE.Color(.75, .88, 1) } },
      vertexShader: `attribute float aS; attribute float aP; uniform float uT; uniform float uPR; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = aS*uPR*2.6*(.75 + .25*sin(uT*2. + aP)); vA = .6 + .4*sin(uT*1.6 + aP*3.); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(uCol*1.4, smoothstep(.5, 0., d)*vA*uA); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1; scene.add(pts);
    let x = cx, t = 0; const vie = 52;
    ajouter('baleine', vie, (dt, age) => {
      x += sens * (320 / vie) * dt; t += dt; m.uniforms.uT.value = t; m.uniforms.uA.value = env(age, vie, 5, 6);
      const centre = b.pos.clone().addScaledVector(b.avant, D).addScaledVector(b.droite, x).addScaledVector(b.haut, y0 + Math.sin(t * .35) * 5);
      base.forEach(([px, py], i) => {
        const ondul = Math.sin(px * 3.2 - t * 1.9) * .07 * (1 - px) / 2;                       // le corps ondule, la queue davantage
        const wx = sens * px * LONG * .5, wy = (py + ondul) * LONG * .5;
        pos[i * 3] = centre.x + b.droite.x * wx + b.haut.x * wy; pos[i * 3 + 1] = centre.y + b.droite.y * wx + b.haut.y * wy; pos[i * 3 + 2] = centre.z + b.droite.z * wx + b.haut.z * wy;
      });
      g.attributes.position.needsUpdate = true;
    }, () => effacer([pts]));
  }

  // ── Satellite : un point qui clignote et traverse en ligne droite ──
  function satellite() {
    const b = repere(camera), sens = Math.random() < .5 ? -1 : 1, D = rnd(140, 200);
    const p = b.pos.clone().addScaledVector(b.avant, D).addScaledVector(b.droite, -sens * 120).addScaledVector(b.haut, rnd(-5, 70));
    const vit = b.droite.clone().multiplyScalar(sens * 14).addScaledVector(b.haut, rnd(-2, 3));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([p.x, p.y, p.z], 3));
    const m = mat({ uniforms: { uT: { value: 0 }, uA: { value: 0 }, uPR: { value: pr }, uCol: { value: blanc() } },
      vertexShader: `uniform float uPR; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize = 5.*uPR; }`,
      fragmentShader: `uniform float uT; uniform float uA; uniform vec3 uCol; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard;
        float blink = smoothstep(.55, .75, sin(uT*3.8)*.5 + .5)*.8 + .2; gl_FragColor = vec4(uCol*1.3, smoothstep(.5, 0., d)*uA*blink); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1; scene.add(pts);
    ajouter('satellite', 18, (dt, age) => { p.addScaledVector(vit, dt); g.attributes.position.array.set([p.x, p.y, p.z]); g.attributes.position.needsUpdate = true; m.uniforms.uT.value += dt; m.uniforms.uA.value = env(age, 18, 1.5, 2); }, () => effacer([pts]));
  }

  // ── Planète lointaine, avec ou sans anneaux ──
  function planete() {
    const b = repere(camera), sens = Math.random() < .5 ? -1 : 1, anneaux = Math.random() < .6;
    const palettes = [[[.95, .62, .3], [.55, .25, .15]], [[.35, .75, .8], [.1, .3, .45]], [[.72, .55, .9], [.3, .2, .5]], [[.9, .85, .7], [.55, .45, .3]]];
    const [c1, c2] = palettes[Math.floor(Math.random() * palettes.length)];
    const m = mat({ blending: THREE.NormalBlending, uniforms: { uSize: { value: 110 }, uA: { value: 0 }, uC1: { value: new THREE.Color(...c1) }, uC2: { value: new THREE.Color(...c2) }, uRing: { value: anneaux ? 1 : 0 }, uTilt: { value: rnd(-.5, .5) } },
      vertexShader: VERT_BILLBOARD,
      fragmentShader: `uniform float uA; uniform vec3 uC1; uniform vec3 uC2; uniform float uRing; uniform float uTilt; varying vec2 vUv; ${GLSL_BRUIT}
        void main(){
          vec2 p = vUv*2.2; float r = length(p); vec3 col = vec3(0.); float a = 0.;     // planète + anneaux tiennent dans le carré
          // anneaux : ellipse inclinée ; la moitié arrière passe derrière la planète
          float cs = cos(uTilt), sn = sin(uTilt); vec2 q = vec2(cs*p.x + sn*p.y, -sn*p.x + cs*p.y); q.y /= .26; float rr = length(q);
          float ring = uRing * smoothstep(1.4, 1.46, rr)*smoothstep(2.15, 2.08, rr) * (.55 + .45*sin(rr*46.));
          bool devant = q.y < 0.;
          if (r < 1.) {
            vec3 n = vec3(p, sqrt(1. - r*r)); vec3 L = normalize(vec3(-.6, .5, .6));
            float bandes = sin(n.y*9. + f2(vec2(n.y*3., n.x*1.5))*3.);
            vec3 base = mix(uC1, uC2, .5 + .5*bandes);
            float lit = smoothstep(-.15, .75, dot(n, L));
            col = base*(.12 + .95*lit) + uC2*pow(1. - n.z, 3.)*.5*lit; a = 1.;
          }
          if (ring > .01 && (r >= 1. || devant)) { col = mix(col, vec3(.85, .8, .72)*(.5 + .5*ring), ring*.75); a = max(a, ring*.8); }
          gl_FragColor = vec4(col, a*uA); }` });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); mesh.frustumCulled = false; mesh.renderOrder = -6; scene.add(mesh);     // derrière le volume des nébuleuses (-5)
    const dep = b.pos.clone().addScaledVector(b.avant, 460).addScaledVector(b.droite, -sens * 150).addScaledVector(b.haut, rnd(20, 90)), vit = b.droite.clone().multiplyScalar(sens * 3.2);
    ajouter('planete', 90, (dt, age) => { dep.addScaledVector(vit, dt); mesh.position.copy(dep); m.uniforms.uA.value = env(age, 90, 9, 10); }, () => effacer([mesh]));
  }

  // ── Vraie lune (objet « La Lune ») : phase du jour, un peu plus haute à son passage au méridien ──
  // Elle reste accrochée en haut à gauche du ciel qu'on regarde (une lune achetée doit se voir), plus pâle quand elle est sous l'horizon.
  const lune = creerLune(scene, tint); lune.renderOrder = -6; const _vl = new THREE.Vector3();
  function majLune(dt, anim, voulue) {
    const u = lune.material.uniforms;
    if (!voulue && u.uA.value < .01) { u.uA.value = 0; lune.visible = false; return; }
    const d = new Date(), age = agePhase(d), heure = d.getHours() + d.getMinutes() / 60;
    const transit = (12 + age * 24) % 24, ha = ((heure - transit + 36) % 24 - 12) * 15 * Math.PI / 180;       // angle horaire : 0 = au plus haut
    const elev = Math.cos(ha);
    lune.position.copy(camera.position).addScaledVector(dansLeCiel((-7 + Math.sin(ha) * 4) * etalement(camera), 15 + elev * 5, _vl), 330);
    u.uPhi.value = age * Math.PI * 2; u.uSize.value = 60;
    const cible = voulue ? (.62 + .38 * clamp01((elev + .3) / .6)) * (.55 + .45 * Math.min(1, anim)) : 0;
    u.uA.value += (cible - u.uA.value) * Math.min(1, dt * (voulue ? .7 : 1.4)); lune.visible = u.uA.value > .01;
  }
  // lune invoquée par un mot (« lune ») : grosse, au premier plan du ciel, quelques secondes
  function luneInvoquee() {
    const b = repere(camera), m = creerLune(scene, tint); m.visible = true; m.renderOrder = 2; m.material.uniforms.uSize.value = 48; m.material.uniforms.uPhi.value = agePhase() * Math.PI * 2;
    const p = b.pos.clone().addScaledVector(b.avant, 210).addScaledVector(b.droite, rnd(-30, 55)).addScaledVector(b.haut, rnd(25, 60)); m.position.copy(p);
    ajouter('lune', 13, (dt, age) => { m.material.uniforms.uA.value = env(age, 13, 3, 4) * (tint.clair ? .5 : 1); m.position.addScaledVector(b.haut, -.25 * dt); }, () => effacer([m]));
  }

  // ── Lucioles : de petites étincelles qui tournent autour de certaines étoiles ──
  function creerLucioles(visuelsFn) {
    const N = 64, pos = new Float32Array(N * 3), ph = new Float32Array(N), ray = new Float32Array(N), vit = new Float32Array(N), inc = new Float32Array(N), cible = new Array(N).fill(null);
    for (let i = 0; i < N; i++) { ph[i] = Math.random() * 6.28; ray[i] = rnd(1.4, 4.2); vit[i] = rnd(.25, .8) * (Math.random() < .5 ? -1 : 1); inc[i] = rnd(-.8, .8); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aP', new THREE.BufferAttribute(ph, 1));
    const m = mat({ uniforms: { uT: { value: 0 }, uPR: { value: pr }, uA: { value: 0 }, uCol: { value: new THREE.Color(1, .9, .6) } },
      vertexShader: `attribute float aP; uniform float uT; uniform float uPR; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = uPR*(26./max(1., -mv.z))*5.; vA = pow(.5 + .5*sin(uT*1.7 + aP*9.), 3.); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(uCol*1.5, smoothstep(.5, 0., d)*vA*uA); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; pts.visible = false; scene.add(pts);
    let t = 0;
    return {
      m,
      // presence : 1 quand l'objet « Lucioles » est possédé et allumé, 0 sinon (elles s'éteignent en douceur)
      maj(dt, anim, presence = 1) {
        t += dt; m.uniforms.uT.value = t; m.uniforms.uA.value += (Math.min(1, anim) * presence - m.uniforms.uA.value) * Math.min(1, dt * 2);
        if (m.uniforms.uA.value < .005 && !presence) m.uniforms.uA.value = 0;
        pts.visible = m.uniforms.uA.value > .005; if (!pts.visible) return;
        const vs = [...visuelsFn().values()]; if (!vs.length) return;
        for (let i = 0; i < N; i++) {
          if (!cible[i] || !visuelsFn().has(cible[i].id)) cible[i] = vs[Math.floor(Math.random() * vs.length)];
          const c = cible[i].groupe.position, a = ph[i] + t * vit[i];
          pos[i * 3] = c.x + Math.cos(a) * ray[i]; pos[i * 3 + 1] = c.y + Math.sin(a * 1.3 + inc[i]) * ray[i] * .5; pos[i * 3 + 2] = c.z + Math.sin(a) * ray[i];
        }
        g.attributes.position.needsUpdate = true;
      },
    };
  }

  const tout = { comete, aurore, dessin, baleine, satellite, planete, lune: luneInvoquee };
  // fréquences moyennes (secondes) : volontairement rares ; l'aurore, objet cher, un peu moins
  const plan = { comete: [80, 200], aurore: [80, 180], dessin: [90, 220], baleine: [260, 520], satellite: [50, 120], planete: [180, 420] };
  const attente = Object.fromEntries(Object.entries(plan).map(([k, [a, b]]) => [k, rnd(a * .25, b * .5)]));    // la première surprise vient assez vite
  const CLES = { comete: 'cometes', aurore: 'aurores', dessin: 'dessins', baleine: 'baleine', satellite: 'satellites', planete: 'planetes' };   // nom interne → clé du catalogue
  let permisPrec = null; const promis = new Set();          // tout juste permis : on insiste jusqu'à ce que le premier passe

  return {
    lune, tout, creerLucioles,
    declencher(nom, arg) { const f = tout[nom]; if (f) f(arg); return !!f; },
    actifs: () => actifs.map(a => a.nom),
    regler(clair, encre) {
      tint.clair = clair; tint.encre.set(encre);
      const u = lune.material.uniforms; u.uClair.value = clair ? 1 : 0; u.uEncre.value.set(encre);
    },
    // permis : ce que la boutique a débloqué (voir l'en-tête) ; sans permis, rien ne part au hasard et la vraie lune s'efface
    update(dt, anim, clair, permis = {}) {
      majLune(dt, anim, !!permis.lune);
      for (let i = actifs.length - 1; i >= 0; i--) { const a = actifs[i]; a.age += dt; a.maj(dt, a.age); if (a.age >= a.vie) { a.fin(); actifs.splice(i, 1); } }
      const premier = !permisPrec; permisPrec = permisPrec || {};
      for (const k in CLES) {
        const ok = !!permis[CLES[k]];
        if (!premier && ok && !permisPrec[k]) { promis.add(k); attente[k] = rnd(6, 18); }       // tout juste acheté ou rallumé : il vient vite
        if (!ok) promis.delete(k);
        permisPrec[k] = ok;
      }
      if (anim <= 0) return;
      for (const k of Object.keys(plan)) {
        if (!permisPrec[k] || (attente[k] -= dt) > 0) continue;
        if (!actifs.some(a => a.nom === k) && actifs.length < 3 && !(clair && k === 'planete')) { tout[k](); promis.delete(k); attente[k] = rnd(...plan[k]) / anim; }
        else attente[k] = promis.has(k) ? rnd(4, 9) : rnd(...plan[k]) / anim;              // place prise : un premier promis réessaie bientôt
      }
    },
  };
}
