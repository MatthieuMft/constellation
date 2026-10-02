// La petite lueur : un esprit de lumière qui vit DANS la galaxie (monde 3D).
// Elle se déplace en 3D parmi les étoiles, mais elle est dessinée après les effets de caméra (flou, lueur) :
// toujours nette, avec un fond sombre léger pour ne pas se noyer dans l'éclat des étoiles.
//  - elle s'assoit au-dessus de l'éditeur pendant qu'on écrit, suit le texte, imite l'humeur choisie, réagit aux mots ;
//  - elle remonte vos anciennes pensées : elle va près de l'étoile, la regarde, la lit dans une bulle ;
//  - elle dort, s'ennuie si on n'écrit plus (jamais de mort), grandit avec les jours écrits.
import * as THREE from 'three';
import { VALENCE } from './analyse.js';
import { norm } from './embed.js';
import { t, EN } from './langue.js';

const CLE = 'constellation.creature.v1';
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const choix = l => l[Math.floor(Math.random() * l.length)];
const ECHELLES = [.85, 1, 1.15, 1.35];                                  // stades : étincelle · lueur · esprit · grand esprit
const FORMES = { rond: 0, chat: 1, fantome: 2, coeur: 3, etoile: 4 }, TEXTURES = { lisse: 0, nacre: 1, givre: 2, paillettes: 3, nebuleuse: 4 };
const EXPRESSIONS = ['douce', 'rieuse', 'reveuse', 'malicieuse', 'etonnee'];         // l'expression au repos (les états passagers passent devant)

function charger() { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } }
function sauver(o) { try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} }

const K = 1.3;                                                          // le quad déborde du corps : oreilles, ailes, cape, chapeau ne sont jamais coupés
const VERT = `uniform float uSize; varying vec2 vUv;
  void main(){ vUv = position.xy*${2 * K}; vec4 mv = modelViewMatrix*vec4(0.,0.,0.,1.); mv.xy += position.xy*uSize*${K}; gl_Position = projectionMatrix*mv; }`;

