// Lueur 3D — la mascotte en volume (v12) : un orbe de gaz lumineux, lisse, poussière d'étoiles dedans (étude 7C), avec le visage de la v11.
//
// ═══════════════════════════════ CONTRAT (fait foi pour lueur3d-formes.js, lueur3d-accessoires.js, lueur3d-habits.js) ═══════════════════════════════
//
// const lueur = creerLueur3D({ graine = 7 })
//   lueur.groupe   THREE.Group à ajouter à sceneUI. Corps de rayon ≈ 1 à l'échelle 1 ; +Z = direction du visage ; +Y = haut ; centre = origine.
//                  L'appelant le place (position), le met à l'échelle (taille v11 : groupe.scale.setScalar(uSize*.25)) et l'oriente (orienter).
//   lueur.pivot    sous-groupe du corps (écrasement uSquash, penché uTilt) : TOUT ce qui touche le corps s'y accroche. Repère du corps = repère du pivot.
//   lueur.maj(dt, t, etat)   à chaque image, aucune allocation. Une clé absente garde sa valeur (on peut aussi écrire lueur.U.uJoy.value…).
//     etat = { couleur: THREE.Color (linéaire, déjà lissée) | '#hex',  clair: 0|1 (thème Papier),  app: 0..1 (apparition : fondu de tout),
//              joie, triste, calme, grands, sommeil, cligne, eclat: 0..1,  sourcils: -1 (fâchés)..1 (inquiets),  regard: {x, y} (≈ -1..1),
//              expr: {x: rieuse, y: rêveuse, z: malicieuse, w: étonnée} | [x, y, z, w] (0..1, l'expression au repos), yeuxEtoiles: 0|1,
//              battement: -1..1 (ailes), ecrase: {x, y} (1 = rien), penche: radians, habitCouleur: THREE.Color (facultatif),
//              perso: creature.perso() = { forme, texture, yeux, yeuxCouleur, acc, accCouleur, habit, ailes, bras, pieds, … } }
//     Correspondance v11 : joie uJoy · triste uSad · sourcils uBrow · eclat uSpark · calme uRelax · grands uWide · sommeil uSleep · cligne uBlink ·
//     regard uLook · expr uExpr · yeuxEtoiles uStarEye · battement uFlap · ecrase uSquash · penche uTilt · app uApp · clair uClair.
//     Couleur de l'habit (U.uHabitCol), comme la v11 : habitCouleur si donnée, sinon accCouleur si elle a été choisie (≠ #ffd98a),
//     sinon la complémentaire de la lueur. Couleur de l'accessoire : U.uAccCol (accCouleur). Ailes, bras, pieds : la couleur de la lueur (U.uColor).
//   lueur.orienter(camera, lacet = 0, tangage = 0)   visage vers la caméra (+ un petit lacet / tangage en radians, pour regarder ailleurs), sans allocation.
//   lueur.encombrement()  { haut, bas, cote } en unités du corps (silhouette + parties portées) : pour la bulle et la zone de clic.
//   lueur.ecran(camera, largeur, hauteur)  { x, y, r } : centre et rayon du corps à l'écran en px CSS (objet réutilisé ; × encombrement pour la bulle).
//   lueur.prechauffer(renderer, camera)   compile d'avance TOUS les matériaux (parties invisibles comprises) : sous l'écran de chargement.
//   lueur.U  uniforms partagés (par référence).  lueur.forme · lueur.visage : l'API de placement (ci-dessous).  lueur.liberer().
//
// RENDU (comme dans le site) : sceneUI est dessinée APRÈS le composer, directement à l'écran, sans lumière ni tone mapping :
//     composer.render(); renderer.autoClear = false; renderer.clearDepth(); renderer.render(sceneUI, camera); renderer.autoClear = true;
//   clearDepth() est INDISPENSABLE : la passe de sortie du composer laisse une profondeur 0 partout (le masque et les parties se testent en profondeur).
//   Matériaux autonomes (aucune lumière de scène) qui encodent eux-mêmes leur sortie (linearToOutputTexel → sRGB à l'écran) ; THREE.Color = linéaire.
//   Sortie en alpha pré-multiplié (blending One / OneMinusSrcAlpha) : rgb = ce qui s'ajoute, a = ce qui est voilé derrière.
//   Pas de MSAA dans le site (antialias: false) : les bords se font dans les shaders (liseré, fondu rasant).
//   ORDRE (renderOrder) : halo 0 → derriere 1 → corps (le gaz) 2 → grains 3 → visage 5 → parties 6 → devant 7.
//   Le masque (surface du corps × .72, profondeur seule, opaque donc dessiné en tout premier) cache ce qui passe derrière le cœur ; entre lui et le bord
//   du gaz, c'est transmission() qui voile en douceur (pas d'arête nette).
//   Les parties sont dessinées APRÈS le gaz (ORDRE.parties) : le masque les cache derrière le cœur, et transmission() (GLSL.voile) les voile
//   quand elles passent derrière le gaz (lumiere() et voiler() le font déjà). ORDRE.devant : par-dessus les autres parties (lunettes sur une écharpe…).
//   RÈGLE : tout matériau de partie a transparent: true (sinon three le dessine avant le gaz), depthTest: true, et sort en pré-multiplié.
//
// PARTIES (lueur3d-accessoires.js : ACCESSOIRES[1..5] ; lueur3d-habits.js : HABITS[1..3] et MEMBRES.ailes / bras / pieds ;
//          lueur3d-formes.js : FORMES[nom].creer et MATIERES[nom].creer, facultatifs) :
//   def = { nom, creer(ctx) → inst }   inst = { objet: THREE.Object3D, maj?(dt, t, etat, presence), placer?(ctx), encombrement?: { haut, bas, cote }, liberer?() }
//   - creer est appelé UNE fois, au chargement (toutes les parties existent, invisibles) ; lueur3d.js ajoute inst.objet au pivot s'il n'a pas de parent.
//   - presence 0..1 : lissée par lueur3d.js quand l'article est porté / retiré ; objet.visible = presence > 0 (servez-vous-en pour un fondu ou une pousse).
//   - placer(ctx) : appelé à la création et à chaque changement de silhouette → se reposer avec ctx.forme / ctx.visage (jamais de constantes en dur).
//   - maj : appelée seulement quand presence > 0, aucune allocation (pré-allouez vos Vector3) ; lisez les uniforms partagés (U.uT, U.uFlap…).
//   - encombrement : en unités du corps, compté quand presence > .5 (chapeau : haut ≈ 2.3 ; cape : bas ≈ 1.6…).
//   ctx = {
//     THREE, ORDRE, GLSL (morceaux de shader : prelude, formes, voile, sortie — voir plus bas), U (uniforms partagés), pivot,
//     forme: { nom, bornes, sd(x,y,z), surface(dx,dy,dz,out) (point de la surface dans une direction, depuis le centre, le plus à l'extérieur),
//              normale(x,y,z,out), avant(x,y) → z de la surface avant (NaN hors silhouette), toucher(ox,oy,oz,dx,dy,dz,out) → t du 1er contact (-1 sinon),
//              rayon(y, angle) → distance horizontale de l'axe vertical à la surface, à la hauteur y, vers (sin angle, 0, cos angle) (0 si rien),
//              reperes: { haut (dessus de la tête, à la verticale du centre : là où se pose un chapeau), sommet (le point le plus haut : pointe d'oreille),
//                         bas, gauche, droite (à y = 0), avant, arriere, cou (sous le menton, sur la surface avant) } (THREE.Vector3, mis à jour en place) },
//     visage: { y, echelle, point(qx, qy, out) → point de la surface depuis les coordonnées du visage v11 (rayon du corps .5 ; yeux ±.16, .08 ;
//               rayon d'œil .088 × .115 ; bouche 0, -.1 ; joues ±.3, -.02 ; sourcils y .26 ; sous le menton 0, -.255), oeil(s, out) (s = -1 gauche, 1 droite) },
//     materiaux: { lumiere(options) → ShaderMaterial « objet de lumière » dans le style de la lueur (couleur, modelé doux, liseré, voile du gaz,
//                  mode clair, apparition, sortie encodée pré-multipliée, bords adoucis) ; options : { couleur: uniform {value: Color} (U.uAccCol, U.uHabitCol,
//                  U.uColor…) ou THREE.Color, opacite = 1, eclat = 1, lisere = .6, voile = 1, douceur = .6 (fondu des bords rasants), cote = THREE.FrontSide },
//                  voiler(materiau) → patch d'un matériau three de base (MeshBasicMaterial…) : voile du gaz + apparition + mode clair + pré-multiplié },
//     preparer(objet, ordre = ORDRE.parties) → objet   met renderOrder, transparent et frustumCulled = false sur tout le sous-arbre.
//   }
//   U (objets { value }) : uT (temps, s), uApp, uClair, uColor (lueur, linéaire), uAccCol, uHabitCol, uFlap, uJoy, uSad, uSleep, uLook, uSquash, uTilt,
//     uForme, uTex, uBornes, uCamL (caméra dans le repère du pivot), uInvL (monde → pivot), + ceux du visage. Ne remplacez jamais un .value objet : copiez dedans.
//   GLSL.prelude : uniforms uT uApp uClair uForme uTex uBornes uColor ; smin, smax, sdEllipsoide, sdCapsule, sdCone, sdTore, sdBoite, rot2, h3, n3, trame, vifDe.
//   GLSL.formes : sdForme(p) (silhouette courante, repère du corps) et rayonForme(dir). GLSL.voile : uniform uCamL ; float transmission(vec3 pCorps)
//     (1 = rien devant, 0 = caché par le gaz). GLSL.sortie : vec3 versSortie(vec3 linéaire) (fragment seulement). Ordre d'inclusion : prelude, formes, voile, sortie.
//
// FORMES / MATIÈRES : voir l'en-tête de lueur3d-formes.js (distance signée GLSL + la même en JS, compilées une seule fois avec le corps,
//   choisies par uniforms uForme / uTex : changer d'article ne recompile rien).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { FORMES, MATIERES } from './lueur3d-formes.js';
import { ACCESSOIRES } from './lueur3d-accessoires.js';
import { HABITS, MEMBRES } from './lueur3d-habits.js';

