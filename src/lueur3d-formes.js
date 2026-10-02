// Lueur 3D — silhouettes (rond, chat, fantome, coeur, etoile) et matières (lisse, nacre, givre, paillettes, nebuleuse).
// Ce fichier ne contient QUE des données : du GLSL (compilé une seule fois avec le corps, choisi par uniforms) et de petites fonctions JS.
// Il n'importe rien (pas même three : creer(ctx) reçoit ctx.THREE) ; lueur3d.js l'importe et assemble tout au chargement.
//
// ═══ CONTRAT (recopié de lueur3d.js, qui fait foi ; lisez aussi son en-tête pour ctx, U, GLSL, ORDRE) ═══
// Repère du corps : rayon ≈ 1, +Z = visage, +Y = haut, centre = (0,0,0). Unités du corps partout (GLSL et JS). Le visage v11 a un rayon de .5 :
// ×2 pour passer en unités du corps (yeux v11 ±.16, .08 → ±.32, .16).
//
// FORMES[nom] = {
//   id: entier unique (rond 0, chat 1, fantome 2, coeur 3, etoile 4) → uniform uForme ; ne JAMAIS réutiliser un id.
//   sd: 'sdChat'               nom de la fonction GLSL `float sdChat(vec3 p)` : distance signée à la surface (négative dedans).
//                              Une borne inférieure suffit (ex. sdEllipsoide). Elle peut lire uT (temps, s) pour onduler (fantôme) — mais la version JS, non.
//   glsl: `…`                  le code GLSL de sd (et de deco). Préfixez vos fonctions privées par le nom de la forme (chatOreille…).
//                              Disponibles avant votre code (GLSL.prelude) : smin, smax, sdEllipsoide, sdCapsule, sdCone, sdTore, sdBoite, rot2, h3, n3, trame, vifDe,
//                              les uniforms uT, uApp, uClair, uForme, uTex, uBornes, uColor, et la struct Gaz (pour deco).
//                              Ce code est compilé dans le corps (fragment), les grains (vertex), les parties (fragment) : rien qui n'existe que dans un seul étage.
//   js: (x, y, z) => distance  la MÊME distance en JS (sans le temps) : sert à poser le visage, le masque, les repères, les accessoires. Aucune allocation.
//   bornes: 1.6                rayon de la sphère (centrée) qui contient toute la silhouette (oreilles, queue, branches…) → uniform uBornes.
//   visage: { y: 0, echelle: 1 }   décalage vertical et échelle du visage (unités v11 : rayon du corps .5 ; ex. étoile v11 : y .015, échelle .94).
//                              Le visage est une calotte projetée selon -Z sur l'avant de la surface : il faut une surface avant continue sous les yeux, la bouche
//                              et les joues (|x| ≤ .4, -.2 ≤ y ≤ .33 en unités v11 × echelle, + y).
//   deco: 'decoChat'           (facultatif) `void decoChat(inout Gaz g)` : retouche le gaz (intérieur rosé des oreilles, bas diaphane…). Appelée avant la matière.
//   reperes: { haut: [x,y,z], … }   (facultatif) remplace des repères calculés (haut, sommet, bas, gauche, droite, avant, arriere, cou ; voir lueur3d.js).
//   creer(ctx)                 (facultatif) objets 3D en plus (moustaches…), visibles seulement avec cette forme : même contrat qu'une partie.
// }
//
// MATIERES[nom] = {
//   id: entier unique (lisse 0, nacre 1, givre 2, paillettes 3, nebuleuse 4) → uniform uTex.
//   fn: 'matNacre'             (facultatif) `void matNacre(inout Gaz g)` : retouche le gaz après la couleur de base et deco (lisse = rien).
//   glsl: `…`                  son code GLSL (fonctions privées préfixées : nacreIri…). Compilé dans le corps seulement.
//   grains: { brume, poussiere, etincelles, teinte, part, scint, taille }   (facultatif) réglages des grains de lumière, par uniforms
//                              (aucune recompilation) : multiplicateurs d'éclat (1 = lisse), teinte [r,g,b] linéaire mêlée aux grains
//                              dans la proportion part (0..1), scint = scintillement (0..1), taille = multiplicateur de taille.
//   creer(ctx)                 (facultatif) objets 3D en plus, visibles seulement avec cette matière.
// }
//
// struct Gaz (ce que reçoivent deco et fn ; tout en linéaire, unités du corps) :
//   vec3 p     point du rayon le plus proche de la surface (le plus profond) · vec3 rd  direction du regard (de la caméra vers le fond)
//   vec3 pa    point d'entrée du rayon dans la surface (= p si le rayon la manque) · vec3 n  normale de la surface en pa (au plus près si raté)
//   float smin distance signée minimale le long du rayon (négative : le rayon traverse le corps) · float dedans  1 si le rayon touche la surface
//   float D    densité 0..1 (1 au cœur, 0 hors de la frange) · float ep  demi-épaisseur traversée 0..1 · float vol  volutes -.5..+.5 · float k  poids des volutes
//   vec3 vif   la couleur à pleine luminosité · vec3 coeur · vec3 dense · vec3 pale   (palette dérivée de uColor)
//   vec3 c     couleur (à modifier) · float E  émission · float A  opacité · vec3 brille  lumière ajoutée (reflets, éclats ; non plafonnée)
//   float halo rayonnement autour de la silhouette (ajouté, sans opacité).
// Sortie : em = c*E plafonné (le visage reste net) + halo + brille ; opacité A. En mode clair (uClair = 1), lueur3d.js remplace E et A par un gaz couvrant
//   (couleur c, bord plus dense) : ne testez uClair que pour adoucir des éclats (brille est réduit de moitié sur papier).
//
// Règles : pas de `discard`, pas de boucle de plus de 8 tours, pas de texture. Tout doit rester joli à 100-150 px de diamètre.
// Le corps est marché en 28 pas le long du rayon : sd est appelée ~35 fois par pixel → restez simple (quelques smin, pas de bruit dans sd).
// Les grains (brume, poussière) sont semés dans la sphère unité puis étirés jusqu'à la surface dans leur direction (rayonForme) : ils remplissent
// toute silhouette « étoilée » depuis le centre sans rien faire ; la queue du chat, par exemple, n'en aura pas (c'est voulu).

