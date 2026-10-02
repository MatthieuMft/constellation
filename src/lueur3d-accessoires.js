// Lueur 3D — accessoires : 1 anneau, 2 antenne, 3 lunettes, 4 couronne d'étoiles, 5 chapeau de magicien (couleur : U.uAccCol = accCouleur).
// N'importe rien (pas même three : tout arrive par ctx) ; lueur3d.js l'importe et crée chaque accessoire UNE fois, au chargement, invisible.
//
// ═══ CONTRAT (recopié de lueur3d.js, qui fait foi ; lisez son en-tête pour le détail de ctx, U, GLSL, ORDRE) ═══
// ACCESSOIRES[n] = { nom, creer(ctx) → inst }   (n = valeur de perso.acc : 1..5)
//   inst = { objet: THREE.Object3D, maj?(dt, t, etat, presence), placer?(ctx), encombrement?: { haut, bas, cote }, liberer?() }
//   - objet : ajouté au pivot du corps (repère du corps : rayon ≈ 1, +Z = visage, +Y = haut) ; il suit l'écrasement et le penché.
//   - presence 0..1 (porté / retiré, lissé) ; objet.visible est géré par lueur3d.js. Servez-vous de presence pour un fondu (uOpacite) ou une pousse (échelle).
//   - placer(ctx) : à la création et à chaque changement de silhouette. Placez-vous UNIQUEMENT avec ctx.forme et ctx.visage :
//       ctx.forme.reperes.haut (dessus de la tête, là où se pose un chapeau) · .sommet (point le plus haut : au-dessus des oreilles) · .bas · .gauche · .droite
//       · .avant · .arriere · .cou ; ctx.forme.surface(dx,dy,dz,out) · normale(x,y,z,out) · avant(x,y) · toucher(o…, d…, out) · rayon(y, angle) ;
//       ctx.visage.point(qx, qy, out) (coordonnées du visage v11) · ctx.visage.oeil(s, out) (s = -1 / 1).
//   - maj : aucune allocation (pré-allouez vos Vector3 / Color dans creer) ; temps : U.uT.value ou t.
//   - encombrement : en unités du corps (haut du chapeau, de l'antenne…) ; sert à placer la bulle de dialogue.
// Matériaux : ctx.materiaux.lumiere({ couleur: ctx.U.uAccCol, opacite, eclat, lisere, voile, douceur, cote }) — un objet de lumière dans le style
//   de la lueur (modelé doux, liseré, voilé par le gaz quand il passe derrière, mode clair, apparition, sortie encodée en pré-multiplié, bords adoucis).
//   Ou un ShaderMaterial à vous : alors transparent: true, depthTest: true, blending pré-multiplié (One, OneMinusSrcAlpha), sortie versSortie(c)*a,
//   multipliez par uApp, incluez GLSL.prelude + GLSL.formes + GLSL.voile + GLSL.sortie et utilisez transmission(pCorps) ; ou ctx.materiaux.voiler(m)
//   sur un MeshBasicMaterial. AUCUNE lumière de scène (MeshStandardMaterial serait noir). Pas de texture canvas 8 bits pour un dégradé de lumière.
//   ctx.preparer(objet) : renderOrder = ORDRE.parties, transparent, frustumCulled = false sur tout le sous-arbre (à appeler sur votre objet).
// Rendu : dessiné après le gaz et le visage, testé en profondeur contre le masque du corps (la moitié arrière d'un anneau disparaît derrière la tête).
//   Pas de MSAA dans le site : évitez les arêtes fines dures (douceur, liseré). Lisible à 100-150 px de diamètre du corps.
// Variantes compilées une seule fois : changer d'accessoire ou de couleur ne doit rien recompiler (couleur par uniform, pas de define).
//
// ═══ CE FICHIER ═══
// Deux ShaderMaterial à nous (compilés une fois, partagés par tous les accessoires ; réglages par uniforms) :
//   « objet » : le modelé de ctx.materiaux.lumiere (même formule, voile du gaz, papier, apparition, pré-multiplié) + dégradé vertical (uGrad),
//               cœur blanc chaud (uBlanc : étoiles-lanternes), étincelles peintes (uMotif : chapeau), verre (uVerre : verres des lunettes).
//   « lueur »  : rayonnement en cloche calculé en flottant (jamais de texture) : panneau face caméra (étoiles) ou coque autour d'un tube (anneau) ;
//               voilé par le gaz (transmission au centre), additif sur la nuit, aura colorée sur papier.
// Placement (placer) : uniquement ctx.forme (repères, sd, toucher, normale, surface) et ctx.visage (oeil) ; libre() mesure la place entre les
//   oreilles (chat) pour réduire le chapeau ou relever la couronne ; assise() pose le bord du chapeau sur la tête (rayons vers le bas).
// Hauteur du haut de l'accessoire au-dessus du centre (encombrement.haut, unités du corps, mesurée ; recalculée à chaque silhouette) :
//            corps  anneau  antenne  couronne  chapeau      (lunettes : rien au-dessus du corps)
//   rond     0.95   1.39    1.73     1.59      1.86
//   chat     1.22   1.65    1.73     1.67      1.70         (anneau au-dessus des oreilles ; couronne entre leurs pointes ; chapeau réduit entre elles)
//   fantome  0.96   1.40    1.74     1.60      1.85
//   coeur    0.84   1.28    1.45     1.31      1.52         (antenne, couronne, chapeau dans le creux entre les lobes)
//   etoile   1.16   1.60    1.94     1.80      1.84         (sur la branche du haut ; le chapeau la coiffe)
//   → la bulle : lueur.encombrement().haut × rayon à l'écran (compté par lueur3d.js quand presence > .5).
// Pousse : presence → fondu (uPres) + échelle .7 → 1 (sauf lunettes : fondu seul).