export const ORDRE = { halo: 0, derriere: 1, corps: 2, grains: 3, visage: 5, parties: 6, devant: 7 };
const PAS = 28, MARGE = .55, MASQUE = .72;                         // pas de marche du gaz ; marge du rayonnement ; taille du masque (× la surface)
const RB = Math.max(...Object.values(FORMES).map(f => f.bornes || 1)) + MARGE;   // sphère de rendu du gaz (toutes silhouettes)

// ── morceaux de shader partagés ──
const PRELUDE = `uniform float uT, uApp, uClair, uForme, uTex, uBornes; uniform vec3 uColor;
  float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b - a)/k, 0., 1.); return mix(b, a, h) - k*h*(1. - h); }
  float smax(float a, float b, float k){ return -smin(-a, -b, k); }
  float sdEllipsoide(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.)/max(k1, 1e-5); }
  float sdCapsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h) - r; }
  float sdCone(vec3 p, vec3 a, vec3 b, float r1, float r2){            // cône arrondi entre a (rayon r1) et b (rayon r2) (Inigo Quilez)
    vec3 ba = b - a; float l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr*rr, il2 = 1./l2; vec3 pa = p - a; float y = dot(pa, ba), z = y - l2;
    vec3 xv = pa*l2 - ba*y; float x2 = dot(xv, xv), y2 = y*y*l2, z2 = z*z*l2, k = sign(rr)*rr*rr*x2;
    if (sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2; if (sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1; return (sqrt(x2*a2*il2) + y*rr)*il2 - r1; }
  float sdTore(vec3 p, vec2 t){ return length(vec2(length(p.xz) - t.x, p.y)) - t.y; }
  float sdBoite(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
  mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  vec3 h3(vec3 p){ p = fract(p*vec3(.1031, .103, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx)*p.zyx); }
  float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
    return mix(mix(mix(h3(i).x, h3(i + vec3(1,0,0)).x, f.x), mix(h3(i + vec3(0,1,0)).x, h3(i + vec3(1,1,0)).x, f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)).x, h3(i + vec3(1,0,1)).x, f.x), mix(h3(i + vec3(0,1,1)).x, h3(i + vec3(1,1,1)).x, f.x), f.y), f.z); }
  float trame(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(.06711056, .00583715)))) - .5; }   // dither : pas de paliers 8 bits
  vec3 vifDe(vec3 c){ return c/max(max(c.r, c.g), max(c.b, 1e-3)); }  // la teinte à pleine luminosité
`;
const SORTIE = `
vec3 versSortie(vec3 c){ return linearToOutputTexel(vec4(max(c, 0.), 1.)).rgb; }
`;   // fragment seulement
const STRUCT = `struct Gaz { vec3 p; vec3 pa; vec3 n; vec3 rd; float smin; float dedans; float D; float ep; float vol; float k; vec3 vif; vec3 coeur; vec3 dense; vec3 pale; vec3 c; float E; float A; vec3 brille; float halo; };
`;

// les silhouettes et les matières, assemblées une fois pour toutes (choix par uniforms : aucune recompilation)
const LF = Object.values(FORMES).sort((a, b) => a.id - b.id), LM = Object.values(MATIERES).sort((a, b) => a.id - b.id);
// (la struct Gaz vient avec les silhouettes : deco peut vivre dans le même code ; elle est inutilisée hors du corps, sans frais)
const CODE_FORMES = '\n' + STRUCT + LF.map(f => f.glsl || '').join('\n') + `
  float sdForme(vec3 p){ int f = int(uForme + .5); ${LF.filter(f => f.id !== 0).map(f => `if (f == ${f.id}) return ${f.sd}(p);`).join(' ')} return ${FORMES.rond.sd}(p); }
  float rayonForme(vec3 d){ float r = uBornes; for (int i = 0; i < 10; i++) r -= sdForme(d*r); return clamp(r, 0., uBornes); }   // depuis le centre, vers d
`;
const CODE_DECO = `
void decoForme(inout Gaz g){ int f = int(uForme + .5); ${LF.filter(f => f.deco).map(f => `if (f == ${f.id}) ${f.deco}(g);`).join(' ')} }
`;
const CODE_MATIERES = '\n' + LM.map(m => m.glsl || '').join('\n') + `
  void matiere(inout Gaz g){ int m = int(uTex + .5); ${LM.filter(m => m.fn).map(m => `if (m == ${m.id}) ${m.fn}(g);`).join(' ')} }
`;
// voile : le gaz (la silhouette courante, adoucie) entre un point du repère du corps et la caméra ; 6 échantillons
const VOILE = `
uniform vec3 uCamL;
  float transmission(vec3 p){ vec3 d = uCamL - p; float L = length(d); d /= max(L, 1e-4);
    float R = uBornes + .25, b = dot(p, d), h = b*b - dot(p, p) + R*R; if (h <= 0.) return 1.;
    h = sqrt(h); float t0 = max(-b - h, 0.), t1 = min(-b + h, L); if (t1 <= t0) return 1.;
    float pas = (t1 - t0)/6., acc = 0.;
    for (int i = 0; i < 6; i++) acc += smoothstep(.16, -.36, sdForme(p + d*(t0 + pas*(float(i) + .5))));
    return exp(-acc*pas*2.5); }
`;
export const GLSL = { prelude: PRELUDE, formes: CODE_FORMES, voile: VOILE, sortie: SORTIE };   // formes contient déjà la struct Gaz

