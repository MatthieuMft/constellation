// Décor : les planètes qu'on a fait entrer dans son ciel (boutique, « Ton ciel » › Astres). Elles y restent tant qu'elles sont allumées.
// Accrochées très loin, comme la lune : à chaque rendu, elles se replacent autour de la caméra (une toile de fond, jamais traversée),
// à des directions fixes du ciel qu'on regarde à l'arrivée (voir dansLeCiel dans evenements.js) ; elles dérivent et tournent à peine.
//
// API :
//   const decor = creerDecor({ scene, camera });
//   decor.regler({ planetes, clair, direct = false })
//       planetes : clés possédées et allumées, parmi 'planete-anneaux', 'planete-bleue', 'planete-rouge' ; clair : ciel papier.
//       À chaque changement (achat, interrupteur, thème). Une planète qui arrive apparaît en ~2,6 s (fondu, léger grossissement, éclat
//       de lumière) ; une qui part s'efface en ~1,4 s. direct : true = tout de suite, sans animation.
//   decor.update(dt, anim)       à chaque image ; anim = R.animation (0 : rotation et dérive s'arrêtent, les planètes restent).
//   decor.apparaitre(cle)        rejoue l'apparition d'une planète allumée (par ex. en refermant la boutique, pour la montrer).
//   decor.direction(cle, v?)     Vector3 unitaire, de la caméra vers la planète (pour tourner la vue vers elle).
//   decor.PLANETES               les clés connues.
// Dessin : un panneau face à la caméra ; la sphère éclairée est calculée dans le shader (bandes, nuages, tempête, anneaux qui passent
// derrière elle, ombres portées) avec un bord adouci et un léger halo. renderOrder -6 : après le dégradé du ciel (-10), avant le
// volume des nébuleuses (-5) et toutes les étoiles. Ciel papier : un lavis d'aquarelle et d'encre, sans aplat ni contour.
import * as THREE from 'three';
import { dansLeCiel, etalement } from './evenements.js';

const ease = k => k * k * (3 - 2 * k), sortie = k => 1 - Math.pow(1 - k, 3);
const DIST = 800;                                  // assez loin pour rester derrière tout, assez près pour la précision

// ax, ay : angles (degrés) dans le ciel d'arrivée ; ang : rayon apparent (degrés) ; K : demi-côté du panneau en rayons de planète ;
// incl : inclinaison à l'écran ; ouv : ouverture de l'axe vers nous (anneaux vus de trois quarts) ; rot : vitesse de rotation (rad/s)
const PLANETES = {
  'planete-anneaux': { type: 0, ax: 5.5, ay: 7.5, ang: 2.3, K: 2.5, incl: -.4, ouv: .3, rot: .012, expo: .42, teinte: [1, .8, .5] },
  'planete-bleue':   { type: 1, ax: -7.5, ay: -3, ang: 2, K: 1.35, incl: .3, ouv: .22, rot: .01, expo: .44, teinte: [.45, .7, 1] },
  'planete-rouge':   { type: 2, ax: 3.5, ay: -23.5, ang: 8.5, K: 1.25, incl: .1, ouv: .14, rot: .006, expo: .34, teinte: [1, .5, .28] },     // la plus grande, la plus discrète
};

const VERT = `uniform float uSize; varying vec2 vUv;
  void main(){ vUv = position.xy*2.; vec4 mv = modelViewMatrix*vec4(0.,0.,0.,1.); mv.xy += position.xy*uSize; gl_Position = projectionMatrix*mv; }`;

