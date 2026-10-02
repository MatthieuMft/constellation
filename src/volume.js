// Nébuleuses volumétriques : un vrai nuage de gaz, raymarché, coloré par l'humeur des étoiles qui l'entourent.
// Les étoiles sont « cuites » dans une petite texture 3D (32³) ; un shader la traverse en la modulant par du bruit fractal.
// Le calcul se fait en demi-résolution, puis une image plein écran l'ajoute à la scène.
import * as THREE from 'three';

const N = 32;

export function creerVolume(scene, camera, renderer, mobile) {
  const data = new Uint8Array(N * N * N * 4), rgb = new Float32Array(N * N * N * 3), dens = new Float32Array(N * N * N);
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType; tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping; tex.unpackAlignment = 1; tex.needsUpdate = true;
  const min = new THREE.Vector3(-30, -20, -30), max = new THREE.Vector3(30, 20, 30);

  const sceneVol = new THREE.Scene();
  const matVol = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    uniforms: { tVol: { value: tex }, uMin: { value: min }, uMax: { value: max }, uT: { value: 0 }, uGain: { value: 1 }, uClair: { value: 0 }, uSteps: { value: mobile ? 18 : 30 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `precision highp sampler3D;
      uniform sampler3D tVol; uniform vec3 uMin; uniform vec3 uMax; uniform float uT; uniform float uGain; uniform float uClair; uniform float uSteps; varying vec3 vW;
      float hash(vec3 p){ p = fract(p*.3183099 + .1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3. - 2.*f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a*noise(p); p = p*2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }
      void main(){
        vec3 ro = cameraPosition, rd = normalize(vW - ro), inv = 1./rd;
        vec3 t0 = (uMin - ro)*inv, t1 = (uMax - ro)*inv, tmin = min(t0, t1), tmax = max(t0, t1);
        float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.)), tf = min(min(tmax.x, tmax.y), tmax.z);
        if (tf <= tn) { gl_FragColor = vec4(0.); return; }
        float dt = (tf - tn)/uSteps;
        float j = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));   // décalage fin et régulier (l'ancien sin() faisait des bandes sur mobile)
        vec3 sz = uMax - uMin, col = vec3(0.); float w = 0.;
        for (int i = 0; i < 48; i++) {
          if (float(i) >= uSteps) break;
          vec3 p = ro + rd*(tn + (float(i) + j)*dt);
          vec3 q = (p - uMin)/sz;
          vec3 e = smoothstep(0., .22, q) * smoothstep(0., .22, 1. - q);          // fondu sur les bords : plus de boîte visible
          vec4 s = texture(tVol, q); s.a *= e.x*e.y*e.z;
          if (s.a < .02) continue;
          float n = fbm(p*.09 + vec3(uT*.012, uT*.008, 0.));
          float d = s.a * smoothstep(.3, .82, n) * dt * .014;
          col += s.rgb * d; w += d;
        }
        gl_FragColor = vec4(col, w);
      }`,
  });
  const boite = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matVol); boite.frustumCulled = false; sceneVol.add(boite);

  const echelle = mobile ? .35 : .5;
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const matQuad = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tVol: { value: rt.texture }, uGain: { value: 1 }, uClair: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `uniform sampler2D tVol; uniform float uGain; uniform float uClair; varying vec2 vUv;
      void main(){ vec4 s = texture2D(tVol, vUv);
        vec3 sombre = s.rgb * uGain;                                  // ciel nocturne : la lumière s'ajoute
        float a = clamp(s.a * uGain * 1.6, 0., .5); vec3 c = s.rgb / max(s.a, 1e-4) * .7;   // papier : une lavis d'aquarelle
        gl_FragColor = mix(vec4(sombre, 1.), vec4(c, a), uClair); }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matQuad); quad.frustumCulled = false; quad.renderOrder = -5; scene.add(quad);

  // « cuisson » : étoiles → densité et couleur dans la texture 3D. étoiles : [{ pos: Vector3, couleur: Color, rayon, poids }]
  function cuire(etoiles) {
    if (!etoiles.length) { quad.visible = false; return; }
    quad.visible = true;
    min.set(Infinity, Infinity, Infinity); max.set(-Infinity, -Infinity, -Infinity);
    etoiles.forEach(e => { const m = e.rayon * 2.6 + 6; min.min(e.pos.clone().subScalar(m)); max.max(e.pos.clone().addScalar(m)); });
    const sz = max.clone().sub(min), vs = sz.clone().divideScalar(N);
    rgb.fill(0); dens.fill(0);
    for (const e of etoiles) {
      const r2 = e.rayon * e.rayon, reach = e.rayon * 2.1;
      const lo = [0, 1, 2].map(k => Math.max(0, Math.floor((e.pos.getComponent(k) - reach - min.getComponent(k)) / vs.getComponent(k)))),
            hi = [0, 1, 2].map(k => Math.min(N - 1, Math.ceil((e.pos.getComponent(k) + reach - min.getComponent(k)) / vs.getComponent(k))));
      for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
        const dx = min.x + (x + .5) * vs.x - e.pos.x, dy = min.y + (y + .5) * vs.y - e.pos.y, dz = min.z + (z + .5) * vs.z - e.pos.z;
        const d = Math.exp(-(dx * dx + dy * dy + dz * dz) / r2) * e.poids; if (d < .002) continue;
        const i = (z * N + y) * N + x; dens[i] += d; rgb[i * 3] += e.couleur.r * d; rgb[i * 3 + 1] += e.couleur.g * d; rgb[i * 3 + 2] += e.couleur.b * d;
      }
    }
    for (let i = 0; i < N * N * N; i++) {
      const d = dens[i] || 1e-6;
      data[i * 4] = Math.min(255, rgb[i * 3] / d * 255); data[i * 4 + 1] = Math.min(255, rgb[i * 3 + 1] / d * 255); data[i * 4 + 2] = Math.min(255, rgb[i * 3 + 2] / d * 255);
      data[i * 4 + 3] = Math.min(1, dens[i]) * 255;
    }
    tex.needsUpdate = true;
    boite.position.copy(min).addScaledVector(sz, .5); boite.scale.copy(sz);
  }

  function rendre(t) {
    if (!quad.visible) return;
    matVol.uniforms.uT.value = t;
    const ancien = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(sceneVol, camera); renderer.setRenderTarget(ancien);
  }
  function redim(w, h, pr) { rt.setSize(Math.max(1, Math.round(w * pr * echelle)), Math.max(1, Math.round(h * pr * echelle))); }
  function regler(clair, gain) { matQuad.blending = clair ? THREE.NormalBlending : THREE.AdditiveBlending; matQuad.needsUpdate = true; matQuad.uniforms.uClair.value = clair ? 1 : 0; matQuad.uniforms.uGain.value = gain; }
  return { cuire, rendre, redim, regler, gain: g => { matQuad.uniforms.uGain.value = g; } };
}
