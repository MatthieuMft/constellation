// Ciel vivant : étoiles filantes et poussière cosmique qui dérive. Les deux s'achètent dans la boutique (« Ton ciel » › Animations).
//
// API :
//   const meteores = creerEtoilesFilantes(scene, camera)
//     meteores.update(dt, frequence)   frequence 0 : plus aucun départ, celles en vol finissent leur course (≤ 1,4 s) puis plus rien.
//     meteores.dorees(on, part = 1)    objet « Filantes dorées » : part = proportion d'étoiles filantes dorées parmi les départs.
//                                      Seul : frequence = anim × 2,5 et part 1 ; avec « Étoiles filantes » aussi : part ≈ .6 (l'or reste rare et précieux).
//     meteores.regler(clair, melange, encre) · rafale(n) · pluie(n) (v55 : n départs étalés, tous dans le même sens) · vives()
//     meteores.proche(x, y, r) → indice de la filante la plus proche d'un toucher (tête ou queue, en px), -1 sinon · attraper(i) → sa tête (v57)
//   const poussiere = creerPoussiere(scene, pr, N)
//     poussiere.update(t, anim, centre, dist, presence)   presence 0/1 (objet « Poussière d'étoiles ») : fondu de ~1,5 s, puis plus rien n'est dessiné.
//     poussiere.regler(clair, melange, couleur)
import * as THREE from 'three';

