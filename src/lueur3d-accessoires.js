// Lueur 3D — accessoires : 1 anneau, 2 antenne, 3 lunettes, 4 couronne d'étoiles, 5 chapeau de magicien, 6 anneaux de planète, 7 petite lune, 8 satellite, 9 petite comète, 10 croissant de lune (couleur : U.uAccCol = accCouleur).
// N'importe rien (pas même three : tout arrive par ctx) ; lueur3d.js l'importe et crée chaque accessoire UNE fois, au chargement, invisible.
//
// ═══ CONTRAT (recopié de lueur3d.js, qui fait foi ; lisez son en-tête pour le détail de ctx, U, GLSL, ORDRE) ═══
// ACCESSOIRES[n] = { nom, creer(ctx) → inst }   (n = valeur de perso.acc : 1..10)
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
// Deux ShaderMaterial à nous (même texte pour toutes les pièces → deux programmes en tout ; tout se règle par uniforms, rien ne se recompile) :
//   « objet » : un objet de lumière couleur accCouleur. Teinte gardée saturée (accTon : les ombres s'approfondissent sans brunir, les éclats
//               blanchissent au lieu d'écrêter en crème), lumière douce d'en haut à gauche, liseré, petit reflet (uSpec), cœur blanc chaud (uBlanc),
//               voile du gaz (transmission), papier (or profond, lisible sur le clair), apparition, pré-multiplié. Motifs : 1 chapeau (dégradé, ruban
//               de lumière, étoiles peintes qui scintillent, pointe lumineuse), 2 anneau (un éclat qui fait le tour). uVerre : verres des lunettes.
//               uFlex (sommet) : la pointe du chapeau fléchit et traîne (animée par maj, sans recompilation).
//   « lueur »  : rayonnement en cloche calculé en flottant (jamais de texture) : panneau face caméra (étoiles) ou coque autour d'un tube (anneau) ;
//               voilé par le gaz (transmission), additif sur la nuit, aura colorée sur papier.
// Placement (placer) : uniquement ctx.forme (repères, sd, toucher, normale, surface) et ctx.visage (oeil, point) ; libre() mesure la place entre les
//   oreilles (chat) pour réduire le chapeau ou relever la couronne ; assise() pose le chapeau sur la tête (rayons vers le bas).
// Hauteur du haut de l'accessoire au-dessus du centre (encombrement.haut, unités du corps, mesurée ; recalculée à chaque silhouette) : voir le tableau
//   HAUTEURS plus bas (lunettes : rien au-dessus du corps). → la bulle : lueur.encombrement().haut × rayon à l'écran (compté quand presence > .5).
// Pousse : presence → fondu (uPres) + échelle .7 → 1 (sauf lunettes : fondu seul) ; la profondeur n'est écrite qu'une fois l'article bien là.

const TAU = Math.PI * 2;

// étoiles peintes sur le chapeau : [angle autour de l'axe (0 = devant), hauteur (0 bord → 1 pointe), taille, phase du scintillement]
const ETOILES_CHAPEAU = [[.12, .47, .085, 0], [1.3, .3, .062, 1.7], [-1.22, .36, .058, 3.1], [2.45, .52, .058, 4.4], [-2.5, .27, .062, 2.2], [3.08, .4, .052, 5.3],
  [-.7, .66, .046, .9], [.86, .72, .04, 3.8], [-1.85, .6, .044, 1.2]];