// Un orbe de lumière : un volume translucide ombré (cœur lumineux, reflet, liseré de lumière), aura qui se fond dans le ciel,
// dégradé de couleur — rien de plat, aucun contour dur. Sortie en alpha pré-multiplié : l'aura s'ajoute, le corps recouvre.
// La silhouette (rond, chat, fantôme, cœur, étoile) est une distance signée : le volume, le liseré et l'aura en découlent.
const FRAG = `uniform vec3 uColor; uniform float uT; uniform vec2 uLook; uniform float uBlink; uniform float uJoy; uniform float uSleep; uniform float uWide; uniform float uSad;
  uniform float uBrow; uniform float uSpark; uniform float uRelax; uniform float uWings; uniform float uFlap; uniform vec2 uSquash; uniform float uTilt; uniform float uStage; uniform float uApp; uniform float uClair; uniform float uAcc; uniform vec3 uAccCol; uniform float uEyeS; uniform float uStarEye;
  uniform float uForme; uniform float uTex; uniform vec4 uExpr; uniform vec3 uEyeCol; uniform float uEyeOn; uniform float uHabit; uniform vec3 uHabitCol; uniform float uBras; uniform float uPieds; uniform float uBorne;
  varying vec2 vUv;
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h); }
  vec4 over(vec4 top, vec4 bot){ return top + bot*(1. - top.a); }                          // alpha pré-multiplié
  float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b - a)/k, 0., 1.); return mix(b, a, h) - k*h*(1. - h); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
  float bruit(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
  // des éclats : un point par case (une part des cases seulement), qui scintille à son rythme, avec une petite croix de lumière
  float eclats(vec2 p, float t, float seuil, float r){
    vec2 i = floor(p), f = fract(p) - .5 - (vec2(hash(i + 7.3), hash(i + 1.9)) - .5)*.3; float h = hash(i); vec2 e = abs(f);
    return step(seuil, h)*pow(.5 + .5*sin(t + h*50.), 6.)*(smoothstep(r, 0., length(f)) + smoothstep(r*.35, 0., min(e.x, e.y))*smoothstep(r*2., 0., max(e.x, e.y))*.7); }
  float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2){                    // triangle (Inigo Quilez)
    vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2, v0 = p - p0, v1 = p - p1, v2 = p - p2;
    vec2 a = v0 - e0*clamp(dot(v0, e0)/dot(e0, e0), 0., 1.), b = v1 - e1*clamp(dot(v1, e1)/dot(e1, e1), 0., 1.), c = v2 - e2*clamp(dot(v2, e2)/dot(e2, e2), 0., 1.);
    float s = sign(e0.x*e2.y - e0.y*e2.x);
    vec2 d = min(min(vec2(dot(a, a), s*(v0.x*e0.y - v0.y*e0.x)), vec2(dot(b, b), s*(v1.x*e1.y - v1.y*e1.x))), vec2(dot(c, c), s*(v2.x*e2.y - v2.y*e2.x)));
    return -sqrt(d.x)*sign(d.y); }
  float sdBranche(vec2 p, float r1, float r2, float h){              // capsule qui s'affine, le long de +y (Inigo Quilez)
    p.x = abs(p.x); float b = (r1 - r2)/h, a = sqrt(1. - b*b), k = dot(p, vec2(-b, a));
    if (k < 0.) return length(p) - r1; if (k > a*h) return length(p - vec2(0., h)) - r2; return dot(p, vec2(a, b)) - r1; }
  vec2 sdCourbe(vec2 pos, vec2 A, vec2 B, vec2 C){                   // distance à une courbe de Bézier (Inigo Quilez), et où l'on est le long (0..1)
    vec2 a = B - A, b = A - 2.*B + C, c = a*2., d = A - pos;
    float kk = 1./dot(b, b), kx = kk*dot(a, b), ky = kk*(2.*dot(a, a) + dot(d, b))/3., kz = kk*dot(d, a);
    float p = ky - kx*kx, q = kx*(2.*kx*kx - 3.*ky) + kz, h = q*q + 4.*p*p*p;
    if (h >= 0.) { h = sqrt(h); vec2 x = (vec2(h, -h) - q)/2., uv = sign(x)*pow(abs(x), vec2(1./3.)); float t = clamp(uv.x + uv.y - kx, 0., 1.); return vec2(length(d + (c + b*t)*t), t); }
    float z = sqrt(-p), v = acos(q/(p*z*2.))/3., m = cos(v), n = sin(v)*1.732051; vec2 t = clamp(vec2(m + m, -n - m)*z - kx, 0., 1.);
    float d1 = length(d + (c + b*t.x)*t.x), d2 = length(d + (c + b*t.y)*t.y); return d1 < d2 ? vec2(d1, t.x) : vec2(d2, t.y); }
  // la silhouette : distance signée au bord (négative dedans), profondeur locale du volume, part du dôme lisse ; le rond fait .5 de rayon
  vec3 forme(vec2 p, float f){
    float rond = length(vec2(p.x, p.y/.95)) - .5;
    if (f < .5) return vec3(rond, .5, 0.);
    if (f < 1.5) {                                                   // chat : deux oreilles pointues aux bouts arrondis, une queue enroulée
      float o = sdTri(vec2(abs(p.x), p.y), vec2(.08, .38), vec2(.46, .2), vec2(.36, .74)) - .03;
      vec2 qc = sdCourbe(p, vec2(.33, -.36), vec2(.92, -.5), vec2(.64, .02)); float qu = qc.x - mix(.055, .038, qc.y);
      float d = smin(rond, o, .06);
      return vec3(smin(d, qu, .05), mix(mix(.5, .15, clamp(.5 + .5*(rond - o)/.08, 0., 1.)), .06, clamp(.5 + .5*(d - qu)/.06, 0., 1.)), 0.);   // oreilles et queue : des volumes fins
    }
    if (f < 2.5) {                                                   // fantôme : une tête ronde, un bas en vagues qui ondule
      vec2 c = p - vec2(0., .04); float hw = .46 + max(0., -c.y)*.12, vague = -.5 + .04*sin(p.x*17. - uT*2.4);
      vec2 d = vec2(abs(p.x) - hw + .05, vague + .05 - p.y);
      return vec3(min(length(c) - .46, max(length(max(d, 0.)) + min(max(d.x, d.y), 0.) - .05, c.y)), .46, 1.);
    }
    if (f < 3.5) {                                                   // cœur arrondi
      vec2 h = (p - vec2(0., -.52))/.86; h.x = abs(h.x); vec2 m = h - .5*max(h.x + h.y, 0.), u = h - vec2(0., 1.);
      return vec3((h.y + h.x > 1. ? length(h - vec2(.25, .75)) - .35355 : sqrt(min(dot(u, u), dot(m, m)))*sign(h.x - h.y))*.86 - .04, .42, 1.);
    }
    float a = atan(p.x, p.y), r = length(p), a1 = mod(a + .62832, 1.25664) - .62832, a2 = a1 - sign(a1)*1.25664;   // étoile : cinq branches dodues, fondues entre elles
    return vec3(smin(sdBranche(r*vec2(sin(a1), cos(a1)), .3, .12, .46), sdBranche(r*vec2(sin(a2), cos(a2)), .3, .12, .46), .1), mix(.36, .15, smoothstep(.12, .56, r)), .6);
  }
  void main(){
    if (length(vUv) > uBorne) { gl_FragColor = vec4(0.); return; }    // rien à dessiner si loin du corps (le quad est grand)
    float aa = fwidth(vUv.x)*1.3, f = floor(uForme + .5);
    vec2 q = (rot(uTilt)*vUv)/uSquash;
    vec2 pp = vec2(q.x, q.y/.95)/.5;
    // repères de chaque silhouette : profondeur du volume, côté (bras), bas et écart des pieds, hauteur des accessoires de tête
    // et un dôme lisse (centre, rayons) qui arrondit l'intérieur, sans arêtes
    float cote = .48, bas = -.44, piedX = .15, dT = 0., dAnn = 0., dCour = 0., fy = 0., fs = 1.; vec4 dome = vec4(0., 0., .5, .475);
    if (f > .5 && f < 1.5) { dT = .03; dAnn = .2; dCour = .1; }
    else if (f > 1.5 && f < 2.5) { cote = .45; bas = -.47; piedX = .17; dT = .025; dome = vec4(0., -.02, .47, .53); }
    else if (f > 2.5 && f < 3.5) { cote = .47; bas = -.42; piedX = .13; dT = -.04; dAnn = .03; dome = vec4(0., -.03, .56, .52); }
    else if (f > 3.5) { cote = .37; bas = -.4; piedX = .29; dT = .11; dAnn = .03; dCour = .02; fy = .015; fs = .94; dome = vec4(0., .02, .52, .52); }
    vec3 fo = forme(q, f); float sd = fo.x, R = fo.y, ep = f < .5 ? .03 : .065;            // un écart large adoucit les arêtes des silhouettes
    vec2 g = vec2(forme(q + vec2(ep, 0.), f).x - forme(q - vec2(ep, 0.), f).x, forme(q + vec2(0., ep), f).x - forme(q - vec2(0., ep), f).x);
    g /= max(length(g), 1e-5);
    float rdS = 1. + sd/.5;                                // « rayon » équivalent : 1 au bord, comme le rond
    vec3 clair = mix(uColor, vec3(1., .95, .86), .6);     // la lumière du cœur
    vec3 profond = uColor*.5 + vec3(.04, .02, .1);        // le bord, plus dense et plus froid

    // aura : un halo doux qui épouse la silhouette (s'ajoute, ne cache rien) + un voile sombre très léger qui garde le corps lisible
    float aura = exp(-max(0., rdS - .8)*2.6)*.5 + exp(-max(rdS, 0.)*1.1)*.22;
    float fenetre = smoothstep(1., .45, length(vUv));         // l'aura s'éteint complètement avant le bord du quad (sinon : un rectangle visible)
    vec4 col = vec4(uColor*aura*.7*(1. - uClair)*fenetre, smoothstep(2.2, .75, rdS)*.26*(1. - uClair)*fenetre);

    // derrière le corps : la cape, les ailes, les bras, les pieds
    if (uHabit > 2.5) {                                              // cape de lumière : elle flotte et traîne derrière les mouvements
      float tc = clamp((.1 - q.y)/.94, 0., 1.), x = q.x - uTilt*.8*tc*tc + sin(uT*1.3)*.03*tc*tc;
      float dc = max(abs(x) - mix(.28, .64, tc*tc), max(-.83 + .035*sin(x*13. + uT*2.2) - q.y, q.y - .1));          // sort de derrière le corps, s'évase vers l'ourlet
      float lis = smoothstep(-.08, 0., dc), C = smoothstep(.02, -.03, dc)*(.5 + .3*lis), pli = .7 + .3*sin(x*16. - tc*3. + uT*.9);
      vec3 cc = mix(uHabitCol, vec3(1.), .25)*(.45 + .55*pli)*(.75 + .45*tc) + mix(uHabitCol, vec3(1.), .55)*lis*.55;
      col = over(vec4(cc*C, C), col);
    }
    if (uWings > .01) {                                              // petites ailes : trois plumes de lumière translucides qui battent
      for (int k = 0; k < 2; k++) {
        float s = k == 0 ? -1. : 1.; vec2 w = q - vec2(s*.3, .04); w.x *= s;
        w = rot(-uFlap*.3)*w; w.x /= .84 + .16*uFlap;
        float d = 1e3;
        for (int i = 0; i < 3; i++) {
          float fi = float(i), an = .55 - fi*.38, L = .5 - fi*.085; vec2 dir = vec2(cos(an), sin(an)), rr = vec2(L*.55, .09 - fi*.014);
          vec2 lp = vec2(dot(w, dir) - rr.x, dot(w, vec2(-dir.y, dir.x)));
          d = smin(d, (length(lp/rr) - 1.)*rr.y, .035);
        }
        float lis = smoothstep(-.06, 0., d), A = smoothstep(.012, -.03, d)*(.3 + .45*lis)*uWings;
        vec3 wc = mix(uColor, vec3(1.), .6)*(.75 + .6*lis);
        col = over(vec4(wc*A + mix(uColor, vec3(1.), .5)*exp(-max(d, 0.)*35.)*.15*uWings*(1. - uClair), A), col);      // et un léger halo autour (pas sur un ciel clair)
      }
    }
    if (uBras > .5 || uPieds > .5) {                                 // bras qui font coucou, pieds qui pendent : de petits volumes de lumière
      for (int k = 0; k < 4; k++) {
        float s = mod(float(k), 2.) < .5 ? -1. : 1., d;
        if (k < 2) {
          if (uBras < .5) continue;
          float cy = fract(uT/7.), coucou = s < 0. ? max(smoothstep(0., .06, cy)*smoothstep(.34, .26, cy), smoothstep(.55, .95, uJoy)) : 0.;   // le bras gauche (la queue du chat est à droite)
          float an = mix(-.55 + .12*sin(uT*1.7 + s), .7 + .32*sin(uT*10.), coucou);               // levé sur le côté, pour qu'on le voie
          vec2 S = vec2(s*(cote - .07), -.1), M = S + vec2(s*cos(an), sin(an))*.22;
          d = smin(sdSeg(q, S, M) - .05, length(q - M) - .066, .04);
        } else {
          if (uPieds < .5) continue;
          vec2 H = vec2(s*piedX, bas + .06), F = H + vec2(s*.012 + sin(uT*2.3 + s*1.2)*.03, -.13);
          d = smin(sdSeg(q, H, F) - .04, length((q - F - vec2(s*.03, -.012))/vec2(1.45, 1.)) - .056, .035);
        }
        float v = clamp(-d/.05, 0., 1.), A = smoothstep(.012, -.02, d);
        vec3 bc = mix(profond, uColor, v)*(.7 + .45*v) + clair*pow(v, 3.)*.35 + clair*smoothstep(-.025, .005, d)*.3;
        col = over(vec4(bc*A, A), col);
      }
    }

    // corps : un volume de gel lumineux ; la normale vient de la distance au bord (une sphère pour le rond)
    float bord = smoothstep(.01 + aa, -.06, sd);                       // silhouette douce, pas de trait
    if (f > 1.5 && f < 2.5) bord *= mix(1., .72, smoothstep(-.15, -.52, q.y));     // le bas du fantôme, plus diaphane
    float pr = clamp(1. + sd/R, 0., 1.);
    vec2 dv = (q - dome.xy)/dome.zw; dv /= max(1., length(dv)/.98);
    vec2 nxy = mix(g*pr, dv, fo.z*(1. - smoothstep(.5, .95, pr))*.85);
    vec3 n = vec3(nxy, sqrt(max(0., 1. - dot(nxy, nxy))));
    vec3 L = normalize(vec3(-.45, .6, .7));
    float diff = clamp(dot(n, L), 0., 1.), wrap = diff*.55 + .45;
    float rim = pow(1. - n.z, 2.4), spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 26.);
    vec3 base = mix(profond, uColor, smoothstep(0., .6, n.z));
    base = mix(base, clair, pow(n.z, 3.)*.85);                       // cœur lumineux
    float sw = .5 + .5*sin(pp.x*4.5 + sin(pp.y*3.5 + uT*.6)*1.4 + uT*.45);        // des volutes lentes à l'intérieur
    base *= (.6 + .55*wrap)*(.92 + .1*sw);
    // matière : nacre, givre, paillettes, nébuleuse — toujours lumineuses
    vec3 brille = vec3(0.); float tx = floor(uTex + .5);
    if (tx > .5) {
      if (tx < 1.5) {                                                // nacre : des reflets irisés qui glissent avec le volume
        vec3 iri = .5 + .5*cos(6.2832*(dot(n.xy, vec2(.8, .55))*.9 + n.z*.6 + uT*.04 + vec3(0., .33, .67)));
        base = mix(base, (base*.6 + vec3(.42, .4, .44))*mix(vec3(1.), iri, .38), .5);
        brille = mix(vec3(1.), iri, .45)*(pow(rim, .8)*.32 + pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 7.)*.22);
      } else if (tx < 2.5) {                                         // givre : une surface glacée, de fines craquelures, des éclats
        float fr = bruit(q*13.)*.6 + bruit(q*29.)*.4, ve = smoothstep(.028, .0, abs(bruit(q*7. + 5.) - .5))*.6 + smoothstep(.022, .0, abs(bruit(q*16. + 2.) - .5))*.4;
        base = mix(base, vec3(.78, .9, 1.)*(.55 + .5*wrap), .38)*(.88 + .2*fr) + vec3(.82, .94, 1.)*ve*.2*(1. - pr*.5);
        brille = vec3(.92, .97, 1.)*(eclats(q*11., uT*1.1, .62, .2)*1.4 + eclats(q*19. + 3.1, uT*1.7, .7, .16)) + vec3(.85, .95, 1.)*rim*.2;
      } else if (tx < 3.5) {                                         // paillettes : de minuscules éclats qui pétillent
        float p1 = eclats(q*17., uT*3., .45, .17), p2 = eclats(q*24. + 4.2, uT*4.1, .55, .15);
        base *= .94 + .12*bruit(q*34.);
        brille = (mix(vec3(1., .88, .55), vec3(1., .72, .9), hash(floor(q*17.)))*p1 + vec3(1.)*p2*.8)*(.55 + .7*diff);
      } else {                                                       // nébuleuse : un petit ciel qui tourbillonne à l'intérieur
        vec2 w = rot(uT*.16 + length(q)*4.)*q;
        float n1 = bruit(w*4. + vec2(0., uT*.15)), n2 = bruit(w*8.5 - n1*2.), nb = n1*.65 + n2*.35;
        vec3 neb = mix(vec3(.22, .12, .42), mix(uColor, vec3(.6, .42, 1.), .45), smoothstep(.28, .62, nb));
        neb = mix(neb, vec3(1., .66, .88), smoothstep(.6, .85, n2)*.55) + vec3(1., .97, .9)*eclats(q*14., uT*1.6, .6, .13)*.9;
        base = mix(base, neb*(.7 + .45*wrap) + clair*pow(n.z, 4.)*.28, .7);
      }
    }
    vec3 corps = base + clair*rim*.4 + vec3(1., .98, .94)*spec*.6 + brille;  // liseré de lumière sur le bord, reflet
    col = over(vec4(corps*bord*.97, bord*.97), col);
    if (f > .5 && f < 1.5) {                                         // chat : l'intérieur rosé des oreilles, des moustaches de lumière
      float oi = smoothstep(.02, -.035, sdTri(vec2(abs(q.x), q.y), vec2(.17, .44), vec2(.39, .31), vec2(.34, .63)))*.45;
      vec2 m = vec2(abs(q.x), q.y);
      float mous = (smoothstep(.009, .002, sdSeg(m, vec2(.33, -.05), vec2(.62, -.01))) + smoothstep(.009, .002, sdSeg(m, vec2(.33, -.09), vec2(.6, -.13))))*smoothstep(.62, .5, m.x)*.5;
      col = over(vec4(vec3(1., .6, .75)*oi*bord, oi*bord), col); col = over(vec4(clair*mous, mous*.8), col);
    }

    // visage : de grands yeux sombres et brillants, des joues, un sourire — doux, comme éclairés de l'intérieur
    vec2 qf = (q - vec2(0., fy))/fs;
    vec3 noir = vec3(.12, .08, .22);
    vec2 reg = uLook*.04;
    float wide = max(uWide, uExpr.w*.85), mo = max(uWide, uExpr.w);                    // étonnée : grands yeux ronds, petite bouche ronde
    float ouv = max(.07, 1. - uBlink)*(1. - uSleep)*(1. - uRelax*.75);
    float joyeux = max(smoothstep(.45, .8, uJoy), uExpr.x)*(1. - uSleep), triste = uSad*(1. - joyeux);     // rieuse : les yeux plissés de bonheur
    vec2 rayon = vec2(.088, .115)*(1. + wide*.25)*uEyeS;
    float traits = 0., blanc = 0., etoile = 0., iris = 0.; vec3 irisC = vec3(0.);
    for (int k = 0; k < 2; k++) {
      float s = k == 0 ? -1. : 1.;
      float jk = s > 0. ? max(joyeux, uExpr.z*(1. - uSleep)) : joyeux;                  // malicieuse : un clin d'œil
      float ok = ouv*(1. - uExpr.y*.3)*(1. - uExpr.z*.1);                                // rêveuse : paupières mi-closes, arrondies
      vec2 c = vec2(s*.16, .08 - triste*.025) + reg;
      float pau = c.y + rayon.y*ok*mix(1.3, .55, uExpr.y), cl = pau - 7.*(qf.x - c.x)*(qf.x - c.x), coupe = smoothstep(cl + .008, cl - .006, qf.y);
      vec2 le = (qf - c)/(rayon*vec2(1., ok));
      float rond = smoothstep(1. + aa*9., .8, length(le))*(1. - jk)*(1. - uSpark)*coupe;
      float arc = smoothstep(.026, .008, abs(length(qf - (c + vec2(0., -.055))) - .088))*step(c.y - .002, qf.y)*jk;
      float dort = smoothstep(.026, .008, abs(length(qf - (c + vec2(0., .055))) - .088))*step(qf.y, c.y + .002)*max(uSleep, uRelax);
      float lid = smoothstep(.014, .004, abs(qf.y - cl))*step(abs(qf.x - c.x), rayon.x*1.1)*uExpr.y*(1. - jk)*(1. - uSleep)*smoothstep(.2, .5, ok);
      vec2 hl = vec2(.03, mix(.04, -.012, uExpr.y))*(1. + wide*.3);
      float lum = (smoothstep(.034, .012, length(qf - c - hl)) + smoothstep(.016, .004, length(qf - c + vec2(.026, .034))))*ok*(1. - jk)*(1. - uSleep)*(1. - uSpark)*coupe;
      vec2 e = abs(qf - c);
      vec2 er = abs(qf - c - vec2(.022, hl.y*.75)*(1. + wide*.3));                     // « Yeux étoilés » : le reflet devient une petite étoile
      float refletEt = (smoothstep(.05, .0, er.x + er.y*4.) + smoothstep(.05, .0, er.y + er.x*4.) + smoothstep(.022, .0, length(er)))*ok*(1. - jk)*(1. - uSleep)*(1. - uSpark)*uStarEye*coupe;
      lum *= 1. - uStarEye*.85;
      etoile += uSpark*(smoothstep(.1, .0, e.x + e.y*3.) + smoothstep(.1, .0, e.y + e.x*3.))*(1. - uSleep);
      // couleur des yeux : un dégradé (bord sombre, bas plus clair, pupille douce) qui garde l'œil brillant
      vec3 ic = mix(uEyeCol*.32, uEyeCol*1.15 + .05, smoothstep(.55, -.75, le.y))*mix(1., .55, smoothstep(.5, 1., length(le)));
      ic = mix(ic, uEyeCol*.16, smoothstep(.45, .22, length(le - vec2(0., .1)))*.7);
      iris += rond; irisC += ic*rond;
      traits += clamp(arc + dort + lid, 0., 1.); blanc += clamp(lum + refletEt, 0., 1.);
      vec2 b0 = vec2(s*.105, .26 + uBrow*.05), b1 = vec2(s*.235, .26 - uBrow*.03);                           // sourcils : inquiets ou fâchés
      traits += smoothstep(.016, .004, sdSeg(qf, b0, b1))*smoothstep(.05, .3, abs(uBrow))*(1. - uSleep);
      traits += smoothstep(.014, .004, abs(qf.y - (c.y + .2 - 3.*(qf.x - c.x)*(qf.x - c.x))))*step(abs(qf.x - c.x), .075)*uExpr.w*(1. - uSleep)*.85;   // étonnée : sourcils levés
    }
    float joue = (smoothstep(1., .2, length((qf - vec2(-.3, -.02))/vec2(.085, .052))) + smoothstep(1., .2, length((qf - vec2(.3, -.02))/vec2(.085, .052))))*clamp(uJoy + .3 - uSad*.6 + uExpr.x*.4 + uExpr.y*.25, 0., 1.)*.55;
    float h = clamp(.35 + uJoy*.9 - uSad*1.2 + uRelax*.4 + uExpr.y*.15 + uExpr.z*.2, -1., 1.), xb = (qf.x - uExpr.z*.035)/(.07 - uExpr.y*.012);
    float sourire = smoothstep(.013, .004, abs(qf.y - (-.1 + .045*h*xb*xb + uExpr.z*.03*xb)))*step(abs(xb), 1.)*(1. - mo)*(1. - uExpr.x);   // malicieuse : un sourire en coin
    float xo = qf.x/.095, yo = -.085 - .07*(1. - xo*xo), dm = max(qf.y + .085, yo - qf.y);
    float rire = smoothstep(.007, -.004, dm)*step(abs(xo), 1.)*uExpr.x*(1. - mo);                          // rieuse : un grand sourire ouvert
    float langue = smoothstep(1., .5, length((qf - vec2(0., -.142))/vec2(.05, .028)))*rire;
    float ouvert = smoothstep(1., .5, length((qf - vec2(0., -.1))/(vec2(.026, .034)*(1. - uExpr.w*.2))))*mo;
    float visage = bord;
    vec3 rose = vec3(1., .55, .7);
    col = over(vec4(rose*joue*visage, joue*visage*.9), col);
    float tr = clamp(traits + sourire + ouvert + rire, 0., 1.)*visage;
    col = over(vec4(noir*tr*.92, tr*.92), col);
    float ir = clamp(iris, 0., 1.)*visage; vec3 irc = uEyeOn > .5 ? irisC/max(iris, 1e-3) : noir;
    col = over(vec4(irc*ir*.92, ir*.92), col);
    float lg = langue*visage; col = over(vec4(vec3(1., .5, .62)*lg*.9, lg*.9), col);
    float bl = clamp(blanc, 0., 1.)*visage; col = over(vec4(vec3(1.)*bl, bl), col);
    float et = clamp(etoile, 0., 1.)*visage; col = over(vec4(vec3(1., .93, .6)*et, et), col);

    // habits, devant : écharpe, nœud papillon, attache de la cape
    if (uHabit > .5) {
      float hb = floor(uHabit + .5), H = 0.; vec3 HC = uHabitCol;
      if (hb < 1.5) {                                                // écharpe nouée sous le visage, un pan qui pend
        float yc = -.255 - .05*(1. - qf.x*qf.x*4.), v = (qf.y - yc)/.06;
        float bande = smoothstep(1.1, .8, abs(v))*smoothstep(.03, .0, sd - .025)*smoothstep(.58, .52, abs(qf.x)), vol = sqrt(max(0., 1. - v*v))*(.5 + .5*n.z);
        vec2 a0 = vec2(.16, -.3), a1 = vec2(.24 + sin(uT*1.4)*.018, -.62), ax = a1 - a0;
        float tp = clamp(dot(qf - a0, ax)/dot(ax, ax), 0., 1.), dp = sdSeg(qf, a0, a1) - .048 - tp*.012;
        float pan = smoothstep(.012, -.012, dp)*mix(1., .55 + .45*sin(dot(qf - a0, vec2(-ax.y, ax.x))*180.), smoothstep(.86, .92, tp));   // franges au bout
        float noeud = smoothstep(1., .65, length((qf - vec2(.16, -.3))/vec2(.07, .06)));
        H = clamp(max(max(bande, pan), noeud), 0., 1.);
        float tric = .86 + .14*sin(qf.x*60. + v*2.);                 // les côtes du tricot
        HC = uHabitCol*(.42 + .7*max(max(vol*bande, pan*(.75 - tp*.25)), noeud*.95))*tric + mix(uHabitCol, vec3(1.), .5)*smoothstep(.9, .6, abs(v))*bande*.08;
      } else if (hb < 2.5) {                                         // nœud papillon sous la bouche
        vec2 b = qf - vec2(0., -.235), ba = vec2(abs(b.x), b.y);
        float m = smoothstep(.01, -.012, sdTri(ba, vec2(.01, 0.), vec2(.13, .07), vec2(.13, -.07)) - .025), mk = smoothstep(1., .6, length(b/vec2(.034, .04)));
        H = max(m, mk);
        float pli = .8 + .2*cos(atan(ba.y, ba.x)*9.);
        HC = mix(uHabitCol*(.5 + .55*smoothstep(-.08, .08, ba.x*.4 - b.y))*pli, uHabitCol*.85 + .08, mk);
      } else {                                                       // cape : un lien de lumière et un fermoir
        float yc = -.245 - .035*(1. - qf.x*qf.x*4.), v = (qf.y - yc)/.024;
        float lien = smoothstep(1.1, .6, abs(v))*smoothstep(.02, .0, sd)*smoothstep(.56, .5, abs(qf.x))*.8, fermoir = smoothstep(1., .55, length((qf - vec2(0., -.28))/.04));
        H = max(lien, fermoir); HC = mix(uHabitCol*1.05, vec3(1., .96, .86), fermoir*smoothstep(.6, .0, length((qf - vec2(-.01, -.27))/.04)));
      }
      col = over(vec4(HC*H, H), col);
    }
    // accessoires : des formes de lumière aux bords doux, posées sur la lueur (rien de plat ni de cerclé)
    if (uAcc > .5) {
      float A = 0.; vec3 AC = uAccCol; vec2 u = q - vec2(0., dT); float a = floor(uAcc + .5);
      if (a < 1.5) {                                                       // anneau : un halo flottant au-dessus de la tête
        float e = length(vec2(u.x/.27, (u.y - .6 - dAnn)/.075)); A = clamp(smoothstep(.22, .0, abs(e - 1.))*1.1 + exp(-abs(e - 1.)*5.)*.4, 0., 1.);
      } else if (a < 2.5) {                                                // antenne : une tige fine et une petite étoile-lanterne
        vec2 b = vec2(.07 + sin(uT*1.6)*.015, .73); float d = length(u - b);
        A = clamp(smoothstep(.014, .004, sdSeg(u, vec2(0., .46), b))*.9 + smoothstep(.06, .02, d) + exp(-d*13.)*.55, 0., 1.); AC = mix(uAccCol, vec3(1., .96, .85), smoothstep(.06, .0, d));
      } else if (a < 3.5) {                                                // lunettes rondes
        float g = 0.; for (int k = 0; k < 2; k++) { vec2 c = vec2((k == 0 ? -1. : 1.)*.16, .08); float r = length(qf - c); g += smoothstep(.016, .004, abs(r - .125)) + smoothstep(.12, .0, r)*.1; }
        g += smoothstep(.014, .004, sdSeg(qf, vec2(-.035, .09), vec2(.035, .09))); A = clamp(g, 0., 1.)*.95;
      } else if (a < 4.5) {                                                // couronne d'étoiles
        float g = 0.; for (int k = 0; k < 3; k++) { float fk = float(k); vec2 c = vec2((fk - 1.)*.2, .5 + dCour + (1. - abs(fk - 1.))*.1 + sin(uT*2. + fk*2.)*.01); vec2 e = abs(u - c)*(k == 1 ? .9 : 1.3);
          g += smoothstep(.1, .0, e.x + e.y*3.) + smoothstep(.1, .0, e.y + e.x*3.) + exp(-length(u - c)*22.)*.5; } A = clamp(g, 0., 1.); AC = mix(uAccCol, vec3(1., .96, .8), .4);
      } else {                                                             // chapeau pointu étoilé
        float y = (u.y - .4)/.48, demi = .27*(1. - y); float dans = smoothstep(.012, -.012, abs(u.x - .02*y) - demi)*step(0., y)*step(y, 1.); float bord = smoothstep(.02, .0, abs(u.y - .42) - .012)*smoothstep(.34, .28, abs(u.x));
        A = clamp(dans*.95 + bord, 0., 1.); AC = mix(uAccCol*.55, uAccCol*1.15, clamp(y, 0., 1.)) + vec3(1., .95, .8)*smoothstep(.05, .0, length(u - vec2(.04, .68)))*.9;
      }
      A *= smoothstep(${K.toFixed(2)}, ${(K - .25).toFixed(2)}, length(vUv)); col = over(vec4(AC*A, A), col);
    }
    col *= uApp;
    col.rgb = pow(max(col.rgb, 0.), vec3(1./2.2));                    // dessinée après le rendu : on encode en sRGB soi-même
    gl_FragColor = col;
  }`;