// ── petits outils JS (mêmes formules que le GLSL du prélude ; aucune allocation) ──
const ell = (x, y, z, a, b, c) => { const k0 = Math.hypot(x / a, y / b, z / c), k1 = Math.hypot(x / (a * a), y / (b * b), z / (c * c)); return k0 * (k0 - 1) / Math.max(k1, 1e-5); };
const smin = (a, b, k) => { const h = Math.min(1, Math.max(0, .5 + .5 * (b - a) / k)); return b + (a - b) * h - k * h * (1 - h); };
const smax = (a, b, k) => -smin(-a, -b, k);
const cone = (px, py, pz, ax, ay, az, bx, by, bz, r1, r2) => {     // cône arrondi entre a (r1) et b (r2) : le sdCone du prélude (Inigo Quilez)
  const bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - ax, pay = py - ay, paz = pz - az, y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y, x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
};
const branche = (x, y, r1, r2, h) => {                              // capsule qui s'affine le long de +y (2D ; en 3D par révolution autour de l'axe)
  x = Math.abs(x); const b = (r1 - r2) / h, a = Math.sqrt(1 - b * b), k = -b * x + a * y;
  if (k < 0) return Math.hypot(x, y) - r1; if (k > a * h) return Math.hypot(x, y - h) - r2; return a * x + b * y - r1;
};
const fmod = (x, y) => x - y * Math.floor(x / y);                  // le mod du GLSL