let SRC = null;   // sources construites une fois : même texte → même programme pour toutes les instances
function sources(GLSL) {
  if (SRC) return SRC;
  const f = x => x.toFixed(3);
  const objetV = `uniform mat4 uInvL; uniform vec4 uFlex; varying vec3 vN; varying vec3 vV; varying vec3 vLoc; varying vec3 vO; varying vec2 vUv;
  void main(){ vec3 p = position; vO = position; vUv = uv;
    if (uFlex.w > 0.) { float f = clamp((p.y/uFlex.w - uFlex.z)/(1. - uFlex.z), 0., 1.); p.xz += uFlex.xy*f*f*f; }   // la pointe fléchit (chapeau)
    vec4 w = modelMatrix*vec4(p, 1.); vLoc = (uInvL*w).xyz; vec4 mv = viewMatrix*w; vN = normalMatrix*normal; vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
  const objetF = `uniform vec3 uCouleur; uniform float uOpacite, uPres, uEclat, uLisere, uDouceur, uBlanc, uMotif, uVerre, uProf, uSpec; uniform vec2 uFondu;
  varying vec3 vN; varying vec3 vV; varying vec3 vLoc; varying vec3 vO; varying vec2 vUv;
  ${GLSL.prelude} ${GLSL.formes} ${GLSL.voile} ${GLSL.sortie}
  float accAngle(float a){ return mod(a + 3.14159265, 6.2831853) - 3.14159265; }
  vec3 accTon(vec3 vif, float L, float prof){                          // la teinte reste saturée : ombres plus profondes (jamais brunes), éclats qui blanchissent
    vec3 c = mix(pow(vif, vec3(1.8)), vif, clamp(L*1.3 - .35 - prof*.45, 0., 1.))*L; float m = max(c.r, max(c.g, c.b));
    return mix(c/max(m, 1.), vec3(1., .98, .94), clamp((m - 1.)*.85, 0., .8)); }
  float accEtoile(vec2 p, float r){                                    // étoile à 5 branches (distance signée, Inigo Quilez), pointe en haut
    const vec2 k1 = vec2(.809017, -.587785), k2 = vec2(-.809017, -.587785); p.x = abs(p.x);
    p -= 2.*max(dot(k1, p), 0.)*k1; p -= 2.*max(dot(k2, p), 0.)*k2; p.x = abs(p.x); p.y -= r;
    vec2 ba = .46*vec2(-k1.y, k1.x) - vec2(0., 1.); float h = clamp(dot(p, ba)/dot(ba, ba), 0., r); return length(p - ba*h)*sign(p.y*ba.x - p.x*ba.y); }
  void main(){
    vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n;
    const vec3 CLE = vec3(-.5, .64, .58);                               // lumière douce d'en haut à gauche (déjà normée) : du volume
    float cv = clamp(dot(n, v), 0., 1.), lat = clamp(dot(n, CLE)*.5 + .5, 0., 1.), sp = pow(clamp(dot(reflect(-v, n), CLE), 0., 1.), 14.);
    vec3 vif = vifDe(uCouleur), blanc = vec3(1., .97, .9);
    float L = uEclat*(.66 + .26*lat + .16*cv), prof = uProf, ajout = 0., blanchi = 0., a = uOpacite;
    int m = int(uMotif + .5);
    if (m == 1) {                                                        // chapeau : dégradé, ruban de lumière, étoiles peintes, pointe lumineuse
      float y = vO.y, an = atan(vO.x, vO.z), rr = length(vO.xz), aa;
      L *= mix(.84, 1.1, smoothstep(.05, .9, y)); prof += .35*smoothstep(.06, .0, y);
      float ruban = smoothstep(.05, .062, y)*smoothstep(.178, .166, y);
      blanchi = max(blanchi, ruban*(.34 + .16*exp(-pow(accAngle(an - uT*.5), 2.)*5.)));
      float s = 0., k = 0.;
      ${ETOILES_CHAPEAU.map(([a, y, t, ph]) => `k = accEtoile(vec2(accAngle(an - ${f(a)})*rr, (y - ${f(y)})*1.12), ${f(t)}); aa = max(fwidth(k), 1e-4); s += (smoothstep(aa, -aa, k) + exp(-max(k, 0.)*38.)*.35)*(.75 + .25*sin(uT*2.1 + ${ph.toFixed(1)}))*step(.07, y);`).join('\n      ')}
      ajout += min(s, 1.2)*.9*step(.17, y);
      blanchi = max(blanchi, smoothstep(.8, .985, y)*.7);
    } else if (m == 2) {                                                 // anneau : un éclat qui en fait le tour, lentement (et un plus faible en face)
      float g = accAngle(vUv.x*6.2831853 - uT*.55); ajout += exp(-g*g*16.)*.5 + exp(-pow(accAngle(g + 3.14159), 2.)*16.)*.22;
    }
    vec3 c = accTon(vif, L, prof);
    c += mix(vif, blanc, .55)*pow(1. - cv, 2.6)*uLisere*.7 + blanc*sp*uSpec;   // liseré : la lumière qui fait le tour (pas un contour) ; petit reflet
    c = mix(c, blanc*1.12, clamp(uBlanc*pow(cv, 2.5) + blanchi, 0., 1.));     // cœur blanc chaud (étoiles-lanternes, ruban, pointe)
    c += blanc*ajout;
    // papier : un or profond et saturé (jamais kaki), lisible sur le clair ; mêmes motifs, plus discrets
    vec3 cp = mix(pow(vif, vec3(2.)), vif, .42)*(.62 + .26*lat + .14*cv)*(1. - .12*prof) + blanc*(sp*uSpec*.8 + ajout*.55);
    cp = mix(cp, mix(vif, blanc, .55), clamp(uBlanc*pow(cv, 2.5)*.5 + blanchi*.6, 0., 1.));
    c = mix(c, cp, uClair);
    a *= uFondu.y > 0. ? 1. - smoothstep(uFondu.x, uFondu.y, vUv.x) : 1.;   // fondu le long du tube (branches des lunettes)
    if (uVerre > .5) { float d = dot(vUv, vec2(.7071)), r2 = dot(vUv, vUv);   // verre : deux reflets en biais, un soupçon de teinte
      float sh = exp(-pow(d - .3, 2.)*28.)*.8 + exp(-pow(d + .14, 2.)*150.)*.4; sh *= smoothstep(1., .75, r2);
      c = mix(mix(vif, blanc, .6)*.6, blanc, clamp(sh, 0., 1.)); a = .05 + sh*.32 + pow(1. - cv, 3.)*.12; }
    float T = transmission(vLoc);
    c = mix(mix(vifDe(uColor), vec3(1., .96, .9), .4)*.85, c, T);                                     // derrière la frange : teinté par le gaz
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
    else { float r = length(vQ); I = max(0., (exp(-r*r*7.) - .0009)/.9991);                          // cloche ronde (nulle au bord du panneau)
      vec2 q = abs(vQ); I += uRayons*(exp(-q.y*42. - q.x*3.4) + exp(-q.x*42. - q.y*3.4))*(1. - smoothstep(.5, 1., r)); }   // petite croix de scintillement
    vec3 vif = vifDe(uCouleur), col = mix(vif, vec3(1., .97, .92), .22 + .45*uBlanc*min(I, 1.));
    float k = uPres*uApp*vT;
    vec3 sombre = versSortie(col*I*uForce)*k;
    float ac = .3*min(I, 1.)*uForce*k; vec3 claire = versSortie(mix(pow(vif, vec3(2.)), vif, .42)*.85)*ac;   // papier : aura colorée (l'additif ne se voit pas)
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
  return new THREE.ShaderMaterial({ ...premul(THREE), depthWrite: o.ecrit !== false, side: THREE.FrontSide, vertexShader: S.objetV, fragmentShader: S.objetF,
    uniforms: { ...partages(U), uCouleur: U.uAccCol, uPres: o.pres, uOpacite: { value: o.opacite ?? 1 }, uEclat: { value: o.eclat ?? 1 }, uLisere: { value: o.lisere ?? .55 },
      uDouceur: { value: o.douceur ?? .4 }, uBlanc: { value: o.blanc ?? 0 }, uMotif: { value: o.motif ?? 0 }, uVerre: { value: o.verre ?? 0 }, uProf: { value: o.prof ?? 0 },
      uSpec: { value: o.spec ?? .35 }, uFlex: { value: new THREE.Vector4(0, 0, 0, 0) },
      uFondu: { value: new THREE.Vector2(o.fondu ? o.fondu[0] : 0, o.fondu ? o.fondu[1] : 0) } } });
}
// « lueur » : rayonnement doux (panneau face caméra, ou coque si o.coque)
function matLueur(ctx, o = {}) {
  const { THREE, U, GLSL } = ctx, S = sources(GLSL);
  return new THREE.ShaderMaterial({ ...premul(THREE), depthWrite: false, vertexShader: S.lueurV, fragmentShader: S.lueurF,
    uniforms: { ...partages(U), uCouleur: U.uAccCol, uPres: o.pres, uTaille: { value: o.taille ?? .3 }, uForce: { value: o.force ?? .5 }, uRayons: { value: o.rayons ?? 0 },
      uCoque: { value: o.coque ? 1 : 0 }, uBlanc: { value: o.blanc ?? .4 } } });
}

// étoile bombée à 5 branches (pointe vers +Y, épaisseur selon Z) : le contour exact d'une étoile, gonflé en coussin (pointes fines, cœur rond)
function geoEtoile(THREE, R = 1, ri = .5, ep = .46) {
  const NU = 60, NV = 10, s = Math.PI / 5, x2 = ri * Math.cos(s), y2 = ri * Math.sin(s), ex = x2 - R, ey = y2;
  const rho = u => { let a = ((u % (2 * s)) + 2 * s) % (2 * s); if (a > s) a = 2 * s - a; const dx = Math.cos(a), dy = Math.sin(a); return R * ey / (dx * ey - dy * ex); };
  const pos = [], uv = [], idx = [];
  for (let j = 1; j < NV; j++) { const v = -Math.PI / 2 + Math.PI * j / NV, cv = Math.cos(v), sv = Math.sin(v);
    for (let i = 0; i < NU; i++) { const u = i / NU * TAU, r = rho(u) * Math.pow(cv, .8); pos.push(r * Math.sin(u), r * Math.cos(u), ep * sv); uv.push(i / NU, j / NV); } }
  const pS = pos.length / 3; pos.push(0, 0, -ep); uv.push(.5, 0); const pN = pS + 1; pos.push(0, 0, ep); uv.push(.5, 1);
  const id = (j, i) => (j - 1) * NU + (i % NU);
  for (let j = 1; j < NV - 1; j++) for (let i = 0; i < NU; i++) { const a = id(j, i), b = id(j, i + 1), c = id(j + 1, i), d = id(j + 1, i + 1); idx.push(a, c, b, b, c, d); }
  for (let i = 0; i < NU; i++) { idx.push(pS, id(1, i), id(1, i + 1)); idx.push(pN, id(NV - 1, i + 1), id(NV - 1, i)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

// chapeau pointu (hauteur 1 au-dessus du bord) : fond fermé, bord roulé qui tombe un peu, ruban en relief, cône à peine creusé, pointe qui s'incline
const coneR = y => .48 * Math.pow(Math.max(0, 1 - (y - .05) / .95), 1.12);
function geoChapeau(THREE) {
  const p = [[0, .03], [.22, .02], [.42, .006], [.55, -.016], [.65, -.036], [.705, -.046], [.735, -.043], [.75, -.03], [.748, -.013], [.732, -.002], [.69, .004], [.61, .018], [.54, .034], [.5, .046]];
  p.push([coneR(.055), .055], [coneR(.06) + .02, .062], [coneR(.165) + .02, .166], [coneR(.172), .172]);   // ruban
  for (let i = 1; i <= 20; i++) { const y = .172 + (1 - .172) * i / 20; p.push([Math.max(coneR(y), .004), y]); }
  const g = new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 48, Math.PI), P = g.attributes.position;   // couture à l'arrière
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y > .45) { const f = (y - .45) / .55, f2 = f * f; P.setXYZ(i, P.getX(i) + .16 * f2 * f, y - .07 * f2 * f, P.getZ(i) - .05 * f2); } }
  P.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
// tige effilée le long d'une courbe (rayon r0 à la base → r1 au bout)
function geoTige(THREE, courbe, r0, r1, n = 28, rs = 8) {
  const g = new THREE.TubeGeometry(courbe, n, r0, rs, false), P = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= n; i++) { courbe.getPointAt(i / n, c); const k = 1 + (r1 / r0 - 1) * i / n; for (let j = 0; j <= rs; j++) { const q = i * (rs + 1) + j; v.fromBufferAttribute(P, q).sub(c).multiplyScalar(k).add(c); P.setXYZ(q, v.x, v.y, v.z); } }
  P.needsUpdate = true; return g;
}

// croissant de lune bombé (v55) : un arc de tube qui s'affine vers les pointes (le dos est le plus épais), pointes tournées vers +X, aplati selon Z
function geoCroissant(THREE, R = .34, ep = .135, ouv = 2.25, n = 48, rs = 14) {
  const a0 = Math.PI - ouv, pts = [];
  for (let i = 0; i <= 16; i++) { const a = a0 + 2 * ouv * i / 16; pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0)); }
  const courbe = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(courbe, n, ep, rs, false), P = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= n; i++) { courbe.getPointAt(i / n, c); const k = Math.max(.07, Math.pow(Math.sin(Math.PI * i / n), .7));
    for (let j = 0; j <= rs; j++) { const q = i * (rs + 1) + j; v.fromBufferAttribute(P, q).sub(c).multiplyScalar(k); v.z *= .72; v.add(c); P.setXYZ(q, v.x, v.y, v.z); } }
  P.needsUpdate = true; g.computeVertexNormals(); return g;
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
// tourne un objet vers la caméra (lacet, et un peu de tangage) + un balancement : jamais vu par la tranche (repère du pivot)
const versCamera = (o, cam, k, bal, t, ph) => { o.rotation.order = 'YXZ'; o.rotation.y = Math.atan2(cam.x, cam.z) + Math.sin(t * .8 + ph) * bal; o.rotation.x = -Math.atan2(cam.y, Math.hypot(cam.x, cam.z)) * k; };