// petites réactions aux mots que l'on tape (mots normalisés : sans accent, minuscules)
const LEXIQUE = [
  { re: /^(heureu\w*|content\w*|joie|rire|ri|rigol\w*|super|genial\w*|merci|bravo|fier\w*|fiere|adore\w*|amour\w*|aime\w*|magnifique|beau|belle|reussi\w*|happy|glad|joy\w*|laugh\w*|great|awesome|thanks|thank|proud|love\w*|beautiful|wonderful|lovely)$/, expr: 'joie', dit: ['Ça me fait plaisir !', 'Oh, c’est beau.', 'Ça me touche.'] },
  { re: /^(triste\w*|fatigu\w*|seul\w*|peur|angoiss\w*|pleur\w*|stress\w*|epuis\w*|deprim\w*|difficile|mal|dur|dure|sad\w*|tired|alone|lonely|afraid|scared|anxious|anxiety|cry\w*|cried|exhausted|depressed|hard|difficult)$/, expr: 'triste', dit: ['Je suis là.', 'Courage…', 'Respire doucement.'] },
  { re: /^(lune|etoiles?|ciel|nuit|filante|moon|stars?|sky|night)$/, expr: 'leve', dit: ['Oh… regarde là-haut.'] },
  { re: /^(pluie|neige|mer|vagues?|plage|feu|orage|soleil|baleine|rain|snow|sea|waves?|beach|fire|storm|sun|whale)$/, expr: 'wow', dit: ['Oh !'] },
  { re: /^(chat|chats|chaton|cat|cats|kitten)$/, expr: 'joie', dit: ['Miaou ?'] },
];