// Étoiles filantes : bandes lumineuses (tête vive, queue qui s'efface) tirées dans le champ de la caméra.
export function creerEtoilesFilantes(scene, camera) {
  const N = 10, V = N * 4;
  const pos = new Float32Array(V * 3), tete = new Float32Array(V * 3), queue = new Float32Array(V * 3);
  const cote = new Float32Array(V), t = new Float32Array(V), al = new Float32Array(V), idx = [];
  for (let m = 0; m < N; m++) {
    for (let k = 0; k < 4; k++) { const i = m * 4 + k; t[i] = k >= 2 ? 1 : 0; cote[i] = k % 2 ? 1 : -1; }
    idx.push(m * 4, m * 4 + 1, m * 4 + 2, m * 4 + 2, m * 4 + 1, m * 4 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aHead', new THREE.BufferAttribute(tete, 3)); g.setAttribute('aTail', new THREE.BufferAttribute(queue, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(cote, 1)); g.setAttribute('aT', new THREE.BufferAttribute(t, 1)); g.setAttribute('aA', new THREE.BufferAttribute(al, 1));
  const dore = new Float32Array(V); g.setAttribute('aOr', new THREE.BufferAttribute(dore, 1));          // 1 : celle-ci est dorée
  g.setIndex(idx);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uW: { value: .5 }, uTint: { value: new THREE.Color(.7, .85, 1) }, uOr: { value: new THREE.Color('#ffc85a') } },
    vertexShader: `attribute vec3 aHead; attribute vec3 aTail; attribute float aSide; attribute float aT; attribute float aA; attribute float aOr; uniform float uW;
      varying float vA; varying float vT; varying float vS; varying float vOr;
      void main(){
        vec4 h = viewMatrix*vec4(aHead,1.); vec4 q = viewMatrix*vec4(aTail,1.); vec4 p = mix(h, q, aT);
        vec2 d = q.xy - h.xy; float l = length(d); d = l > 1e-4 ? d/l : vec2(1.,0.);
        p.xy += vec2(-d.y, d.x) * aSide * uW * (1. - aT*.85);
        vA = aA; vT = aT; vS = aSide; vOr = aOr; gl_Position = projectionMatrix*p; }`,
    fragmentShader: `uniform vec3 uTint; uniform vec3 uOr; varying float vA; varying float vT; varying float vS; varying float vOr;
      void main(){ float a = vA * pow(1. - vT, 2.) * smoothstep(0., .7, 1. - abs(vS));
        gl_FragColor = vec4(mix(mix(vec3(1.), vec3(1., .88, .62), vOr), mix(uTint, uOr, vOr), vT) * 1.8, a); }`,
  });
  const mesh = new THREE.Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = 6; scene.add(mesh);

  const vies = Array.from({ length: N }, () => ({ vivant: false, age: 0, vie: 1, tete: new THREE.Vector3(), vit: new THREE.Vector3(), long: 10, or: 0 }));
  const _d = new THREE.Vector3(), _r = new THREE.Vector3(), _h = new THREE.Vector3(), _q = new THREE.Vector3();
  let attente = 1.5;

  function lancer(v, sensP, aP) {
    camera.updateMatrixWorld();
    _d.set(Math.random() * 1.7 - .85, Math.random() * .9 + .05, .5).unproject(camera).sub(camera.position).normalize();
    v.tete.copy(camera.position).addScaledVector(_d, 70 + Math.random() * 90);
    _r.setFromMatrixColumn(camera.matrixWorld, 0); _h.setFromMatrixColumn(camera.matrixWorld, 1);
    const sens = sensP ?? (Math.random() < .5 ? -1 : 1), a = aP ?? .35 + Math.random() * .5, vitesse = 30 + Math.random() * 30;
    v.vit.copy(_r).multiplyScalar(Math.cos(a) * sens).addScaledVector(_h, -Math.sin(a)).multiplyScalar(vitesse);
    v.long = vitesse * (.25 + Math.random() * .12); v.vie = .8 + Math.random() * .6; v.age = 0; v.vivant = true;
    v.or = or && Math.random() < partOr ? 1 : 0;
  }
  let file = 0, prochaine = 0, sensPluie = 1, aPluie = .5;
  function pluie(n = 12) { file = n; prochaine = 0; sensPluie = Math.random() < .5 ? -1 : 1; aPluie = .4 + Math.random() * .35; }
  function update(dt, frequence) {
    attente -= dt;
    if (file > 0 && (prochaine -= dt) <= 0) {         // pluie de météores : une averse, toutes dans le même sens
      const libre = vies.find(v => !v.vivant); if (libre) { lancer(libre, sensPluie, aPluie + (Math.random() - .5) * .1); file--; }
      prochaine = .12 + Math.random() * .32;
    }
    if (frequence > 0 && attente <= 0) {
      const libre = vies.find(v => !v.vivant); if (libre) { lancer(libre); if (Math.random() < .18) { const l2 = vies.find(v => !v.vivant); if (l2) lancer(l2); } }
      attente = (2.2 + Math.random() * 5) / frequence;
    }
    vies.forEach((v, m) => {
      let a = 0;
      if (v.vivant) { v.age += dt; v.tete.addScaledVector(v.vit, dt); if (v.age >= v.vie) v.vivant = false; else a = Math.min(1, v.age / .1) * Math.pow(1 - v.age / v.vie, .7); }
      _q.copy(v.vit).normalize().multiplyScalar(-v.long).add(v.tete);
      for (let k = 0; k < 4; k++) {
        const i = m * 4 + k; tete.set([v.tete.x, v.tete.y, v.tete.z], i * 3); queue.set([_q.x, _q.y, _q.z], i * 3); al[i] = a; dore[i] = v.or;
      }
    });
    g.attributes.aHead.needsUpdate = g.attributes.aTail.needsUpdate = g.attributes.aA.needsUpdate = g.attributes.aOr.needsUpdate = true;
  }
  function regler(clair, melange, encre) {
    material.blending = melange; material.needsUpdate = true;
    material.uniforms.uTint.value.set(clair ? encre : '#b3d9ff'); material.uniforms.uOr.value.set(clair ? '#b07a1c' : '#ffc85a');   // papier : un or ocre, lisible
  }
  // objet « Filantes dorées » : une part des départs est dorée (la fréquence est réglée par l'appelant) ; au changement, celles en vol suivent aussi
  let or = false, partOr = 1;
  function dorees(on, part = 1) { on = !!on; if (on !== or || part !== partOr) vies.forEach(v => { if (v.vivant) v.or = on && Math.random() < part ? 1 : 0; }); or = on; partOr = part; }
  function rafale(n) { for (let k = 0; k < n; k++) { const libre = vies.find(v => !v.vivant); if (libre) lancer(libre); } }
  const vives = () => vies.filter(v => v.vivant).map(v => v.tete);
  const _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3();
  function proche(x, y, r = 80) {                     // v57 : on touche une filante (sur sa tête ou le long de sa queue)
    let best = -1, d0 = r * r; const W = innerWidth, H = innerHeight;
    vies.forEach((v, i) => { if (!v.vivant) return;
      _s1.copy(v.tete).project(camera); _s2.copy(v.vit).normalize().multiplyScalar(-v.long).add(v.tete).project(camera); if (_s1.z > 1 || _s2.z > 1) return;
      const ax = (_s1.x + 1) / 2 * W, ay = (1 - _s1.y) / 2 * H, dx = (_s2.x + 1) / 2 * W - ax, dy = (1 - _s2.y) / 2 * H - ay, l2 = dx * dx + dy * dy;
      const k = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0, ex = ax + dx * k - x, ey = ay + dy * k - y, d = ex * ex + ey * ey;
      if (d < d0) { d0 = d; best = i; } });
    return best;
  }
  function attraper(i) { const v = vies[i]; if (!v || !v.vivant) return null; v.vivant = false; return v.tete.clone(); }
  return { update, regler, rafale, pluie, vives, dorees, proche, attraper };
}