export const ACCESSOIRES = {
  // 1 — anneau : un halo de lumière incliné qui flotte au-dessus de la tête (au-dessus des oreilles du chat, de la branche de l'étoile)
  1: { nom: 'anneau', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.4 }, objet = new THREE.Group(); objet.name = 'acc-anneau';
    const tore = new THREE.Mesh(new THREE.TorusGeometry(.47, .042, 12, 96).rotateX(Math.PI / 2), matObjet(ctx, { pres, eclat: 1.08, blanc: .42, lisere: .45, douceur: .35, motif: 2, spec: .3 }));
    const coque = new THREE.Mesh(new THREE.TorusGeometry(.47, .15, 12, 96).rotateX(Math.PI / 2), matLueur(ctx, { pres, coque: 1, force: .34, blanc: .3 }));
    objet.add(tore, coque); ctx.preparer(objet);
    let y0 = 1.2;
    return { objet, encombrement: enc,
      placer(ctx) { const R = ctx.forme.reperes; y0 = R.sommet.y + .24; objet.position.set(R.haut.x, y0, R.haut.z); enc.haut = y0 + .47 * Math.sin(.3) + .08; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(.7 + .3 * e); tore.material.depthWrite = e > .97;
        objet.position.y = y0 + Math.sin(t * 1.3) * .025 + (1 - e) * .12; objet.rotation.x = .3 + Math.sin(t * .9) * .04; objet.rotation.z = Math.sin(t * .7 + 1) * .03; } };
  } },

  // 2 — antenne : une tige fine et effilée qui sort du dessus de la tête et une petite étoile-lanterne qui se balance (toujours tournée vers nous)
  2: { nom: 'antenne', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.75 }, objet = new THREE.Group(), balance = new THREE.Group(); objet.name = 'acc-antenne'; objet.add(balance);
    const courbe = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -.1, 0), new THREE.Vector3(0, .3, 0), new THREE.Vector3(.12, .56, 0));
    const tige = new THREE.Mesh(geoTige(THREE, courbe, .032, .019), matObjet(ctx, { pres, eclat: 1.02, lisere: .5, douceur: .3, prof: .2, spec: .45 }));
    const lanterne = new THREE.Group(); lanterne.position.copy(courbe.getPoint(1)).addScaledVector(courbe.getTangent(1), .1);
    const etoile = new THREE.Mesh(geoEtoile(THREE, 1, .5, .5), matObjet(ctx, { pres, eclat: 1.1, blanc: .6, lisere: .5, douceur: .25, spec: .3 })); etoile.scale.setScalar(.15);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matLueur(ctx, { pres, taille: .4, force: .5, rayons: .3, blanc: .6 }));
    lanterne.add(etoile, halo); balance.add(tige, lanterne); ctx.preparer(objet); const mats = [tige.material, etoile.material];
    const Y = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(), q = new THREE.Vector3();
    return { objet, encombrement: enc,
      placer(ctx) { const F = ctx.forme, B = F.reperes.haut; F.normale(B.x, B.y, B.z, n); n.lerp(Y, .35).normalize();   // un peu redressée vers le haut
        objet.position.copy(B); objet.quaternion.setFromUnitVectors(Y, n);
        q.copy(lanterne.position).applyQuaternion(objet.quaternion).add(B); enc.haut = q.y + .18; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(.7 + .3 * e); profondeur(mats, e);
        const bz = Math.sin(t * 1.6) * .09 + Math.sin(t * 2.9 + .4) * .025 - ctx.U.uTilt.value * .4; balance.rotation.z = bz; balance.rotation.x = Math.sin(t * 1.13 + 1) * .05;
        versCamera(etoile, ctx.U.uCamL.value, .5, .32, t, 0); etoile.rotation.z = -bz * .8 + Math.sin(t * 2.3) * .06; } };   // la lanterne traîne un peu derrière la tige
  } },

  // 3 — lunettes rondes : montures posées sur la surface autour des yeux (elles épousent la courbe), pont, branches qui filent vers l'arrière, verres
  3: { nom: 'lunettes', creer(ctx) {
    const { THREE, ORDRE } = ctx, pres = { value: 0 }, objet = new THREE.Group(); objet.name = 'acc-lunettes';
    const matM = matObjet(ctx, { pres, eclat: .96, lisere: .4, douceur: .3, prof: .55, spec: .75 }), matV = matObjet(ctx, { pres, verre: 1, douceur: 0, ecrit: false });
    const matB = matObjet(ctx, { pres, eclat: .96, lisere: .4, douceur: .3, prof: .55, spec: .6, fondu: [.3, 1], ecrit: false });
    const vide = () => new THREE.BufferGeometry();
    const montures = [-1, 1].map(() => { const m = new THREE.Mesh(vide(), matM), v = new THREE.Mesh(vide(), matV), b = new THREE.Mesh(vide(), matB); m.add(v); objet.add(m, b); return { m, v, b }; });
    const pont = new THREE.Mesh(vide(), matM); objet.add(pont); ctx.preparer(objet, ORDRE.devant);
    const U = ctx.U; let F = ctx.forme, V = ctx.visage, oeilS = -1;
    function construire(k) {                                           // rare (silhouette ou taille des yeux changée) : on peut allouer ici
      const off = .044, bouts = [];
      // ovale autour de l'œil (rayon v11 .088 × .115, × taille des yeux) + une marge ; rond pour des yeux normaux ou petits
      const rx = Math.max(.25, (.176 * k + .045)) * V.echelle, ry = Math.max(.25, (.23 * k + .025)) * V.echelle;
      const sur = (P) => { F.surface(P.x, P.y, P.z, P); const n = F.normale(P.x, P.y, P.z, new THREE.Vector3()); return P.addScaledVector(n, off); };
      montures.forEach(({ m, v, b }, i) => {
        const s = i ? 1 : -1, C = V.oeil(s, new THREE.Vector3()), N = F.normale(C.x, C.y, C.z, new THREE.Vector3());
        const T1 = new THREE.Vector3(0, 1, 0).cross(N).normalize(), T2 = new THREE.Vector3().crossVectors(N, T1), O = C.clone().addScaledVector(N, off);
        const pt = a => sur(C.clone().addScaledVector(T1, Math.cos(a) * rx).addScaledVector(T2, Math.sin(a) * ry));
        const cercle = []; for (let j = 0; j < 32; j++) cercle.push(pt(j / 32 * TAU).sub(O));
        m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cercle, true, 'centripetal'), 72, .033, 8, true); m.position.copy(O);
        // branche : du bord extérieur, au ras de la tête, vers l'arrière (elle entre dans le gaz, qui la voile)
        const ext = pt(s > 0 ? 0 : Math.PI), el = Math.atan2(C.y, Math.hypot(C.x, C.z)), br = [ext.clone()];
        for (let j = 1; j <= 4; j++) { const lo = s * (.72 + j * .2), d = new THREE.Vector3(Math.sin(lo) * Math.cos(el), Math.sin(el) + .02, Math.cos(lo) * Math.cos(el)).normalize();
          br.push(sur(d.clone()).addScaledVector(d, -j * .045)); }   // de plus en plus enfoncée : le gaz l'efface vers l'arrière
        b.geometry.dispose(); b.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(br, false, 'centripetal'), 20, .024, 6, false);
        // verre : un disque bombé tendu dans la monture (uv = position dans le disque, pour les reflets)
        const pos = [0, 0, 0], uv = [0, 0], nor = [], idx = [];
        for (let j = 0; j < 32; j++) { const a = j / 32 * TAU, P = cercle[j]; pos.push(P.x * .92, P.y * .92, P.z * .92); uv.push(Math.cos(a), Math.sin(a)); idx.push(0, 1 + j, 1 + (j + 1) % 32); }
        for (let j = 0; j < 33; j++) nor.push(N.x, N.y, N.z);
        const gv = new THREE.BufferGeometry(); gv.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gv.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        gv.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gv.setIndex(idx); v.geometry.dispose(); v.geometry = gv;
        bouts[i] = pt(s > 0 ? Math.PI - .45 : .45);                      // haut du bord intérieur (départ du pont)
      });
      const mil = sur(new THREE.Vector3(0, (bouts[0].y + bouts[1].y) / 2 + .045, 1));
      pont.geometry.dispose(); pont.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([bouts[0], mil, bouts[1]], false, 'centripetal'), 16, .026, 6, false);
      oeilS = k;
    }
    return { objet,
      placer(c) { F = c.forme; V = c.visage; construire(U.uEyeS.value || 1); },
      maj(dt, t, etat, presence) { pres.value = lisse(presence); matM.depthWrite = pres.value > .97;
        const k = U.uEyeS.value || 1; if (Math.abs(k - oeilS) > .01) construire(k);   // taille des yeux changée (réglage : rare)
        const fs = 1 + .2 * Math.max(U.uWide.value, U.uExpr.value.w * .85);             // yeux écarquillés : les montures suivent
        montures[0].m.scale.setScalar(fs); montures[1].m.scale.setScalar(fs); } };
  } },

  // 4 — couronne d'étoiles : trois petites étoiles bombées qui flottent en diadème au-dessus de la tête (relevée entre les oreilles s'il n'y a pas la place)
  4: { nom: 'couronne', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.45 }, objet = new THREE.Group(); objet.name = 'acc-couronne';
    const geo = geoEtoile(THREE, 1, .5, .48), plan = new THREE.PlaneGeometry(2, 2);
    const mat = matObjet(ctx, { pres, eclat: 1.1, blanc: .5, lisere: .5, douceur: .25, spec: .3 });
    const E = [0, 1, 2].map(k => { const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), c = k === 1;
      const h = new THREE.Mesh(plan, matLueur(ctx, { pres, taille: c ? .34 : .27, force: c ? .42 : .34, rayons: .26, blanc: .5 }));
      m.scale.setScalar(c ? .165 : .12); g.add(m, h); objet.add(g); return { g, m, y0: 0, ph: k * 2.1 }; });
    ctx.preparer(objet);
    return { objet, encombrement: enc,
      placer(ctx) { const F = ctx.forme, R = F.reperes, H = R.haut, place = libre(F, H.y + .15);
        const haute = place < .45 && R.sommet.y - H.y > .25;              // de hautes oreilles autour : entre leurs pointes
        const yc = haute ? R.sommet.y - .02 : H.y + .17, xs = haute ? .34 : Math.min(.38, Math.max(.27, place * .8));
        objet.position.set(H.x, yc, H.z);
        E[0].g.position.set(-xs, 0, -.07); E[1].g.position.set(0, .2, .1); E[2].g.position.set(xs, 0, -.07);   // en arc : le diadème suit la tête
        for (let k = 0; k < 3; k++) E[k].y0 = E[k].g.position.y;
        enc.haut = yc + .2 + .165 + .1; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(.7 + .3 * e); mat.depthWrite = e > .97;
        const cam = ctx.U.uCamL.value;
        for (let k = 0; k < 3; k++) { const s = E[k]; s.g.position.y = s.y0 + Math.sin(t * 2 + s.ph) * .022 + (1 - e) * .1;
          versCamera(s.m, cam, .5, .35, t, s.ph); s.m.rotation.z = (k - 1) * -.28 + Math.sin(t * 1.4 + s.ph) * .05; } } };
  } },

  // 5 — chapeau de magicien : cône pointu (pointe qui s'incline et fléchit), bord roulé, ruban de lumière, étoiles peintes qui scintillent ; posé sur la tête,
  //     réduit entre des oreilles
  5: { nom: 'chapeau', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.85 }, objet = new THREE.Group(); objet.name = 'acc-chapeau';
    const mat = matObjet(ctx, { pres, eclat: 1, lisere: .55, douceur: .2, motif: 1, prof: .1, spec: .3 }); mat.uniforms.uFlex.value.set(0, 0, .42, 1);
    const chapeau = new THREE.Mesh(geoChapeau(THREE), mat); objet.add(chapeau); ctx.preparer(objet);
    let k0 = 1;
    return { objet, encombrement: enc,
      placer(ctx) { const F = ctx.forme, R = F.reperes, H = R.haut, place = libre(F, H.y + .06);
        k0 = Math.min(1, Math.max(.7, place / .44));                     // entre des oreilles : un chapeau un peu plus petit
        let y = assise(F, .44 * k0, R.sommet.y + .6); if (y < -8) y = H.y; y = Math.max(y, H.y - .3);
        objet.position.set(H.x, y - .02, H.z); enc.haut = y + .95 * k0; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(k0 * (.7 + .3 * e)); mat.depthWrite = e > .97;
        const tl = ctx.U.uTilt.value; mat.uniforms.uFlex.value.set(Math.sin(t * 1.25) * .035 - tl * .25, Math.sin(t * .9 + 1) * .025, .42, 1);   // la pointe traîne
        objet.rotation.z = .1 + Math.sin(t * 1.2) * .025; objet.rotation.x = .06; } };
  } },
  // 6 — anneaux de planète (v39) : deux anneaux plats et inclinés autour d'elle, comme Saturne (la moitié arrière passe derrière la tête)
  6: { nom: 'saturne', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.1 }, objet = new THREE.Group(); objet.name = 'acc-saturne';
    const anneau = (r, ep, eclat) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, ep, 8, 128).rotateX(Math.PI / 2).scale(1, .16, 1), matObjet(ctx, { pres, eclat, blanc: .25, lisere: .5, douceur: .5, motif: 2, spec: .25 })); objet.add(m); return m; };
    const A = anneau(1.3, .07, 1.02), B = anneau(1.52, .042, .92);
    const coque = new THREE.Mesh(new THREE.TorusGeometry(1.45, .2, 8, 128).rotateX(Math.PI / 2).scale(1, .2, 1), matLueur(ctx, { pres, coque: 1, force: .22, blanc: .25 }));
    objet.add(coque); ctx.preparer(objet); const mats = [A.material, B.material];
    let k0 = 1;
    return { objet, encombrement: enc,
      placer(ctx) { const R = ctx.forme.reperes, w = Math.max(Math.abs(R.droite.x), Math.abs(R.gauche.x), 1); k0 = w; objet.position.set(0, R.droite.y * .3, 0);
        enc.haut = Math.max(R.sommet.y, 1.6 * k0 * Math.sin(.42) + .1); enc.cote = 1.68 * k0; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(k0 * (.8 + .2 * e)); profondeur(mats, e);
        objet.rotation.set(.32 + Math.sin(t * .6) * .03, t * .12, -.38 + Math.sin(t * .8 + 1) * .03); } };
  } },

  // 7 — petite lune (v39) : une lune ronde qui tourne lentement autour d'elle (elle passe derrière, puis revient devant), avec son halo
  7: { nom: 'lune', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.3 }, objet = new THREE.Group(), orbite = new THREE.Group(); objet.name = 'acc-lune'; objet.add(orbite);
    const lune = new THREE.Mesh(new THREE.SphereGeometry(.2, 28, 18), matObjet(ctx, { pres, eclat: 1.05, blanc: .35, lisere: .6, douceur: .2, prof: .25, spec: .35 }));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matLueur(ctx, { pres, taille: .42, force: .4, rayons: 0, blanc: .5 }));
    const astre = new THREE.Group(); astre.add(lune, halo); orbite.add(astre); ctx.preparer(objet);
    let r0 = 1.45;
    return { objet, encombrement: enc,
      placer(ctx) { const R = ctx.forme.reperes; r0 = Math.max(Math.abs(R.droite.x), Math.abs(R.gauche.x), 1) + .45; objet.position.set(0, .25, 0); enc.haut = .25 + r0 * Math.sin(.35) + .25; enc.cote = r0 + .22; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; lune.material.depthWrite = e > .97;
        const a = t * .55 - .5; astre.position.set(Math.sin(a) * r0, Math.sin(a + .6) * .18, Math.cos(a) * r0); astre.scale.setScalar(.6 + .4 * e);
        orbite.rotation.z = -.35; } };
  } },

  // 8 — satellite (v39) : un petit satellite (corps, deux panneaux, une antenne) qui fait le tour d'elle ; un feu qui clignote
  8: { nom: 'satellite', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, feu = { value: 0 }, enc = { haut: 1.4 }, objet = new THREE.Group(), orbite = new THREE.Group(), sat = new THREE.Group(); objet.name = 'acc-satellite';
    const mC = matObjet(ctx, { pres, eclat: 1, blanc: .2, lisere: .5, douceur: .2, prof: .3, spec: .5 }), mP = matObjet(ctx, { pres, eclat: .9, blanc: .1, lisere: .6, douceur: .3, prof: .55, spec: .8 });
    const corpsS = new THREE.Mesh(new THREE.BoxGeometry(.13, .13, .19), mC);
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(.3, .012, .13), mP), p2 = p1.clone(); p1.position.x = .23; p2.position.x = -.23;
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .12, 6), mC); tige.position.y = .12;
    const lampe = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matLueur(ctx, { pres: feu, taille: .16, force: .7, rayons: .4, blanc: .7 })); lampe.position.y = .19;
    sat.add(corpsS, p1, p2, tige, lampe); orbite.add(sat); objet.add(orbite); ctx.preparer(objet); const mats = [mC, mP];
    let r0 = 1.5;
    return { objet, encombrement: enc,
      placer(ctx) { const R = ctx.forme.reperes; r0 = Math.max(Math.abs(R.droite.x), Math.abs(R.gauche.x), 1) + .55; objet.position.set(0, .1, 0); enc.haut = .1 + r0 * Math.sin(.5) + .3; enc.cote = r0 + .3; enc.bas = r0 * Math.sin(.5); },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; profondeur(mats, e);
        const a = -t * .4 + 2.4; sat.position.set(Math.sin(a) * r0, 0, Math.cos(a) * r0); sat.rotation.set(.3, a + Math.PI / 2, t * .3); sat.scale.setScalar(1.35 * (.7 + .3 * e));
        orbite.rotation.set(.18, 0, .5); feu.value = e * (Math.sin(t * 4) > .6 ? 1 : .15); } };
  } },

  // 9 — petite comète (v55) : une tête brillante qui file autour d'elle sur une orbite penchée, suivie d'une chevelure de lumière qui s'effile
  9: { nom: 'comete', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.35 }, objet = new THREE.Group(), orbite = new THREE.Group(), bras = new THREE.Group(); objet.name = 'acc-comete';
    objet.add(orbite); orbite.add(bras);
    const tete = new THREE.Mesh(new THREE.SphereGeometry(.12, 20, 14), matObjet(ctx, { pres, eclat: 1.2, blanc: .8, lisere: .5, douceur: .2, spec: .4 }));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matLueur(ctx, { pres, taille: .48, force: .8, rayons: .45, blanc: .75 }));
    const astre = new THREE.Group(); astre.add(tete, halo); bras.add(astre);
    const coeur = new THREE.Mesh(new THREE.BufferGeometry(), matObjet(ctx, { pres, eclat: 1.1, blanc: .6, lisere: .3, douceur: .6, fondu: [0, 1], ecrit: false }));
    const voile = new THREE.Mesh(new THREE.BufferGeometry(), matLueur(ctx, { pres, coque: 1, force: .85, blanc: .55 }));
    bras.add(voile, coeur); ctx.preparer(objet);
    let r0 = 0;
    function chevelure(r) {                                             // un arc derrière la tête, sur l'orbite (rare : à chaque silhouette)
      const pts = []; for (let i = 0; i <= 12; i++) { const a = -i / 12 * 1.05; pts.push(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)); }
      const c = new THREE.CatmullRomCurve3(pts); coeur.geometry.dispose(); voile.geometry.dispose();
      coeur.geometry = geoTige(THREE, c, .07, .008, 40, 10); voile.geometry = geoTige(THREE, c, .2, .03, 40, 12); r0 = r;
    }
    return { objet, encombrement: enc,
      placer(ctx) { const R = ctx.forme.reperes, r = Math.max(Math.abs(R.droite.x), Math.abs(R.gauche.x), 1) + .5; if (Math.abs(r - r0) > .01) chevelure(r);
        astre.position.set(0, 0, r); objet.position.set(0, .2, 0); enc.haut = .2 + r * Math.sin(.4) + .25; enc.cote = r + .3; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; tete.material.depthWrite = e > .97;
        bras.rotation.y = t * .75; bras.scale.setScalar(.85 + .15 * e); astre.scale.setScalar(.6 + .4 * e);
        orbite.rotation.set(.28, 0, .38); } };
  } },

  // 10 — croissant de lune (v55) : un croissant bombé qui flotte au-dessus de la tête, toujours tourné vers nous, avec une toute petite étoile entre ses pointes
  10: { nom: 'croissant', creer(ctx) {
    const { THREE } = ctx, pres = { value: 0 }, enc = { haut: 1.5 }, objet = new THREE.Group(), face = new THREE.Group(); objet.name = 'acc-croissant'; objet.add(face);
    const croissant = new THREE.Mesh(geoCroissant(THREE), matObjet(ctx, { pres, eclat: 1.08, blanc: .45, lisere: .5, douceur: .3, spec: .35 }));
    const etoile = new THREE.Mesh(geoEtoile(THREE, 1, .5, .48), matObjet(ctx, { pres, eclat: 1.12, blanc: .6, lisere: .5, douceur: .25, spec: .3 })); etoile.scale.setScalar(.08); etoile.position.set(.19, .03, .02);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matLueur(ctx, { pres, taille: .55, force: .26, rayons: 0, blanc: .35 }));
    const halo2 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matLueur(ctx, { pres, taille: .16, force: .45, rayons: .35, blanc: .6 })); halo2.position.copy(etoile.position);
    face.add(halo, croissant, etoile, halo2); ctx.preparer(objet); const mats = [croissant.material, etoile.material];
    let y0 = 1.3;
    return { objet, encombrement: enc,
      placer(ctx) { const R = ctx.forme.reperes; y0 = R.sommet.y + .4; objet.position.set(R.haut.x, y0, R.haut.z); enc.haut = y0 + .47; },
      maj(dt, t, etat, presence) { const e = lisse(presence); pres.value = e; objet.scale.setScalar(.7 + .3 * e); profondeur(mats, e);
        objet.position.y = y0 + Math.sin(t * 1.2) * .03 + (1 - e) * .12;
        versCamera(face, ctx.U.uCamL.value, .4, .25, t, .5); face.rotation.z = .5 + Math.sin(t * .9) * .06;
        etoile.rotation.z = Math.sin(t * 1.7) * .15; } };
  } },
};
