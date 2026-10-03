// Décor : tes planètes dans le ciel (v40 : de vraies planètes 3D, achetées et personnalisées, voir planetes.js).
// Accrochées très loin, comme la lune : à chaque rendu, elles se replacent autour de la caméra (une toile de fond, jamais traversée),
// à six places fixes du ciel qu'on regarde à l'arrivée (voir dansLeCiel dans evenements.js) ; elles dérivent et tournent doucement.
//
// API :
//   const decor = creerDecor({ scene, camera, renderer });
//   decor.regler({ planetes, clair, direct = false })
//       planetes : planetes.visibles() (les allumées, telles qu'elles se dessinent, avec leur place) ; clair : ciel papier.
//       À chaque changement (achat, personnalisation, thème). Une planète qui arrive apparaît en ~2,6 s (fondu, léger grossissement,
//       éclat de lumière) ; une qui part s'efface en ~1,4 s ; une planète modifiée est reconstruite sur place. direct : sans animation.
//   decor.update(dt, anim)       à chaque image, avant le rendu du ciel ; anim = R.animation (0 : rotation et dérive s'arrêtent).
//   decor.apparaitre(id)         rejoue l'apparition d'une planète allumée (pour la montrer).
//   decor.direction(id, v?)      Vector3 unitaire, de la caméra vers la planète (pour tourner la vue vers elle).
// Dessin : chaque planète est rendue en 3D dans sa propre petite image (une cible de rendu, une image sur deux), puis posée sur un
// panneau face à la caméra. renderOrder -6 : après le dégradé du ciel (-10), avant le volume des nébuleuses (-5) et les étoiles.
// Ciel papier : la planète devient un lavis plus discret, sans les lueurs.
import * as THREE from 'three';
import { dansLeCiel, etalement } from './evenements.js';
import { construire, tourner, liberer } from './planetes.js';

const ease = k => k * k * (3 - 2 * k), sortie = k => 1 - Math.pow(1 - k, 3);
const DIST = 800;                                  // assez loin pour rester derrière tout, assez près pour la précision
// les six places : angles (degrés) dans le ciel d'arrivée, et rayon apparent de la planète (degrés). Les trois premières sont celles des anciennes planètes.
const PLACES = [{ ax: 5.5, ay: 7.5, ang: 2.3 }, { ax: -7.5, ay: -3, ang: 2 }, { ax: 3.5, ay: -23.5, ang: 6 },
  { ax: -16, ay: 13, ang: 1.5 }, { ax: 17, ay: -9, ang: 1.7 }, { ax: -4, ay: 20, ang: 1.3 }];
const FOV = 30, ELEV = .143;                       // la caméra de chaque planète (la même que pour les photos)

const VERT = `uniform float uSize; varying vec2 vUv;
  void main(){ vUv = position.xy*2.; vec4 mv = modelViewMatrix*vec4(0.,0.,0.,1.); mv.xy += position.xy*uSize; gl_Position = projectionMatrix*mv; }`;
const FRAG = `#define EXPO .42
  uniform sampler2D uTex; uniform float uA, uEclat, uClair, uK; uniform vec3 uTeinte, uEncre; varying vec2 vUv;
  void main(){
    vec4 c = texture2D(uTex, vUv*.5 + .5);
    float bord = smoothstep(1., .9, max(abs(vUv.x), abs(vUv.y)));
    if (uClair > .5) { float a = max(c.a, min(.8, dot(c.rgb, vec3(.3, .59, .11))*2.2*(1. - c.a)))*.7;   // les anneaux (pure lumière) deviennent un trait d'encre léger
      vec3 col = mix(min(c.rgb/max(c.a, .05), vec3(1.)), uEncre, .3 + .45*(1. - c.a)); gl_FragColor = vec4(col*a, a)*uA*bord; return; }
    float r = length(vUv)*uK*1.04;
    vec3 col = c.rgb + uTeinte*uEclat*.35*exp(-max(r - 1., 0.)*3.2)*smoothstep(.6, 1., r);   // un éclat de lumière à l'arrivée
    gl_FragColor = vec4(col*EXPO, c.a)*uA*bord;          // le ciel est éclairé plus fort que l'étude (lueurs, bloom) : on retient la lumière
  }`;

const hache = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 100000; return h / 100000 * 6.283; };

