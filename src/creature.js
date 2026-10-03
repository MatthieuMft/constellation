// La petite lueur : un esprit de lumière qui vit DANS la galaxie (monde 3D).
// Elle se déplace en 3D parmi les étoiles. v12 : un vrai objet 3D (lueur3d.js : orbe de gaz, poussière d'étoiles, visage courbé sur la sphère)
// qui fait face à la caméra mais se tourne vers ce qu'elle regarde et là où elle va. Dessinée après les effets de caméra (flou, lueur) : toujours nette.
//  - elle s'assoit au-dessus de l'éditeur pendant qu'on écrit, suit le texte, imite l'humeur choisie, réagit aux mots ;
//  - elle remonte vos anciennes pensées : elle va près de l'étoile, la regarde, la lit dans une bulle ;
//  - elle dort, s'ennuie si on n'écrit plus (jamais de mort), grandit avec les jours écrits.
import * as THREE from 'three';
import { creerLueur3D } from './lueur3d.js';
import { VALENCE } from './analyse.js';
import { norm } from './embed.js';
import { t, EN } from './langue.js';

const CLE = 'constellation.creature.v1';
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const choix = l => l[Math.floor(Math.random() * l.length)];
const ECHELLES = [.85, 1, 1.15, 1.35];                                  // stades : étincelle · lueur · esprit · grand esprit
const EXPRESSIONS = ['douce', 'rieuse', 'reveuse', 'malicieuse', 'etonnee'];         // l'expression au repos (les états passagers passent devant)

