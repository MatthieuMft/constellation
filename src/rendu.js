// Briques de rendu : ciel dégradé, profondeur de champ, particules d'écriture.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function creerCiel() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uHaut: { value: new THREE.Color() }, uBas: { value: new THREE.Color() } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uHaut; uniform vec3 uBas; varying vec3 vD;
      void main(){ float t = smoothstep(-.35, .6, vD.y); gl_FragColor = vec4(mix(uBas, uHaut, t), 1.); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), mat);
  m.renderOrder = -10; m.frustumCulled = false; return m;
}

// Profondeur de champ : flou en disque dont le rayon dépend de l'écart à la distance de mise au point.
export function creerDOF() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, tDepth: { value: null }, uNear: { value: .1 }, uFar: { value: 2000 },
      uFocus: { value: 50 }, uAper: { value: 1 }, uMax: { value: 10 }, uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uAper; uniform float uMax; uniform vec2 uRes; varying vec2 vUv;
      float lin(float d){ float z = d*2.-1.; return 2.*uNear*uFar/(uFar+uNear - z*(uFar-uNear)); }
      void main(){
        float raw = texture2D(tDepth, vUv).x;
        float coc = raw > .99995 ? .12 : clamp(abs(lin(raw)-uFocus)/lin(raw)*uAper, 0., 1.);
        if (coc < .02 || uAper <= 0.) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
        vec4 acc = vec4(0.); float R = coc*uMax;
        for (int i = 0; i < 24; i++) {
          float fi = float(i); float r = sqrt((fi+.5)/24.)*R; float a = fi*2.39996;
          acc += textureLod(tDiffuse, vUv + vec2(cos(a), sin(a))*r/uRes, 0.);
        }
        gl_FragColor = acc/24.;
      }`,
  });
  const base = pass.render.bind(pass);
  pass.render = function (renderer, writeBuffer, readBuffer, dt, masque) {
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    base(renderer, writeBuffer, readBuffer, dt, masque);
  };
  return pass;
}

// Poussière de lumière qui s'élève quand on écrit.
export function creerParticules(scene, camera, pr) {
  const N = 1400, pos = new Float32Array(N * 3), vit = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const al = new Float32Array(N), tai = new Float32Array(N), vie = new Float32Array(N), age = new Float32Array(N).fill(99);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aC', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aA', new THREE.BufferAttribute(al, 1)); g.setAttribute('aS', new THREE.BufferAttribute(tai, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uPR: { value: pr } },
    vertexShader: `attribute vec3 aC; attribute float aA; attribute float aS; uniform float uPR; varying vec3 vC; varying float vA;
      void main(){ vC = aC; vA = aA; vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = aS*uPR*(30./-mv.z); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-.5); if (d > .5) discard; gl_FragColor = vec4(vC*1.4, smoothstep(.5, 0., d)*vA); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);

  let cur = 0; const droite = new THREE.Vector3(), haut = new THREE.Vector3(), avant = new THREE.Vector3();
  function burst(origine, couleur, n, echelle = 1, iso = false) {
    camera.updateMatrixWorld(); droite.setFromMatrixColumn(camera.matrixWorld, 0); haut.setFromMatrixColumn(camera.matrixWorld, 1); camera.getWorldDirection(avant);
    for (let k = 0; k < n; k++) {
      const i = cur++ % N, r = Math.random;
      pos[i * 3] = origine.x + (r() - .5) * .5; pos[i * 3 + 1] = origine.y + (r() - .5) * .3; pos[i * 3 + 2] = origine.z + (r() - .5) * .5;
      const h = (.6 + r() * 1.6) * echelle, d = (r() - .5) * 1.8 * echelle, a = (r() - .5) * .8 * echelle;
      if (iso) { const u = r() * 6.2832, c = r() * 2 - 1, s = Math.sqrt(1 - c * c), sp = (2 + r() * 5) * echelle / 2.2; vit[i * 3] = Math.cos(u) * s * sp; vit[i * 3 + 1] = c * sp; vit[i * 3 + 2] = Math.sin(u) * s * sp; }
      else { vit[i * 3] = haut.x * h + droite.x * d + avant.x * a; vit[i * 3 + 1] = haut.y * h + droite.y * d + avant.y * a; vit[i * 3 + 2] = haut.z * h + droite.z * d + avant.z * a; }
      col.set([couleur.r, couleur.g, couleur.b], i * 3); tai[i] = (2.5 + r() * 5) * (echelle < 1 ? .7 : 1); vie[i] = 1.4 + r() * 1.8; age[i] = 0;
    }
  }
  function update(dt) {
    for (let i = 0; i < N; i++) {
      if (age[i] >= vie[i]) { al[i] = 0; continue; }
      age[i] += dt; const f = 1 - .9 * dt;
      vit[i * 3] *= f; vit[i * 3 + 1] *= f; vit[i * 3 + 2] *= f;
      pos[i * 3] += vit[i * 3] * dt; pos[i * 3 + 1] += vit[i * 3 + 1] * dt; pos[i * 3 + 2] += vit[i * 3 + 2] * dt;
      al[i] = Math.pow(Math.max(0, 1 - age[i] / vie[i]), 1.5);
    }
    g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true; g.attributes.aC.needsUpdate = true; g.attributes.aS.needsUpdate = true;
  }
  return { burst, update, material: mat };
}