export function creerCreature({ sceneUI, camera, controls, particules, texHalo, entrees, couleurDe, surMessage, etoiles, ouvrirPensee, mobile }) {
  let sauve = charger();
  if (!sauve.nee) { sauve.nee = Date.now(); sauve.caresses = 0; sauve.stade = 0; sauve.visible = true; }
  let montree = false, apparition = 0, clair = false;
  const PERSO0 = { couleur: null, acc: 0, accCouleur: '#ffd98a', yeux: 1, taille: 1, etincelles: false,
    forme: 'rond', texture: 'lisse', expression: 'douce', yeuxCouleur: null, habit: 0, ailes: false, bras: false, pieds: false };
  const perso = () => Object.assign({}, PERSO0, sauve.perso || {});

  // ───── rendu : des billboards dans le monde 3D, dessinés après les effets ─────
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uAcc: { value: 0 }, uAccCol: { value: new THREE.Color('#ffd98a') }, uEyeS: { value: 1 }, uStarEye: { value: 0 }, uSize: { value: 10 }, uColor: { value: new THREE.Color('#ffd98a') }, uT: { value: 0 }, uLook: { value: new THREE.Vector2() }, uBlink: { value: 0 }, uJoy: { value: 0 }, uSleep: { value: 0 },
                uWide: { value: 0 }, uSad: { value: 0 }, uBrow: { value: 0 }, uSpark: { value: 0 }, uRelax: { value: 0 }, uWings: { value: 0 }, uFlap: { value: 0 },
                uSquash: { value: new THREE.Vector2(1, 1) }, uTilt: { value: 0 }, uStage: { value: 0 }, uApp: { value: 0 }, uClair: { value: 0 },
                uForme: { value: 0 }, uTex: { value: 0 }, uExpr: { value: new THREE.Vector4() }, uEyeCol: { value: new THREE.Color() }, uEyeOn: { value: 0 },
                uHabit: { value: 0 }, uHabitCol: { value: new THREE.Color() }, uBras: { value: 0 }, uPieds: { value: 0 }, uBorne: { value: 1.02 } },
  });
  const corps = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); corps.frustumCulled = false; corps.visible = false; corps.renderOrder = 3; sceneUI.add(corps);

  // ───── bulle de dialogue (DOM) ─────
  const bulle = document.getElementById('bulle'), bulleTexte = bulle.querySelector('span');
  let bulleFin = 0, bulleLibre = 0, bulleClic = null;
  bulle.addEventListener('click', () => { if (bulleClic) { const f = bulleClic; bulleClic = null; bulle.classList.remove('visible'); f(); } });
  function dire(texte, { duree = 5200, clic = null, priorite = false } = {}) {
    const now = performance.now(); if (!priorite && now < bulleLibre) return false;
    bulleTexte.textContent = t(texte); bulleClic = clic; bulle.classList.toggle('clic', !!clic); bulle.hidden = false; requestAnimationFrame(() => bulle.classList.add('visible'));
    bulleFin = now + duree; bulleLibre = now + duree + 4500; return true;
  }

  // ───── état ─────
  const pos = new THREE.Vector3(0, 6, 28), vel = new THREE.Vector3(), cible = new THREE.Vector3(), regard = new THREE.Vector2(), coul = new THREE.Color('#ffd98a'), coulCible = new THREE.Color('#ffd98a');
  let etat = 'flotte', etatT = 0, prochainChangement = rnd(12, 24), visiteId = null, arrivee = false;
  let profil = { jours: 0, stade: sauve.stade || 0, valence: .3, seul: 0 }, tProfil = 99;
  let blinkT = rnd(1.5, 4), blinkV = 0, joie = 0, peur = 0, surprise = 0, etire = 0, evolue = 0, calin = false, bond = 0, zT = 0;
  let forceCible = null, souvenir = null, prochainSouvenir = rnd(40, 80), dernierSouhait = -1e9, bullesEcriture = 0, longDit = false, patienceDite = false, fx = { expr: null, jusqu: 0 };
  let animSuivante = 'visite', chat = rnd(40, 70), prevD = 0, zoomWhee = 0, regardPt = new THREE.Vector3(), regardT = 0;
  let mimique = { mood: null, couleur: null }, ecranPos = { x: 0, y: 0, rpx: 60 };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _p = new THREE.Vector3();
  const rose = new THREE.Color(1, .55, .7), blanc = new THREE.Color(1, 1, 1), _pc = new THREE.Color(), _hsl = {};

  function base() { camera.updateMatrixWorld(); _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1); camera.getWorldDirection(_f); }
  const ndcPoint = (x, y, d, out) => out.set(x, y, .5).unproject(camera).sub(camera.position).normalize().multiplyScalar(d).add(camera.position);
  const distRef = () => clamp(camera.position.distanceTo(controls.target), 14, 2400) * .8;
  const proj = p => { _p.copy(p).project(camera); return { x: (_p.x + 1) / 2 * innerWidth, y: (1 - _p.y) / 2 * innerHeight, vu: _p.z < 1 && Math.abs(_p.x) < .96 && Math.abs(_p.y) < .96 }; };
  const posEtoile = id => { const v = etoiles().get(id); return v ? v.groupe.position : null; };
  function plusProcheEtoile(p) { let best = null, d0 = 1e9; for (const v of etoiles().values()) { const d = v.groupe.position.distanceToSquared(p); if (d < d0) { d0 = d; best = v; } } return best; }

  // ───── profil : couleur de la semaine, jours écrits, solitude ─────
  function majProfil(silence = false) {
    const liste = entrees().slice().sort((a, b) => b.date - a.date);
    const jours = new Set(liste.map(e => new Date(e.date).toDateString())).size;
    const stade = jours >= 30 ? 3 : jours >= 10 ? 2 : jours >= 3 ? 1 : 0;
    const recents = liste.slice(0, 6); let w = 0, val = 0; const poids = {};
    recents.forEach((e, i) => { const k = Math.pow(.8, i); w += k; val += (VALENCE[e.mood] ?? 0) * k; poids[e.mood] = (poids[e.mood] || 0) + k; });
    if (w) {                                                          // l'humeur dominante de la semaine, en pastel vif
      const dom = Object.entries(poids).sort((a, b) => b[1] - a[1])[0][0], hsl = {}; couleurDe(recents.find(e => e.mood === dom)).getHSL(hsl);
      coulCible.setHSL(hsl.h, clamp(hsl.s * 1.1, .6, .95), .62); profil.valence = val / w;
    } else coulCible.set('#ffd98a');
    const dernier = liste[0] ? liste[0].date : Date.now(), avant = profil.seul;
    profil.seul = clamp(((Date.now() - dernier) / 86400000 - 2) / 5, 0, 1);
    if (stade > (sauve.stade || 0) && montree && !silence) { evolue = 4; surMessage && surMessage(t('{nom} a grandi.', { nom: sauve.nom || t('Votre lueur') })); sauve.stade = stade; sauver(sauve); joie = 4; dire('J’ai grandi !', { priorite: true }); }
    profil.jours = jours; profil.stade = stade; if (silence) { sauve.stade = stade; sauver(sauve); }
    return { retour: avant > .45 && profil.seul < .05 };
  }

  // ───── comportement ─────
  function choisirEtat(dt, ctx) {
    const now = performance.now();
    const dort = (ctx.inactivite > 70 || (ctx.nuit && ctx.inactivite > 16)) && !ctx.ecriture && !calin;
    let n = 'flotte';
    if (peur > 0) n = 'peur';
    else if (ctx.ecriture) n = 'ecrit';
    else if (ctx.pose) n = 'pose';
    else if (ctx.guide) n = 'guide';
    else if (forceCible && now < forceCible.jusqu) n = 'fete';
    else if (calin) n = 'calin';
    else if (souvenir && now < souvenir.fin) n = 'souvenir';
    else if (ctx.selection) n = 'centre';
    else if (dort) n = 'dort';
    else if (ctx.curseurActif && ctx.curseurImmobile > 2.4 && !ctx.occupe) n = 'curieux';
    else if (profil.seul > .4) n = 'attend';
    else if ((etat === 'joue' && etatT < 5.5) || (etat === 'danse' && etatT < 4.5) || (etat === 'regarde' && etatT < 6)) n = etat;
    else if (etat === 'visite' && etatT < prochainChangement) n = 'visite';
    else if (etat === 'flotte' && etatT > prochainChangement && (animSuivante !== 'visite' || etoiles().size)) n = animSuivante;
    if (n !== etat) {
      if (etat === 'dort') { etire = 1.4; dire('Hm ? Oh, tu es là.'); }
      if (etat === 'ecrit') { bullesEcriture = 0; longDit = false; patienceDite = false; }
      if (n === 'ecrit' && sauve.nom) dire(choix(['Je t’écoute.', 'Alors, cette journée ?', 'Raconte-moi.', 'Qu’est-ce qui traverse ?']), { duree: 3600 });
      etat = n; etatT = 0; arrivee = false;
      if (etat === 'regarde') regardT = 0;
      if (etat === 'visite') { const vs = [...etoiles().values()]; visiteId = vs[Math.floor(Math.random() * vs.length)]; prochainChangement = rnd(8, 13); }
      if (etat === 'flotte') { prochainChangement = rnd(10, 22); animSuivante = choix(['visite', 'visite', 'joue', 'danse', 'regarde', 'joue']); }
      if (etat === 'danse') dire(choix(['Lalala~', 'Tu danses avec moi ?', '♪']), { duree: 2600 });
      if (etat === 'joue') joie = Math.max(joie, 2.5);
      if (etat === 'dort') visiteId = plusProcheEtoile(pos);
    }
  }

  function viser(dt, t, ctx) {
    base(); const d = distRef(); const W = ctx.W, H = ctx.H;
    let raideur = 2, vmax = 12, regardCible = null;
    const ndcDe = (px, py) => [px / W * 2 - 1, 1 - py / H * 2];
    switch (etat) {
      case 'flotte': ndcPoint(-.34 + Math.sin(t * .21) * .2, -.3 + Math.cos(t * .17) * .2, d + Math.sin(t * .13) * 8, cible); raideur = 1.3; vmax = 6; break;
      case 'attend': ndcPoint(-.18, -.55 + Math.sin(t * .8) * .02, d * .85, cible); raideur = 1.6; vmax = 7; break;
      case 'visite': {
        const v = visiteId && etoiles().get(visiteId.id) ? visiteId : null;
        if (!v) { etat = 'flotte'; etatT = 0; return viser(dt, t, ctx); }
        cible.copy(v.groupe.position).addScaledVector(_f, -3.6).addScaledVector(_u, 1.5).addScaledVector(_r, Math.sin(t * .7) * 1.6); raideur = 1.8; vmax = 9;
        if (!arrivee && pos.distanceTo(cible) < 3) { arrivee = true; v.pulse = Math.max(v.pulse, .55); particules.burst(v.groupe.position, coul, 8, .6); joie = Math.max(joie, 1.2); regardCible = v.groupe.position; }
        break; }
      case 'souvenir': {
        const sp = souvenir && posEtoile(souvenir.id); if (!sp) { souvenir = null; break; }
        cible.copy(sp).addScaledVector(_f, -3.8).addScaledVector(_u, 1.6).addScaledVector(_r, -2.2); raideur = 2.2; vmax = 12; regardCible = sp;
        if (!arrivee && pos.distanceTo(cible) < 3.5) { arrivee = true; const v = etoiles().get(souvenir.id); if (v) v.pulse = Math.max(v.pulse, .9); souvenir.arrive(); } break; }
      case 'fete': {
        const sp = forceCible.id ? posEtoile(forceCible.id) : forceCible.point; if (!sp) break;
        cible.copy(sp).addScaledVector(_f, -3.8).addScaledVector(_u, 1.6); raideur = 2.4; vmax = 14; regardCible = sp;
        if (!arrivee && pos.distanceTo(cible) < 3.5) { arrivee = true; particules.burst(sp, coul, 24, 1.2, true); joie = 3.4; bond = 0; forceCible.surArrivee && forceCible.surArrivee(); } break; }
      case 'joue': { const a = etatT * 2.3; ndcPoint(-.05 + Math.cos(a) * .38, .05 + Math.sin(a * 1.4) * .26, d * .9, cible); raideur = 3.4; vmax = 17; joie = Math.max(joie, .5); break; }
      case 'danse': { ndcPoint(-.3, -.12, d * .85, cible); cible.addScaledVector(_r, Math.sin(etatT * 5) * 2.2).addScaledVector(_u, Math.abs(Math.sin(etatT * 5)) * 1.2); raideur = 4; vmax = 14; joie = Math.max(joie, .5); break; }
      case 'regarde': {
        regardT -= dt; if (regardT <= 0) { regardT = rnd(1, 1.9); ndcPoint(rnd(-.8, .8), rnd(-.5, .7), d * 1.2, regardPt); }
        ndcPoint(-.25 + Math.sin(t * .4) * .06, -.2, d, cible); raideur = 1.2; vmax = 5; regardCible = regardPt; break; }
      case 'pose': { const r = ctx.pose; const [nx, ny] = ndcDe(clamp(r.left + r.width * .5, 40, W - 40), r.top - 92); ndcPoint(nx, ny, d * .62, cible); raideur = 2.8; vmax = 18; break; }
      case 'centre': cible.copy(ctx.selection).addScaledVector(_f, -4).addScaledVector(_r, -3.4).addScaledVector(_u, 1.4); raideur = 1.8; vmax = 10; regardCible = ctx.selection; break;
      case 'guide': cible.copy(ctx.guide).addScaledVector(_u, 2.2); raideur = 3.2; vmax = 22; break;
      case 'ecrit': {                                                    // elle flotte juste au-dessus de l'éditeur, devant le texte
        const r = ctx.rectEcriture; if (!r) { ndcPoint(0, .2, d * .7, cible); break; }
        const [nx, ny] = ndcDe(clamp(r.left + r.width * (.14 + .72 * ctx.caret), 40, W - 40), r.top - 56);
        ndcPoint(nx, ny, d * .62, cible); raideur = 2.8; vmax = 18; break; }
      case 'curieux': { const [nx, ny] = ndcDe(ctx.curseur.x, ctx.curseur.y); ndcPoint(nx + .12, ny + .16, d * .9, cible); raideur = 1.5; vmax = 9; break; }
      case 'calin': { const [nx, ny] = ndcDe(ctx.curseur.x, ctx.curseur.y); ndcPoint(nx, ny, d * .7, cible); raideur = 4; vmax = 20; break; }
      case 'peur': { const e = plusProcheEtoile(pos); if (e) cible.copy(e.groupe.position).addScaledVector(_f, 2.2); else ndcPoint(-.3, -.45, d * .8, cible); raideur = 4; vmax = 20; break; }
      case 'dort': {
        const e = visiteId && etoiles().get(visiteId.id) ? visiteId : plusProcheEtoile(pos);
        if (e) cible.copy(e.groupe.position).addScaledVector(_u, -2.3).addScaledVector(_f, -1.2); else ndcPoint(-.22, -.38, d * .9, cible); raideur = 1.1; vmax = 4; break; }   // ciel encore vide : elle dort près de toi
    }
    _a.copy(cible).sub(pos).multiplyScalar(raideur); _a.addScaledVector(vel, -2.4);
    if (etat === 'flotte' || etat === 'visite' || etat === 'attend' || etat === 'regarde') { _a.x += Math.sin(t * 1.3 + 1) * .6; _a.y += Math.cos(t * 1.1) * .5; _a.z += Math.sin(t * .9) * .5; }
    vel.addScaledVector(_a, dt);
    if (joie > 0 && etat !== 'dort') { bond -= dt; if (bond <= 0) { vel.addScaledVector(_u, 5.2); bond = rnd(.55, .8); } }       // petits bonds de joie
    const vit = vel.length(); if (vit > vmax) vel.multiplyScalar(vmax / vit);
    pos.addScaledVector(vel, dt);
    return regardCible;
  }

  // ───── mise à jour ─────
  function update(dt, t, ctx) {
    if (!montree || !sauve.visible) { corps.visible = false; if (!bulle.hidden) { bulle.hidden = true; bulle.classList.remove('visible'); } return; }
    apparition = Math.min(1, apparition + dt * .8);
    tProfil += dt; if (tProfil > 4) { tProfil = 0; const r = majProfil(); if (r.retour) { joie = 4; dire('Tu m’avais manqué.', { priorite: true }); } }
    etatT += dt; peur = Math.max(0, peur - dt); joie = Math.max(0, joie - dt); evolue = Math.max(0, evolue - dt); surprise = Math.max(0, surprise - dt); etire = Math.max(0, etire - dt);
    const now = performance.now(); if (fx.expr && now > fx.jusqu) fx.expr = null;
    if (ctx.eclair) peur = 4;
    prochainSouvenir -= dt;
    if (prochainSouvenir <= 0 && etat !== 'dort' && !ctx.occupe && !ctx.ecriture && !souvenir) { prochainSouvenir = rnd(70, 130); lancerSouvenir(); }
    choisirEtat(dt, ctx);
    { // bavardage : de temps en temps, un mot sur la journée, la série, une date qui compte
      chat -= dt;
      if (chat <= 0) { chat = rnd(70, 140); if (!ctx.occupe && !ctx.ecriture && etat !== 'dort' && etat !== 'peur') { const l = (ctx.phrases && ctx.phrases.length && Math.random() < .65) ? ctx.phrases : (ctx.nuit ? ['Les étoiles brillent plus fort la nuit.', 'Chut… écoute le ciel.'] : ['Je me demande ce que tu vas écrire.', 'Tu vois cette étoile ? C’est une journée.', 'Un petit tour ?', 'Je suis bien, ici.']); dire(choix(l), { duree: 4200 }); } }
      const dcam = camera.position.distanceTo(controls.target); const taux = prevD ? Math.abs(Math.log(dcam / prevD)) / Math.max(dt, 1e-3) : 0; prevD = dcam;
      if (taux > 1.3 && performance.now() - zoomWhee > 18000 && etat !== 'dort' && !ctx.ecriture) { zoomWhee = performance.now(); joie = Math.max(joie, 2); surprise = Math.max(surprise, .8); if (Math.random() < .6) dire(choix(['Wouiii !', 'On plonge ?', 'Ça tourne !', 'Haaaa !']), { duree: 1800, priorite: true }); }
    }
    const regardCible = viser(dt, t, ctx);
    const P = perso(); if (P.couleur) _pc.set(P.couleur);
    coul.lerp(mimique.couleur || (P.couleur ? _pc : coulCible), Math.min(1, dt * (mimique.couleur ? 5 : P.couleur ? 3 : .7)));

    // regard : vers une étoile filante, ce qu'elle visite, le curseur, sinon où elle va
    _p.copy(pos).project(camera);
    let lx = 0, ly = 0;
    const meteor = ctx.meteores && ctx.meteores[0];
    if (meteor) { _c.copy(meteor).project(camera); lx = _c.x - _p.x; ly = _c.y - _p.y; surprise = Math.max(surprise, .6); if (now - dernierSouhait > 90000) { dernierSouhait = now; dire('Vite, un vœu !', { priorite: true }); } }
    else if (regardCible) { _c.copy(regardCible).project(camera); lx = _c.x - _p.x; ly = _c.y - _p.y; }
    else if (ctx.curseurActif && etat !== 'dort') { lx = (ctx.curseur.x / ctx.W * 2 - 1) - _p.x; ly = (1 - ctx.curseur.y / ctx.H * 2) - _p.y; }
    else { _c.copy(pos).add(vel).project(camera); lx = (_c.x - _p.x) * 6; ly = (_c.y - _p.y) * 6; }
    const l = Math.hypot(lx, ly) || 1, f = Math.min(1, l * 2.2) / l;
    regard.x += (lx * f - regard.x) * Math.min(1, dt * 7); regard.y += (ly * f - regard.y) * Math.min(1, dt * 7);

    blinkT -= dt; if (blinkT <= 0) { blinkV = .16; blinkT = Math.random() < .2 ? .3 : rnd(1.8, 5); }
    blinkV = Math.max(0, blinkV - dt); const blink = blinkV > 0 ? Math.sin(blinkV / .16 * Math.PI) : 0;

    // expressions : état + humeur imitée + réaction de mot
    const dort = etat === 'dort', seul = profil.seul, imi = mimique.mood, expr = fx.expr;
    let joy = joie > 0 ? 1 : 0, sad = clamp(seul * .9 + (profil.valence < -.4 ? .3 : 0), 0, 1), brow = 0, spark = 0, relax = 0, wide = 0;
    if (!joy && profil.valence > .5 && !seul) joy = .4;
    if (imi === 'joie') joy = Math.max(joy, 1); else if (imi === 'calme') { relax = 1; joy = Math.max(joy, .35); }
    else if (imi === 'elan') { spark = 1; joy = Math.max(joy, .5); }
    else if (imi === 'melancolie') { sad = Math.max(sad, .85); joy = 0; brow = .6; }
    else if (imi === 'tempete') { sad = Math.max(sad, .35); brow = -.7; joy = 0; wide = .4; }
    if (expr === 'joie') joy = 1; else if (expr === 'triste') { sad = .9; joy = 0; brow = .7; } else if (expr === 'leve') { wide = .8; spark = .6; } else if (expr === 'wow') wide = 1;
    if (peur > 0) { wide = 1; brow = .9; sad = .3; joy = 0; spark = 0; }
    if (surprise > 0) wide = Math.max(wide, .7);
    const U = mat.uniforms, k6 = Math.min(1, dt * 6);
    U.uJoy.value += (joy - U.uJoy.value) * k6; U.uSad.value += (sad - U.uSad.value) * Math.min(1, dt * 3); U.uBrow.value += (brow - U.uBrow.value) * k6;
    U.uSpark.value += (spark - U.uSpark.value) * k6; U.uRelax.value += (relax - U.uRelax.value) * k6; U.uWide.value += (wide - U.uWide.value) * Math.min(1, dt * 9);
    U.uSleep.value += ((dort ? 1 : 0) - U.uSleep.value) * Math.min(1, dt * 2.5);
    U.uBlink.value = blink; U.uLook.value.copy(regard); U.uT.value = t; U.uColor.value.copy(coul); U.uStage.value = profil.stade; U.uApp.value = apparition;
    // l'expression choisie, seulement au repos : sommeil, peur, joie, mots, humeur imitée passent devant
    const ie = EXPRESSIONS.indexOf(P.expression), repos = dort || imi || expr || peur > 0 || surprise > 0 || joie > 0 || calin ? 0 : 1 - sad;
    ['x', 'y', 'z', 'w'].forEach((c, i) => { U.uExpr.value[c] += ((ie === i + 1 ? repos : 0) - U.uExpr.value[c]) * k6; });
    U.uWings.value += ((P.ailes ? 1 : 0) - U.uWings.value) * Math.min(1, dt * 3);
    const vit = vel.length(); U.uFlap.value = Math.sin(t * (dort ? .8 : 7 + vit * .6)) * (dort ? .2 : 1);

    // forme : étirement dans le sens du mouvement, respiration, penchée dans les virages
    base(); const lat = vel.dot(_r);
    const etir = 1 + clamp(vit * .028, 0, .25), resp = 1 + Math.sin(t * (dort ? 1.1 : 2.2)) * .035 * (dort ? 1.6 : 1);
    const ecr = dort ? .93 : 1 + (etire > 0 ? Math.sin(etire / 1.4 * Math.PI) * .22 : 0);
    U.uSquash.value.set(resp / Math.sqrt(etir) * (calin ? 1.12 : 1) * (peur > 0 ? .9 : 1), resp * Math.sqrt(etir) * ecr * (calin ? .9 : 1));
    U.uTilt.value += (clamp(-lat * .035, -.4, .4) + (peur > 0 ? Math.sin(t * 40) * .06 : 0) - U.uTilt.value) * Math.min(1, dt * 6);

    // taille : bien visible, et à peu près constante à l'écran quand elle s'éloigne ou se rapproche
    const dc = camera.position.distanceTo(pos), ech = clamp(dc / distRef(), .8, 1.5);
    const taille = ECHELLES[profil.stade] * (1 + evolue * .07 * Math.sin(evolue * 6)) * (.4 + .6 * apparition) * (mobile ? .9 : 1);
    U.uAcc.value = P.acc; U.uAccCol.value.set(P.accCouleur); U.uEyeS.value = P.yeux;
    U.uForme.value = FORMES[P.forme] || 0; U.uTex.value = TEXTURES[P.texture] || 0; U.uEyeOn.value = P.yeuxCouleur ? 1 : 0; if (P.yeuxCouleur) U.uEyeCol.value.set(P.yeuxCouleur);
    U.uHabit.value = P.habit || 0; U.uBras.value = P.bras ? 1 : 0; U.uPieds.value = P.pieds ? 1 : 0;
    if (P.accCouleur && P.accCouleur !== PERSO0.accCouleur) U.uHabitCol.value.set(P.accCouleur);                        // l'habit prend la couleur d'accessoire choisie,
    else { coul.getHSL(_hsl); U.uHabitCol.value.setHSL((_hsl.h + .5) % 1, clamp(_hsl.s, .55, .8), .6); }   // sinon une teinte complémentaire de la lueur
    U.uBorne.value = P.acc || P.habit || P.ailes || P.bras || P.pieds || P.forme === 'etoile' ? K : 1.02;      // au-delà : rien à dessiner
    U.uSize.value = 12 * taille * P.taille * ech * (distRef() / 52); U.uClair.value = clair ? 1 : 0;
    const bob = Math.sin(t * 1.7) * .25 * (dort ? .3 : 1), tr = peur > 0 ? .12 : 0;
    corps.position.copy(pos).addScaledVector(_u, bob).add(_a.set((Math.random() - .5) * tr, (Math.random() - .5) * tr, (Math.random() - .5) * tr));
    corps.visible = true;

    // écran : sert au clic, à la bulle
    _p.copy(corps.position).project(camera);
    const pxUnit = ctx.H / (2 * Math.tan(camera.fov * Math.PI / 360) * Math.max(1, dc));
    ecranPos = { x: (_p.x + 1) / 2 * ctx.W, y: (1 - _p.y) / 2 * ctx.H, rpx: U.uSize.value * .27 * pxUnit };

    // étincelles : sillage, petits « z » pendant le sommeil, cœurs pendant le câlin
    if (!dort && vit > 4 && Math.random() < dt * 14) particules.burst(corps.position, coul, 1, .12);
    if (dort) { zT -= dt; if (zT <= 0) { zT = rnd(1.8, 3); particules.burst(_p.copy(corps.position).addScaledVector(_u, 2.2).addScaledVector(_r, 1.2), blanc, 1, .1); } }
    if (calin && Math.random() < dt * 5) particules.burst(corps.position, rose, 1, .45);
    if (P.etincelles && !dort && Math.random() < dt * 7) particules.burst(_p.copy(corps.position).addScaledVector(_r, rnd(-2.5, 2.5)).addScaledVector(_u, rnd(-2.5, 2.5)), Math.random() < .5 ? coul : blanc, 1, .25);

    // bulle : au-dessus de la tête, jamais hors de l'écran
    if (!bulle.hidden) {
      if (now > bulleFin) { bulle.classList.remove('visible'); if (now > bulleFin + 400) { bulle.hidden = true; bulleClic = null; } }
      const estChat = P.forme === 'chat', haut = Math.max(estChat ? 1.5 : P.forme === 'etoile' ? 1.2 : 1, ([1, estChat ? 1.8 : 1.45, 1.55, 1, estChat ? 1.55 : 1.35, 1.8][P.acc] || 1) + (P.forme === 'etoile' && P.acc ? .2 : 0));
      const dessous = P.habit === 3 ? 1.6 : P.pieds ? 1.3 : 1;      // oreilles, chapeau, cape, pieds : la bulle ne les cache pas
      const w = bulle.offsetWidth, h = bulle.offsetHeight; let bx = clamp(ecranPos.x - w / 2, 8, ctx.W - w - 8), by = ecranPos.y - ecranPos.rpx * haut - h - 12, bas = false;
      if (by < 8) { by = ecranPos.y + ecranPos.rpx * dessous + 12; bas = true; }
      bulle.style.transform = `translate(${Math.round(bx)}px, ${Math.round(by)}px)`; bulle.classList.toggle('bas', bas);
      bulle.style.setProperty('--queue', Math.round(clamp(ecranPos.x - bx, 14, w - 14)) + 'px');
    }
  }

  // ───── souvenirs : elle va près d'une ancienne étoile et la lit ─────
  function lancerSouvenir() {
    const liste = entrees(); if (liste.length < 2) return;
    const now = Date.now(), cand = liste.map(e => { const p = posEtoile(e.id); return p ? { e, s: proj(p) } : null; }).filter(c => c && c.s.vu && c.s.x > 90 && c.s.x < innerWidth - 90 && c.s.y > 110 && c.s.y < innerHeight - 200);
    if (!cand.length) { prochainSouvenir = 20; return; }
    cand.forEach(c => { c.p = (1 + Math.min(120, (now - (c.e.touched || c.e.date)) / 86400000)) * rnd(.5, 1.5); });
    const { e } = cand.sort((a, b) => b.p - a.p)[0];
    souvenir = { id: e.id, fin: performance.now() + 11000, arrive() {
      const jours = Math.round((Date.now() - e.date) / 86400000), quand = jours <= 0 ? t('aujourd’hui') : jours === 1 ? t('hier') : t('il y a {n} jours', { n: jours });
      const brut = e.text.replace(/\s+/g, ' ').trim(), court = brut.length > 78 ? brut.slice(0, 76).replace(/\s+\S*$/, '') + '…' : brut;
      fx = { expr: { joie: 'joie', melancolie: 'triste', tempete: 'wow', elan: 'leve', calme: null }[e.mood] || null, jusqu: performance.now() + 5000 };
      dire((EN ? '“' + court + '”' : '« ' + court + ' »') + ' · ' + quand, { duree: 7500, priorite: true, clic: () => ouvrirPensee(e.id) });
    } };
  }

  // La lueur accompagne la caméra : quand on zoome, dézoome ou tourne, elle reste au même endroit de l'écran et à la même taille apparente.
  const _inv = new THREE.Matrix4(), _loc = new THREE.Vector3();
  function memoriser() { camera.updateMatrixWorld(); _inv.copy(camera.matrixWorld).invert(); return camera.position.distanceTo(controls.target); }
  function suivre(d0) {
    const d1 = camera.position.distanceTo(controls.target); if (!montree || d0 < 1e-3 || d1 < 1e-3) return;
    camera.updateMatrixWorld(); const k = d1 / d0;
    for (const v of [pos, cible]) v.copy(_loc.copy(v).applyMatrix4(_inv).multiplyScalar(k).applyMatrix4(camera.matrixWorld));
    vel.multiplyScalar(k);
  }

  function personnaliser(patch, discret = false) { sauve.perso = Object.assign({}, perso(), patch); sauver(sauve); if (montree && !discret) { joie = Math.max(joie, 2); particules.burst(corps.position, coul, 14, .9, true); } return perso(); }
  function fete(texte, { couleur = null } = {}) { joie = 5; bond = 0; surprise = 1; if (montree) particules.burst(pos, couleur || coul, 40, 1.8, true); dire(texte, { priorite: true, duree: 5200 }); }

  return {
    memoriser, suivre, perso, personnaliser, fete, dessiner: () => ecranPos,
    yeuxEtoiles: on => { mat.uniforms.uStarEye.value = on ? 1 : 0; },
    update, majProfil, dire, souvenirMaintenant() { souvenir = null; prochainSouvenir = rnd(70, 130); lancerSouvenir(); return !!souvenir; },
    montrer() { if (montree) return; montree = true; apparition = 0; majProfil(true); base(); ndcPoint(0, .05, distRef(), pos); vel.set(0, 0, 0);   // elle naît devant toi, où que regarde la caméra
      particules.burst(pos, new THREE.Color(1, .95, .8), 40, 2.6, true); },
    nom: () => sauve.nom || '', renommer(n) { sauve.nom = (n || '').trim().slice(0, 18) || t('Lueur'); sauver(sauve); dire(t('Bonjour ! Moi, c’est {nom}.', { nom: sauve.nom }), { priorite: true, duree: 4500 }); },
    visible: () => sauve.visible !== false, basculer() { sauve.visible = !(sauve.visible !== false); sauver(sauve); return sauve.visible; },
    // la lueur est-elle sous le pointeur ? (cercle autour du corps, en pixels)
    touche(x, y) { if (!montree || !sauve.visible) return false; const r = Math.max(34, ecranPos.rpx * 1.25); return (x - ecranPos.x) ** 2 + (y - ecranPos.y) ** 2 < r * r; },
    caresse() { joie = 3.4; bond = 0; sauve.caresses = (sauve.caresses || 0) + 1; sauver(sauve); surprise = 0; particules.burst(corps.position, rose, 12, .7); dire(choix(['Hihi.', 'Encore !', 'Mmh…', 'Oh, ça chatouille !', '♥']), { priorite: true, duree: 2200 }); },
    calin(actif) { calin = actif; if (!actif && etat === 'calin') { joie = 4; particules.burst(corps.position, rose, 26, 1.3, true); dire('Merci.', { priorite: true, duree: 2200 }); } },
    appeler() { forceCible = { point: new THREE.Vector3().copy(controls.target), jusqu: performance.now() + 4000 }; joie = 2; dire('Me voilà !', { priorite: true, duree: 2200 }); },
    reagir(nom) {
      if (nom === 'eclair') { peur = 4; dire('Aaah !', { priorite: true, duree: 2000 }); }
      else if (nom === 'artifice') { joie = 6; dire('Waouh !', { priorite: true, duree: 2200 }); }
      else if (['pluie', 'mer', 'neige', 'soleil', 'amour', 'chat', 'feu'].includes(nom)) joie = Math.max(joie, 5);
      else if (nom === 'baleine') { surprise = 5; dire('Une baleine ?!', { priorite: true, duree: 2800 }); }
      else if (nom === 'lune') { surprise = 4; dire('La lune…', { duree: 2600 }); }
      else if (nom === 'etoile') surprise = 3;
    },
    choc(point) { _b.copy(pos).sub(point).normalize(); vel.addScaledVector(_b, 16); surprise = 2.5; dire('Waouh !', { priorite: true, duree: 1800 }); },
    // une nouvelle pensée vient de naître : elle va voir l'étoile arriver
    celebrer(id) {
      joie = 3.4;
      forceCible = id ? { id, jusqu: performance.now() + 7000, surArrivee: () => dire(choix(['Je la garde précieusement.', 'Elle est belle, celle-là.', 'Une étoile de plus.']), { priorite: true, duree: 3800 }) } : null;
    },
    // ─── pendant qu'on écrit ───
    taper(texte, curseur) {
      joie = Math.max(joie, .25);
      const m = texte.slice(0, curseur).match(/([\p{L}’'-]{3,})[\s.,;:!?…]$/u);                    // un mot vient d'être terminé
      if (m) { const mot = norm(m[1]); const r = LEXIQUE.find(x => x.re.test(mot)); if (r) { fx = { expr: r.expr, jusqu: performance.now() + 2800 }; if (bullesEcriture < 4 && dire(choix(r.dit), { duree: 2800 })) bullesEcriture++; } }
      if (texte.length > 240 && !longDit) { longDit = true; dire('Tu as beaucoup à dire…', { duree: 3000 }); }
    },
    patiente() { if (!patienceDite) { patienceDite = true; dire('Prends ton temps.', { duree: 3200 }); } },
    imiter(mood, couleur) { mimique = mood ? { mood, couleur: couleur ? new THREE.Color(couleur) : null } : { mood: null, couleur: null }; },
    finEcriture() { mimique = { mood: null, couleur: null }; },
    regler(c) { clair = c; },
    etat: () => ({ etat, stade: profil.stade, jours: profil.jours, seul: profil.seul, caresses: sauve.caresses, nom: sauve.nom, pos: pos.toArray().map(x => Math.round(x * 10) / 10), ecran: [Math.round(ecranPos.x), Math.round(ecranPos.y)] }),
  };
}
