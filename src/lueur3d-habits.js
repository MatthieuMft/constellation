// Lueur 3D — habits (1 écharpe, 2 nœud papillon, 3 cape ; couleur : U.uHabitCol) et membres (petites ailes, petits bras, petits pieds ; couleur de la lueur : U.uColor).
// N'importe rien (pas même three : tout arrive par ctx) ; lueur3d.js l'importe et crée chaque partie UNE fois, au chargement, invisible.
//
// ═══ CONTRAT (recopié de lueur3d.js, qui fait foi ; lisez son en-tête pour le détail de ctx, U, GLSL, ORDRE) ═══
// HABITS[n] = { nom, creer(ctx) → inst }   (n = valeur de perso.habit : 1..3)
// MEMBRES.ailes / MEMBRES.bras / MEMBRES.pieds = { nom, creer(ctx) → inst }   (portés quand perso.ailes / bras / pieds est vrai)
//   inst = { objet: THREE.Object3D, maj?(dt, t, etat, presence), placer?(ctx), encombrement?: { haut, bas, cote }, liberer?() }
//   - objet : ajouté au pivot du corps (repère du corps : rayon ≈ 1, +Z = visage, +Y = haut) ; il suit l'écrasement et le penché.
//   - presence 0..1 (porté / retiré, lissé) ; objet.visible est géré par lueur3d.js. Servez-vous de presence pour un fondu (uOpacite) ou une pousse (échelle).
//   - placer(ctx) : à la création et à chaque changement de silhouette. Placez-vous UNIQUEMENT avec ctx.forme et ctx.visage :
//       ctx.forme.reperes.cou (sous le menton, sur l'avant) · .bas · .gauche · .droite · .haut · .arriere ; ctx.forme.rayon(y, angle) (tour de cou d'une écharpe,
//       épaules d'une cape) · surface(dx,dy,dz,out) · normale(x,y,z,out) · avant(x,y) · toucher(o…, d…, out) ; ctx.visage.point(qx, qy, out) (visage v11 :
//       sous le menton 0, -.255).
//   - maj : aucune allocation (pré-allouez vos Vector3 / Color dans creer). Animation : U.uT (temps), U.uFlap (battement des ailes -1..1, fourni par creature.js),
//     U.uJoy (bras qui font coucou quand elle est joyeuse, comme la v11), U.uTilt (la cape traîne dans les virages), U.uSleep, U.uSquash.
//   - encombrement : en unités du corps (bas de la cape ≈ 1.6, pieds ≈ 1.3, ailes : cote) ; sert à placer la bulle de dialogue.
// Matériaux : ctx.materiaux.lumiere({ couleur: ctx.U.uHabitCol (habits) ou ctx.U.uColor (membres), opacite, eclat, lisere, voile, douceur, cote })
//   — un objet de lumière dans le style de la lueur (modelé doux, liseré, voilé par le gaz quand il passe derrière, mode clair, apparition,
//   sortie encodée pré-multipliée, bords adoucis). Ou un ShaderMaterial à vous : transparent: true, depthTest: true, blending pré-multiplié
//   (One, OneMinusSrcAlpha), sortie versSortie(c)*a, multipliez par uApp, incluez GLSL.prelude + GLSL.formes + GLSL.voile + GLSL.sortie et
//   utilisez transmission(pCorps) ; ou ctx.materiaux.voiler(m) sur un MeshBasicMaterial. AUCUNE lumière de scène. Pas de texture canvas pour un dégradé.
//   ctx.preparer(objet) : renderOrder = ORDRE.parties, transparent, frustumCulled = false sur tout le sous-arbre (à appeler sur votre objet).
// Rendu : dessiné après le gaz et le visage, testé en profondeur contre le masque du corps (la cape passe derrière le corps, l'écharpe en fait le tour).
//   Pas de MSAA dans le site : évitez les arêtes fines dures (douceur, liseré). Lisible à 100-150 px de diamètre du corps.
// Variantes compilées une seule fois : changer d'habit ou de couleur ne doit rien recompiler (couleur par uniform, pas de define).
//
// ═══ CE FICHIER ═══
// Un seul ShaderMaterial à nous (même texte pour toutes les pièces → un programme, deux avec DoubleSide ; tout se règle par uniforms) :
//   le modelé de ctx.materiaux.lumiere (même formule + la lumière douce d'en haut à gauche des accessoires, voile du gaz, papier, apparition, pré-multiplié)
//   + uMotif : 1 tricot (côtes torsadées, uFreq côtes par tour, effacées sous le pixel), 2 plume (translucide, nervure, liseré), 3 cape (plis, ourlet
//   lumineux, doublure éclairée par la lueur), 4 nœud (plis rayonnants), 5 fermoir (cœur blanc chaud), 6 pan d’écharpe (tricot + franges au bout),
//   7 membres (volume de lumière clair, bord adouci)
//   + uDeforme 1 (cape, dans le vertex : l'ourlet traîne quand elle penche (uTilt), ondule et se gonfle (uT)) + uBlanc (cœur blanc des membres).
//   Couleur : uniform partagé (U.uHabitCol pour les habits, U.uColor pour les membres), jamais copiée. uOpacite = presence (fondu).
// Géométries construites une fois (creer), sommets reposés dans placer() d'après la silhouette (tubes qui épousent la surface, cape drapée sur rayon()).
// Ordre : ORDRE.parties ; les ailes (translucides, sans écriture de profondeur : les plumes se superposent) juste après, à ORDRE.parties + .5.
// Encombrement (rond) : écharpe bas ≈ 1.25 · cape bas ≈ 1.6, cote ≈ 1.4 · ailes cote ≈ 1.45 · bras cote ≈ 1.4 · pieds bas ≈ 1.25.

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }, mix = (a, b, t) => a + (b - a) * t;