// ── le corps : on marche le long du rayon dans la silhouette (distance signée) ; un seul fragment par pixel (faces arrière) ──
const CORPS_V = `varying vec3 vO; void main(){ vO = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }`;
const CORPS_F = `#define PAS ${PAS}
  #define MARGE ${MARGE.toFixed(2)}
  uniform vec3 uCamL; varying vec3 vO;
  ${PRELUDE} ${SORTIE} ${CODE_FORMES} ${CODE_DECO} ${CODE_MATIERES}
  float champ(vec3 q){ q.y -= uT*.03;                                  // fumée déformée par elle-même → volutes (étude 7C)
    vec3 w = vec3(n3(q*1.6 + vec3(0., 0., uT*.05)), n3(q*1.6 + vec3(5.2, 1.3, -uT*.04)), n3(q*1.6 + vec3(9.1, 4.7, 2.)));
    q = q*3.4 + (w - .5)*2.1; float f = 1. - abs(n3(q)*2. - 1.); return mix(n3(q*.6), f*f, .55)*.8 + n3(q*2.2)*.2; }
  void main(){
    float R = uBornes + MARGE;
    vec3 ro = uCamL, rd = normalize(vO - uCamL);
    float b = dot(ro, rd), h = b*b - dot(ro, ro) + R*R;
    if (h <= 0.) discard;
    h = sqrt(h); float t0 = max(-b - h, 0.), t1 = -b + h; if (t1 <= t0) discard;
    float pas = (t1 - t0)/float(PAS), t = t0 + pas*.5, sMin = 1e3, tMin = t0, ep = 0., tA = -1., sP = 1e3;
    for (int i = 0; i < PAS; i++) {
      float s = sdForme(ro + rd*t);
      if (s < sMin) { sMin = s; tMin = t; }
      ep += clamp(.5 - s/pas, 0., 1.);                                  // épaisseur traversée (douce : pas de paliers)
      if (tA < 0. && s < 0.) tA = t - pas*clamp(-s/max(sP - s, 1e-4), 0., 1.);
      sP = s; t += pas;
    }
    ep *= pas;
    { float sa = sdForme(ro + rd*(tMin - pas*.5)), sc = sdForme(ro + rd*(tMin + pas*.5)), den = sa - 2.*sMin + sc;   // affinage parabolique du point le plus proche
      if (den > 1e-5) { tMin += clamp(.25*(sa - sc)/den, -.5, .5)*pas; sMin = min(sMin, sMin - (sa - sc)*(sa - sc)/(8.*den)); } }
    Gaz g; g.rd = rd; g.p = ro + rd*tMin; g.pa = tA > 0. ? ro + rd*tA : g.p; g.smin = sMin; g.dedans = smoothstep(.02, -.02, sMin);
    g.ep = clamp(ep*.5, 0., 1.); g.D = 1. - smoothstep(-.42, .2, sMin);
    vec3 pn = g.pa - rd*.02; const vec2 e = vec2(.03, -.03);                                   // normale à l'entrée (au plus près si le rayon frôle)
    g.n = normalize(e.xyy*sdForme(pn + e.xyy) + e.yyx*sdForme(pn + e.yyx) + e.yxy*sdForme(pn + e.yxy) + e.xxx*sdForme(pn + e.xxx));
    g.k = mix(.3, 1., smoothstep(.27, .8, 1. + sMin));                                          // volutes discrètes derrière le visage, franches autour
    g.vol = 0.;
    if (g.D > .002) { float L = max(g.ep, .25)*.5; g.vol = smoothstep(.26, .74, (champ((g.p - rd*L)*.75) + champ((g.p + rd*L)*.75))*.5) - .5; }   // 2 profondeurs écartées → parallaxe, et un gaz plus lisse
    // palette : tout dérive de la couleur (or, rose, bleu…) ; le gaz ténu pâlit au lieu de s'assombrir (un or faible sur la nuit vire au brun)
    g.vif = vifDe(uColor);
    g.coeur = mix(g.vif, vec3(1.), .34); g.dense = pow(g.vif, vec3(1.35)); g.pale = mix(g.vif, vec3(1., .97, .93), .3);
    float s = g.vol*g.k;
    g.c = mix(g.vif, g.dense, clamp(.45 - s*1.6, 0., 1.)*smoothstep(.15, .7, g.D)*.7)*(1. + .3*s);     // crêtes claires, sillons plus denses (jamais bruns : la teinte reste)
    g.c = mix(g.c, g.coeur, g.ep*g.ep*g.ep*(.75 + .25*s));
    g.c = mix(g.c, g.pale, (1. - g.D)*.2);
    g.c *= .92 + .1*clamp(dot(g.n, normalize(vec3(-.45, .6, .7))), 0., 1.);                    // un soupçon de modelé
    g.E = pow(g.D, .9)*(.6 + .32*g.ep*g.ep)*(1. + .16*s); g.A = pow(g.D, 1.15)*.82;             // la frange émet un peu plus qu'elle ne voile
    g.brille = vec3(0.); g.halo = exp(-max(sMin, 0.)*3.5)*(1. - g.D)*(1. - g.D)*(1. - smoothstep(R - .5, R - .08, length(g.p)));
    decoForme(g); matiere(g);
    vec3 em = g.c*g.E; em *= min(1., .9/max(max(em.r, em.g), max(em.b, 1e-4)));               // cœur plafonné : le visage reste net
    em += mix(g.vif, vec3(1., .97, .92), .18)*g.halo*.07;                                         // rayonnement qui épouse la silhouette (pas de bloom sur ce calque)
    // papier : un gaz coloré qui recouvre le fond (l'additif ne s'y verrait pas), bord plus dense et plus soutenu pour se détacher
    float Ac = (1. - smoothstep(-.2, .05, g.smin))*.97, bordC = smoothstep(-.55, -.03, g.smin);
    vec3 ec = mix(mix(g.c, g.coeur, g.ep*g.ep*.6), g.dense*vec3(.9, .84, .88), bordC*bordC*.75)*(.9 + .16*clamp(dot(g.n, normalize(vec3(-.45, .6, .7))), 0., 1.));
    vec3 o = mix(versSortie((em + g.brille)*uApp), versSortie(ec + g.brille*.5)*Ac*uApp, uClair);   // papier : encodé PUIS couvert (sinon le bord s'éclaircit)
    float a = mix(g.A, Ac, uClair)*uApp, l = max(o.r, max(o.g, o.b));
    gl_FragColor = vec4(o + trame(gl_FragCoord.xy)/255.*min(1., l*40.), a);
  }`;

// ── grains de lumière : brume (gros grains doux), poussière d'étoiles, étincelles qui tournent autour ──
// additifs « en linéaire » : on estime le gaz derrière le grain (vFond) et on ajoute la différence d'encodage (comme sous le bloom de l'étude)
const GRAINS_V = `uniform float uPx, uMaxPt; uniform vec4 uGr; uniform vec4 uGr2; uniform vec3 uTeinte; attribute vec4 aAxe; attribute vec4 aDiv; attribute vec2 aMel;
  varying vec3 vFond; varying vec3 vG; varying vec3 vDense; varying float vDur; varying float vHors;
  ${PRELUDE} ${CODE_FORMES} ${VOILE}
  vec3 tourne(vec3 p, vec3 k, float a){ float c = cos(a), s = sin(a); return p*c + cross(k, p)*s + k*dot(k, p)*(1. - c); }
  void main(){
    float type = aDiv.w;                                                // 0 brume · 1 poussière · 2 étincelle
    vec3 p = tourne(position, aAxe.xyz, uT*aAxe.w);                     // la volute glisse le long d'elle-même
    p += .035*sin(uT*vec3(.53, .41, .47) + position.yzx*4. + aDiv.z);  // houle douce
    if (type < 1.5) p *= rayonForme(normalize(p + vec3(0., 1e-4, 0.)));  // semés dans la sphère unité → remplissent la silhouette courante
    else p *= max(1., uBornes - .05);
    vec4 mv = modelViewMatrix*vec4(p, 1.);
    float sz = aDiv.x*uGr2.x*uPx*length(modelViewMatrix[0].xyz)/max(-mv.z, 1e-3), I = aDiv.y*(type < .5 ? uGr.x : type < 1.5 ? uGr.y : uGr.z);
    if (sz < 1.6) { I *= sz*sz/2.56; sz = 1.6; }                         // trop petit : on garde 1,6 px et on baisse l'éclat (pas de crénelage qui scintille)
    I *= 1. - .5*smoothstep(uMaxPt*.8, uMaxPt*1.3, sz);                  // plafonné : certains téléphones bornent la taille des points
    gl_PointSize = min(sz, uMaxPt);
    float sd = sdForme(p);
    I *= type < .5 ? smoothstep(.1, -.12, sd) : type < 1.5 ? smoothstep(.3, .02, sd) : 1.;   // dans la silhouette (quelle qu'elle soit), la poussière déborde un peu
    I *= mix(1., .5 + .5*sin(uT*(.5 + fract(aDiv.z*3.1)*1.3) + aDiv.z*6.28), (type < .5 ? .15 : .75)*uGr.w);   // scintillement lent
    I *= transmission(p);                                               // derrière le cœur : voilée par le gaz
    vec3 n = normalize(p); if (type > .5 && n.z > 0.) I *= mix(.3, 1., smoothstep(.8, 1.2, length(vec2(n.x/.7, (n.y - .07)/.5))));   // le visage reste net
    vec3 vif = vifDe(uColor), creme = mix(vif, vec3(1., .95, .86), .72);
    vec3 cl = mix(mix(vif, creme, aMel.x), pow(vif, vec3(1.3)), aMel.y); cl = mix(cl, uTeinte, uGr2.y);
    // le gaz derrière le grain : distance du rayon de vue à la silhouette (3 échantillons autour du point le plus proche du centre)
    vec3 d = normalize(p - uCamL); vec3 m = uCamL - d*dot(uCamL, d);
    float sm = min(sdForme(m), min(sdForme(m - d*.35), sdForme(m + d*.35))), D = 1. - smoothstep(-.42, .2, sm);
    vFond = mix(mix(vif, vec3(1., .96, .9), .4)*pow(D, .9)*.6, vec3(.82, .78, .7), uClair);
    vG = cl*I; vDense = pow(vif, vec3(1.3))*.8; vDur = type < .5 ? 2.4 : 5.; vHors = type < .5 ? 0. : smoothstep(-.05, .15, sd);
    gl_Position = projectionMatrix*mv; }`;