// chat : constantes partagées par le GLSL et le JS (oreilles, queue)
const OR = { a: [.44, .6], b: [.74, 1.38], r1: .35, r2: .075, z: -.05, ep: .17 };              // oreille droite (x > 0) ; la gauche en miroir
const QU = { c: [.98, -.42, -.36], lacet: .6, rot: -2.4697, ra: .42, rb: .095, sc: [.9483, -.3173] };   // queue : un arc de tore (217°) penché vers l'arrière
const g3 = v => v.map(n => n.toFixed(4)).join(', ');
const cQ = Math.cos(-QU.lacet), sQ = Math.sin(-QU.lacet), cR = Math.cos(QU.rot), sR = Math.sin(QU.rot);
const oreilleJS = (x, y, z) => smax(cone(Math.abs(x), y, z - OR.z, OR.a[0], OR.a[1], 0, OR.b[0], OR.b[1], 0, OR.r1, OR.r2), Math.abs(z - OR.z) - OR.ep, .1);
const queueJS = (x, y, z) => {
  let qx = x - QU.c[0], qy = y - QU.c[1], qz = z - QU.c[2];
  let u = cQ * qx + sQ * qz; const w = -sQ * qx + cQ * qz;          // rot2(-lacet) sur xz
  const vx = cR * u + sR * qy, vy = -sR * u + cR * qy; u = Math.abs(vx);   // rot2(rot) sur xy
  const k = QU.sc[1] * u > QU.sc[0] * vy ? u * QU.sc[0] + vy * QU.sc[1] : Math.hypot(u, vy);
  return Math.sqrt(Math.max(u * u + vy * vy + w * w + QU.ra * QU.ra - 2 * QU.ra * k, 0)) - QU.rb;
};
// cœur : deux lobes, chacun fondu avec la pointe (l'enveloppe de deux boules = un cône arrondi), puis fondus entre eux
const CO = { lobe: [.49, .22], r: .63, pointe: -.98, rp: .1, k: .12, z: 1.12, ventre: [-.1, .64, .64, .7] };   // ventre : un ellipsoïde au milieu (y, rayons), sinon le cœur se pince entre les lobes
// étoile : cinq branches dodues (capsules qui s'affinent, par révolution), fondues entre elles
const ET = { r1: .6, r2: .24, h: .92, k: .2, z: .86 };