const FRAG = `uniform float uA; uniform float uT; uniform float uRot; uniform float uClair; uniform float uEclat; uniform float uK; uniform float uExpo;
  uniform float uIncl; uniform float uOuv; uniform vec3 uL; uniform vec3 uTeinte; uniform vec3 uEncre; varying vec2 vUv;
  float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)))*43758.5453); }
  float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float f3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a*n3(p); p = p*2.03 + vec3(1.7, 9.2, 4.1); a *= .5; } return s; }
  vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x + s*v.y, -s*v.x + c*v.y); }
  vec4 sur(vec4 dst, vec3 c, float a){ return vec4(c*a + dst.rgb*(1. - a), a + dst.a*(1. - a)); }       // « par-dessus », prémultiplié
  // densité des anneaux selon le rayon (en rayons de planète) : anneau intérieur pâle, division sombre, fines stries
  float anneau(float rr){
    float d = smoothstep(1.34, 1.42, rr)*smoothstep(2.32, 2.2, rr);
    d *= .62 + .24*sin(rr*37.) + .14*sin(rr*93. + 1.);
    d *= 1. - .8*smoothstep(.045, .0, abs(rr - 1.9));
    d *= mix(.45, 1., smoothstep(1.42, 1.72, rr));
    return clamp(d, 0., 1.);
  }
  void main(){
    vec2 p = vUv*uK; float r = length(p), fw = max(fwidth(r), 1e-3);
    vec2 q = rot2(p, uIncl);                                                  // repère incliné de la planète
    float co = sqrt(1. - uOuv*uOuv);
    vec3 Nr = vec3(0., co, uOuv), E3 = vec3(0., -uOuv, co);                    // axe de rotation (normale des anneaux) et troisième axe
    vec3 L = normalize(vec3(rot2(uL.xy, uIncl), uL.z));
    bool clair = uClair > .5;
    vec4 acc = vec4(0.);
    float lumCote = smoothstep(-.7, .7, dot(normalize(q + 1e-4), normalize(L.xy + 1e-4)));      // côté éclairé du limbe

    // anneaux : la moitié arrière d'abord (cachée par la planète)
    float qy = q.y/uOuv, rr = length(vec2(q.x, qy)), dA = TYPE == 0 ? anneau(rr) : 0.;
    float zr = -qy*co;                                                         // > 0 : moitié avant de l'anneau
    vec3 cAn = vec3(0.); float aAn = 0.;
    if (dA > .001) {
      vec3 P = vec3(q.x, q.y, zr); float tl = dot(P, L);
      float ombre = tl < 0. ? 1. - smoothstep(.93, 1.05, length(P - tl*L)) : 0.;   // l'ombre de la planète sur les anneaux
      float lum = (.5 + .5*abs(dot(L, Nr)))*(1. - .88*ombre);
      cAn = mix(vec3(.84, .62, .36), vec3(1., .9, .68), smoothstep(1.5, 2.15, rr))*lum*uExpo;
      aAn = dA*.82;
      if (clair) { cAn = mix(mix(vec3(.4, .24, .09), uEncre, .25), uEncre, .3*ombre); aAn = dA*.4; }
      if (zr <= 0.) acc = sur(acc, cAn, aAn*smoothstep(1. - fw, 1. + fw*2., r));
    }

    // la planète
    if (r < 1. + fw) {
      vec3 n = vec3(q, sqrt(max(0., 1. - r*r)));
      float X = n.x, Y = dot(n, Nr), Z = dot(n, E3);                           // repère propre : Y = latitude
      float dif = dot(n, L), jour = smoothstep(-.2, .6, dif), ld = .62 + .38*pow(n.z, .5);
      vec3 c; vec3 extra = vec3(0.);
      float ang = uRot*(TYPE == 2 ? 1. + .45*sin(Y*7.3) : 1.);                  // la géante tourne plus vite à l'équateur
      vec3 sp = vec3(X*cos(ang) + Z*sin(ang), Y, -X*sin(ang) + Z*cos(ang));
      if (TYPE == 0) {                                                         // bandes de sable et d'or
        float w = f3(sp*vec3(2.2, 8., 2.2) + 3.);
        float y = Y + (w - .5)*.08;
        float b1 = .5 + .5*sin(y*26.), b2 = .5 + .5*sin(y*10. + 1.3), b3 = .5 + .5*sin(y*55. + w*3.);
        c = mix(vec3(.82, .56, .25), vec3(1., .87, .6), b2);
        c = mix(c, vec3(.64, .37, .15), smoothstep(.62, 1., b1)*.5);
        c *= .93 + .12*b3;
        c = mix(c, vec3(.88, .76, .56), smoothstep(.72, .96, abs(Y))*.55);
        float t = -dot(n, Nr)/dot(L, Nr);                                      // l'ombre des anneaux sur la planète
        if (t > 0.) jour *= 1. - .7*anneau(length(n + t*L));
        extra = vec3(1., .82, .55)*pow(1. - n.z, 3.)*.3*jour;
      } else if (TYPE == 1) {                                                  // océan, nuages qui tournent en spirale
        float pr = f3(sp*2.2 + 4.);
        c = mix(vec3(.02, .1, .3), vec3(.05, .3, .58), smoothstep(.3, .72, pr));
        c = mix(c, vec3(.08, .5, .62), smoothstep(.6, .78, f3(sp*4.5 + 1.))*.4);
        float an = uRot*.7 + 1.;
        vec3 cp = vec3(X*cos(an) + Z*sin(an), Y, -X*sin(an) + Z*cos(an));
        vec3 wq = cp*vec3(1.7, 3.6, 1.7) + (vec3(f3(cp*3.1), f3(cp*3.1 + 5.2), f3(cp*3.1 + 9.1)) - .5)*1.5;     // étirés le long des parallèles, tordus
        wq += (vec3(f3(wq*2.), f3(wq*2. + 3.3), f3(wq*2. + 7.7)) - .5)*.38;
        float nu = f3(wq*1.9) + .08*sin(Y*14. + f3(wq)*6.);
        float nuages = max(smoothstep(.52, .68, nu), smoothstep(.4, .6, nu)*.4)*(1. - .4*smoothstep(.8, 1., abs(Y)));
        nuages = max(nuages, smoothstep(.84, .96, abs(Y) + (f3(sp*6.) - .5)*.12)*.9);       // calottes
        float spec = pow(max(dot(n, normalize(L + vec3(0., 0., 1.))), 0.), 60.)*.75*(1. - nuages);
        c = mix(c, vec3(.94, .96, 1.), nuages);
        extra = vec3(1., .96, .88)*spec*jour + vec3(.3, .6, 1.)*pow(1. - n.z, 2.2)*.65*smoothstep(-.35, .5, dif);
      } else {                                                                 // géante rousse, bandes tourmentées, tempête
        float lonS = -.3 + .3*sin(uT*.004);                                   // la tempête dérive lentement, sans jamais passer derrière
        vec2 e = vec2((atan(X, Z) - lonS)*sqrt(max(0., 1. - Y*Y))/.22, (Y - .26)/.11); float de = length(e);
        float w = f3(sp*vec3(1.6, 10., 1.6) + 2.), w2 = f3(sp*vec3(4., 24., 4.));
        float y = Y + (w - .5)*.09 + (w2 - .5)*.025 + (Y - .26)*.9*exp(-de*de*.5);   // les bandes s'écartent autour d'elle
        float t1 = .5 + .5*sin(y*17.), t2 = .5 + .5*sin(y*7. + 2.), t3 = .5 + .5*sin(y*38. + 1.);
        c = mix(vec3(.55, .17, .07), vec3(.9, .45, .2), t1);
        c = mix(c, vec3(.96, .76, .54), smoothstep(.6, .95, t2)*.5);
        c = mix(c, vec3(.32, .09, .05), smoothstep(.72, 1., t3)*.4);
        c *= .9 + .2*w2;
        vec2 ep = rot2(e, de*1.3 - uT*.03);                                    // l'œil de la tempête s'enroule sur lui-même
        float sw = f3(vec3(ep*vec2(1.6, 3.), 3.));
        c = mix(c, mix(vec3(.62, .17, .08), vec3(.98, .52, .3), smoothstep(.3, .7, sw)), smoothstep(1.05, .4, de)*.9);
        c = mix(c, vec3(.96, .8, .6), smoothstep(.5, 0., abs(de - 1.15))*.14);
        extra = vec3(1., .6, .35)*pow(1. - n.z, 2.5)*.3*jour;
      }
      float bord = 1. - smoothstep(1. - fw*1.5 - .02, 1. + fw*.5, r);           // limbe adouci
      vec3 cp; float ap;
      if (clair) {                                                             // lavis : plus soutenu côté ombre, pigment qui se dépose au bord
        float lum = dot(c, vec3(.3, .59, .11));
        cp = mix(pow(c, vec3(2.2))*.85, uEncre, .06 + .24*(1. - jour));                // le pigment, en lumière linéaire (sinon il s'efface sur le papier)
        ap = (1.1 - lum)*(.48 + .42*(1. - jour))*(.8 + .4*f3(n*9. + 3.)) + .1*smoothstep(.84, 1., r);
        ap = min(ap, .78)*bord*(TYPE == 1 ? .72 : 1.);                              // l'océan, très pigmenté, reste léger
      } else {
        cp = (c*(.025 + jour)*ld + extra)*uExpo + uTeinte*uEclat*.12;
        ap = bord;
      }
      acc = sur(acc, cp, ap);
    }
    // halo : atmosphère et éclat d'apparition, par-dessus le limbe (un liseré de lumière, jamais un trait sombre) puis autour du disque
    {
      float x = r - 1., xo = max(x, 0.), xi = max(-x, 0.);
      float atm = (TYPE == 1 ? exp(-xo*30.)*.5 + exp(-xo*7.)*.06 : exp(-xo*18.)*.14 + exp(-xo*5.)*.025)*exp(-xi*(TYPE == 1 ? 22. : 30.));
      float h = (atm*(.2 + .8*lumCote) + exp(-xo*3.2 - xi*9.)*uEclat*.35)*smoothstep(uK*.98, 1. + (uK - 1.)*.45, r);   // rien au bord du panneau
      vec3 ch = (TYPE == 1 ? vec3(.38, .66, 1.) : uTeinte)*uExpo*1.3;
      if (clair) acc = sur(acc, mix(uEncre, ch*.5, .35), min(.14, h*.2));
      else acc = sur(acc, ch, min(.9, h));
    }
    // anneaux, moitié avant : par-dessus la planète
    if (dA > .001 && zr > 0.) acc = sur(acc, cAn, aAn);
    gl_FragColor = vec4(acc.rgb/max(acc.a, 1e-4), acc.a*uA);
  }`;