const GRAINS_F = `uniform float uApp, uClair; varying vec3 vFond; varying vec3 vG; varying vec3 vDense; varying float vDur; varying float vHors;
  ${SORTIE}
  void main(){ vec2 q = gl_PointCoord*2. - 1.; float d = dot(q, q); if (d > 1.) discard; float s = exp(-d*vDur)*(1. - d);
    vec3 add = versSortie(vFond + vG*s) - versSortie(vFond);
    float ac = uClair*vHors*min(1., length(vG)*1.6)*s*.75;              // papier : hors du corps, de petits éclats dorés (l'additif ne se verrait pas)
    gl_FragColor = vec4(mix(add, versSortie(vDense)*ac, uClair*vHors)*uApp, ac*uApp); }`;

// ── halo : un quad face caméra, dégradé en cloche calculé en flottants (+ trame) ; papier : une aura colorée très douce ──
const HALO_V = `uniform float uR; varying vec2 vQ; void main(){ vQ = position.xy*uR; vec4 mv = modelViewMatrix*vec4(0., 0., 0., 1.); mv.xy += position.xy*uR*length(modelViewMatrix[0].xyz); gl_Position = projectionMatrix*mv; }`;
const HALO_F = `uniform vec3 uColor; uniform float uClair, uApp, uR, uI; varying vec2 vQ;
  float trame(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(.06711056, .00583715)))) - .5; }
  void main(){
    float r = length(vQ), f = 1. - smoothstep(uR*.55, uR, r);
    vec3 vif = uColor/max(max(uColor.r, uColor.g), max(uColor.b, 1e-3));
    vec3 c = mix(vif, vec3(1., .97, .92), .18)*exp(-r*r*1.05)*f*f*uI;                  // cloche dorée (une lumière pâle et faible sur la nuit vire au gris), ajoutée au ciel
    float voile = .1*smoothstep(1.8, .9, r);                                           // voile sombre léger : la lueur reste lisible sur les étoiles vives
    vec3 sombre = linearToOutputTexel(vec4(c, 1.)).rgb;
    float ac = .15*exp(-max(r - .85, 0.)*2.2)*f*smoothstep(.55, .95, r);                  // papier : une aura colorée, large et douce (l'additif ne se voit pas)
    vec3 claire = linearToOutputTexel(vec4(pow(vif, vec3(1.2)), 1.)).rgb*ac;
    vec4 o = mix(vec4(sombre, voile), vec4(claire, ac), uClair)*uApp;
    gl_FragColor = vec4(o.rgb + trame(gl_FragCoord.xy)/255.*step(.004, o.r + o.a), o.a); }`;