function charger() { try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch (e) { return {}; } }
function sauver(o) { try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} }


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
  let persoC = null;                                                     // le perso effectif, recalculé seulement quand il change (aucune allocation par image)
  const persoI = () => persoC || (persoC = Object.assign({}, PERSO0, sauve.perso || {})), perso = () => Object.assign({}, persoI());

  // ───── rendu : la lueur en volume (lueur3d.js), dans le monde 3D, dessinée après les effets ─────
  const lueur = creerLueur3D(), corps = lueur.groupe; corps.visible = false; sceneUI.add(corps);

  // ───── vignettes de la boutique : la vraie lueur 3D portant l'article, rendue UNE fois dans un canvas 160×160 ─────
  // file vidée dans la boucle juste avant les effets : on dessine dans un coin de l'écran, on recopie, puis l'image du ciel recouvre tout
  // (rien ne clignote ; mêmes programmes que la lueur du ciel : aucune compilation). o = { perso, etoiles, R, cx, cy, az, el, mode, apres(ctx2d) }
  const fileV = []; let vgn = null;
  function creerVignettes() {
    const l = creerLueur3D(), sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(22, 1, .1, 400); let S = 160; sc.add(l.groupe);   // S : taille rendue (160 pour une vignette, plus pour l'aperçu)
    const avant = l.masque.onBeforeRender;                               // grains à l'échelle de la vignette (pas de l'écran entier)
    l.masque.onBeforeRender = (r, sc2, c, ...a) => { avant(r, sc2, c, ...a); l.U.uPx.value = S * c.projectionMatrix.elements[5] * .5; };
    const ev = { couleur: new THREE.Color(), clair: 0, app: 1, joie: 0, triste: 0, sourcils: 0, eclat: 0, calme: 0, grands: 0, sommeil: 0, cligne: 0, regard: { x: 0, y: .05 },
      expr: new THREE.Vector4(), yeuxEtoiles: 0, battement: .6, ecrase: { x: 1, y: 1 }, penche: 0, perso: null };
    const vp = new THREE.Vector4(), sci = new THREE.Vector4(), cc = new THREE.Color(), fond = new THREE.Color('#05060f');
    return (renderer, toile, o) => {
      S = Math.min(o.S || 160, renderer.domElement.width, renderer.domElement.height); const k = S / 160;   // jamais plus grand que l'écran (sinon l'image est coupée)
      const P = Object.assign({}, PERSO0, o.perso), ie = EXPRESSIONS.indexOf(P.expression), az = o.az ?? -.45, el = o.el ?? .12;
      ev.perso = P; ev.couleur.set(P.couleur || '#ffd98a'); ev.expr.set(+(ie === 1), +(ie === 2), +(ie === 3), +(ie === 4)); ev.yeuxEtoiles = o.etoiles ? 1 : 0; ev.regard.x = az * .7;
      l.maj(1, 2.2, ev); l.maj(1, 2.2, ev);                              // dt = 1 : les articles sont là d'un coup (présence 1)
      const e = l.encombrement(), R = o.R || Math.min(33, 118 / (e.haut + e.bas), 60 / e.cote), cx = o.cx ?? 80, cy = o.cy ?? 80 + (e.haut - e.bas) * R / 2;
      const d = 80 / R / Math.tan(cam.fov * Math.PI / 360);               // le corps (rayon 1) fait R px sur 160
      cam.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d); cam.lookAt(0, 0, 0);
      cam.setViewOffset(S, S, (80 - cx) * k, (80 - cy) * k, S, S); cam.updateMatrixWorld();
      renderer.getViewport(vp); renderer.getScissor(sci); renderer.getClearColor(cc);
      const st = renderer.getScissorTest(), ca = renderer.getClearAlpha(), ac = renderer.autoClear, s = S / renderer.getPixelRatio(), can = renderer.domElement;
      renderer.setRenderTarget(null); renderer.setViewport(0, 0, s, s); renderer.setScissor(0, 0, s, s); renderer.setScissorTest(true); renderer.setClearColor(fond, 1); renderer.autoClear = true;
      renderer.render(sc, cam);
      const x = toile.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = o.mode || 'source-over';
      x.drawImage(can, 0, can.height - S, S, S, 0, 0, toile.width, toile.height); x.restore();
      renderer.setViewport(vp); renderer.setScissor(sci); renderer.setScissorTest(st); renderer.setClearColor(cc, ca); renderer.autoClear = ac;
      if (o.apres) { x.save(); o.apres(x); x.restore(); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
    };
  }
  function vignette(toile, o = {}) { fileV.push(toile, o); }
  // aperçu (v21) : on la fait tourner en glissant le doigt (ou la souris) dessus ; chaque canvas garde son angle de vue
  const vues = new WeakMap();
  function apercu(toile, o = {}) {
    let v = vues.get(toile); if (!v) { v = { az: -.35, el: .12 }; vues.set(toile, v); tournable(toile, v); }
    vignette(toile, { perso: perso(), etoiles: yeuxEt === 1, S: toile.width, az: v.az, el: v.el, ...o });
  }
  function tournable(toile, v) {
    let x0 = null, y0 = 0, attente = false; toile.style.touchAction = 'none'; toile.style.cursor = 'grab';
    const fin = () => { x0 = null; toile.style.cursor = 'grab'; };
    toile.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; toile.style.cursor = 'grabbing'; try { toile.setPointerCapture(e.pointerId); } catch (_) {} });
    toile.addEventListener('pointermove', e => {
      if (x0 == null) return;
      v.az -= (e.clientX - x0) * .012; v.el = Math.min(.6, Math.max(-.35, v.el + (e.clientY - y0) * .006)); x0 = e.clientX; y0 = e.clientY;
      if (!attente) { attente = true; requestAnimationFrame(() => { attente = false; apercu(toile); }); }
    });
    toile.addEventListener('pointerup', fin); toile.addEventListener('pointercancel', fin);
  }
  function rendreVignettes(renderer) {                                   // appelée par la boucle, avant composer.render() : quelques vignettes par image
    if (!fileV.length) return; const t0 = performance.now();
    if (!vgn) vgn = creerVignettes();
    do { const toile = fileV.shift(), o = fileV.shift(); try { vgn(renderer, toile, o); } catch (e) { console.warn('lueur : vignette', e); } } while (fileV.length && performance.now() - t0 < 6);
  }

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
  const rose = new THREE.Color(1, .55, .7), blanc = new THREE.Color(1, 1, 1), _pc = new THREE.Color();
  // ce que la lueur 3D reçoit à chaque image (objets réutilisés : aucune allocation) ; lacet / tangage : où elle tourne la tête
  const exprV = new THREE.Vector4(), ecraseV = new THREE.Vector2(1, 1), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const vue = { couleur: coul, clair: 0, app: 0, joie: 0, triste: 0, sourcils: 0, eclat: 0, calme: 0, grands: 0, sommeil: 0, cligne: 0, regard, expr: exprV, yeuxEtoiles: 0, battement: 0, ecrase: ecraseV, penche: 0, perso: null };
  let lacet = 0, tangage = 0, yeuxEt = 0;

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

  const sousCorps = () => Math.max(0, lueur.encombrement().bas - 1) * ecranPos.rpx / 1.08;   // cape, pieds… : elle se pose plus haut pour ne pas les cacher sous le panneau
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
      case 'pose': { const r = ctx.pose; const [nx, ny] = ndcDe(clamp(r.left + r.width * .5, 40, W - 40), r.top - 92 - sousCorps()); ndcPoint(nx, ny, d * .62, cible); raideur = 2.8; vmax = 18; break; }
      case 'centre': cible.copy(ctx.selection).addScaledVector(_f, -4).addScaledVector(_r, -3.4).addScaledVector(_u, 1.4); raideur = 1.8; vmax = 10; regardCible = ctx.selection; break;
      case 'guide': cible.copy(ctx.guide).addScaledVector(_u, 2.2); raideur = 3.2; vmax = 22; break;
      case 'ecrit': {                                                    // elle flotte juste au-dessus de l'éditeur, devant le texte
        const r = ctx.rectEcriture; if (!r) { ndcPoint(0, .2, d * .7, cible); break; }
        const [nx, ny] = ndcDe(clamp(r.left + r.width * (.14 + .72 * ctx.caret), 40, W - 40), r.top - 56 - sousCorps());
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
    const P = persoI(); if (P.couleur) _pc.set(P.couleur);
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
    const V = vue, k6 = Math.min(1, dt * 6);
    V.joie += (joy - V.joie) * k6; V.triste += (sad - V.triste) * Math.min(1, dt * 3); V.sourcils += (brow - V.sourcils) * k6;
    V.eclat += (spark - V.eclat) * k6; V.calme += (relax - V.calme) * k6; V.grands += (wide - V.grands) * Math.min(1, dt * 9);
    V.sommeil += ((dort ? 1 : 0) - V.sommeil) * Math.min(1, dt * 2.5);
    V.cligne = blink; V.app = apparition; V.clair = clair ? 1 : 0; V.yeuxEtoiles = yeuxEt; V.perso = P;
    // l'expression choisie, seulement au repos : sommeil, peur, joie, mots, humeur imitée passent devant
    const ie = EXPRESSIONS.indexOf(P.expression), repos = dort || imi || expr || peur > 0 || surprise > 0 || joie > 0 || calin ? 0 : 1 - sad;
    exprV.x += ((ie === 1 ? repos : 0) - exprV.x) * k6; exprV.y += ((ie === 2 ? repos : 0) - exprV.y) * k6; exprV.z += ((ie === 3 ? repos : 0) - exprV.z) * k6; exprV.w += ((ie === 4 ? repos : 0) - exprV.w) * k6;
    const vit = vel.length(); V.battement = Math.sin(t * (dort ? .8 : 7 + vit * .6)) * (dort ? .2 : 1);

    // forme : étirement dans le sens du mouvement, respiration, penchée dans les virages
    base(); const lat = vel.dot(_r);
    const etir = 1 + clamp(vit * .028, 0, .25), resp = 1 + Math.sin(t * (dort ? 1.1 : 2.2)) * .035 * (dort ? 1.6 : 1);
    const ecr = dort ? .93 : 1 + (etire > 0 ? Math.sin(etire / 1.4 * Math.PI) * .22 : 0);
    ecraseV.set(resp / Math.sqrt(etir) * (calin ? 1.12 : 1) * (peur > 0 ? .9 : 1), resp * Math.sqrt(etir) * ecr * (calin ? .9 : 1));
    V.penche += (clamp(-lat * .035, -.4, .4) + (peur > 0 ? Math.sin(t * 40) * .06 : 0) - V.penche) * Math.min(1, dt * 6);
    lueur.maj(dt, t, V);                                                 // couleur, expressions, regard, ailes, perso (silhouette, matière, articles portés)

    // taille : bien visible, et à peu près constante à l'écran quand elle s'éloigne ou se rapproche (s = « uSize » de la v11 : le corps fait s/4 de rayon)
    const dc = camera.position.distanceTo(pos), ech = clamp(dc / distRef(), .8, 1.5);
    const taille = ECHELLES[profil.stade] * (1 + evolue * .07 * Math.sin(evolue * 6)) * (.4 + .6 * apparition) * (mobile ? .9 : 1);
    const s = 12 * taille * P.taille * ech * (distRef() / 52);
    const bob = Math.sin(t * 1.7) * .25 * (dort ? .3 : 1), tr = peur > 0 ? .12 : 0;
    corps.position.copy(pos).addScaledVector(_u, bob).add(_a.set((Math.random() - .5) * tr, (Math.random() - .5) * tr, (Math.random() - .5) * tr));
    corps.scale.setScalar(s * .25); corps.visible = true;
    // orientation : face à la caméra, mais elle tourne la tête vers là où elle va et ce qu'elle regarde (trois-quarts, profil en voyage),
    // lacet et tangage doux et bornés (le visage reste lisible) ; elle revient de face à l'arrêt, pendant qu'on écrit, qu'on la règle ou qu'elle dort
    let lc = clamp(lat * .16, -1.2, 1.2) + regard.x * .3, tg = clamp(-vel.dot(_u) * .05, -.35, .35) - regard.y * .2;
    if (dort) { lc *= .25; tg = .2; } else if (etat === 'ecrit' || etat === 'pose' || calin) { lc *= .4; tg *= .5; }
    lacet += (clamp(lc, -1.3, 1.3) - lacet) * Math.min(1, dt * 3); tangage += (clamp(tg, -.45, .45) - tangage) * Math.min(1, dt * 3);
    _m.lookAt(camera.position, corps.position, _u); corps.quaternion.setFromRotationMatrix(_m).multiply(_q.setFromEuler(_e.set(tangage, lacet, 0)));

    // écran : sert au clic, à la bulle
    _p.copy(corps.position).project(camera);
    const pxUnit = ctx.H / (2 * Math.tan(camera.fov * Math.PI / 360) * Math.max(1, dc));
    ecranPos.x = (_p.x + 1) / 2 * ctx.W; ecranPos.y = (1 - _p.y) / 2 * ctx.H; ecranPos.rpx = s * .27 * pxUnit;

    // étincelles : sillage, petits « z » pendant le sommeil, cœurs pendant le câlin
    if (!dort && vit > 4 && Math.random() < dt * 14) particules.burst(corps.position, coul, 1, .12);
    if (dort) { zT -= dt; if (zT <= 0) { zT = rnd(1.8, 3); particules.burst(_p.copy(corps.position).addScaledVector(_u, 2.2).addScaledVector(_r, 1.2), blanc, 1, .1); } }
    if (calin && Math.random() < dt * 5) particules.burst(corps.position, rose, 1, .45);
    if (P.etincelles && !dort && Math.random() < dt * 7) particules.burst(_p.copy(corps.position).addScaledVector(_r, rnd(-2.5, 2.5)).addScaledVector(_u, rnd(-2.5, 2.5)), Math.random() < .5 ? coul : blanc, 1, .25);

    // bulle : au-dessus de la tête, jamais hors de l'écran
    if (!bulle.hidden) {
      if (now > bulleFin) { bulle.classList.remove('visible'); if (now > bulleFin + 400) { bulle.hidden = true; bulleClic = null; } }
      const enc = lueur.encombrement(), haut = Math.max(1, enc.haut / 1.08), dessous = Math.max(1, enc.bas / 1.08);   // oreilles, chapeau, cape, pieds : la bulle ne les cache pas
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
      const brut = e.text.replace(/^ *(-{3,}|—+) *$/gm, '').replace(/^(#{1,4}|[-•*]|\d+\.|>) +/gm, '').replace(/\s+/g, ' ').trim(), court = brut.length > 78 ? brut.slice(0, 76).replace(/\s+\S*$/, '') + '…' : brut;
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

  function personnaliser(patch, discret = false) { sauve.perso = Object.assign({}, perso(), patch); persoC = null; sauver(sauve); if (montree && !discret) particules.burst(corps.position, coul, 14, .9, true); return perso(); }   // v20 : plus de sourire forcé, on voit le changement tel quel
  function fete(texte, { couleur = null } = {}) { joie = 5; bond = 0; surprise = 1; if (montree) particules.burst(pos, couleur || coul, 40, 1.8, true); dire(texte, { priorite: true, duree: 5200 }); }

  return {
    memoriser, suivre, perso, personnaliser, fete, dessiner: () => ecranPos,
    yeuxEtoiles: on => { yeuxEt = on ? 1 : 0; },
    lueur, prechauffer: (renderer, cam) => lueur.prechauffer(renderer, cam), vignette, rendreVignettes,
    apercu,   // la lueur telle qu'elle est maintenant (aperçus de la boutique et de « Personnaliser ma lueur »), qu'on fait tourner au doigt
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