export function creerDecor({ scene, camera, renderer }) {
  const etats = new Map(), _v = new THREE.Vector3(), _cc = new THREE.Color();
  let tA = 0, clair = false, image = 0;

  function creer(p) {
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(FOV, 1, .1, 100);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uTex: { value: null }, uSize: { value: 1 }, uA: { value: 0 }, uEclat: { value: 0 }, uClair: { value: 0 }, uK: { value: 1.5 }, uTeinte: { value: new THREE.Color() }, uEncre: { value: new THREE.Color('#1d1a2b') } },
      vertexShader: VERT, fragmentShader: FRAG });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); mesh.frustumCulled = false; mesh.renderOrder = -6; mesh.visible = false;
    const e = { id: p.id, sc, cam, m, mesh, rt: null, taille: 0, voulue: false, v: 0, age: 9, phase: hache(p.id), cle: '', groupe: null, K: 1.5, place: 0, sale: true };
    mesh.onBeforeRender = (r, s, c) => { mesh.position.copy(c.position).addScaledVector(direction(e.id, _v), DIST); mesh.updateMatrixWorld(); };
    scene.add(mesh); etats.set(p.id, e); return e;
  }
  function batir(e, p) {                               // (re)construit la planète 3D quand elle change
    const cle = JSON.stringify(p); if (cle === e.cle) return; e.cle = cle;
    if (e.groupe) { e.sc.remove(e.groupe); liberer(e.groupe); }
    const { groupe, K, atmo } = construire(p, { detail: 40 }); e.groupe = groupe; e.K = K; e.place = p.place; e.sc.add(groupe);
    const d = K * 1.04 / Math.tan(FOV / 2 * Math.PI / 180); e.cam.position.set(0, d * ELEV, d); e.cam.lookAt(0, 0, 0);
    e.m.uniforms.uK.value = K; e.m.uniforms.uTeinte.value.set(atmo); e.sale = true;
  }
  const rayon = e => DIST * Math.tan((PLACES[e.place] || PLACES[0]).ang * Math.PI / 180);
  function cible(e) {                                  // la taille de l'image suit la taille de la planète à l'écran
    const h = renderer.domElement.height, rpx = Math.tan((PLACES[e.place] || PLACES[0]).ang * Math.PI / 180) / Math.tan(camera.fov * Math.PI / 360) * h / 2;
    const s = Math.min(512, Math.max(64, Math.ceil(2 * e.K * 1.04 * rpx * 1.3 / 16) * 16));
    if (e.rt && Math.abs(s - e.taille) / e.taille < .25) return;
    if (e.rt) e.rt.dispose();
    e.rt = new THREE.WebGLRenderTarget(s, s, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    e.taille = s; e.m.uniforms.uTex.value = e.rt.texture; e.sale = true;
  }
  function peindre(e) {
    const av = renderer.getRenderTarget(), ca = renderer.getClearAlpha(), ac = renderer.autoClear; renderer.getClearColor(_cc);
    renderer.setRenderTarget(e.rt); renderer.setClearColor(0x000000, 0); renderer.autoClear = true; renderer.render(e.sc, e.cam);
    renderer.setRenderTarget(av); renderer.setClearColor(_cc, ca); renderer.autoClear = ac; e.sale = false;
  }

  function direction(id, v = new THREE.Vector3()) {
    const e = etats.get(id); if (!e) return v.set(0, 0, -1);
    const P = PLACES[e.place] || PLACES[0], k = etalement(camera), ph = e.phase;
    return dansLeCiel(P.ax * k + Math.sin(tA * .011 + ph) * .7, P.ay + Math.cos(tA * .008 + ph) * .45, v);        // dérive très lente
  }

  return {
    direction,
    regler({ planetes = [], clair: c = false, direct = false } = {}) {
      clair = !!c;
      const ids = new Set(planetes.map(p => p.id));
      for (const p of planetes) {
        const e = etats.get(p.id) || creer(p);
        batir(e, p);
        if (!e.voulue && e.v < .05) e.age = 0;                                         // elle arrive : on joue l'apparition
        e.voulue = true;
      }
      for (const e of etats.values()) {
        if (!ids.has(e.id)) e.voulue = false;
        if (direct) { e.v = e.voulue ? 1 : 0; e.age = 9; }
        e.m.uniforms.uClair.value = clair ? 1 : 0;
      }
    },
    apparaitre(id) { const e = etats.get(id); if (e && e.voulue) { e.v = 0; e.age = 0; } },
    update(dt, anim = 1) {
      tA += dt * anim; image++;
      let i = 0;
      for (const e of etats.values()) {
        e.v = Math.min(1, Math.max(0, e.v + (e.voulue ? dt / 2.6 : -dt / 1.4))); e.age += dt;
        e.mesh.visible = e.v > 0 && !!e.groupe; i++;
        if (!e.mesh.visible) continue;
        cible(e);
        if (anim > 0 || e.sale) { tourner(e.groupe, tA + e.phase * 20); if (e.sale || (image + i) % 2 === 0) peindre(e); }   // une image sur deux : elles tournent lentement
        const u = e.m.uniforms;
        u.uA.value = e.voulue ? ease(e.v) : e.v * e.v;
        u.uSize.value = 2 * e.K * 1.04 * rayon(e) * (e.voulue ? .88 + .12 * sortie(e.v) : 1);
        u.uEclat.value = e.age < 3.2 ? Math.pow(Math.sin(e.age / 3.2 * Math.PI), 2) * (clair ? 0 : 1) : 0;
      }
    },
  };
}