// ── visage : une calotte qui épouse l'avant du corps ; le shader porte le code 2D du visage de la v11 (net, anticrénelé) ──
const VISAGE_V = `uniform vec2 uVisage; attribute float aDans; varying vec2 vF; varying vec3 vN; varying vec3 vV; varying float vDans;
  void main(){ vF = (position.xy*.5 - vec2(0., uVisage.x))/uVisage.y; vDans = aDans; vec4 mv = modelViewMatrix*vec4(position, 1.); vN = normalMatrix*normal; vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
const VISAGE_F = `uniform float uApp, uJoy, uSad, uBrow, uSpark, uRelax, uWide, uSleep, uBlink, uEyeS, uStarEye, uEyeOn; uniform vec2 uLook; uniform vec4 uExpr; uniform vec3 uEyeCol, uColor;
  varying vec2 vF; varying vec3 vN; varying vec3 vV; varying float vDans;
  float aa;
  vec4 over(vec4 top, vec4 bot){ return top + bot*(1. - top.a); }                 // alpha pré-multiplié
  float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h); }
  float L(float a, float b, float d){ float m = (a + b)*.5, h = min((a - b)*.5, max(aa, .0015)); return smoothstep(m + h, m - h, d); }   // trait v11 (plus net en gros plan)
  float marche(float a, float x){ return smoothstep(a - aa*.7, a + aa*.7, x); }
  vec4 visage(vec2 qf){
    vec4 col = vec4(0.);
    vec3 encre = vec3(.024, .011, .05);                                                 // ≈ #2b1c3f : les traits (bouche, sourcils, yeux fermés)
    vec3 vif = uColor/max(max(uColor.r, uColor.g), max(uColor.b, 1e-3));
    vec2 reg = uLook*.04;
    float wide = max(uWide, uExpr.w*.85), mo = smoothstep(.42, .58, max(uWide, uExpr.w));   // v26 : la bouche est ronde OU souriante, jamais les deux à moitié (le point pâle au milieu du sourire)                    // étonnée : grands yeux ronds, petite bouche ronde
    float ouv = max(.3, 1. - uBlink)*(1. - uSleep)*(1. - uRelax*.75);
    // v25 : le clignement ferme l'œil d'un trait net (comme endormi) au lieu d'écraser l'œil en une ligne pâle avec ses reflets par-dessus
    float fb = smoothstep(.6, .66, uBlink), sansReflet = 1. - smoothstep(.1, .3, uBlink);   // bascule franche : jamais deux yeux à moitié transparents l'un sur l'autre
    float joyeux = max(smoothstep(.45, .8, uJoy), uExpr.x)*(1. - uSleep), triste = uSad*(1. - joyeux);   // rieuse : les yeux plissés de bonheur
    vec2 rayon = vec2(.088, .115)*(1. + wide*.25)*uEyeS;
    float sp = smoothstep(.55, .95, uSpark), etG = max(uStarEye, uSpark*(1. - sp)*1.4);   // éclat : d'abord des étoiles dans les yeux, puis des yeux en étoile
    float traits = 0., blanc = 0., etoile = 0., iris = 0.; vec3 irisC = vec3(0.);
    for (int k = 0; k < 2; k++) {
      float s = k == 0 ? -1. : 1.;
      float jk = s > 0. ? max(joyeux, uExpr.z*(1. - uSleep)) : joyeux;                 // malicieuse : un clin d'œil
      jk = smoothstep(.4, .6, jk);                                                      // v38 : bascule franche, jamais un œil ouvert ET plissé à moitié
      float ferme = step(.5, max(uSleep, uRelax));                            // v38 : endormie / relâchée : l'œil se ferme d'un coup, sans fantôme
      float ok = ouv*(1. - uExpr.y*.3)*(1. - uExpr.z*.1);                               // rêveuse : paupières mi-closes, arrondies
      vec2 c = vec2(s*.16, .08 - triste*.025) + reg;
      float pau = c.y + rayon.y*ok*mix(1.3, .55, uExpr.y), cl = pau - 7.*(qf.x - c.x)*(qf.x - c.x), hc = min(.007, max(aa, .0015)), coupe = smoothstep(cl + hc, cl - hc, qf.y);
      vec2 le = (qf - c)/(rayon*vec2(1., max(ok, .002))); float lL = length(le), aL = aa*1.2/min(rayon.x, rayon.y*max(ok, .25));
      float rond = smoothstep(1. + aL, 1. - aL - .04, lL)*(1. - jk)*(1. - sp)*coupe*(1. - ferme)*(1. - fb);  // le contour de l'œil : net, anticrénelé (relâchée : paupières closes)
      float arc = L(.026, .008, abs(length(qf - (c + vec2(0., -.055))) - .088))*marche(c.y - .002, qf.y)*jk;
      float dort = L(.026, .008, abs(length(qf - (c + vec2(0., .055))) - .088))*(1. - marche(c.y + .002, qf.y))*ferme*(1. - jk);
      dort = max(dort, L(.018, .006, abs(length(qf - (c + vec2(0., .07))) - .1))*(1. - marche(c.y - .005, qf.y))*smoothstep(.07, .02, abs(qf.x - c.x) - .06)*fb*(1. - jk)*(1. - ferme));   // œil fermé du clignement : un trait fin
      float lid = L(.014, .004, abs(qf.y - cl))*(1. - marche(rayon.x*1.1, abs(qf.x - c.x)))*uExpr.y*(1. - jk)*(1. - ferme)*(1. - fb)*smoothstep(.2, .5, ok);   // v38 : la paupière de la rêveuse s'efface quand l'œil se ferme
      vec2 hl = vec2(.03, mix(.04, -.012, uExpr.y))*(1. + wide*.3);
      float lum = (L(.034, .012, length(qf - c - hl)) + L(.016, .004, length(qf - c + vec2(.026, .034))))*ok*(1. - jk)*(1. - ferme)*(1. - sp)*coupe*sansReflet;
      vec2 e = abs(qf - c), er = abs(qf - c - vec2(.022, hl.y*.75)*(1. + wide*.3));     // « Yeux étoilés » : le reflet devient une petite étoile
      float refletEt = (smoothstep(.05, .0, er.x + er.y*4.) + smoothstep(.05, .0, er.y + er.x*4.) + L(.022, .0, length(er)))*ok*(1. - jk)*(1. - ferme)*(1. - sp)*min(etG, 1.)*coupe*sansReflet;
      lum *= 1. - min(etG, 1.)*.85;
      etoile += sp*(smoothstep(.1 + aa, .0, e.x + e.y*3.) + smoothstep(.1 + aa, .0, e.y + e.x*3.))*(1. - uSleep); blanc += sp*L(.03, .008, length(e))*(1. - uSleep);   // éclat : une étoile sombre, un point de lumière au cœur
      // l'œil : une lentille sombre et vernie (reflet large et doux en haut, lumière du corps reflétée en bas) ; couleur choisie : iris en dégradé (v11)
      vec3 oeil = mix(vec3(.012, .008, .028), vec3(.075, .06, .1) + vif*.05, smoothstep(.1, -1.05, le.y + le.x*.25)*.85)*mix(1., .65, smoothstep(.6, 1., lL));
      vec3 ic = mix(uEyeCol*.32, uEyeCol*1.15 + .05, smoothstep(.55, -.75, le.y))*mix(1., .55, smoothstep(.5, 1., lL));
      ic = mix(ic, uEyeCol*.16, smoothstep(.45, .22, length(le - vec2(0., .1)))*.7);
      vec2 lv = (le - vec2(.22, .5))*vec2(1.5, 2.6); float vernis = exp(-dot(lv, lv))*.12;
      iris += rond; irisC += (mix(oeil, ic, uEyeOn) + vec3(.92, .94, 1.)*vernis)*rond;
      traits += clamp(arc + dort + lid, 0., 1.); blanc += clamp(lum + refletEt, 0., 1.);
      vec2 b0 = vec2(s*.105, .26 + uBrow*.05), b1 = vec2(s*.235, .26 - uBrow*.03);                      // sourcils : inquiets ou fâchés
      traits += L(.016, .004, sdSeg(qf, b0, b1))*smoothstep(.05, .3, abs(uBrow))*(1. - uSleep);
      traits += L(.014, .004, abs(qf.y - (c.y + .2 - 3.*(qf.x - c.x)*(qf.x - c.x))))*(1. - marche(.075, abs(qf.x - c.x)))*uExpr.w*(1. - uSleep)*.85;   // étonnée : sourcils levés
    }
    float joue = (smoothstep(1., .15, length((qf - vec2(-.3, -.02))/vec2(.088, .055))) + smoothstep(1., .15, length((qf - vec2(.3, -.02))/vec2(.088, .055))))*clamp(.55 + uJoy*.45 - uSad*.6 + uExpr.x*.3 + uExpr.y*.15, 0., 1.)*.95;
    // le sourire : une parabole aux bouts arrondis (malicieuse : en coin)
    float hh = clamp(.35 + uJoy*.9 - uSad*1.2 + uRelax*.4 + uExpr.y*.15 + uExpr.z*.2, -1., 1.), w = .07 - uExpr.y*.012, x0 = uExpr.z*.035;
    float xb = (qf.x - x0)/w, xc = clamp(xb, -1., 1.), yc = -.1 + .045*hh*xc*xc + uExpr.z*.03*xc, pente = (.09*hh*xc + uExpr.z*.03)/w;
    float dS = abs(xb) <= 1. ? abs(qf.y - yc)/sqrt(1. + pente*pente) : length(qf - vec2(x0 + xc*w, yc));
    float sourire = L(.013, .004, dS)*(1. - mo)*(1. - uExpr.x);
    float xo = qf.x/.095, yo = -.085 - .07*(1. - xo*xo), dm = max(max(qf.y + .085, yo - qf.y), (abs(xo) - 1.)*.095);
    float rire = L(.007, -.004, dm)*uExpr.x*(1. - mo);                                   // rieuse : un grand sourire ouvert
    float langue = smoothstep(1., .5, length((qf - vec2(0., -.142))/vec2(.05, .028)))*rire;
    vec2 ro = vec2(.026, .034)*(1. - uExpr.w*.2); float aO = aa/ro.x;
    float ouvert = smoothstep(1. + aO, 1. - aO - .25, length((qf - vec2(0., -.1))/ro))*mo;  // étonnée : petite bouche ronde
    col = over(vec4(vec3(1., .3, .44)*joue*.8, joue*.8), col);            // joues roses, bien visibles en petit (7C, v11)
    float tr = clamp(traits + sourire + ouvert + rire, 0., 1.);
    col = over(vec4(encre*tr*.96, tr*.96), col);
    float ir = clamp(iris, 0., 1.); col = over(vec4(irisC/max(iris, 1e-3)*ir*.98, ir*.98), col);
    float et = clamp(etoile, 0., 1.)*.96; col = over(vec4(mix(encre, vec3(.16, .1, .03), .4)*et, et), col);
    col = over(vec4(vec3(1., .32, .42)*langue*.9, langue*.9), col);
    float bl = clamp(blanc, 0., 1.); col = over(vec4(vec3(1.)*bl, bl), col);
    return col;
  }
  void main(){
    aa = max(length(fwidth(vF))*.85, 1e-4);
    vec4 col = visage(vF);
    // le gaz voile le visage de biais (il s'enfonce dans le nuage) et l'efface de dos, sans tache
    float cv = dot(normalize(vN), normalize(vV)), w = .05 + .72*(1. - smoothstep(.12, .62, cv));
    col *= (1. - w)*smoothstep(.05, .32, cv)*smoothstep(.35, .95, vDans)*uApp;
    gl_FragColor = vec4(linearToOutputTexel(vec4(col.rgb/max(col.a, 1e-4), 1.)).rgb*col.a, col.a);   // pré-multiplié, encodé
  }`;

// ── matériau « objet de lumière » pour les parties (accessoires, habits, membres) ──
const LUMIERE_V = `uniform mat4 uInvL; varying vec3 vN; varying vec3 vV; varying vec3 vLoc;
  void main(){ vec4 w = modelMatrix*vec4(position, 1.); vLoc = (uInvL*w).xyz; vec4 mv = viewMatrix*w; vN = normalMatrix*normal; vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
const LUMIERE_F = `uniform vec3 uCouleur; uniform float uOpacite, uEclat, uLisere, uVoile, uDouceur; varying vec3 vN; varying vec3 vV; varying vec3 vLoc;
  ${PRELUDE} ${CODE_FORMES} ${VOILE} ${SORTIE}
  void main(){
    vec3 n = normalize(vN), v = normalize(vV); if (!gl_FrontFacing) n = -n;
    float cv = clamp(dot(n, v), 0., 1.), haut = clamp(n.y*.5 + .5, 0., 1.);
    vec3 c = uCouleur*(.62 + .38*haut)*(.8 + .25*cv)*uEclat + mix(uCouleur, vec3(1.), .55)*pow(1. - cv, 2.2)*uLisere*(1. - .5*uClair);
    float T = mix(1., transmission(vLoc), uVoile);
    c = mix(mix(vifDe(uColor), vec3(1., .96, .9), .4)*.85, c, T);                      // derrière la frange : teinté par le gaz
    float a = uOpacite*uApp*mix(T, 1., uClair*.7)*mix(1., smoothstep(.0, .3, cv), uDouceur);
    gl_FragColor = vec4(versSortie(c)*a, a); }`;

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v2 = new THREE.Vector2();
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const hasard = s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };   // graine fixe : même nuage à chaque chargement