// Poussière cosmique : points qui dérivent lentement autour de la galaxie (mouvement calculé sur le GPU).
export function creerPoussiere(scene, pr, N = 900) {
  const pos = new Float32Array(N * 3), ph = new Float32Array(N), tai = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - .5) * 120, (Math.random() - .5) * 70, (Math.random() - .5) * 120], i * 3);
    ph[i] = Math.random(); tai[i] = .5 + Math.random() * 1.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aP', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aS', new THREE.BufferAttribute(tai, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uPR: { value: pr }, uCol: { value: new THREE.Color('#dfe8ff') }, uAmp: { value: 1 }, uAlpha: { value: .7 }, uDerive: { value: 0 } },
    vertexShader: `attribute float aP; attribute float aS; uniform float uT; uniform float uPR; uniform float uAmp; uniform float uAlpha; uniform float uDerive; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uT*.06 + aP*6.28), cos(uT*.045 + aP*9.), sin(uT*.05 + aP*4.)) * 3.5 * uAmp;
        p.x = mod(p.x + uDerive*(.7 + .6*aP) + 60., 120.) - 60.;                 // le voile traverse lentement le ciel, et revient par l'autre bord
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = aS*uPR*(58./max(1., -mv.z)); vA = (.1 + .9*(.5 + .5*sin(uT*.6 + aP*30.))) * uAlpha * smoothstep(60., 46., abs(p.x)); }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(uCol, vA*(1. - d*2.)*.95); }`,
  });
  const pts = new THREE.Points(g, material); pts.frustumCulled = false; pts.renderOrder = 2; scene.add(pts);
  let alpha = .7, pres = 0, tPrec = null;
  return {
    // la poussière n'existe que tout près : vue de loin, sa boîte ressemblait à une petite nébuleuse isolée
    // presence : 1 quand l'objet « Poussière d'étoiles » est possédé et allumé (fondu doux dans les deux sens, réglé sur le temps et non sur les images)
    update(t, anim, centre, dist = 0, presence = 1) {
      const dt = tPrec === null ? 0 : Math.min(.1, Math.max(0, t - tPrec)); tPrec = t;
      material.uniforms.uT.value = t; material.uniforms.uAmp.value = anim; material.uniforms.uDerive.value += dt * 1.1 * anim; if (centre) pts.position.copy(centre);
      pres += (presence - pres) * Math.min(1, dt * 2.2); if (!presence && pres < .01) pres = 0;
      const loin = Math.min(1, Math.max(0, (240 - dist) / 130)) * pres; material.uniforms.uAlpha.value = alpha * loin; pts.visible = loin > .005; },
    regler(clair, melange, couleur) { material.blending = melange; material.needsUpdate = true; material.uniforms.uCol.value.set(couleur); alpha = clair ? .5 : .7; },
  };
}