export function creerDecor({ scene, camera }) {
  const etats = {}, _v = new THREE.Vector3();
  let tA = 0, clair = false;
  for (const [cle, d] of Object.entries(PLANETES)) {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending, defines: { TYPE: d.type },
      uniforms: { uSize: { value: 1 }, uA: { value: 0 }, uT: { value: 0 }, uRot: { value: 0 }, uClair: { value: 0 }, uEclat: { value: 0 }, uK: { value: d.K }, uExpo: { value: d.expo },
        uIncl: { value: d.incl }, uOuv: { value: d.ouv }, uL: { value: new THREE.Vector3(-.58, .42, .7).normalize() }, uTeinte: { value: new THREE.Color(...d.teinte) },
        uEncre: { value: new THREE.Color('#1d1a2b') } },
      vertexShader: VERT, fragmentShader: FRAG,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); mesh.frustumCulled = false; mesh.renderOrder = -6; mesh.visible = false;
    const e = { d, m, mesh, voulue: false, v: 0, age: 9, phase: Math.random() * 6.28 };
    // replacée au moment même du rendu : jamais en retard d'une image sur la caméra, même pendant un vol rapide
    mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position).addScaledVector(direction(cle, _v), DIST); mesh.updateMatrixWorld(); };
    scene.add(mesh); etats[cle] = e;
  }

  function direction(cle, v = new THREE.Vector3()) {
    const e = etats[cle]; if (!e) return v.set(0, 0, -1);
    const k = etalement(camera), ph = e.phase;
    return dansLeCiel(e.d.ax * k + Math.sin(tA * .011 + ph) * .7, e.d.ay + Math.cos(tA * .008 + ph) * .45, v);        // dérive très lente
  }

  return {
    PLANETES: Object.keys(PLANETES),
    direction,
    regler({ planetes = [], clair: c = false, direct = false } = {}) {
      clair = !!c;
      for (const [cle, e] of Object.entries(etats)) {
        const voulue = planetes.includes(cle);
        if (voulue && !e.voulue && e.v < .05) e.age = 0;                                // elle arrive : on joue l'apparition
        e.voulue = voulue; if (direct) { e.v = voulue ? 1 : 0; e.age = 9; }
        e.m.uniforms.uClair.value = clair ? 1 : 0;
      }
    },
    apparaitre(cle) { const e = etats[cle]; if (e && e.voulue) { e.v = 0; e.age = 0; } },
    update(dt, anim = 1) {
      tA += dt * anim;
      for (const e of Object.values(etats)) {
        e.v = Math.min(1, Math.max(0, e.v + (e.voulue ? dt / 2.6 : -dt / 1.4))); e.age += dt;
        e.mesh.visible = e.v > 0; if (!e.mesh.visible) continue;
        const u = e.m.uniforms, R = DIST * Math.tan(e.d.ang * Math.PI / 180);
        u.uA.value = e.voulue ? ease(e.v) : e.v * e.v;
        u.uSize.value = 2 * e.d.K * R * (e.voulue ? .88 + .12 * sortie(e.v) : 1);
        u.uEclat.value = e.age < 3.2 ? Math.pow(Math.sin(e.age / 3.2 * Math.PI), 2) * (clair ? .5 : 1) : 0;   // un éclat de lumière à l'arrivée
        u.uT.value = tA; u.uRot.value = tA * e.d.rot;
      }
    },
  };
}