export const FORMES = {
  // rond : un orbe à peine plus large que haut (comme la v11 et l'étude 7C)
  rond: {
    id: 0, sd: 'sdRond', bornes: 1.02, visage: { y: 0, echelle: 1 },
    glsl: `float sdRond(vec3 p){ return sdEllipsoide(p, vec3(1., .95, .95)); }
  void formeNette(inout Gaz g, float k){ float Dc = 1. - smoothstep(-.3, .07, g.smin); g.E = max(g.E, pow(Dc, .9)*.6*k); g.A = max(g.A, pow(Dc, 1.15)*.8*k); }   // bord plus net : les creux se lisent`,
    js: (x, y, z) => ell(x, y, z, 1, .95, .95),
  },

  // chat : la tête ronde, deux oreilles pointues aux bouts arrondis (des cônes aplatis, intérieur rosé), une queue enroulée derrière, à droite ;
  // des moustaches de lumière (tracées dans le gaz : distance du rayon à quatre segments, sans arête ni crénelage)
  chat: {
    id: 1, sd: 'sdChat', bornes: 1.68, visage: { y: 0, echelle: 1 }, deco: 'decoChat',
    glsl: `
  float chatOreilles(vec3 p){ vec3 q = vec3(abs(p.x), p.y, p.z - ${OR.z.toFixed(3)});
    return smax(sdCone(q, vec3(${OR.a[0]}, ${OR.a[1]}, 0.), vec3(${OR.b[0]}, ${OR.b[1]}, 0.), ${OR.r1}, ${OR.r2}), abs(q.z) - ${OR.ep}, .1); }
  float chatQueue(vec3 p){ vec3 q = p - vec3(${g3(QU.c)}); q.xz = rot2(${(-QU.lacet).toFixed(4)})*q.xz; q.xy = rot2(${QU.rot.toFixed(4)})*q.xy; q.x = abs(q.x);
    const vec2 sc = vec2(${g3(QU.sc)}); float k = sc.y*q.x > sc.x*q.y ? dot(q.xy, sc) : length(q.xy);
    return sqrt(max(dot(q, q) + ${(QU.ra * QU.ra).toFixed(4)} - ${(2 * QU.ra).toFixed(4)}*k, 0.)) - ${QU.rb}; }
  float sdChat(vec3 p){ return smin(smin(sdEllipsoide(p, vec3(1., .95, .95)), chatOreilles(p), .09), chatQueue(p), .1); }
  vec3 chatTrait(vec3 o, vec3 d, vec3 a, vec3 b){                    // rayon (o, d) et segment [a, b] : distance, profondeur le long du rayon, position sur le segment
    vec3 ba = b - a, oa = a - o; float bd = dot(ba, d), od = dot(oa, d), s = clamp((od*bd - dot(oa, ba))/max(dot(ba, ba) - bd*bd, 1e-5), 0., 1.);
    vec3 q = oa + ba*s; float t = dot(q, d); return vec3(length(q - d*t), t, s); }
  float chatOreilleDedans(vec2 p){                                    // l'intérieur de l'oreille (vu de face) : une petite capsule effilée
    p.x = abs(p.x); vec2 a = vec2(.48, .76), ax = normalize(vec2(.21, .5)); p -= a; p = vec2(abs(dot(p, vec2(ax.y, -ax.x))), dot(p, ax));
    float h = .5, r1 = .15, r2 = .03, b = (r1 - r2)/h, aa = sqrt(1. - b*b), k = dot(p, vec2(-b, aa));
    return k < 0. ? length(p) - r1 : k > aa*h ? length(p - vec2(0., h)) - r2 : dot(p, vec2(aa, b)) - r1; }
  void decoChat(inout Gaz g){
    // oreilles et queue : des volumes fins → densité propre (sinon ils paraissent fantomatiques), bord net mais doux
    float dT = sdEllipsoide(g.p, vec3(1., .95, .95)), dO = chatOreilles(g.p), dQ = chatQueue(g.p);
    float wO = smoothstep(.14, -.04, dO)*smoothstep(-.12, .1, dT), wQ = smoothstep(.12, -.03, dQ)*smoothstep(-.1, .08, dT), w = max(wO, wQ);
    float Dt = 1. - smoothstep(-.1, .05, g.smin);
    g.E = mix(g.E, max(g.E, pow(Dt, .9)*.7), w); g.A = mix(g.A, max(g.A, pow(Dt, 1.1)*.8), w);
    g.c = mix(g.c, mix(g.vif, g.coeur, .25), w*.5*Dt);
    g.smin -= .07*w;                                                   // papier : un peu plus couvrant
    // l'intérieur rosé des oreilles, sur leur face avant
    float rose = smoothstep(.03, -.05, chatOreilleDedans(g.pa.xy))*smoothstep(-.12, .04, g.pa.z - ${OR.z.toFixed(3)})*wO*g.dedans;
    g.c = mix(g.c, vec3(1., .58, .74), rose*.6);
    // moustaches de lumière : deux de chaque côté, qui partent des joues vers l'extérieur
    float m = 0.;
    for (int i = 0; i < 4; i++) {
      float s = i < 2 ? -1. : 1., j = mod(float(i), 2.);
      vec3 a = vec3(s*.6, -.1 - j*.1, .74), b = vec3(s*1.24, -.03 - j*.24, .5);
      vec3 r = chatTrait(g.p, g.rd, a, b);
      m += smoothstep(.022, .005, r.x)*smoothstep(.0, .25, r.z)*smoothstep(1.02, .7, r.z)*mix(1., clamp(1. - 1.2*g.A, 0., 1.), smoothstep(-.15, .15, r.y));   // derrière le gaz : cachée
    }
    m = min(m, 1.);
    g.brille += mix(g.vif, vec3(1.), .6)*m*.36*(1. - uClair);
    g.smin = mix(g.smin, min(g.smin, -.05), m*uClair);                 // papier : la moustache couvre (sinon elle ne se verrait pas)
  }`,
    js: (x, y, z) => smin(smin(ell(x, y, z, 1, .95, .95), oreilleJS(x, y, z), .09), queueJS(x, y, z), .1),
  },

  // fantôme : une tête ronde, un drapé dont le bas fait des vagues tout autour et ondule ; plus diaphane en bas
  fantome: {
    id: 2, sd: 'sdFantome', bornes: 1.45, visage: { y: 0, echelle: 1 }, deco: 'decoFantome',
    glsl: `
  float sdFantome(vec3 p){ vec3 c = p - vec3(0., .06, 0.); float r = length(c.xz), an = r > 1e-5 ? atan(p.x, p.z) : 0.;
    float hw = .9 + clamp(-c.y, 0., 1.1)*.14, ourlet = -.92 - .09*cos(p.x*8. - uT*1.6) - .02*sin(an*2. + uT*1.1);   // vagues selon x (comme la v11) : de face, l'ourlet se lit (des vagues tout autour se comblent le long du regard)
    vec2 d = vec2(r - hw + .08, ourlet + .08 - p.y);
    return min(length(c) - .9, max(length(max(d, 0.)) + min(max(d.x, d.y), 0.) - .08, c.y)); }
  void decoFantome(inout Gaz g){ float b = smoothstep(-.1, -.95, g.p.y); formeNette(g, .6); g.E = max(g.E, .36*smoothstep(.08, -.22, g.smin)*b); g.A *= 1. - .3*b; g.c = mix(g.c, g.pale, b*.3); }   // bas diaphane mais lumineux`,
    js: (x, y, z) => {
      const cy = y - .06, r = Math.hypot(x, z), an = r > 1e-5 ? Math.atan2(x, z) : 0;
      const hw = .9 + Math.min(1.1, Math.max(0, -cy)) * .14, ourlet = -.92 - .09 * Math.cos(x * 8) - .02 * Math.sin(an * 2);
      const dx = r - hw + .08, dy = ourlet + .08 - y;
      return Math.min(Math.hypot(x, cy, z) - .9, Math.max(Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - .08, cy));
    },
  },

  // cœur : un cœur dodu, arrondi de partout (deux lobes ronds qui descendent vers une pointe douce), un peu moins épais que large
  coeur: {
    id: 3, sd: 'sdCoeur', bornes: 1.22, visage: { y: 0, echelle: 1 }, deco: 'decoCoeur',
    glsl: `
  float sdCoeur(vec3 p){ vec3 q = vec3(p.x, p.y, p.z*${CO.z});
    float g = sdCone(q, vec3(-${CO.lobe[0]}, ${CO.lobe[1]}, 0.), vec3(0., ${CO.pointe}, 0.), ${CO.r}, ${CO.rp}), d = sdCone(q, vec3(${CO.lobe[0]}, ${CO.lobe[1]}, 0.), vec3(0., ${CO.pointe}, 0.), ${CO.r}, ${CO.rp});
    return smin(smin(g, d, ${CO.k}), sdEllipsoide(q - vec3(0., ${CO.ventre[0]}, 0.), vec3(${g3(CO.ventre.slice(1))})), .2)/${CO.z}; }
  void decoCoeur(inout Gaz g){ formeNette(g, .8); }`,
    js: (x, y, z) => { const zz = z * CO.z;
      const d = smin(cone(x, y, zz, -CO.lobe[0], CO.lobe[1], 0, 0, CO.pointe, 0, CO.r, CO.rp), cone(x, y, zz, CO.lobe[0], CO.lobe[1], 0, 0, CO.pointe, 0, CO.r, CO.rp), CO.k);
      return smin(d, ell(x, y - CO.ventre[0], zz, CO.ventre[1], CO.ventre[2], CO.ventre[3]), .2) / CO.z; },
  },

  // étoile : cinq branches dodues fondues entre elles, bombée au centre (le visage, un peu plus petit, comme dans la v11)
  etoile: {
    id: 4, sd: 'sdEtoile', bornes: 1.2, visage: { y: .015, echelle: .94 }, deco: 'decoEtoile',
    glsl: `
  float etoileBranche(vec2 p, float r1, float r2, float h){ p.x = abs(p.x); float b = (r1 - r2)/h, a = sqrt(1. - b*b), k = dot(p, vec2(-b, a));
    if (k < 0.) return length(p) - r1; if (k > a*h) return length(p - vec2(0., h)) - r2; return dot(p, vec2(a, b)) - r1; }
  float sdEtoile(vec3 p){ float r = length(p.xy), a = r > 1e-5 ? atan(p.x, p.y) : 0., a1 = mod(a + .628319, 1.256637) - .628319, a2 = a1 - (a1 >= 0. ? 1.256637 : -1.256637), z = p.z*${ET.z};
    vec2 b1 = r*vec2(sin(a1), cos(a1)), b2 = r*vec2(sin(a2), cos(a2));
    return smin(etoileBranche(vec2(length(vec2(b1.x, z)), b1.y), ${ET.r1}, ${ET.r2}, ${ET.h}), etoileBranche(vec2(length(vec2(b2.x, z)), b2.y), ${ET.r1}, ${ET.r2}, ${ET.h}), ${ET.k}); }
  void decoEtoile(inout Gaz g){ formeNette(g, .7); }`,
    js: (x, y, z) => {
      const r = Math.hypot(x, y), a = r > 1e-5 ? Math.atan2(x, y) : 0, a1 = fmod(a + .628319, 1.256637) - .628319, a2 = a1 - (a1 >= 0 ? 1.256637 : -1.256637), zz = z * ET.z;
      const u1 = r * Math.sin(a1), v1 = r * Math.cos(a1), u2 = r * Math.sin(a2), v2 = r * Math.cos(a2);
      return smin(branche(Math.hypot(u1, zz), v1, ET.r1, ET.r2, ET.h), branche(Math.hypot(u2, zz), v2, ET.r1, ET.r2, ET.h), ET.k);
    },
  },
};