// ── le matériau des habits et des membres ──
let SRC = null;
function sources(GLSL) {
  if (SRC) return SRC;
  const v = `uniform mat4 uInvL; uniform float uT, uTilt, uDeforme; varying vec3 vN; varying vec3 vV; varying vec3 vLoc; varying vec3 vO; varying vec2 vUv;
  void main(){ vec3 p = position; vUv = uv;
    if (uDeforme > .5) {                                              // cape (uv : x en travers, y du col à l'ourlet) : traîne, ondule, se gonfle
      float u = uv.x, h = uv.y; vec2 d = p.xz/max(length(p.xz), 1e-3);
      p.x -= sin(uTilt)*1.9*h*h;                                       // le pivot penche : l'ourlet reste en arrière (il traîne)
      p.xz += d*(.05*h*h + .045*sin(uT*1.3 + u*9.4 - h*2.4)*h);        // vagues qui courent dans le tissu
      p.y += .035*sin(u*18.85 + uT*2.2)*h*h*h; }                       // l'ourlet ondule
    vO = p; vec4 w = modelMatrix*vec4(p, 1.); vLoc = (uInvL*w).xyz; vec4 mv = viewMatrix*w; vN = normalMatrix*normal; vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
  const f = `uniform vec3 uCouleur; uniform float uOpacite, uEclat, uLisere, uDouceur, uBlanc, uMotif, uFreq; uniform vec2 uFondu;
  varying vec3 vN; varying vec3 vV; varying vec3 vLoc; varying vec3 vO; varying vec2 vUv;
  ${GLSL.prelude} ${GLSL.formes} ${GLSL.voile} ${GLSL.sortie}
  void main(){
    vec3 n = normalize(vN), v = normalize(vV); float dos = gl_FrontFacing ? 0. : 1.; if (dos > .5) n = -n;
    float cv = clamp(dot(n, v), 0., 1.), haut = clamp(n.y*.5 + .5, 0., 1.), lat = clamp(dot(n, vec3(-.52, .5, .69))*.5 + .5, 0., 1.);
    vec3 base = uCouleur, blanc = vec3(1., .97, .9); float a = uOpacite, k = 1., douce = uDouceur, lis = uLisere; int m = int(uMotif + .5);
    if (m == 1 || m == 6) {                                            // tricot : côtes torsadées (un tour de la section = un décalage), effacées sous le pixel
      float ph = vUv.x*uFreq + vUv.y, fw = fwidth(ph);
      k = 1. - .24*(.5 - .5*cos(ph*6.2832))*clamp(1.4 - fw*2.2, 0., 1.);
      if (m == 6) { float fr = smoothstep(.84, .9, vUv.x);             // pan : franges au bout (des brins séparés par des jours)
        a *= mix(1., smoothstep(-.35, .45, sin(vUv.y*6.2832*7.)), fr); k *= 1. - .18*fr; }
    } else if (m == 2) {                                               // plume : voile de lumière translucide, nervure, liseré brillant
      float nerv = exp(-pow((vUv.y - .5)/.07, 2.))*smoothstep(1., .55, vUv.x), barbe = .5 + .5*sin((vUv.x*9. + abs(vUv.y - .5)*6.)*6.2832);
      base = mix(base, vec3(1.), .5 + .25*nerv); k = .85 + .1*barbe*clamp(1.4 - fwidth(vUv.x*9.)*2.2, 0., 1.);
      a *= clamp(.34 + .55*pow(1. - cv, 1.6) + .3*nerv, 0., 1.)*mix(1., 1.5, uClair);
    } else if (m == 3) {                                               // cape : plis qui bougent, ourlet et bords lumineux, doublure plus profonde
      float pli = .86 + .14*sin(vUv.x*31.4 + vUv.y*2. + uT*.9), bord = max(smoothstep(.9, 1., vUv.y), max(smoothstep(.05, 0., vUv.x), smoothstep(.95, 1., vUv.x)));
      base = mix(base, vec3(1.), .22)*pli*(.85 + .3*vUv.y);
      base = mix(base, mix(vifDe(uColor), vec3(1.), .45), dos*.3*(1. - vUv.y*.6));   // la doublure reçoit la lumière de la lueur
      base = mix(base, mix(uCouleur, vec3(1.), .6), bord*.6); a *= .64 + .32*bord;
    } else if (m == 4) {                                               // nœud papillon : plis qui rayonnent du centre, creux près du nœud
      float an = atan(vO.y, abs(vO.x) + 1e-3); k = (.8 + .2*cos(an*9.))*(.7 + .3*smoothstep(.03, .17, abs(vO.x)));
    } else if (m == 7) {                                               // membres : volume de lumière clair (comme le gaz), bord adouci et lumineux
      base = mix(base, blanc, .12); a *= .95;
      if (uFondu.x != uFondu.y) { float r = smoothstep(uFondu.x, uFondu.y, vO.y); a *= r; base = mix(base, vifDe(uColor), (1. - r)*.4); }   // la racine naît du gaz
    } else if (m == 5) {                                               // fermoir : une petite pierre de lumière, cœur blanc chaud
      base = mix(base*1.05, blanc*1.2, smoothstep(.45, .95, cv)*.85);
    }
    vec3 c = base*(.5 + .3*haut + .32*lat)*(.8 + .25*cv)*uEclat*k + mix(base, vec3(1.), .55)*pow(1. - cv, 2.2)*lis*(1. - .5*uClair);
    c = mix(c, blanc*1.1, uBlanc*pow(cv, 2.5));
    float T = smoothstep(.25, .95, transmission(vLoc));                // plus franc que le voile brut : rien ne transparaît par le bas, plus fin, du gaz
    if (m == 3) T *= T;                                                // la cape, derrière : le corps la cache franchement
    c = mix(mix(vifDe(uColor), vec3(1., .96, .9), .4)*.85, c, T);      // derrière la frange du gaz : teinté par lui
    float dev = smoothstep(-.15, .25, dot(vLoc, normalize(uCamL)));    // côté caméra du corps ?
    a *= uApp*mix(T, 1., uClair*.7*dev)*mix(1., smoothstep(.0, .3, cv), douce);   // sur papier les pièces restent nettes devant ; derrière (cape, ailes, dos de l'écharpe) le corps les cache
    gl_FragColor = vec4(versSortie(c)*a, a); }`;
  return (SRC = { v, f });
}
function materiau(ctx, o = {}) {
  const { THREE, U } = ctx, S = sources(ctx.GLSL);
  return new THREE.ShaderMaterial({ vertexShader: S.v, fragmentShader: S.f, transparent: true, depthTest: true, depthWrite: o.ecrit !== false, side: o.cote ?? THREE.FrontSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uT: U.uT, uApp: U.uApp, uClair: U.uClair, uForme: U.uForme, uTex: U.uTex, uBornes: U.uBornes, uColor: U.uColor, uCamL: U.uCamL, uInvL: U.uInvL, uTilt: U.uTilt,
      uCouleur: o.couleur, uOpacite: { value: 0 }, uEclat: { value: o.eclat ?? 1 }, uLisere: { value: o.lisere ?? .6 }, uDouceur: { value: o.douceur ?? .4 },
      uBlanc: { value: o.blanc ?? 0 }, uMotif: { value: o.motif ?? 0 }, uFreq: { value: o.freq ?? 1 }, uFondu: { value: new THREE.Vector2(...(o.fondu || [0, 0])) }, uDeforme: { value: o.deforme ?? 0 } } });
}
const fondu = (mats, pr) => { for (let i = 0; i < mats.length; i++) mats[i].uniforms.uOpacite.value = pr; };

// ── géométries ──
// grille (nu+1) × (nv+1) sommets, uv = (i/nu, j/nv) ; les positions sont posées par placer()
function grille(THREE, nu, nv) {
  const n = (nu + 1) * (nv + 1), uv = new Float32Array(n * 2), idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const k = i * (nv + 1) + j; uv[k * 2] = i / nu; uv[k * 2 + 1] = j / nv; }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
const fini = g => { g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); };
// repère d'un tube : T (dérivée des centres C), N rendu perpendiculaire, B = N × T (normales des faces vers l'extérieur)
function repereTube(nu, C, N, B, ferme) {
  for (let i = 0; i <= nu; i++) {
    const i0 = i > 0 ? i - 1 : (ferme ? nu - 1 : 0), i1 = i < nu ? i + 1 : (ferme ? 1 : nu);
    let tx = C[i1 * 3] - C[i0 * 3], ty = C[i1 * 3 + 1] - C[i0 * 3 + 1], tz = C[i1 * 3 + 2] - C[i0 * 3 + 2]; const lt = Math.hypot(tx, ty, tz) || 1; tx /= lt; ty /= lt; tz /= lt;
    let nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2]; const d = nx * tx + ny * ty + nz * tz; nx -= tx * d; ny -= ty * d; nz -= tz * d;
    const ln = Math.hypot(nx, ny, nz) || 1; nx /= ln; ny /= ln; nz /= ln;
    N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz; B[i * 3] = ny * tz - nz * ty; B[i * 3 + 1] = nz * tx - nx * tz; B[i * 3 + 2] = nx * ty - ny * tx;
  }
}
// section elliptique (demi-axes th selon N, w selon B) ; la couture (j = 0) est côté corps, cachée
function tube(g, nu, nv, C, N, B, th, w) {
  const P = g.attributes.position;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const f = Math.PI + TAU * j / nv, c = Math.cos(f) * th[i], s = Math.sin(f) * w[i], k = i * 3;
    P.setXYZ(i * (nv + 1) + j, C[k] + N[k] * c + B[k] * s, C[k + 1] + N[k + 1] * c + B[k + 1] * s, C[k + 2] + N[k + 2] * c + B[k + 2] * s);
  }
  fini(g);
}
// lissage circulaire (une étoile ne fait pas zigzaguer une bande) ; tmp : tableau de travail
function lisser(src, dst, tmp, n, passes) {
  dst.set(src.subarray(0, n));
  for (let p = 0; p < passes; p++) { for (let i = 0; i < n; i++) tmp[i] = (dst[(i + n - 1) % n] + 2 * dst[i] + dst[(i + 1) % n]) / 4; dst.set(tmp.subarray(0, n)); }
}
// rayon horizontal adouci (le plus grand de trois angles voisins : une cape ne rentre pas entre les branches d'une étoile)
const rayonL = (F, y, a) => Math.max(F.rayon(y, a - .24), F.rayon(y, a), F.rayon(y, a + .24));

// nœud papillon : deux ailes (ellipsoïdes pincés vers le centre, encoche au bout, courbés comme le corps), repère du nœud (Z = normale)
function geoNoeud(THREE) {
  const s = new THREE.SphereGeometry(1, 28, 18), P = s.attributes.position, n = P.count, ix = s.index.array, m = ix.length;
  const pos = new Float32Array(n * 6), idx = new Uint32Array(m * 2), uv = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), u = (x + 1) / 2, p = .3 + .7 * Math.pow(sm(0, .8, u), .7);
    let X = .03 + u * .25, Y = y * .145 * p, Z = z * .07 * p * (1 - .45 * u);
    X -= .05 * Math.pow(1 - Math.abs(y), 3) * sm(.7, 1, u);              // l'encoche au bout de chaque aile
    Z += .02 - .45 * X * X;                                              // les ailes suivent la courbe du corps
    pos.set([X, Y, Z], i * 3); pos.set([-X, Y, Z], (n + i) * 3); uv.set([u, y * .5 + .5], i * 2); uv.set([u, y * .5 + .5], (n + i) * 2);
  }
  for (let i = 0; i < m; i += 3) { idx.set([ix[i], ix[i + 1], ix[i + 2]], i); idx.set([n + ix[i], n + ix[i + 2], n + ix[i + 1]], m + i); }   // miroir : sens inversé
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); s.dispose(); return g;
}
// aile : trois plumes en éventail (ellipsoïdes fins, pointe un peu relevée) ; uv = (de la base à la pointe, en travers)
const PLUMES = [[.66, .95, .17], [.22, .8, .145], [-.2, .64, .12]];   // [angle, longueur, demi-largeur]
function geoAile(THREE) {
  const s = new THREE.SphereGeometry(1, 24, 12); s.rotateZ(-Math.PI / 2);   // pôles sur ±x
  const P = s.attributes.position, n = P.count, ix = s.index.array, m = ix.length, np = PLUMES.length;
  const pos = new Float32Array(n * 3 * np), uv = new Float32Array(n * 2 * np), idx = new Uint32Array(m * np);
  for (let f = 0; f < np; f++) {
    const [an, L, W] = PLUMES[f], c = Math.cos(an), si = Math.sin(an);
    for (let i = 0; i < n; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), u = (x + 1) / 2;
      const X = u * L, Y = y * W * (1 - .22 * u) + .1 * u * u * L, Z = z * .03 + .04 * u * u * L;
      pos.set([X * c - Y * si, X * si + Y * c, Z - f * .012], (f * n + i) * 3); uv.set([u, y * .5 + .5], (f * n + i) * 2);
    }
    for (let i = 0; i < m; i++) idx[f * m + i] = f * n + ix[i];
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); s.dispose(); return g;
}
// profil tourné (du bas vers le haut) : bras (+Y : de l'épaule à la main ronde), jambe (−Y : de la hanche au pied)
const lathe = (THREE, pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-3), y)), seg);
const PROFIL_BRAS = [[0, -.12], [.07, -.1], [.088, 0], [.094, .1], [.105, .18], [.122, .24], [.13, .3], [.122, .36], [.097, .405], [.052, .43], [0, .436]];
const PROFIL_JAMBE = [[0, -.15], [.05, -.14], [.07, -.08], [.076, 0], [.07, .05], [0, .07]];

// ── les habits ──
export const HABITS = {
  // 1 — écharpe tricotée : une bande torsadée qui fait le tour du corps sous le visage, un nœud sur le côté, deux pans qui pendent et se balancent
  1: { nom: 'écharpe', creer(ctx) {
    const { THREE, U } = ctx, NA = 72, NS = 10, NP = 22;
    const objet = new THREE.Group(); objet.name = 'echarpe';
    const mBande = materiau(ctx, { couleur: U.uHabitCol, motif: 1, freq: 84, lisere: .5, douceur: .3 });
    const mNoeud = materiau(ctx, { couleur: U.uHabitCol, motif: 1, freq: 9, lisere: .5, douceur: .3 });
    const mPan = materiau(ctx, { couleur: U.uHabitCol, motif: 6, freq: 11, lisere: .5, douceur: .3 });
    const mats = [mBande, mNoeud, mPan];
    const gB = grille(THREE, NA, NS), gP = grille(THREE, NP, NS);
    const bande = new THREE.Mesh(gB, mBande), noeud = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mNoeud);
    const panA = new THREE.Group(), panB = new THREE.Group(); panA.add(new THREE.Mesh(gP, mPan)); panB.add(new THREE.Mesh(gP, mPan)); panB.children[0].scale.set(.9, .6, .9);
    objet.add(bande, panB, panA, noeud);
    const C = new Float32Array((NA + 1) * 3), N = new Float32Array((NA + 1) * 3), B = new Float32Array((NA + 1) * 3), TH = new Float32Array(NA + 1), W = new Float32Array(NA + 1);
    const ys = new Float32Array(NA), rr = new Float32Array(NA), rs = new Float32Array(NA), tmp = new Float32Array(NA);
    const C2 = new Float32Array((NP + 1) * 3), N2 = new Float32Array((NP + 1) * 3), B2 = new Float32Array((NP + 1) * 3), TH2 = new Float32Array(NP + 1), W2 = new Float32Array(NP + 1);
    const o = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3(), M = new THREE.Matrix4();
    const enc = { bas: 1.25 };
    ctx.preparer(objet);
    return { objet, encombrement: enc,
      placer(ctx) {
        const F = ctx.forme, e = ctx.visage.echelle, cou = F.reperes.cou;
        const yF = cou.y - .07 * e, yB = yF + .14 * e, th = .072 * e, w = .118 * e;   // centre de la bande : sous le menton devant, un peu plus haut derrière
        for (let i = 0; i < NA; i++) { const a = Math.PI + i / NA * TAU; ys[i] = yF + (yB - yF) * (.5 - .5 * Math.cos(a)); rr[i] = F.rayon(ys[i], a); }
        lisser(rr, rs, tmp, NA, 4);
        for (let i = 0; i <= NA; i++) {
          const k = i % NA, a = Math.PI + k / NA * TAU, r = Math.max(rs[k], rr[k]);
          o.set(Math.sin(a) * r, ys[k], Math.cos(a) * r); F.normale(o.x, o.y, o.z, n);
          C[i * 3] = o.x + n.x * th * .8; C[i * 3 + 1] = o.y + n.y * th * .8; C[i * 3 + 2] = o.z + n.z * th * .8; N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z; TH[i] = th; W[i] = w;
        }
        repereTube(NA, C, N, B, true); tube(gB, NA, NS, C, N, B, TH, W);
        // le nœud, sur le côté droit du menton (comme la v11), et les pans qui en tombent
        const iK = Math.round((.42 + Math.PI) / TAU * NA) % NA, k3 = iK * 3;
        n.set(N[k3], N[k3 + 1], N[k3 + 2]); b.set(B[k3], B[k3 + 1], B[k3 + 2]); t.crossVectors(b, n);
        noeud.position.set(C[k3], C[k3 + 1], C[k3 + 2]).addScaledVector(n, th * .55); noeud.quaternion.setFromRotationMatrix(M.makeBasis(t, b, n)); noeud.scale.set(w * 1.05, w * .95, th * 1.3);
        panA.position.copy(noeud.position).addScaledVector(n, -th * .25); panB.position.copy(panA.position).addScaledVector(n, -th * .2);
        const L = .62 * e;
        for (let i = 0; i <= NP; i++) {
          const u = i / NP; C2[i * 3] = .07 * u * e; C2[i * 3 + 1] = -L * u; C2[i * 3 + 2] = (.03 * Math.sin(Math.PI * u) - .02 * u) * e;
          N2[i * 3] = 0; N2[i * 3 + 1] = 0; N2[i * 3 + 2] = 1; TH2[i] = .032 * e * (1 - .7 * sm(.88, 1, u)); W2[i] = (.09 + .03 * u) * e;
        }
        repereTube(NP, C2, N2, B2, false); tube(gP, NP, NS, C2, N2, B2, TH2, W2);
        enc.bas = Math.max(1, -(panA.position.y - L) + .03);
      },
      maj(dt, tt, etat, pr) {
        fondu(mats, pr); const tl = U.uTilt.value;
        panA.rotation.set(.07 * Math.sin(tt * 1.1 + .4), .55, .09 * Math.sin(tt * 1.4) - tl * .85);          // le pan se balance et reste vertical quand elle penche
        panB.rotation.set(.06 * Math.sin(tt * 1.25 + 1.3), .7, .45 + .08 * Math.sin(tt * 1.6 + 1) - tl * .85);
      } };
  } },

  // 2 — nœud papillon sous la bouche : deux ailes plissées et un petit nœud, posés sur la courbe
  2: { nom: 'nœud papillon', creer(ctx) {
    const { THREE, U } = ctx;
    const objet = new THREE.Group(); objet.name = 'noeud-papillon';
    const mAiles = materiau(ctx, { couleur: U.uHabitCol, motif: 4, lisere: .55, douceur: .3 }), mCentre = materiau(ctx, { couleur: U.uHabitCol, eclat: .92, lisere: .5, douceur: .3 });
    const mats = [mAiles, mCentre];
    const ailes = new THREE.Mesh(geoNoeud(THREE), mAiles), centre = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), mCentre);
    centre.scale.set(.062, .082, .055); centre.position.z = .04; objet.add(ailes, centre);
    const c = new THREE.Vector3(), n = new THREE.Vector3(), x = new THREE.Vector3(), y = new THREE.Vector3(), M = new THREE.Matrix4();
    ctx.preparer(objet);
    return { objet,
      placer(ctx) {
        const F = ctx.forme, e = ctx.visage.echelle; ctx.visage.point(0, -.235, c); F.normale(c.x, c.y, c.z, n);
        x.set(n.z, 0, -n.x).normalize(); y.crossVectors(n, x);
        objet.position.copy(c).addScaledVector(n, .03 * e); objet.quaternion.setFromRotationMatrix(M.makeBasis(x, y, n)); objet.scale.setScalar(1.18 * e);
      },
      maj(dt, t, etat, pr) { fondu(mats, pr); } };
  } },

  // 3 — cape de lumière : drapée sur le dos (elle épouse le haut du corps puis tombe en s'évasant), ourlet qui ondule et traîne ; lien et fermoir devant
  3: { nom: 'cape', creer(ctx) {
    const { THREE, U } = ctx, NU = 40, NV = 24, NL = 36, NS = 8, TM = 1.5;   // TM : demi-ouverture de la cape autour du dos (rad)
    const objet = new THREE.Group(); objet.name = 'cape';
    const mDrape = materiau(ctx, { couleur: U.uHabitCol, motif: 3, deforme: 1, cote: THREE.DoubleSide, eclat: 1.2, lisere: .7, douceur: .15 });
    const mLien = materiau(ctx, { couleur: U.uHabitCol, eclat: 1.08, lisere: .5, douceur: .3 }), mFermoir = materiau(ctx, { couleur: U.uHabitCol, motif: 5, lisere: .5, douceur: .25 });
    const mats = [mDrape, mLien, mFermoir];
    const gC = grille(THREE, NU, NV), gL = grille(THREE, NL, NS);
    const drape = new THREE.Mesh(gC, mDrape), lien = new THREE.Mesh(gL, mLien), fermoir = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), mFermoir);
    objet.add(drape, lien, fermoir);
    const C = new Float32Array((NL + 1) * 3), N = new Float32Array((NL + 1) * 3), B = new Float32Array((NL + 1) * 3), TH = new Float32Array(NL + 1), W = new Float32Array(NL + 1);
    const NG = (NU + 1) * (NV + 1), RG = new Float32Array(NG), RT = new Float32Array(NG), AG = new Float32Array(NG), YG = new Float32Array(NG), DG = new Float32Array(NG);
    const o = new THREE.Vector3(), n = new THREE.Vector3(), x = new THREE.Vector3(), y = new THREE.Vector3(), M = new THREE.Matrix4();
    const enc = { bas: 1.6, cote: 1.4 };
    ctx.preparer(objet);
    return { objet, encombrement: enc,
      placer(ctx) {
        const F = ctx.forme, e = ctx.visage.echelle, cou = F.reperes.cou, P = gC.attributes.position;
        const yHaut = Math.min(.42, F.reperes.haut.y * .45), yCote = cou.y + .14 * e, yOurlet = Math.min(F.reperes.bas.y - .6, -1.45);
        let cote = 0;
        for (let i = 0; i <= NU; i++) {
          const th0 = TM * (1 - 2 * i / NU), q = (th0 / TM) ** 2, yT = mix(yHaut, yCote, q), yH = yOurlet + .1 * q;
          for (let j = 0; j <= NV; j++) {
            const k = i * (NV + 1) + j, v = j / NV, yy = mix(yT, yH, v), dep = sm(0, 1.5, -yy), a = Math.PI + th0 * (1 - .18 * dep);   // en descendant, les bords reviennent un peu vers le dos
            const rb = rayonL(F, yy, a) + .05 + .03 * v, env = rayonL(F, 0, a) + .05 + .3 * Math.max(0, -yy);    // épouse le haut du dos, puis tombe en s'évasant
            RG[k] = yy < 0 ? Math.max(env, Math.min(rb, env + .2)) : rb;   // une queue, une pointe ne la déchirent pas : elles passent dessous
            AG[k] = a; YG[k] = yy; DG[k] = dep;
          }
        }
        for (let p = 0; p < 2; p++) {                                     // lissage 3 × 3 : un drapé souple
          RT.set(RG);
          for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
            let sw = 0, sr = 0;
            for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const ii = i + di, jj = j + dj; if (ii < 0 || ii > NU || jj < 0 || jj > NV) continue; const wgt = (2 - Math.abs(di)) * (2 - Math.abs(dj)); sw += wgt; sr += wgt * RT[ii * (NV + 1) + jj]; }
            RG[i * (NV + 1) + j] = sr / sw;
          }
        }
        for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
          const k = i * (NV + 1) + j, a = AG[k], r = RG[k] + .06 * (j / NV) * Math.sin(TM * (1 - 2 * i / NU) * 10.5);   // de vrais plis, qui s'ouvrent vers l'ourlet
          P.setXYZ(k, Math.sin(a) * r, YG[k], Math.cos(a) * r - .2 * DG[k]); cote = Math.max(cote, Math.abs(Math.sin(a) * r));
        }
        fini(gC);
        // le lien : de l'épaule gauche à l'épaule droite en passant sous le menton
        const bm = Math.PI - TM;
        for (let i = 0; i <= NL; i++) {
          const bb = bm * (2 * i / NL - 1), q = (bb / bm) ** 2, yy = mix(cou.y + .015 * e, yCote, q), rb = F.rayon(yy, bb);
          o.set(Math.sin(bb) * rb, yy, Math.cos(bb) * rb); F.normale(o.x, o.y, o.z, n);
          C[i * 3] = o.x + n.x * .03 * e; C[i * 3 + 1] = o.y + n.y * .03 * e; C[i * 3 + 2] = o.z + n.z * .03 * e; N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z; TH[i] = W[i] = .028 * e;
        }
        repereTube(NL, C, N, B, false); tube(gL, NL, NS, C, N, B, TH, W);
        // le fermoir, au milieu du lien
        const k3 = (NL >> 1) * 3; n.set(N[k3], N[k3 + 1], N[k3 + 2]); x.set(n.z, 0, -n.x).normalize(); y.crossVectors(n, x);
        fermoir.position.set(C[k3], C[k3 + 1], C[k3 + 2]).addScaledVector(n, .025 * e); fermoir.quaternion.setFromRotationMatrix(M.makeBasis(x, y, n)); fermoir.scale.set(.072 * e, .072 * e, .045 * e);
        enc.bas = -yOurlet + .06; enc.cote = cote + .05;
      },
      maj(dt, t, etat, pr) { fondu(mats, pr); } };
  } },
};

// ── les membres (couleur de la lueur) ──
export const MEMBRES = {
  // petites ailes : trois plumes de lumière translucides par côté, attachées dans le dos, qui battent (U.uFlap)
  ailes: { nom: 'petites ailes', creer(ctx) {
    const { THREE, U, ORDRE } = ctx;
    const objet = new THREE.Group(); objet.name = 'ailes';
    const m = materiau(ctx, { couleur: U.uColor, motif: 2, lisere: .9, douceur: .1, ecrit: false }), mats = [m], geo = geoAile(THREE);
    const racines = [];
    for (let k = 0; k < 2; k++) {                                       // k = 0 : droite ; k = 1 : gauche (même aile, en miroir)
      const cote = new THREE.Group(), racine = new THREE.Group(); if (k) cote.scale.x = -1;
      racine.add(new THREE.Mesh(geo, m)); cote.add(racine); objet.add(cote); racines.push(racine);
    }
    const o = new THREE.Vector3(), enc = { cote: 1.45, haut: 1 };
    ctx.preparer(objet, ORDRE.parties + .5);
    return { objet, encombrement: enc,
      placer(ctx) {
        const F = ctx.forme;
        for (let k = 0; k < 2; k++) { F.surface(k ? -.8 : .8, .2, -.56, o); o.multiplyScalar(.93); racines[k].position.set(Math.abs(o.x), o.y, o.z); }
        enc.cote = racines[0].position.x + .72; enc.haut = racines[0].position.y + .75;
      },
      maj(dt, t, etat, pr) {
        fondu(mats, pr); const f = U.uFlap.value, s = .6 + .4 * pr;
        for (let k = 0; k < 2; k++) { racines[k].rotation.set(0, .42 + .2 * f, .12 + .3 * f); racines[k].scale.setScalar(s); }
      } };
  } },

  // petits bras : deux petits volumes de lumière sur les côtés ; le gauche fait coucou de temps en temps, et dès qu'elle est joyeuse (comme la v11)
  bras: { nom: 'petits bras', creer(ctx) {
    const { THREE, U } = ctx;
    const objet = new THREE.Group(); objet.name = 'bras';
    const m = materiau(ctx, { couleur: U.uColor, motif: 7, blanc: .3, eclat: 1.1, lisere: .6, douceur: .55, fondu: [-.11, .07] }), mats = [m], geo = lathe(THREE, PROFIL_BRAS, 18);
    const epaules = [];
    for (let k = 0; k < 2; k++) { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, m)); objet.add(g); epaules.push(g); }
    const o = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), enc = { cote: 1.4 };
    ctx.preparer(objet);
    return { objet, encombrement: enc,
      placer(ctx) {
        const F = ctx.forme;
        for (let k = 0; k < 2; k++) { F.surface(k ? 1 : -1, -.2, .3, o); epaules[k].position.copy(o).multiplyScalar(.88); }
        enc.cote = Math.max(Math.abs(epaules[0].position.x), epaules[1].position.x) + .42;
      },
      maj(dt, t, etat, pr) {
        fondu(mats, pr); const joie = U.uJoy.value, dort = U.uSleep.value, cy = (t / 7) % 1;
        for (let k = 0; k < 2; k++) {
          const s = k ? 1 : -1;
          let cc = s < 0 ? Math.max(sm(0, .06, cy) * sm(.34, .26, cy), sm(.55, .95, joie)) : 0; cc *= 1 - dort;   // le gauche fait coucou
          const an = mix(-.62 + .12 * Math.sin(t * 1.7 + s) - .3 * dort, .78 + .32 * Math.sin(t * 10), cc);
          d.set(s * Math.cos(an), Math.sin(an), .3 + .2 * cc).normalize(); epaules[k].quaternion.setFromUnitVectors(Y, d); epaules[k].scale.setScalar(.55 + .45 * pr);
        }
      } };
  } },

  // petits pieds : deux petites jambes sous le corps, pieds ovales vers l'avant, qui pendent et se balancent
  pieds: { nom: 'petits pieds', creer(ctx) {
    const { THREE, U } = ctx;
    const objet = new THREE.Group(); objet.name = 'pieds';
    const m = materiau(ctx, { couleur: U.uColor, motif: 7, blanc: .3, eclat: 1.1, lisere: .6, douceur: .55 }), mJ = materiau(ctx, { couleur: U.uColor, motif: 7, blanc: .3, eclat: 1.1, lisere: .6, douceur: .55, fondu: [.07, -.04] }), mats = [m, mJ];
    const gJ = lathe(THREE, PROFIL_JAMBE, 16), gP = new THREE.SphereGeometry(1, 20, 14), hanches = [];
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1, h = new THREE.Group(), pied = new THREE.Mesh(gP, m);
      pied.scale.set(.125, .088, .165); pied.position.set(s * .02, -.17, .06); h.add(new THREE.Mesh(gJ, mJ), pied); objet.add(h); hanches.push(h);
    }
    const o = new THREE.Vector3(), enc = { bas: 1.25 };
    ctx.preparer(objet);
    return { objet, encombrement: enc,
      placer(ctx) {
        const F = ctx.forme;
        for (let k = 0; k < 2; k++) { F.surface(k ? .36 : -.36, -1, .14, o); hanches[k].position.copy(o).multiplyScalar(.93); }
        enc.bas = -Math.min(hanches[0].position.y, hanches[1].position.y) + .27;
      },
      maj(dt, t, etat, pr) {
        fondu(mats, pr); const calme = 1 - .7 * U.uSleep.value;
        for (let k = 0; k < 2; k++) {
          const s = k ? 1 : -1;
          hanches[k].rotation.set(Math.sin(t * 2.3 + s * 1.2) * .3 * calme, 0, s * (.1 + .05 * Math.sin(t * 1.9 + s)));
          hanches[k].scale.setScalar(.55 + .45 * pr);
        }
      } };
  } },
};