export function creerLueur3D({ graine = 7 } = {}) {
  const groupe = new THREE.Group(), pivot = new THREE.Group(); groupe.add(pivot); groupe.name = 'lueur3d';
  const invL = new THREE.Matrix4(), camL = new THREE.Vector3(0, 0, 10);
  const U = {
    uT: { value: 0 }, uApp: { value: 1 }, uClair: { value: 0 }, uColor: { value: new THREE.Color('#ffd98a') }, uForme: { value: 0 }, uTex: { value: 0 }, uBornes: { value: 1.02 },
    uCamL: { value: camL }, uInvL: { value: invL },
    uJoy: { value: 0 }, uSad: { value: 0 }, uBrow: { value: 0 }, uSpark: { value: 0 }, uRelax: { value: 0 }, uWide: { value: 0 }, uSleep: { value: 0 }, uBlink: { value: 0 },
    uLook: { value: new THREE.Vector2() }, uExpr: { value: new THREE.Vector4() }, uEyeS: { value: 1 }, uStarEye: { value: 0 }, uEyeCol: { value: new THREE.Color('#5aa8ff') }, uEyeOn: { value: 0 },
    uVisage: { value: new THREE.Vector2(0, 1) }, uAccCol: { value: new THREE.Color('#ffd98a') }, uHabitCol: { value: new THREE.Color('#8ab4ff') },
    uFlap: { value: 0 }, uSquash: { value: new THREE.Vector2(1, 1) }, uTilt: { value: 0 },
    uPx: { value: 400 }, uMaxPt: { value: 128 }, uGr: { value: new THREE.Vector4(1, 1, 1, 1) }, uGr2: { value: new THREE.Vector4(1, 0, 0, 0) }, uTeinte: { value: new THREE.Color(1, 1, 1) },
  };
  const pick = (...k) => Object.fromEntries(k.map(n => [n, U[n]]));
  const BASE = ['uT', 'uApp', 'uClair', 'uForme', 'uTex', 'uBornes', 'uColor'];
  const premul = { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };

  // halo (suit le groupe, pas l'écrasement du corps)
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ ...premul, depthWrite: false, depthTest: false, vertexShader: HALO_V, fragmentShader: HALO_F,
    uniforms: { ...pick('uColor', 'uClair', 'uApp'), uR: { value: 2.4 }, uI: { value: .085 } } }));
  halo.renderOrder = ORDRE.halo; halo.frustumCulled = false; groupe.add(halo);

  // masque : la surface du corps (profondeur seule) ; opaque, donc dessiné en premier → met aussi à jour la caméra locale et la taille des points
  let maxPt = 0;
  const masque = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ colorWrite: false }));
  masque.frustumCulled = false; pivot.add(masque);
  masque.onBeforeRender = (renderer, scene, camera) => {
    invL.copy(pivot.matrixWorld).invert(); camL.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(invL);
    if (!maxPt) { const gl = renderer.getContext(); maxPt = Math.min(256, .9 * gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]); U.uMaxPt.value = maxPt; }
    renderer.getDrawingBufferSize(_v2); U.uPx.value = _v2.y * camera.projectionMatrix.elements[5] * .5;
  };

  // le corps (gaz marché dans la silhouette) : faces arrière d'une sphère englobante → un seul fragment par pixel, même caméra dedans
  const corps = new THREE.Mesh(new THREE.SphereGeometry(RB, 40, 28), new THREE.ShaderMaterial({ ...premul, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: CORPS_V, fragmentShader: CORPS_F, uniforms: pick(...BASE, 'uCamL') }));
  corps.renderOrder = ORDRE.corps; corps.frustumCulled = false; pivot.add(corps);

  // grains : semés une fois (graine fixe) dans la sphère unité ; ils tournent sur le GPU et remplissent la silhouette courante
  const al = hasard(graine), gauss = () => Math.sqrt(-2 * Math.log(1 - al())) * Math.cos(6.2832 * al());
  const dir = v => v.set(gauss(), gauss(), gauss()).normalize();
  const volutes = Array.from({ length: 9 }, () => { const B = dir(new THREE.Vector3()), A = B.clone().addScaledVector(dir(new THREE.Vector3()), .35).normalize();
    const Uu = new THREE.Vector3().crossVectors(B, dir(new THREE.Vector3())).normalize(), V = new THREE.Vector3().crossVectors(B, Uu);
    return { A, U: Uu, V, w: (al() < .5 ? -1 : 1) * (.05 + al() * .09), r0: .3 + al() * .62, dr: (al() - .5) * .45, t0: al() * 6.28, L: 1.6 + al() * 2.4 }; });
  const NB = { brume: 220, poussiere: 250, etincelles: 18 }, N = NB.brume + NB.poussiere + NB.etincelles;
  const gp = new Float32Array(N * 3), ga = new Float32Array(N * 4), gd = new Float32Array(N * 4), gm = new Float32Array(N * 2), o = new THREE.Vector3();
  const surVolute = (ep, rMin, rMax) => { let v, s, r, n = 0; do { v = volutes[(al() * volutes.length) | 0]; s = al(); const th = v.t0 + v.L * s; r = v.r0 + v.dr * s;
      o.copy(v.U).multiplyScalar(Math.cos(th) * r).addScaledVector(v.V, Math.sin(th) * r); o.x += gauss() * ep; o.y += gauss() * ep; o.z += gauss() * ep; r = o.length(); } while ((r < rMin || r > rMax) && ++n < 200);
    return v; };
  for (let i = 0; i < N; i++) {
    let axe = null, w = 0, taille, eclat, type, m1 = 0, m2 = 0;
    if (i < NB.brume) {                                                // brume : le gaz en volume qui tourne (profondeur quand on tourne autour)
      type = 0;
      if (al() < .45) { do o.set(gauss(), gauss(), gauss()).multiplyScalar(.42); while (o.length() > .85); eclat = .03 + al() * .02; }
      else { const v = surVolute(.12, 0, .95); axe = v.A; w = v.w; eclat = .045 + al() * .035; }
      taille = .26 + al() * .16; m1 = .15 + al() * .5; m2 = al() < .3 ? al() * .5 : 0;
    } else if (i < NB.brume + NB.poussiere) {                          // poussière d'étoiles : clairsemée, sans grappes (une part sur les volutes, le reste semé)
      type = 1;
      if (al() < .3) { const v = surVolute(.12 + al() * .1, .4, 1.1); axe = v.A; w = v.w; }
      else { do o.set(al() * 2 - 1, al() * 2 - 1, al() * 2 - 1).multiplyScalar(1.2); while (o.length() > 1.18 || o.length() < .25); w = (al() < .5 ? -1 : 1) * (.03 + al() * .05); }
      taille = .03 + al() * .026; eclat = .45 + al() * .45; m1 = .45 + al() * .55;
    } else {                                                           // étincelles : quelques grains échappés qui tournent autour
      type = 2; const a = al() * 6.28, r = 1.3 + al() * .45; o.set(Math.cos(a) * r, (al() - .5) * 1.1, Math.sin(a) * r); axe = new THREE.Vector3(0, 1, 0); w = .25 + al() * .3;
      taille = .032 + al() * .022; eclat = .3 + al() * .3; m1 = .8;
    }
    if (!axe) { axe = dir(new THREE.Vector3()); w = w || .04; }
    gp.set([o.x, o.y, o.z], i * 3); ga.set([axe.x, axe.y, axe.z, w], i * 4); gd.set([taille, eclat, al() * 6.28, type], i * 4); gm.set([m1, m2], i * 2);
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('aAxe', new THREE.BufferAttribute(ga, 4));
  gg.setAttribute('aDiv', new THREE.BufferAttribute(gd, 4)); gg.setAttribute('aMel', new THREE.BufferAttribute(gm, 2));
  const grains = new THREE.Points(gg, new THREE.ShaderMaterial({ ...premul, depthWrite: false, depthTest: false, vertexShader: GRAINS_V, fragmentShader: GRAINS_F,
    uniforms: pick(...BASE, 'uCamL', 'uPx', 'uMaxPt', 'uGr', 'uGr2', 'uTeinte') }));
  grains.renderOrder = ORDRE.grains; grains.frustumCulled = false; pivot.add(grains);

  // visage : grille posée sur l'avant de la silhouette (reconstruite quand elle change)
  const VX = 56, VY = 42, gv = new THREE.PlaneGeometry(1.76, 1.36, VX, VY).translate(0, .1, 0), vxy = Float32Array.from(gv.attributes.position.array);
  gv.setAttribute('aDans', new THREE.BufferAttribute(new Float32Array(gv.attributes.position.count), 1));
  const visageMesh = new THREE.Mesh(gv, new THREE.ShaderMaterial({ ...premul, depthWrite: false, depthTest: true, vertexShader: VISAGE_V, fragmentShader: VISAGE_F,
    uniforms: pick('uApp', 'uJoy', 'uSad', 'uBrow', 'uSpark', 'uRelax', 'uWide', 'uSleep', 'uBlink', 'uEyeS', 'uStarEye', 'uEyeOn', 'uLook', 'uExpr', 'uEyeCol', 'uColor', 'uVisage') }));
  visageMesh.renderOrder = ORDRE.visage; visageMesh.frustumCulled = false; pivot.add(visageMesh);

  // ── API de placement (JS) : la silhouette courante ──
  let F = FORMES.rond;
  const sd = (x, y, z) => F.js(x, y, z);
  const B = () => (F.bornes || 1) + .05;
  function toucher(ox, oy, oz, dx, dy, dz, out) {                    // rayon (o, d normalisé) → t du premier contact avec la surface, -1 sinon
    let t = 0; const T = Math.hypot(ox, oy, oz) + B() + 1;
    for (let i = 0; i < 160; i++) { const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t, s = sd(x, y, z); if (s < 1e-4) { if (out) out.set(x, y, z); return t; } t += Math.max(s, 1.5e-3); if (t > T) break; }
    return -1;
  }
  function avant(x, y) { const z0 = B(), t = toucher(x, y, z0, 0, 0, -1); return t < 0 ? NaN : z0 - t; }   // z de la surface avant en (x, y), NaN hors silhouette
  function surface(dx, dy, dz, out = new THREE.Vector3()) {           // point de la surface dans une direction (depuis le centre, le plus à l'extérieur)
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l; const b = B(), t = toucher(dx * b, dy * b, dz * b, -dx, -dy, -dz);
    const r = t < 0 ? 0 : b - t; return out.set(dx * r, dy * r, dz * r);
  }
  function rayon(y, ang) { const b = B() + 1, s = Math.sin(ang), c = Math.cos(ang), t = toucher(s * b, y, c * b, -s, 0, -c); return t < 0 ? 0 : Math.max(0, b - t); }
  function normale(x, y, z, out = new THREE.Vector3()) { const e = 1e-3; return out.set(sd(x + e, y, z) - sd(x - e, y, z), sd(x, y + e, z) - sd(x, y - e, z), sd(x, y, z + e) - sd(x, y, z - e)).normalize(); }
  const reperes = { haut: new THREE.Vector3(), sommet: new THREE.Vector3(), bas: new THREE.Vector3(), gauche: new THREE.Vector3(), droite: new THREE.Vector3(), avant: new THREE.Vector3(), arriere: new THREE.Vector3(), cou: new THREE.Vector3() };
  const forme = { nom: 'rond', bornes: 1, sd, surface, normale, avant, toucher, rayon, reperes };
  const visage = { y: 0, echelle: 1,
    point(qx, qy, out = new THREE.Vector3()) { const x = qx * visage.echelle * 2, y = (qy * visage.echelle + visage.y) * 2, z = avant(x, y); return out.set(x, y, Number.isNaN(z) ? 0 : z); },
    oeil(s, out) { return visage.point(s * .16, .08, out); } };

  function construireSilhouette() {
    // calotte du visage : chaque sommet de la grille est projeté sur l'avant de la surface
    const P = gv.attributes.position, D = gv.attributes.aDans;
    for (let i = 0; i < P.count; i++) { const x = vxy[i * 3], y = vxy[i * 3 + 1], z = avant(x, y), ok = !Number.isNaN(z); P.setXYZ(i, x, y, ok ? z + .006 : 0); D.setX(i, ok ? 1 : 0); }
    P.needsUpdate = true; D.needsUpdate = true; gv.computeVertexNormals(); gv.computeBoundingSphere();
    // masque : une sphère dont chaque sommet est ramené sur la surface, puis rentré (× MASQUE) : au-delà, c'est transmission() qui voile, en douceur
    const M = masque.geometry.attributes.position;
    if (!masque.userData.dirs) masque.userData.dirs = Float32Array.from(M.array);
    const dm = masque.userData.dirs;
    for (let i = 0; i < M.count; i++) { surface(dm[i * 3], dm[i * 3 + 1], dm[i * 3 + 2], o); o.multiplyScalar(MASQUE); M.setXYZ(i, o.x, o.y, o.z); }
    M.needsUpdate = true; masque.geometry.computeBoundingSphere();
    // repères
    surface(0, 1, 0, reperes.haut); surface(0, -1, 0, reperes.bas); surface(-1, 0, 0, reperes.gauche); surface(1, 0, 0, reperes.droite);
    surface(0, 0, 1, reperes.avant); surface(0, 0, -1, reperes.arriere); visage.point(0, -.255, reperes.cou);
    reperes.sommet.copy(reperes.haut);
    for (let a = 0; a < 24; a++) for (let b = 1; b <= 6; b++) { const la = b * .2, lo = a / 24 * 6.2832; surface(Math.cos(lo) * Math.sin(la), Math.cos(la), Math.sin(lo) * Math.sin(la), o); if (o.y > reperes.sommet.y) reperes.sommet.copy(o); }
    const R = F.reperes || {}; for (const k in R) if (reperes[k]) reperes[k].fromArray(R[k]);
  }

  // ── matériaux pour les parties ──
  const lumiere = ({ couleur = U.uAccCol, opacite = 1, eclat = 1, lisere = .6, voile = 1, douceur = .6, cote = THREE.FrontSide } = {}) => new THREE.ShaderMaterial({ ...premul, depthWrite: true, depthTest: true, side: cote,
    vertexShader: LUMIERE_V, fragmentShader: LUMIERE_F,
    uniforms: { ...pick(...BASE, 'uCamL', 'uInvL'), uCouleur: couleur.isColor ? { value: couleur } : couleur,
      uOpacite: { value: opacite }, uEclat: { value: eclat }, uLisere: { value: lisere }, uVoile: { value: voile }, uDouceur: { value: douceur } } });
  const voiler = (m) => { Object.assign(m, premul); m.onBeforeCompile = s => { Object.assign(s.uniforms, pick(...BASE, 'uCamL', 'uInvL'));
      s.vertexShader = 'uniform mat4 uInvL; varying vec3 vLocV;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vLocV = (uInvL*modelMatrix*vec4(transformed, 1.)).xyz;');
      s.fragmentShader = PRELUDE + '\n' + CODE_FORMES + '\n' + VOILE + '\nvarying vec3 vLocV;\n' + s.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float Tv = transmission(vLocV); vec3 vifV = vifDe(uColor);
        gl_FragColor.rgb = mix(linearToOutputTexel(vec4(mix(vifV, vec3(1., .96, .9), .4)*.85, 1.)).rgb, gl_FragColor.rgb, Tv);
        gl_FragColor.a *= uApp*mix(Tv, 1., uClair*.7); gl_FragColor.rgb *= gl_FragColor.a;`); };
    m.customProgramCacheKey = () => 'lueur-voile-' + m.type; return m; };
  const preparer = (objet, ordre = ORDRE.parties) => { objet.traverse(x => { x.renderOrder = ordre; x.frustumCulled = false; if (x.material) for (const m of [].concat(x.material)) m.transparent = true; }); return objet; };
  const ctx = { THREE, ORDRE, GLSL, U, pivot, forme, visage, materiaux: { lumiere, voiler }, preparer };

  // ── les parties : créées une fois, invisibles, APRÈS la silhouette (creer voit déjà les repères) ; portées / retirées par presence ──
  const parties = [];
  const voulu = { forme: 'rond', texture: 'lisse', acc: 0, habit: 0, ailes: false, bras: false, pieds: false };
  const estVoulue = c => c === 'acc' + voulu.acc || c === 'habit' + voulu.habit || (c === 'ailes' && voulu.ailes) || (c === 'bras' && voulu.bras) || (c === 'pieds' && voulu.pieds)
    || c === 'forme-' + voulu.forme || c === 'matiere-' + voulu.texture;
  function changerForme(nom) {
    F = FORMES[nom] || FORMES.rond; voulu.forme = FORMES[nom] ? nom : 'rond';
    forme.nom = voulu.forme; forme.bornes = F.bornes || 1; U.uForme.value = F.id; U.uBornes.value = forme.bornes;
    visage.y = (F.visage && F.visage.y) || 0; visage.echelle = (F.visage && F.visage.echelle) || 1; U.uVisage.value.set(visage.y, visage.echelle);
    construireSilhouette();
    for (let i = 0; i < parties.length; i++) { const p = parties[i]; if (p.inst.placer) p.inst.placer(ctx); }
  }
  function changerMatiere(nom) {
    const M = MATIERES[nom] || MATIERES.lisse; voulu.texture = MATIERES[nom] ? nom : 'lisse'; U.uTex.value = M.id;
    const g = Object.assign({ brume: 1, poussiere: 1, etincelles: 1, teinte: [1, 1, 1], part: 0, scint: 1, taille: 1 }, M.grains);
    U.uGr.value.set(g.brume, g.poussiere, g.etincelles, g.scint); U.uGr2.value.set(g.taille, g.part, 0, 0); U.uTeinte.value.fromArray(g.teinte);
  }
  changerForme('rond'); changerMatiere('lisse');
  const ajouter = (cle, def) => { if (!def || !def.creer) return; let inst = null;
    try { inst = def.creer(ctx); } catch (e) { console.warn('lueur3d : partie', cle, e); return; }
    if (!inst || !inst.objet) return; if (!inst.objet.parent) pivot.add(inst.objet); inst.objet.visible = false;
    parties.push({ cle, inst, presence: 0 });
    if (inst.placer) try { inst.placer(ctx); } catch (e) { console.warn('lueur3d : placer', cle, e); } };
  for (const k in ACCESSOIRES) ajouter('acc' + k, ACCESSOIRES[k]);
  for (const k in HABITS) ajouter('habit' + k, HABITS[k]);
  for (const k in MEMBRES) ajouter(k, MEMBRES[k]);
  for (const k in FORMES) ajouter('forme-' + k, FORMES[k]);
  for (const k in MATIERES) ajouter('matiere-' + k, MATIERES[k]);

  const cur = { yeuxCouleur: undefined, accCouleur: undefined, couleur: undefined }, hsl = { h: 0, s: 0, l: 0 };
  let habitAuto = true;
  function appliquerPerso(P) {
    if ((P.forme || 'rond') !== voulu.forme) changerForme(P.forme || 'rond');
    if ((P.texture || 'lisse') !== voulu.texture) changerMatiere(P.texture || 'lisse');
    U.uEyeS.value = P.yeux || 1;
    if (P.yeuxCouleur) { if (P.yeuxCouleur !== cur.yeuxCouleur) { U.uEyeCol.value.set(P.yeuxCouleur); cur.yeuxCouleur = P.yeuxCouleur; } U.uEyeOn.value = 1; } else U.uEyeOn.value = 0;
    const ac = P.accCouleur || '#ffd98a'; if (ac !== cur.accCouleur) { U.uAccCol.value.set(ac); cur.accCouleur = ac; }
    habitAuto = String(ac).toLowerCase() === '#ffd98a';
    voulu.acc = P.acc | 0; voulu.habit = P.habit | 0; voulu.ailes = !!P.ailes; voulu.bras = !!P.bras; voulu.pieds = !!P.pieds;
  }
  const lire = (u, v) => { if (v !== undefined) u.value = v; };

  function maj(dt, t, etat = {}) {
    U.uT.value = t;
    if (etat.perso) appliquerPerso(etat.perso);
    const c = etat.couleur; if (c) { if (c.isColor) U.uColor.value.copy(c); else if (c !== cur.couleur) { U.uColor.value.set(c); cur.couleur = c; } }
    lire(U.uClair, etat.clair); lire(U.uApp, etat.app); lire(U.uJoy, etat.joie); lire(U.uSad, etat.triste); lire(U.uBrow, etat.sourcils); lire(U.uSpark, etat.eclat);
    lire(U.uRelax, etat.calme); lire(U.uWide, etat.grands); lire(U.uSleep, etat.sommeil); lire(U.uBlink, etat.cligne); lire(U.uStarEye, etat.yeuxEtoiles);
    lire(U.uFlap, etat.battement); lire(U.uTilt, etat.penche);
    if (etat.regard) U.uLook.value.set(etat.regard.x || 0, etat.regard.y || 0);
    const x = etat.expr; if (x) { if (Array.isArray(x)) U.uExpr.value.fromArray(x); else U.uExpr.value.set(x.x || 0, x.y || 0, x.z || 0, x.w || 0); }
    if (etat.ecrase) U.uSquash.value.set(etat.ecrase.x || 1, etat.ecrase.y || 1);
    if (etat.habitCouleur) U.uHabitCol.value.copy(etat.habitCouleur);
    else if (habitAuto) { U.uColor.value.getHSL(hsl); U.uHabitCol.value.setHSL((hsl.h + .5) % 1, clamp(hsl.s, .55, .8), .6); } else U.uHabitCol.value.copy(U.uAccCol.value);
    // le corps : écrasé / étiré, penché (comme la v11)
    const sq = U.uSquash.value; pivot.scale.set(sq.x, sq.y, sq.x); pivot.rotation.z = U.uTilt.value;
    // les parties : présence lissée (fondu ou pousse à leur charge)
    const k = Math.min(1, dt * 5);
    for (let i = 0; i < parties.length; i++) {
      const p = parties[i], v = estVoulue(p.cle) ? 1 : 0;
      p.presence += (v - p.presence) * k; if (v && p.presence > .998) p.presence = 1; if (!v && p.presence < .002) p.presence = 0;
      p.inst.objet.visible = p.presence > 0;
      if (p.presence > 0 && p.inst.maj) p.inst.maj(dt, t, etat, p.presence);
    }
  }

  function orienter(camera, lacet = 0, tangage = 0) { groupe.quaternion.copy(camera.quaternion).multiply(_q.setFromEuler(_e.set(tangage, lacet, 0))); }
  const ecr = { x: 0, y: 0, r: 0 }, _c = new THREE.Vector3(), _d = new THREE.Vector3();
  function ecran(camera, largeur, hauteur) {                         // centre et rayon du corps à l'écran (px CSS) : bulle, zone de clic (aucune allocation)
    groupe.updateMatrixWorld(); _c.setFromMatrixPosition(groupe.matrixWorld); const k = groupe.matrixWorld.getMaxScaleOnAxis(), dist = _d.copy(_c).sub(camera.position).length();
    _c.project(camera); ecr.x = (_c.x + 1) / 2 * largeur; ecr.y = (1 - _c.y) / 2 * hauteur;
    ecr.r = k / Math.max(dist, 1e-3) * hauteur / (2 * Math.tan(camera.fov * Math.PI / 360)); return ecr;
  }
  const enc = { haut: 1, bas: 1, cote: 1 };
  function encombrement() {
    enc.haut = reperes.sommet.y; enc.bas = -reperes.bas.y; enc.cote = Math.max(reperes.droite.x, -reperes.gauche.x);
    for (let i = 0; i < parties.length; i++) { const p = parties[i], e = p.inst.encombrement; if (p.presence > .5 && e) { if (e.haut) enc.haut = Math.max(enc.haut, e.haut); if (e.bas) enc.bas = Math.max(enc.bas, e.bas); if (e.cote) enc.cote = Math.max(enc.cote, e.cote); } }
    return enc;
  }
  function prechauffer(renderer, camera) {                            // renderer.compile ne voit que le visible : on allume tout le temps de compiler
    const vis = parties.map(p => p.inst.objet.visible); for (const p of parties) p.inst.objet.visible = true;
    const sc = new THREE.Scene(), parent = groupe.parent; sc.add(groupe); groupe.updateMatrixWorld(true);
    try { renderer.compile(sc, camera); } catch (e) {}
    if (parent) parent.add(groupe); else sc.remove(groupe);
    parties.forEach((p, i) => { p.inst.objet.visible = vis[i]; });
  }
  function liberer() { groupe.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) for (const m of [].concat(x.material)) m.dispose(); }); for (const p of parties) if (p.inst.liberer) p.inst.liberer(); }

  return { groupe, pivot, U, maj, orienter, ecran, encombrement, prechauffer, liberer, forme, visage, ctx, corps, grains, halo, masque, visageMesh, parties };
}