// ── matières : toutes lumineuses ; elles retouchent la couleur du gaz (c) et ajoutent des reflets (brille), jamais d'ombre brune ──
// face : 1 de face, 0 de biais (sur la surface d'entrée) ; peau : le rayon touche la surface (fondu doux au bord, pas d'arête)
const MAT_COMMUN = `
  float matFace(Gaz g){ return clamp(-dot(g.n, g.rd), 0., 1.); }
  float matPeau(Gaz g){ return smoothstep(.05, -.08, g.smin); }
  float matEclat(vec3 q, float seuil, float vitesse, float r){         // un éclat par case (une part des cases), qui scintille à son rythme
    vec3 i = floor(q), f = fract(q) - .5, h = h3(i); f -= (h.yzx - .5)*.5;
    return step(seuil, h.x)*pow(.5 + .5*sin(uT*vitesse*(.7 + .6*h.z) + h.y*50.), 6.)*exp(-dot(f, f)/(r*r)); }
`;
export const MATIERES = {
  // lisse : le gaz de l'étude 7C, poussière d'étoiles dedans (c'est le réglage de base de lueur3d.js : rien à retoucher)
  lisse: { id: 0, fn: null, glsl: MAT_COMMUN, grains: { brume: 1, poussiere: 1, etincelles: 1, teinte: [1, 1, 1], part: 0, scint: 1, taille: 1 } },

  // nacre : une perle de lumière ; des reflets irisés (rose, lilas, menthe) qui glissent avec le volume quand elle tourne, liseré nacré
  nacre: {
    id: 1, fn: 'matNacre',
    glsl: `
  void matNacre(inout Gaz g){
    float cv = matFace(g), pe = matPeau(g);
    vec3 lisse = mix(mix(g.vif, g.coeur, g.ep*g.ep*g.ep), g.pale, (1. - g.D)*.2);
    g.c = mix(g.c, lisse, .65);                                         // plus calme : la perle est lisse
    float t = dot(g.n, vec3(.5, .62, .25))*.7 + cv*.9 + g.vol*.08 + uT*.02;
    vec3 iri = mix(mix(vec3(1., .7, .84), vec3(.78, .74, 1.), smoothstep(-.6, .6, sin(t*6.2832))), vec3(.72, .93, 1.), smoothstep(.2, .9, sin(t*6.2832 + 2.1))*.7);   // rose, lilas, bleu ciel
    vec3 perle = mix(g.c, vec3(1., .97, .97), .35)*mix(vec3(1.), iri, .7);
    g.c = mix(g.c, perle, (.45 + .4*(1. - cv))*pe);
    vec3 r = reflect(g.rd, g.n); float sp = pow(clamp(dot(r, normalize(vec3(-.4, .62, .68))), 0., 1.), 10.);
    g.brille += mix(vec3(1.), iri, .7)*(pow(1. - cv, 2.)*.24 + sp*.2)*pe*(1. - .4*uClair);
  }`,
    grains: { brume: 1, poussiere: .7, etincelles: 1, teinte: [1, .9, 1], part: .3, scint: .6, taille: 1 },
  },

  // givre : une surface glacée (bleutée, grain fin), de fines craquelures de lumière, des éclats qui scintillent
  givre: {
    id: 2, fn: 'matGivre',
    glsl: `
  void matGivre(inout Gaz g){
    float cv = matFace(g), pe = matPeau(g);
    vec3 q = g.pa*4.2; float cr = abs(n3(q) - .5), cr2 = abs(n3(q*2.3 + 7.1) - .5);
    float ve = (smoothstep(.06, .012, cr)*.65 + smoothstep(.05, .01, cr2)*.35)*smoothstep(.15, .5, cv);   // craquelures (s'effacent de biais : pas de moiré)
    float fr = n3(g.pa*15.)*.6 + n3(g.pa*31.)*.4;                                                       // grain du givre
    vec3 glace = mix(vec3(.74, .88, 1.), g.vif, .2);
    g.c = mix(g.c, glace*(.82 + .26*fr), .45*pe);
    g.c = mix(g.c, vec3(.95, .99, 1.), ve*.35*pe*(1. - .5*g.ep));
    float ec = matEclat(g.pa*9., .8, 1.3, .14) + matEclat(g.pa*15. + 3.1, .82, 1.9, .12)*.7;
    g.brille += (vec3(.9, .97, 1.)*(ve*.12 + ec*1.1) + vec3(.82, .93, 1.)*pow(1. - cv, 2.6)*.24)*pe*(1. - .4*uClair);
  }`,
    grains: { brume: .8, poussiere: 1.15, etincelles: 1.2, teinte: [.85, .95, 1], part: .55, scint: 1.2, taille: .9 },
  },

  // paillettes : de minuscules éclats dorés et rosés qui pétillent, sur la peau et dans le gaz (plus de poussière, qui scintille)
  paillettes: {
    id: 3, fn: 'matPaillettes',
    glsl: `
  void matPaillettes(inout Gaz g){
    float pe = matPeau(g), cv = matFace(g); vec3 t = vec3(0.);
    for (int i = 0; i < 2; i++) { float fi = float(i); vec3 q = g.pa*(10. + fi*6.) + fi*4.2, h = h3(floor(q) + 17.);
      t += matEclat(q, .3 + fi*.1, 2.6 + fi*1.5, .2 - fi*.04)*mix(vec3(1., .86, .55), vec3(1., .68, .9), h.z)*(1.6 - fi*.4); }
    vec3 qd = g.p*7. - g.rd*.7; t += matEclat(qd, .5, 2.2, .16)*vec3(1., .93, .8)*smoothstep(.2, .7, g.D);   // et dans le gaz
    g.c = mix(g.c, g.coeur, .12)*(.95 + .1*n3(g.pa*26.));
    g.brille += t*(.6 + .5*cv)*pe*(1. - .4*uClair);
  }`,
    grains: { brume: .9, poussiere: 1.6, etincelles: 1.5, teinte: [1, .88, .78], part: .25, scint: 1.4, taille: .85 },
  },

  // nébuleuse : un petit ciel violet et doré qui tourbillonne à l'intérieur (deux profondeurs : il a du fond), le cœur reste doré, de petites étoiles
  nebuleuse: {
    id: 4, fn: 'matNebuleuse',
    glsl: `
  float nebuleuseCiel(vec3 q){ q.xz = rot2(uT*.12 + length(q)*1.7)*q.xz; float n1 = n3(q*2.1 + vec3(0., uT*.05, 0.)); return n1*.62 + n3(q*4.4 - n1*1.7)*.38; }
  void matNebuleuse(inout Gaz g){
    float L = max(g.ep, .25)*.55, nb = (nebuleuseCiel(g.p - g.rd*L) + nebuleuseCiel(g.p + g.rd*L))*.5, n2 = nebuleuseCiel(g.p*1.6 + 3.);
    vec3 violet = mix(vec3(.3, .14, .72), g.vif*vec3(.5, .4, 1.), .15), lilas = mix(g.vif, vec3(.66, .46, 1.), .7);
    vec3 neb = mix(violet, lilas, smoothstep(.34, .6, nb));
    neb = mix(neb, vec3(1., .66, .88), smoothstep(.56, .78, n2)*.5);                     // nuées roses
    neb = mix(neb, g.coeur, smoothstep(.6, .98, g.ep)*.45 + smoothstep(.6, .78, nb)*.45);   // le cœur et les crêtes restent dorés
    g.c = mix(g.c, neb, .85*smoothstep(.05, .35, g.D));
    g.E *= 1.04;
    vec3 qs = g.p*8. + g.rd*.4; g.brille += vec3(1., .96, .88)*matEclat(qs, .7, 1.6, .12)*.7*smoothstep(.25, .7, g.D)*(1. - .5*uClair);   // petites étoiles dedans
  }`,
    grains: { brume: 1.25, poussiere: 1.15, etincelles: 1, teinte: [.78, .62, 1], part: .38, scint: 1.1, taille: 1 },
  },
};