const TAU = Math.PI * 2;

// étincelles peintes sur le chapeau : [angle autour de l'axe (0 = devant), hauteur (0 bord → 1 pointe), taille, force]
const ETOILES_CHAPEAU = [[0, .56, .1, 1], [1.3, .3, .055, .85], [-1.35, .4, .05, .8], [2.45, .52, .048, .7], [-2.55, .24, .055, .75], [3.05, .7, .04, .6], [-.62, .17, .045, .65], [.72, .76, .035, .6]];

let SRC = null;   // sources construites une fois : même texte → même programme pour toutes les instances
function sources(GLSL) {
  if (SRC) return SRC;
  const f = x => x.toFixed(3);
  const objetV = `uniform mat4 uInvL; varying vec3 vN; varying vec3 vV; varying vec3 vLoc; varying vec3 vO; varying vec2 vUv;
  void main(){ vec4 w = modelMatrix*vec4(position, 1.); vLoc = (uInvL*w).xyz; vO = position; vUv = uv; vec4 mv = viewMatrix*w; vN = normalMatrix*normal; vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
  const objetF = `uniform vec3 uCouleur; uniform float uOpacite, uPres, uEclat, uLisere, uDouceur, uBlanc, uMotif, uVerre; uniform vec4 uGrad; uniform vec2 uFondu;
  varying vec3 vN; varying vec3 vV; varying vec3 vLoc; varying vec3 vO; varying vec2 vUv;
  ${GLSL.prelude} ${GLSL.formes} ${GLSL.voile} ${GLSL.sortie}
  float accAngle(float a){ return mod(a + 3.14159265, 6.2831853) - 3.14159265; }
  float accEtincelle(vec2 q, float s){ vec2 e = abs(q)/s; return smoothstep(1., 0., e.x + e.y*3.) + smoothstep(1., 0., e.y + e.x*3.) + exp(-dot(e, e)*6.)*.7; }
  void main(){
    vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n;
    float cv = clamp(dot(n, v), 0., 1.), haut = clamp(n.y*.5 + .5, 0., 1.), lat = clamp(dot(n, vec3(-.52, .5, .69))*.5 + .5, 0., 1.);   // + lumière douce d'en haut à gauche : du volume
    vec3 col = uCouleur*mix(uGrad.z, uGrad.w, smoothstep(uGrad.x, uGrad.y, vO.y));                    // dégradé (chapeau : sombre au bord, vif en haut)
    vec3 c = col*(.5 + .3*haut + .32*lat)*(.8 + .25*cv)*uEclat + mix(uCouleur, vec3(1.), .55)*pow(1. - cv, 2.2)*uLisere*(1. - .5*uClair);
    c = mix(c, vec3(1., .97, .9)*1.15, uBlanc*pow(cv, 2.5));                                         // cœur blanc chaud (étoiles)
    if (uMotif > .5) { float an = atan(vO.x, vO.z), rr = length(vO.xz), s = 0.;                     // étincelles du chapeau, posées sur le cône
      ${ETOILES_CHAPEAU.map(([a, y, t, k]) => `s += accEtincelle(vec2(accAngle(an - ${f(a)})*rr, vO.y - ${f(y)}), ${f(t)})*${k.toFixed(2)};`).join(' ')}
      c += vec3(1., .95, .82)*min(s, 1.4)*(1. - .35*uClair); }
    float a = uOpacite*(uFondu.y > 0. ? 1. - smoothstep(uFondu.x, uFondu.y, vUv.x) : 1.);         // fondu le long du tube (branches des lunettes)
    if (uVerre > .5) { float d = (vUv.x + vUv.y)*.7071, sh = exp(-pow(d - .3, 2.)*30.)*.75 + exp(-pow(d + .12, 2.)*140.)*.35;   // verre : reflets en biais
      c = mix(uCouleur*.55, vec3(1., .98, .94), clamp(sh, 0., 1.)); a = .07 + sh*.28 + pow(1. - cv, 3.)*.18; }
    float T = transmission(vLoc);
    c = mix(mix(vifDe(uColor), vec3(1., .96, .9), .4)*.85, c, T);                                     // derrière la frange : teinté par le gaz
    c = mix(c, pow(max(c, 0.), vec3(1.35))*.9, uClair);                                              // papier : un or plus profond, lisible sur le clair
    a *= uPres*uApp*mix(T, 1., uClair*.7)*mix(1., smoothstep(.0, .3, cv), uDouceur);
    gl_FragColor = vec4(versSortie(c)*a, a); }`;
  const lueurV = `uniform mat4 uInvL; uniform float uTaille, uCoque; varying vec2 vQ; varying float vT; varying vec3 vN; varying vec3 vV;
  ${GLSL.prelude} ${GLSL.formes} ${GLSL.voile}
  void main(){
    if (uCoque > .5) { vec4 w = modelMatrix*vec4(position, 1.); vT = transmission((uInvL*w).xyz); vec4 mv = viewMatrix*w; vN = normalMatrix*normal; vV = -mv.xyz; vQ = vec2(0.); gl_Position = projectionMatrix*mv; }
    else { vT = transmission((uInvL*modelMatrix*vec4(0., 0., 0., 1.)).xyz); vec4 mv = modelViewMatrix*vec4(0., 0., 0., 1.);       // panneau face caméra
      mv.xy += position.xy*uTaille*length(modelViewMatrix[0].xyz); vQ = position.xy; vN = vec3(0., 0., 1.); vV = vN; gl_Position = projectionMatrix*mv; } }`;
  const lueurF = `uniform vec3 uCouleur; uniform float uForce, uPres, uRayons, uCoque, uBlanc; varying vec2 vQ; varying float vT; varying vec3 vN; varying vec3 vV;
  ${GLSL.prelude} ${GLSL.sortie}
  void main(){
    float I;
    if (uCoque > .5) { float cv = abs(dot(normalize(vN), normalize(vV))); I = pow(cv, 3.); }        // coque : cloche à travers le tube
    else { float r = length(vQ); I = max(0., (exp(-r*r*6.) - .0025)/.9975);                          // cloche ronde (nulle au bord du panneau)
      vec2 q = abs(vQ); I += uRayons*(exp(-q.y*40. - q.x*3.2) + exp(-q.x*40. - q.y*3.2))*(1. - smoothstep(.55, 1., r)); }   // petite croix de scintillement
    vec3 vif = vifDe(uCouleur), col = mix(mix(vif, uCouleur, .5), vec3(1., .97, .92), .2 + .5*uBlanc*min(I, 1.));
    float k = uPres*uApp*vT;
    vec3 sombre = versSortie(col*I*uForce)*k;
    float ac = .32*min(I, 1.)*uForce*k; vec3 claire = versSortie(pow(vif, vec3(1.25))*.8)*ac;   // papier : aura colorée (l'additif ne se voit pas)
    vec4 o = mix(vec4(sombre, 0.), vec4(claire, ac), uClair);
    o.rgb += trame(gl_FragCoord.xy)/255.*k;
    gl_FragColor = vec4(max(o.rgb, 0.), o.a); }`;
  return SRC = { objetV, objetF, lueurV, lueurF };
}

const partages = U => ({ uT: U.uT, uApp: U.uApp, uClair: U.uClair, uForme: U.uForme, uTex: U.uTex, uBornes: U.uBornes, uColor: U.uColor, uCamL: U.uCamL, uInvL: U.uInvL });
const premul = THREE => ({ transparent: true, depthTest: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });

// « objet » : un objet de lumière couleur accCouleur (o.pres : uniform de présence partagé par l'accessoire)
function matObjet(ctx, o = {}) {
  const { THREE, U, GLSL } = ctx, S = sources(GLSL);
  return new THREE.ShaderMaterial({ ...premul(THREE), depthWrite: o.ecrit !== false, side: o.cote || THREE.FrontSide, vertexShader: S.objetV, fragmentShader: S.objetF,
    uniforms: { ...partages(U), uCouleur: U.uAccCol, uPres: o.pres, uOpacite: { value: o.opacite ?? 1 }, uEclat: { value: o.eclat ?? 1 }, uLisere: { value: o.lisere ?? .55 },
      uDouceur: { value: o.douceur ?? .4 }, uBlanc: { value: o.blanc ?? 0 }, uMotif: { value: o.motif ?? 0 }, uVerre: { value: o.verre ?? 0 },
      uGrad: { value: new THREE.Vector4(0, 1, 1, 1) }, uFondu: { value: new THREE.Vector2(o.fondu ? o.fondu[0] : 0, o.fondu ? o.fondu[1] : 0) } } });
}
// « lueur » : rayonnement doux (panneau face caméra, ou coque si o.coque)
function matLueur(ctx, o = {}) {
  const { THREE, U, GLSL } = ctx, S = sources(GLSL);
  return new THREE.ShaderMaterial({ ...premul(THREE), depthWrite: false, vertexShader: S.lueurV, fragmentShader: S.lueurF,
    uniforms: { ...partages(U), uCouleur: U.uAccCol, uPres: o.pres, uTaille: { value: o.taille ?? .3 }, uForce: { value: o.force ?? .5 }, uRayons: { value: o.rayons ?? 0 },
      uCoque: { value: o.coque ? 1 : 0 }, uBlanc: { value: o.blanc ?? .4 } } });
}

// étoile bombée à 5 branches (pointe vers +Y, épaisseur selon Z) : le contour exact d'une étoile, gonflé en coussin (pointes fines, cœur rond)
function geoEtoile(THREE, R = 1, ri = .47, ep = .4) {
  const NU = 60, NV = 10, s = Math.PI / 5, x2 = ri * Math.cos(s), y2 = ri * Math.sin(s), ex = x2 - R, ey = y2;
  const rho = u => { let a = ((u % (2 * s)) + 2 * s) % (2 * s); if (a > s) a = 2 * s - a; const dx = Math.cos(a), dy = Math.sin(a); return R * ey / (dx * ey - dy * ex); };
  const pos = [], uv = [], idx = [];
  for (let j = 1; j < NV; j++) { const v = -Math.PI / 2 + Math.PI * j / NV, cv = Math.cos(v), sv = Math.sin(v);
    for (let i = 0; i < NU; i++) { const u = i / NU * TAU, r = rho(u) * cv; pos.push(r * Math.sin(u), r * Math.cos(u), ep * sv); uv.push(i / NU, j / NV); } }
  const pS = pos.length / 3; pos.push(0, 0, -ep); uv.push(.5, 0); const pN = pS + 1; pos.push(0, 0, ep); uv.push(.5, 1);
  const id = (j, i) => (j - 1) * NU + (i % NU);
  for (let j = 1; j < NV - 1; j++) for (let i = 0; i < NU; i++) { const a = id(j, i), b = id(j, i + 1), c = id(j + 1, i), d = id(j + 1, i + 1); idx.push(a, c, b, b, c, d); }
  for (let i = 0; i < NU; i++) { idx.push(pS, id(1, i), id(1, i + 1)); idx.push(pN, id(NV - 1, i + 1), id(NV - 1, i)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

// chapeau pointu : bord arrondi (lisible de face), cône un peu creusé, pointe qui s'incline (de côté et vers l'arrière)
function geoChapeau(THREE, H = 1) {
  const p = [[.4, 0], [.53, -.02], [.63, -.032], [.675, -.022], [.682, -.004], [.662, .012], [.57, .021], [.47, .029]];
  for (let i = 0; i <= 18; i++) { const f = i / 18; p.push([Math.max(.44 * Math.pow(1 - f, 1.15), .003), .045 + f * (H - .045)]); }
  const g = new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 44, Math.PI), P = g.attributes.position;   // couture à l'arrière
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y > .45 * H) { const f = (y - .45 * H) / (.55 * H), f2 = f * f; P.setXYZ(i, P.getX(i) + .17 * f2 * f, y - .07 * f2 * f, P.getZ(i) - .05 * f2); } }
  P.needsUpdate = true; g.computeBoundingSphere(); return g;
}

// place libre autour de l'axe vertical à la hauteur y (jusqu'à la première partie de la silhouette : oreilles du chat…)
function libre(F, y, max = .8) {
  let r = max;
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, s = Math.sin(a), c = Math.cos(a); for (let d = .05; d < r; d += .025) if (F.sd(s * d, y, c * d) < .03) { r = d; break; } }
  return r;
}
// hauteur où un cercle de rayon r (autour de l'axe) se pose sur la silhouette, vu d'en haut (la plus haute touche)
function assise(F, r, y0) {
  let y = -9; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, t = F.toucher(Math.sin(a) * r, y0, Math.cos(a) * r, 0, -1, 0); if (t >= 0) y = Math.max(y, y0 - t); }
  return y;
}
const lisse = p => p * p * (3 - 2 * p);
const profondeur = (mats, e) => { const v = e > .97; for (let i = 0; i < mats.length; i++) mats[i].depthWrite = v; };   // pendant un fondu : n'écrit pas la profondeur (ne cache rien)

export const ACCESSOIRES = {
  // 1 — anneau : un halo de lumière incliné qui flotte au-dessus de la tête (au-dessus des oreilles du chat, de la branche de l'étoile)
  1: { nom: 'anneau', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.4 }, objet = new THREE.Group(); objet.name = 'acc-anneau';
    const tore = new THREE.Mesh(new THREE.TorusGeometry(.46, .045, 10, 72).rotateX(Math.PI / 2), matObjet(ctx, { pres, eclat: 1.15, blanc: .28, lisere: .5, douceur: .35 }));
    const coque = new THREE.Mesh(new THREE.TorusGeometry(.46, .15, 10, 72).rotateX(Math.PI / 2), matLueur(ctx, { pres, coque: 1, force: .36, blanc: .3 }));
    objet.add(tore, coque); ctx.preparer(objet);
    let y0 = 1.2;
    return { objet, encombrement: enc,
      placer(ctx) { const R = ctx.forme.reperes; y0 = R.sommet.y + .24; objet.position.set(R.haut.x, y0, R.haut.z); enc.haut = y0 + .46 * Math.sin(.3) + .06; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(.7 + .3 * e); tore.material.depthWrite = e > .97;
        objet.position.y = y0 + Math.sin(t * 1.3) * .025 + (1 - e) * .12; objet.rotation.x = .3 + Math.sin(t * .9) * .04; objet.rotation.z = Math.sin(t * .7 + 1) * .03; } };
  } },

  // 2 — antenne : une tige fine qui sort du dessus de la tête (selon la normale) et une petite étoile-lanterne qui se balance
  2: { nom: 'antenne', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.75 }, objet = new THREE.Group(), balance = new THREE.Group(); objet.name = 'acc-antenne'; objet.add(balance);
    const courbe = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -.08, 0), new THREE.Vector3(0, .3, 0), new THREE.Vector3(.12, .55, 0));
    const tige = new THREE.Mesh(new THREE.TubeGeometry(courbe, 24, .024, 7, false), matObjet(ctx, { pres, eclat: 1.05, lisere: .5, douceur: .15 }));
    const lanterne = new THREE.Group(); lanterne.position.copy(courbe.getPoint(1)).addScaledVector(courbe.getTangent(1), .08);
    const etoile = new THREE.Mesh(geoEtoile(THREE), matObjet(ctx, { pres, eclat: 1.2, blanc: .6, lisere: .45, douceur: .25 })); etoile.scale.setScalar(.13);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matLueur(ctx, { pres, taille: .46, force: .6, rayons: .35, blanc: .6 }));
    lanterne.add(etoile, halo); balance.add(tige, lanterne); ctx.preparer(objet); const mats = [tige.material, etoile.material];
    const Y = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(), q = new THREE.Vector3();
    return { objet, encombrement: enc,
      placer(ctx) { const F = ctx.forme, B = F.reperes.haut; F.normale(B.x, B.y, B.z, n); n.lerp(Y, .35).normalize();   // un peu redressée vers le haut
        objet.position.copy(B); objet.quaternion.setFromUnitVectors(Y, n);
        q.copy(lanterne.position).applyQuaternion(objet.quaternion).add(B); enc.haut = q.y + .16; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(.7 + .3 * e); profondeur(mats, e);
        balance.rotation.z = Math.sin(t * 1.6) * .09 - ctx.U.uTilt.value * .4; balance.rotation.x = Math.sin(t * 1.13 + 1) * .05;
        const cam = ctx.U.uCamL.value; etoile.rotation.y = Math.atan2(cam.x, cam.z) * .7 + Math.sin(t * 1.1) * .4; etoile.rotation.z = -balance.rotation.z * .6; } };
  } },

  // 3 — lunettes rondes : montures posées sur la surface autour des yeux (elles épousent la courbe), pont, branches qui filent vers l'arrière, verres
  3: { nom: 'lunettes', creer(ctx) {
    const { THREE, ORDRE } = ctx, pres = { value: 0 }, objet = new THREE.Group(); objet.name = 'acc-lunettes';
    const matM = matObjet(ctx, { pres, eclat: 1.15, lisere: .55, douceur: .2 }), matV = matObjet(ctx, { pres, verre: 1, douceur: 0, ecrit: false });
    const matB = matObjet(ctx, { pres, eclat: 1.1, lisere: .5, douceur: .2, fondu: [.3, 1], ecrit: false });
    const vide = () => new THREE.BufferGeometry();
    const montures = [-1, 1].map(() => { const m = new THREE.Mesh(vide(), matM), v = new THREE.Mesh(vide(), matV), b = new THREE.Mesh(vide(), matB); m.add(v, b); objet.add(m); return { m, v, b }; });
    const pont = new THREE.Mesh(vide(), matM); objet.add(pont); ctx.preparer(objet, ORDRE.devant);
    const U = ctx.U;
    return { objet,
      placer(ctx) {                                                     // rare (changement de silhouette) : on peut allouer ici
        const F = ctx.forme, V = ctx.visage, rf = .25 * V.echelle, off = .045, bouts = [];
        const sur = (P) => { F.surface(P.x, P.y, P.z, P); const n = F.normale(P.x, P.y, P.z, new THREE.Vector3()); return P.addScaledVector(n, off); };
        montures.forEach(({ m, v, b }, i) => {
          const s = i ? 1 : -1, C = V.oeil(s, new THREE.Vector3()), N = F.normale(C.x, C.y, C.z, new THREE.Vector3());
          const T1 = new THREE.Vector3(0, 1, 0).cross(N).normalize(), T2 = new THREE.Vector3().crossVectors(N, T1), O = C.clone().addScaledVector(N, off);
          const pt = a => sur(C.clone().addScaledVector(T1, Math.cos(a) * rf).addScaledVector(T2, Math.sin(a) * rf));
          const cercle = []; for (let k = 0; k < 28; k++) cercle.push(pt(k / 28 * TAU).sub(O));
          // branche : du bord extérieur, au ras de la tête, vers l'arrière (elle entre dans le gaz, qui la voile)
          const ext = pt(s > 0 ? 0 : Math.PI), el = Math.atan2(C.y, Math.hypot(C.x, C.z)), br = [ext.clone().sub(O)];
          for (let k = 1; k <= 4; k++) { const lo = s * (.72 + k * .2), d = new THREE.Vector3(Math.sin(lo) * Math.cos(el), Math.sin(el) + .02, Math.cos(lo) * Math.cos(el)).normalize();
            br.push(sur(d.clone()).addScaledVector(d, -k * .045).sub(O)); }   // de plus en plus enfoncée : le gaz l'efface vers l'arrière
          m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cercle, true, 'centripetal'), 64, .027, 7, true); m.position.copy(O);
          b.geometry.dispose(); b.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(br, false, 'centripetal'), 20, .021, 6, false);
          // verre : un disque bombé tendu dans la monture (uv = position dans le disque, pour les reflets)
          const pos = [0, 0, 0], uv = [0, 0], nor = [], idx = [];
          for (let k = 0; k < 28; k++) { const a = k / 28 * TAU, P = cercle[k]; pos.push(P.x * .93, P.y * .93, P.z * .93); uv.push(Math.cos(a), Math.sin(a)); idx.push(0, 1 + k, 1 + (k + 1) % 28); }
          for (let k = 0; k < 29; k++) nor.push(N.x, N.y, N.z);
          const gv = new THREE.BufferGeometry(); gv.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gv.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
          gv.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gv.setIndex(idx); v.geometry.dispose(); v.geometry = gv;
          bouts[i] = pt(s > 0 ? Math.PI - .5 : .5);                       // haut du bord intérieur (départ du pont)
        });
        const mil = sur(new THREE.Vector3(0, (bouts[0].y + bouts[1].y) / 2 + .05, 1));
        pont.geometry.dispose(); pont.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([bouts[0], mil, bouts[1]], false, 'centripetal'), 16, .022, 6, false);
      },
      maj(dt, t, etat, presence) { pres.value = lisse(presence); matM.depthWrite = pres.value > .97;
        const k = U.uEyeS.value, fs = k >= 1 ? 1 + (k - 1) * .6 : 1 - (1 - k) * .3;   // grands yeux : montures un peu plus grandes
        montures[0].m.scale.setScalar(fs); montures[1].m.scale.setScalar(fs); } };
  } },

  // 4 — couronne d'étoiles : trois petites étoiles bombées qui flottent en arc au-dessus de la tête (relevée au-dessus des oreilles s'il n'y a pas la place)
  4: { nom: 'couronne', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.45 }, objet = new THREE.Group(); objet.name = 'acc-couronne';
    const geo = geoEtoile(THREE), mat = matObjet(ctx, { pres, eclat: 1.2, blanc: .5, lisere: .45, douceur: .25 }), plan = new THREE.PlaneGeometry(2, 2);
    const E = [0, 1, 2].map(k => { const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), c = k === 1;
      const h = new THREE.Mesh(plan, matLueur(ctx, { pres, taille: c ? .4 : .32, force: c ? .45 : .36, rayons: .28, blanc: .5 }));
      m.scale.setScalar(c ? .17 : .125); g.add(m, h); objet.add(g); return { g, m, y0: 0 }; });
    ctx.preparer(objet);
    return { objet, encombrement: enc,
      placer(ctx) { const F = ctx.forme, R = F.reperes, H = R.haut, place = libre(F, H.y + .15);
        const haute = place < .45 && R.sommet.y - H.y > .25;              // de hautes oreilles autour : entre leurs pointes
        const yc = haute ? R.sommet.y - .02 : H.y + .17, xs = haute ? .34 : Math.min(.38, Math.max(.26, place * .8));
        objet.position.set(H.x, yc, H.z);
        E[0].g.position.set(-xs, 0, -.02); E[0].g.rotation.z = .32; E[1].g.position.set(0, .2, .07); E[2].g.position.set(xs, 0, -.02); E[2].g.rotation.z = -.32;
        for (let k = 0; k < 3; k++) E[k].y0 = E[k].g.position.y;
        enc.haut = yc + .2 + .17 + .1; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(.7 + .3 * e); mat.depthWrite = e > .97;
        const cam = ctx.U.uCamL.value, lacet = Math.atan2(cam.x, cam.z) * .7;   // un peu tournées vers la caméra : jamais vues de champ
        for (let k = 0; k < 3; k++) { const s = E[k]; s.g.position.y = s.y0 + Math.sin(t * 2 + k * 2) * .022 + (1 - e) * .1; s.m.rotation.y = lacet + Math.sin(t * .8 + k * 1.7) * .35; } } };
  } },

  // 5 — chapeau de magicien : cône pointu (pointe qui s'incline), bord arrondi, dégradé d'or et étincelles peintes ; posé sur la tête, réduit entre des oreilles
  5: { nom: 'chapeau', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.85 }, objet = new THREE.Group(); objet.name = 'acc-chapeau';
    const mat = matObjet(ctx, { pres, eclat: 1.05, lisere: .6, douceur: .25, motif: 1 }); mat.uniforms.uGrad.value.set(0, .95, .56, 1.15);
    const chapeau = new THREE.Mesh(geoChapeau(THREE), mat); objet.add(chapeau); ctx.preparer(objet);
    let k0 = 1;
    return { objet, encombrement: enc,
      placer(ctx) { const F = ctx.forme, R = F.reperes, H = R.haut, place = libre(F, H.y + .06);
        k0 = Math.min(1, Math.max(.72, place / .4));                     // entre des oreilles : un chapeau un peu plus petit
        let y = assise(F, .38 * k0, R.sommet.y + .6); if (y < -8) y = H.y; y = Math.max(y, H.y - .3);
        objet.position.set(H.x, y - .015, H.z); enc.haut = y + .98 * k0; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(k0 * (.7 + .3 * e)); mat.depthWrite = e > .97;
        objet.rotation.z = .1 + Math.sin(t * 1.2) * .025; objet.rotation.x = .08; } };
  } },
};
