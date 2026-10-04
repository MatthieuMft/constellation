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
const lisse01 = x => x * x * (3 - 2 * x);
// v57 : ce que la lueur retient de vos jeux (clé à part : rien d'autre n'est touché) : bonjour du jour, couchée le soir, filantes attrapées
const CLE_JEUX = 'constellation.lueur-jeux.v1';
const jeux = (() => { try { return JSON.parse(localStorage.getItem(CLE_JEUX)) || {}; } catch (e) { return {}; } })();
const sauverJeux = () => { try { localStorage.setItem(CLE_JEUX, JSON.stringify(jeux)); } catch (e) {} };
const estNuit = h => h >= 20 || h < 7;
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

export function creerCreature({ sceneUI, camera, controls, particules, texHalo, entrees, couleurDe, surMessage, etoiles, ouvrirPensee, mobile, jouer, amitie }) {
  let sauve = charger();
  if (!sauve.nee) { sauve.nee = Date.now(); sauve.caresses = 0; sauve.stade = 0; sauve.visible = true; }
  let montree = false, apparition = 0, clair = false;
  const PERSO0 = { couleur: null, acc: 0, accCouleur: '#ffd98a', yeux: 1, taille: 1, etincelles: false, orbite: false, traine: false, poudre: false,   // v39 : effets
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
      ev.perso = P; ev.couleur.set(P.couleur || '#ffd98a'); ev.expr.set(+(ie === 1), +(ie === 2), +(ie === 3), +(ie === 4)); ev.yeuxEtoiles = o.etoiles ? 1 : 0; ev.regard.x = az * .7; ev.cligne = o.cligne || 0; ev.calme = o.calme || 0; ev.sommeil = o.sommeil || 0; ev.joie = o.joie || 0; ev.eclat = 0; ev.grands = 0;
      if (P.expression === 'emerveillee') ev.eclat = 1; else if (P.expression === 'curieuse') { ev.grands = .55; ev.eclat = .35; } else if (P.expression === 'ensommeillee') { ev.calme = Math.max(ev.calme, .4); ev.expr.y = .55; }   // v39 ; v38 : états du visage (tests de compatibilité)
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
  // v79 : o (facultatif) est gardé pour ce canvas : l'essai de la boutique reste quand on la fait tourner ; {} revient à la lueur telle qu'elle est
  function apercu(toile, o) {
    let v = vues.get(toile); if (!v) { v = { az: -.35, el: .12, o: {} }; vues.set(toile, v); tournable(toile, v); }
    if (o) v.o = o;
    const { patch, ...reste } = v.o;
    vignette(toile, { perso: patch ? { ...perso(), ...patch } : perso(), etoiles: yeuxEt === 1, S: toile.width, az: v.az, el: v.el, ...reste });
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
    const now = performance.now(); if (!priorite && now < bulleLibre) return false; if (cache) return false;
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
  let lacet = 0, tangage = 0, yeuxEt = 0, petite = 1;
  // v25 : elle réagit davantage à ce qu'on fait (doigt, écriture, humeur, ciel qu'on tourne, inactivité)
  let doigt = { x: 0, y: 0, t: -1e9 }, tapes = [], dernierSursaut = 0, hoche = 0, tournis = 0, tourneAcc = 0, azPrec = null, vAz = 0, baille = 0, bailleFait = false;
  // v56 : on la prend du doigt (tenue), on la lance (lancee puis revient), deux tapes = pirouette, frotter vite = fou rire ; lâchée doucement, elle reste là (maison)
  let tenue = null, poseeJusqu = 0, lancee = 0, revenue = false, pirouette = 0, rire = 0, rireLibre = 0, derniereCaresse = 0, recentes = [], ditPrise = 0, phrasesCtx = [];
  const maison = { x: -.34, y: -.3 };
  let cache = null, cacheF = 0, couchee = false, reveil = false, tCouchee = 9, serie = 0, proposeCache = 0;   // v57 : cache-cache, couchée pour la nuit
  const doree = new THREE.Color(1, .88, .55);
  const _o = new THREE.Vector3();
  // v58 : sa vie en solo (croquer l'étoile du jour, en faire le tour, la planche, jongler, polir une étoile, une sieste, éternuer) et ses réactions aux filantes
  const SOLO = { croque: 7.5, orbite: 9, planche: 10, jongle: 8, polit: 8, sieste: 14, coeur: 7 };
  const tr = (x, v) => t(x, v);   // t est aussi le temps dans viser / update
  let chercheDemande = null;   // v59 : partir chercher une trouvaille
  const amiP = () => amitie ? amitie.palier() : 0, prenom = () => amitie ? amitie.prenom() : '';
  let derniereFilante = -1e9, solo = null, eternue = 0, prochainEternue = rnd(120, 260), filR = null, filVue = 0;
  const balles = [0, 1, 2].map(() => { const m = new THREE.SpriteMaterial({ map: texHalo, color: new THREE.Color(1, .9, .6), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: 0 }), b = new THREE.Sprite(m); b.renderOrder = 12; b.visible = false; sceneUI.add(b); return b; });
  const cleEtoile = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function etoileDuJour() { const m = etoiles(), v = m.get(cleEtoile()); if (v) return v; let best = null; for (const w of m.values()) if (!best || String(w.id) > String(best.id)) best = w; return best; }   // pas encore écrit aujourd'hui : la plus récente
  const couleurEtoile = v => v.mat && v.mat.uniforms && v.mat.uniforms.uColor ? v.mat.uniforms.uColor.value : coul;
  function preparerSolo(n) {
    if (n === 'croque' || n === 'orbite') { const v = etoileDuJour(); return v && proj(v.groupe.position).vu ? { v, a0: Math.random() * 6.283 } : null; }
    if (n === 'polit' || n === 'sieste') { const vus = [...etoiles().values()].filter(v => proj(v.groupe.position).vu); return vus.length ? { v: choix(vus) } : null; }
    if (n === 'coeur' && amiP() < 3) return null;                      // v59 : les cœurs d'étoiles, à partir du palier « Inséparables »
    return { dir: Math.random() < .5 ? -1 : 1 };
  }
  function debutSolo(n) {
    const l = { croque: [.35, ['Elle a l’air bonne, ton étoile…', 'Juste une bouchée…']], orbite: [.4, ['Un petit tour de ton étoile !', 'Je fais le tour !']], planche: [.5, ['Je fais la planche…', 'Je me laisse flotter.']],
      jongle: [.5, ['Regarde, je jongle !', 'Hop, hop, hop !']], coeur: [.5, [prenom() ? t('Un cœur pour toi, {p}.', { p: prenom() }) : 'Un cœur pour toi.', 'Regarde bien…']], polit: [.4, ['Je la fais briller pour toi.', 'Un peu de poussière, là…']], sieste: [.4, ['Une petite sieste…', 'Je me pose un peu.']] }[n];
    if (l && Math.random() < l[0]) dire(choix(l[1]), { duree: 2600 });
  }
  function finSolo(n) {
    if (n === 'jongle' && Math.random() < .5) { joie = 2; dire(choix(['Ta-da !', 'Et voilà !']), { priorite: true, duree: 1600 }); }
    if (n === 'sieste' && solo && !solo.reveillee) { etire = 1.4; if (Math.random() < .4) dire(choix(['Ah, ça fait du bien.', 'Petite sieste… finie !']), { duree: 2200 }); }
  }
  function reactionFilante(ctx, m) {                                   // une réaction tirée au hasard à chaque filante
    const t0 = performance.now();
    if ((jeux.attrapes || 0) < 3 && t0 - dernierSouhait > 90000 && etat !== 'dort' && etat !== 'sieste' && !cache) { dernierSouhait = t0; dire('Touche-la, je l’attrape !', { priorite: true }); }
    if (etat === 'dort' || etat === 'sieste' || cache || tenue || etat === 'ecrit' || etat === 'fete' || etat === 'souvenir' || etat === 'lancee' || etat === 'revient') return { type: 'ignore' };
    if (SOLO[etat] || etat === 'visite' || etat === 'souvenir' || etat === 'cherche') return { type: 'ignore' };   // v68 : occupée, elle laisse filer (Matthieu : elle ne faisait plus que ça)
    if (t0 - derniereFilante < 50000 || Math.random() < .35) return { type: 'ignore' };   // v68 : au plus une réaction toutes les 50 s, et pas à chaque fois
    derniereFilante = t0;
    const libre = ['flotte', 'regarde', 'joue', 'danse', 'visite', 'attend', 'curieux'].includes(etat) && !ctx.ecriture;
    const r = Math.random(), type = r < .3 ? 'voeu' : r < .58 ? 'suit' : r < .85 ? 'bouche' : libre ? 'court' : 'suit';   // v68 : courir après, plus rare
    if (type === 'voeu' && Math.random() < .45) dire(choix(['Je fais un vœu…', 'Un vœu pour toi.', 'Chut, je fais un vœu.']), { duree: 2600 });
    else if (type === 'bouche' && Math.random() < .4) dire(choix(['Ooooh…', 'Waouh…', 'Tu as vu ?']), { duree: 2000 });
    else if (type === 'suit' && Math.random() < .25) dire(choix(['Elle file !', 'Regarde-la filer.']), { duree: 2000 });
    else if (type === 'court') {                                       // elle court après toute seule, et parfois elle l'attrape
      dire(choix(['Attends-moi !', 'Je l’attrape !', 'Elle est à moi !']), { priorite: true, duree: 1600 }); souvenir = null;
      _c.copy(m).project(camera); const p = ndcPoint(clamp(_c.x, -.9, .9), clamp(_c.y, -.85, .85), camera.position.distanceTo(pos), new THREE.Vector3());
      forceCible = { point: p, vite: true, chasse: true, jusqu: t0 + 2600, surArrivee: () => {
        if (Math.random() < .45) { jouer && jouer('filante'); joie = 4; particules.burst(pos, doree, 30, 1.3, true); dire(choix(['Je l’ai eue toute seule !', 'Attrapée ! Pour toi.']), { priorite: true, duree: 2400 }); }
        else { surprise = .6; dire(choix(['Raté… elle va trop vite.', 'Zut, envolée !', 'Pfff, la prochaine fois.']), { priorite: true, duree: 2200 }); } } };
    }
    return { type, t0 };
  }

  function base() { camera.updateMatrixWorld(); _r.setFromMatrixColumn(camera.matrixWorld, 0); _u.setFromMatrixColumn(camera.matrixWorld, 1); camera.getWorldDirection(_f); }
  const ndcPoint = (x, y, d, out) => out.set(x, y, .5).unproject(camera).sub(camera.position).normalize().multiplyScalar(d).add(camera.position);
  const distRef = () => clamp(camera.position.distanceTo(controls.target), 14, 2400) * .8;
  let hVue = innerHeight;   // v61 : hauteur du ciel dessiné (plus grande que l'écran visible quand le clavier est ouvert)
  const proj = p => { _p.copy(p).project(camera); return { x: (_p.x + 1) / 2 * innerWidth, y: (1 - _p.y) / 2 * hVue, vu: _p.z < 1 && Math.abs(_p.x) < .96 && Math.abs(_p.y) < .96 }; };
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
    const dort = (ctx.inactivite > 150 || (ctx.nuit && ctx.inactivite > 16)) && !ctx.ecriture && !calin;
    if (ctx.inactivite < 5) bailleFait = false;
    else if (!bailleFait && !dort && !ctx.ecriture && !calin && etat !== 'dort' && ctx.inactivite > (ctx.nuit ? 11 : 60)) { bailleFait = true; baille = 2.4; etire = 1.4; dire(choix(['Aaaah…', '*bâille*', 'Je somnole un peu…']), { duree: 2400 }); }
    let n = 'flotte';
    if (tenue) n = 'tenue';
    else if (peur > 0) n = 'peur';
    else if (ctx.ecriture) n = 'ecrit';
    else if (ctx.pose) n = 'pose';
    else if (cache) n = 'cache';
    else if (lancee > 0) n = 'lancee';
    else if ((etat === 'lancee' || etat === 'revient') && !revenue && etatT < 6) n = 'revient';
    else if (ctx.guide) n = 'guide';
    else if (forceCible && forceCible.vite && !forceCible.fait && now >= forceCible.jusqu) { forceCible.fait = true; forceCible.surArrivee(); }   // v57 : trop loin, elle l'attrape quand même
    else if (forceCible && now < forceCible.jusqu) n = 'fete';
    else if (chercheDemande || (etat === 'cherche' && etatT < 12)) n = 'cherche';   // v59 : elle part chercher une trouvaille
    else if (calin) n = 'calin';
    else if (souvenir && now < souvenir.fin) n = 'souvenir';
    else if (couchee) n = 'dort';                                       // v57 : couchée pour la nuit
    else if (ctx.selection) n = 'centre';
    else if (dort) n = 'dort';
    else if (ctx.curseurActif && ctx.curseurImmobile > 2.4 && !ctx.occupe && now > poseeJusqu) n = 'curieux';   // v56 : tout juste posée, elle reste où on l'a mise
    else if (profil.seul > .4) n = 'attend';
    else if ((etat === 'joue' && etatT < 5.5) || (etat === 'danse' && etatT < 4.5) || (etat === 'regarde' && etatT < 6)) n = etat;
    else if (SOLO[etat] && solo && etatT < SOLO[etat]) n = etat;       // v58 : une scène en solo va jusqu'au bout
    else if (etat === 'visite' && etatT < prochainChangement) n = 'visite';
    else if (etat === 'flotte' && etatT > prochainChangement && (animSuivante !== 'visite' || etoiles().size)) n = animSuivante;
    if (SOLO[n] && n !== etat && !(solo = preparerSolo(n))) { n = 'flotte'; animSuivante = 'joue'; }
    if (n === 'cherche' && chercheDemande) { solo = chercheDemande; chercheDemande = null; dire(choix(['Attends-moi, je reviens !', 'Je vais te chercher quelque chose…', 'Je pars en balade, je reviens vite.']), { priorite: true, duree: 2600 }); }
    if (n !== etat) {
      if (SOLO[etat]) finSolo(etat);
      if (SOLO[n]) debutSolo(n);
      if (etat === 'dort' && n !== 'tenue') { etire = 1.4; if (reveil) { jeux.bonjour = cleJour(); sauverJeux(); } dire(reveil ? 'Bonjour ! J’ai bien dormi.' : 'Hm ? Oh, tu es là.'); reveil = false; }
      if (etat === 'ecrit') { bullesEcriture = 0; longDit = false; patienceDite = false; }
      if (etat === 'revient' && n !== 'tenue') { joie = 2.5; dire(choix(['Pfiou ! Quel voyage.', 'Tu m’as lancée loin !', 'Encore ! … Non, en fait.', 'Me revoilà !']), { priorite: true, duree: 2400 }); }
      if (n === 'revient') revenue = false;
      if (n === 'ecrit' && sauve.nom) dire(choix(['Je t’écoute.', 'Alors, cette journée ?', 'Raconte-moi.', 'Qu’est-ce qui traverse ?']), { duree: 3600 });
      etat = n; etatT = 0; arrivee = false;
      if (etat === 'regarde') regardT = 0;
      if (etat === 'visite') { const vs = [...etoiles().values()]; visiteId = vs[Math.floor(Math.random() * vs.length)]; prochainChangement = rnd(8, 13); }
      if (etat === 'flotte') { prochainChangement = rnd(7, 14); animSuivante = choix(['visite', 'joue', 'danse', 'croque', 'croque', 'orbite', 'orbite', 'planche', 'planche', 'jongle', 'jongle', 'polit', 'polit', 'sieste', 'coeur', 'coeur']); }   // v68 : plus de scènes en solo, plus souvent
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
      case 'flotte': ndcPoint(maison.x + Math.sin(t * .21) * .2, maison.y + Math.cos(t * .17) * .2, d + Math.sin(t * .13) * 8, cible); raideur = 1.3; vmax = 6; break;
      case 'attend': ndcPoint(maison.x + .16, Math.max(-.6, maison.y - .25) + Math.sin(t * .8) * .02, d * .85, cible); raideur = 1.6; vmax = 7; break;
      case 'tenue': { const [nx, ny] = ndcDe(tenue.x, tenue.y); ndcPoint(nx, ny, tenue.d, cible); raideur = 16; vmax = 90; break; }   // v56 : elle suit le doigt, un peu en retard (elle gigote)
      case 'lancee': cible.copy(pos); raideur = 0; vmax = 160; break;                                  // en vol libre
      case 'revient': ndcPoint(maison.x, maison.y, d, cible); raideur = 3.2; vmax = 36; if (pos.distanceTo(cible) < 4) revenue = true; break;
      case 'visite': {
        const v = visiteId && etoiles().get(visiteId.id) ? visiteId : null;
        if (!v) { etat = 'flotte'; etatT = 0; return viser(dt, t, ctx); }
        cible.copy(v.groupe.position).addScaledVector(_f, -3.6).addScaledVector(_u, 1.5).addScaledVector(_r, Math.sin(t * .7) * 1.6); raideur = 1.8; vmax = 9;
        if (!arrivee && pos.distanceTo(cible) < 3) { arrivee = true; v.pulse = Math.max(v.pulse, .55); particules.burst(v.groupe.position, coul, 8, .6); joie = Math.max(joie, 1.2); regardCible = v.groupe.position; }
        break; }
      case 'souvenir': {
        const sp = souvenir && posEtoile(souvenir.id); if (!sp) { souvenir = null; break; }
        const a = etatT * 1.05, ro = 3.2;                                // v68 : elle fait le tour de ton étoile (avant, elle lisait le début de la note)
        cible.copy(sp).addScaledVector(_r, Math.cos(a) * ro).addScaledVector(_f, Math.sin(a) * ro).addScaledVector(_u, 1.1 + Math.sin(a * 2) * .4); raideur = 2.6; vmax = 14; regardCible = sp;
        if (!arrivee && pos.distanceTo(sp) < 5) { arrivee = true; const v = etoiles().get(souvenir.id); if (v) v.pulse = Math.max(v.pulse, .9); souvenir.arrive(); } break; }
      case 'fete': {
        const sp = forceCible.id ? posEtoile(forceCible.id) : forceCible.point; if (!sp) break;
        if (forceCible.vite) { cible.copy(sp); raideur = 7; vmax = 48; } else { cible.copy(sp).addScaledVector(_f, -3.8).addScaledVector(_u, 1.6); raideur = 2.4; vmax = 14; } regardCible = sp;   // v57 : vite = attraper une filante
        if (!arrivee && !forceCible.fait && pos.distanceTo(cible) < (forceCible.vite ? 6 : 3.5)) { arrivee = true; forceCible.fait = true; particules.burst(sp, coul, 24, 1.2, true); joie = 3.4; bond = 0; forceCible.surArrivee && forceCible.surArrivee(); } break; }
      case 'joue': { const a = etatT * 2.3; ndcPoint(-.05 + Math.cos(a) * .38, .05 + Math.sin(a * 1.4) * .26, d * .9, cible); raideur = 3.4; vmax = 17; joie = Math.max(joie, .5); break; }
      case 'danse': { ndcPoint(maison.x + .04, maison.y + .18, d * .85, cible); cible.addScaledVector(_r, Math.sin(etatT * 5) * 2.2).addScaledVector(_u, Math.abs(Math.sin(etatT * 5)) * 1.2); raideur = 4; vmax = 14; joie = Math.max(joie, .5); break; }
      case 'regarde': {
        regardT -= dt; if (regardT <= 0) { regardT = rnd(1, 1.9); ndcPoint(rnd(-.8, .8), rnd(-.5, .7), d * 1.2, regardPt); }
        ndcPoint(maison.x + .09 + Math.sin(t * .4) * .06, maison.y + .1, d, cible); raideur = 1.2; vmax = 5; regardCible = regardPt; break; }
      case 'pose': { const r = ctx.pose; const [nx, ny] = ndcDe(clamp(r.left + r.width * .5, 40, W - 40), r.top - 92 - sousCorps()); ndcPoint(nx, ny, d * .62, cible); raideur = 2.8; vmax = 18; break; }
      case 'centre': cible.copy(ctx.selection).addScaledVector(_f, -4).addScaledVector(_r, -3.4).addScaledVector(_u, 1.4); raideur = 1.8; vmax = 10; regardCible = ctx.selection; break;
      case 'guide': cible.copy(ctx.guide).addScaledVector(_u, 2.2); raideur = 3.2; vmax = 22; break;
      case 'ecrit': {                                                    // elle flotte juste au-dessus de l'éditeur, devant le texte
        const r = ctx.rectEcriture; if (!r) { ndcPoint(0, .2, d * .7, cible); break; }
        // v61 : en bas à droite, juste au-dessus de la barre du clavier (Matthieu : c'est là qu'elle a le plus de place, sa bulle ne cache pas le texte qu'on tape).
        // Clavier fermé : à hauteur de « Ajouter un média ». La hauteur vient du ciel dessiné (ctx.H), sinon elle se retrouvait sous le clavier.
        const m = ctx.rectMedia, yMedia = m && m.height ? m.top + m.height / 2 : r.bottom - 120, yClavier = Math.min(r.bottom, ctx.basVue || r.bottom) - 64;
        const [nx, ny] = ndcDe(r.right - 52 + Math.sin(etatT * .5) * 5, (ctx.clavier ? yClavier : yMedia) + Math.sin(etatT * .8) * 3);
        ndcPoint(nx, ny, d * .62, cible); raideur = 2.8; vmax = 18; break; }
      case 'curieux': { const [nx, ny] = ndcDe(ctx.curseur.x, ctx.curseur.y); ndcPoint(clamp(nx + .12, -.82, .82), clamp(ny + .16, -.7, .75), d * .9, cible); raideur = 1.5; vmax = 9; break; }
      case 'calin': { const [nx, ny] = ndcDe(ctx.curseur.x, ctx.curseur.y); ndcPoint(nx, ny, d * .7, cible); raideur = 4; vmax = 20; break; }
      case 'peur': { const e = plusProcheEtoile(pos); if (e) cible.copy(e.groupe.position).addScaledVector(_f, 2.2); else ndcPoint(-.3, -.45, d * .8, cible); raideur = 4; vmax = 20; break; }
      case 'cache': { const v = etoiles().get(cache.id); if (!v) { cache = null; break; }    // v57 : elle file derrière l'étoile et s'efface
        cible.copy(v.groupe.position).addScaledVector(_f, 2.5); raideur = 3.5; vmax = 30; break; }
      case 'croque': {                                                   // v58 : elle croque un bout de ton étoile du jour, grimace, et recrache tout en étincelles
        const v = solo.v, sp = v.groupe.position; regardCible = sp;
        cible.copy(sp).addScaledVector(_r, -2.8).addScaledVector(_f, -2.4).addScaledVector(_u, .4); raideur = 2.6; vmax = 14;
        if (solo.arrive == null && (pos.distanceTo(cible) < 2.5 || etatT > 4)) solo.arrive = etatT;
        if (solo.arrive != null) { const ta = etatT - solo.arrive;
          if (ta > .45 && ta < .85) cible.addScaledVector(_r, 1.6);       // la bouchée
          if (ta > .7 && !solo.mord) { solo.mord = true; v.pulse = Math.max(v.pulse, .8); particules.burst(sp, couleurEtoile(v), 10, .5); dire(choix(['Miam !', 'Crounch !', '*croque*']), { priorite: true, duree: 1400 }); }
          if (ta > 2.7 && !solo.crache) { solo.crache = true; _b.copy(pos).addScaledVector(_r, 1); particules.burst(_b, couleurEtoile(v), 22, 1.3, true); particules.burst(_b, doree, 10, 1, true); vel.addScaledVector(_r, -7).addScaledVector(_u, 2); v.pulse = Math.max(v.pulse, 1);
            dire(choix(['Pouah ! Ça pique.', 'Trop chaud !', 'Beurk, ça brille trop !', 'Bon… je te la rends.']), { priorite: true, duree: 2400 }); }
        } break; }
      case 'orbite': { const sp = solo.v.groupe.position, a = solo.a0 + etatT * 1.6, R = 6;   // elle tourne autour de ton étoile du jour (devant, puis derrière)
        cible.copy(sp).addScaledVector(_r, Math.cos(a) * R).addScaledVector(_f, Math.sin(a) * R * .8).addScaledVector(_u, .8 + Math.sin(a * 2) * .6); raideur = etatT < 1.5 ? 2.5 : 7; vmax = 28; regardCible = sp;
        if (Math.random() < dt * 10) particules.burst(pos, coul, 1, .12); break; }
      case 'planche': ndcPoint(clamp(maison.x + solo.dir * (etatT * .045 - .22), -.8, .8), maison.y + .14 + Math.sin(t * .7) * .03, d * .9, cible); raideur = 1; vmax = 3; break;   // elle se laisse dériver, allongée
      case 'jongle': ndcPoint(maison.x + .02, maison.y + .06, d * .85, cible); raideur = 2; vmax = 8; break;
      case 'polit': { const v = solo.v, sp = v.groupe.position; regardCible = sp;          // elle frotte une de tes étoiles jusqu'à ce qu'elle brille
        cible.copy(sp).addScaledVector(_f, -3).addScaledVector(_r, 1.7).addScaledVector(_u, .3); raideur = 2.4; vmax = 14;
        if (solo.arrive == null && (pos.distanceTo(cible) < 2.5 || etatT > 3.5)) solo.arrive = etatT;
        if (solo.arrive != null) { const ta = etatT - solo.arrive; cible.addScaledVector(_r, Math.sin(ta * 13) * .55).addScaledVector(_u, Math.cos(ta * 13) * .3); raideur = 9; vmax = 22;
          if (Math.random() < dt * 6) particules.burst(sp, blanc, 1, .3); v.pulse = Math.max(v.pulse, Math.min(.6, ta * .12));
          if (etatT > SOLO.polit - .8 && !solo.fini) { solo.fini = true; v.pulse = Math.max(v.pulse, 1.3); particules.burst(sp, doree, 22, 1.1, true); joie = 2.5; dire(choix(['Toute propre !', 'Elle brille, hein ?', 'Voilà, comme neuve.']), { priorite: true, duree: 2200 }); } }
        break; }
      case 'coeur': { const a = Math.min(1, etatT / 5.5) * Math.PI * 2, hx = Math.pow(Math.sin(a), 3), hy = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16;   // v59 : elle trace un cœur d'étoiles
        ndcPoint(clamp(maison.x + .3, -.5, .5) + hx * .32, clamp(maison.y + .38, -.2, .4) + hy * .2, d * .9, cible); raideur = 9; vmax = 30;
        if (etatT < 5.6 && Math.random() < dt * 40) particules.burst(pos, Math.random() < .6 ? rose : doree, 1, .04);
        if (etatT > 5.6 && !solo.fini) { solo.fini = true; joie = 3; dire(choix(['♥', 'Pour toi.', 'Tadaa, un cœur !']), { priorite: true, duree: 2000 }); } break; }
      case 'cherche': {                                                  // v59 : elle file hors de l'écran, puis revient avec une trouvaille
        if (etatT < 6) { ndcPoint(1.5, .35, d, cible); raideur = 2.2; vmax = 30; }
        else { ndcPoint(maison.x, maison.y, d, cible); raideur = 3; vmax = 30;
          if (solo && !solo.fini && pos.distanceTo(cible) < 5) { solo.fini = true; etatT = 99; joie = 4; bond = 0; particules.burst(pos, doree, 36, 1.3, true);
            const it = solo.item; dire(tr('Regarde ce que j’ai trouvé : {o} !', { o: it.nom }), { priorite: true, duree: 7000, clic: solo.clic }); solo.surRetour && solo.surRetour(); } }
        break; }
      case 'sieste': cible.copy(solo.v.groupe.position).addScaledVector(_u, 2.1).addScaledVector(_f, -1); raideur = 1.4; vmax = 7; break;   // couchée sur une étoile
      case 'dort': {
        if (couchee) { ndcPoint(maison.x, maison.y - .05, d * .9, cible); raideur = 1.1; vmax = 4; break; }   // couchée : là où elle vit, sous sa couverture
        const e = visiteId && etoiles().get(visiteId.id) ? visiteId : plusProcheEtoile(pos);
        if (e) cible.copy(e.groupe.position).addScaledVector(_u, -2.3).addScaledVector(_f, -1.2); else ndcPoint(-.22, -.38, d * .9, cible); raideur = 1.1; vmax = 4; break; }   // ciel encore vide : elle dort près de toi
    }
    _a.copy(cible).sub(pos).multiplyScalar(raideur); _a.addScaledVector(vel, etat === 'lancee' ? -1.1 : -2.4);
    if (etat === 'flotte' || etat === 'visite' || etat === 'attend' || etat === 'regarde') { _a.x += Math.sin(t * 1.3 + 1) * .6; _a.y += Math.cos(t * 1.1) * .5; _a.z += Math.sin(t * .9) * .5; }
    vel.addScaledVector(_a, dt);
    if (joie > 0 && etat !== 'dort' && etat !== 'tenue' && etat !== 'lancee') { bond -= dt; if (bond <= 0) { vel.addScaledVector(_u, 5.2); bond = rnd(.55, .8); } }       // petits bonds de joie
    const vit = vel.length(); if (vit > vmax) vel.multiplyScalar(vmax / vit);
    pos.addScaledVector(vel, dt);
    return regardCible;
  }

  // ───── mise à jour ─────
  function update(dt, t, ctx) {
    if (!montree || !sauve.visible) { corps.visible = false; if (!bulle.hidden) { bulle.hidden = true; bulle.classList.remove('visible'); } return; }
    apparition = Math.min(1, apparition + dt * .8); if (ctx.H) hVue = ctx.H;
    tProfil += dt; if (tProfil > 4) { tProfil = 0; const r = majProfil(); if (r.retour) { joie = 4; dire('Tu m’avais manqué.', { priorite: true }); } }
    etatT += dt; peur = Math.max(0, peur - dt); joie = Math.max(0, joie - dt); evolue = Math.max(0, evolue - dt); surprise = Math.max(0, surprise - dt); etire = Math.max(0, etire - dt);
    hoche = Math.max(0, hoche - dt); tournis = Math.max(0, tournis - dt); baille = Math.max(0, baille - dt);
    lancee = Math.max(0, lancee - dt); pirouette = Math.max(0, pirouette - dt); rire = Math.max(0, rire - dt); if (ctx.phrases) phrasesCtx = ctx.phrases;
    if (ctx.serie != null) serie = ctx.serie;
    tCouchee += dt; if (tCouchee > 2) { tCouchee = 0; const c = !!jeux.coucheeA && Date.now() - jeux.coucheeA < 14 * 3600e3 && estNuit(new Date().getHours()); if (couchee && !c) { jeux.coucheeA = 0; sauverJeux(); reveil = true; } couchee = c; }   // le matin, elle se réveille
    cacheF += ((cache && performance.now() - cache.t0 > 900 ? 1 : 0) - cacheF) * Math.min(1, dt * 3);
    if (mimique.fin && performance.now() > mimique.fin) mimique = { mood: null, couleur: null };
    const now = performance.now(); if (fx.expr && now > fx.jusqu) fx.expr = null;
    if (ctx.eclair) peur = 4;
    prochainSouvenir -= dt;
    if (prochainSouvenir <= 0 && etat !== 'dort' && !SOLO[etat] && !ctx.occupe && !ctx.ecriture && !souvenir) { prochainSouvenir = rnd(150, 260); lancerSouvenir(); }
    choisirEtat(dt, ctx);
    { // bavardage : de temps en temps, un mot sur la journée, la série, une date qui compte
      chat -= dt;
      if (chat <= 0 && !ctx.ecriture && proposerCache(ctx)) chat = rnd(70, 140);
      if (chat <= 0) { chat = rnd(70, 140); if (!ctx.occupe && !ctx.ecriture && etat !== 'dort' && etat !== 'peur') { const l = (ctx.phrases && ctx.phrases.length && Math.random() < .65) ? ctx.phrases : (ctx.nuit ? ['Les étoiles brillent plus fort la nuit.', 'Chut… écoute le ciel.'] : ['Je me demande ce que tu vas écrire.', 'Tu vois cette étoile ? C’est une journée.', 'Un petit tour ?', 'Je suis bien, ici.']); dire(choix(l), { duree: 4200 }); } }
      const dcam = camera.position.distanceTo(controls.target); const taux = prevD ? Math.abs(Math.log(dcam / prevD)) / Math.max(dt, 1e-3) : 0; prevD = dcam;
      if (taux > 1.3 && performance.now() - zoomWhee > 18000 && etat !== 'dort' && !ctx.ecriture) { zoomWhee = performance.now(); joie = Math.max(joie, 2); surprise = Math.max(surprise, .8); if (Math.random() < .6) dire(choix(['Wouiii !', 'On plonge ?', 'Ça tourne !', 'Haaaa !']), { duree: 1800, priorite: true }); }
    }
    { // le ciel qu'on fait tourner : elle penche dans le sens du mouvement ; trop de tours et elle a le tournis
      _o.copy(camera.position).sub(controls.target); const az = Math.atan2(_o.x, _o.z);
      let da = azPrec === null ? 0 : az - azPrec; if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2; azPrec = az;
      if (!controls.enabled || controls.autoRotate) da = 0;
      vAz += (da / Math.max(dt, 1e-3) - vAz) * Math.min(1, dt * 8);
      tourneAcc = tourneAcc * Math.exp(-dt * .3) + Math.abs(da);
      if (tourneAcc > Math.PI * 2.6 && !tournis && etat !== 'dort') { tournis = 3.6; tourneAcc = 0; surprise = Math.max(surprise, .5); dire(choix(['J’ai le tournis…', 'Ouh là, ça tourne !', 'Tout tourne…']), { priorite: true, duree: 2600 }); }
    }
    const regardCible = viser(dt, t, ctx);
    if (eternue > 0) { const avant = eternue; eternue = Math.max(0, eternue - dt);   // v58 : A… a… atchoum !
      if (avant > .7 && eternue <= .7) { base(); _b.copy(corps.position).addScaledVector(_f, -1.2); particules.burst(_b, coul, 18, 1.2, true); particules.burst(_b, blanc, 10, .9, true); vel.addScaledVector(_u, -4).addScaledVector(_f, 3); surprise = .8; dire('Atchoum !', { priorite: true, duree: 1500 }); } }
    else if ((etat === 'flotte' || etat === 'regarde' || etat === 'attend') && !ctx.ecriture && !ctx.occupe) { prochainEternue -= dt; if (prochainEternue <= 0) { prochainEternue = rnd(150, 320); eternue = 2.2; dire(choix(['A… a…', 'Ah… ah…']), { priorite: true, duree: 1300 }); } }
    const P = persoI(); if (P.couleur) _pc.set(P.couleur);
    coul.lerp(mimique.couleur || (P.couleur ? _pc : coulCible), Math.min(1, dt * (mimique.couleur ? 5 : P.couleur ? 3 : .7)));

    // regard : vers une étoile filante, ce qu'elle visite, le curseur, sinon où elle va
    _p.copy(pos).project(camera);
    let lx = 0, ly = 0;
    const meteor = ctx.meteores && ctx.meteores[0];
    if (meteor) filVue = now; else if (filR && now - filVue > 900) filR = null;
    if (meteor && !filR) filR = reactionFilante(ctx, meteor);                // v58 : plus toujours la même tête : un vœu, la suivre, bouche bée, lui courir après, ou rien
    const fil = meteor && filR ? filR.type : null;
    if (fil === 'court' && forceCible && forceCible.chasse) { _c.copy(meteor).project(camera); ndcPoint(clamp(_c.x, -.9, .9), clamp(_c.y, -.85, .85), camera.position.distanceTo(pos), forceCible.point); _p.copy(pos).project(camera); }
    if (fil === 'suit' || fil === 'bouche' || fil === 'court') { _c.copy(meteor).project(camera); lx = _c.x - _p.x; ly = _c.y - _p.y; }
    else if (tournis > 0) { lx = Math.cos(t * 9); ly = Math.sin(t * 9); }                     // les yeux qui tournent
    else if (etat === 'jongle') { lx = Math.sin(etatT * 3.9) * .35; ly = .7; }   // les yeux suivent les balles
    else if (now - doigt.t < 1800 && etat !== 'dort') { lx = (doigt.x / ctx.W * 2 - 1) - _p.x; ly = (1 - doigt.y / ctx.H * 2) - _p.y; }   // elle regarde là où tu touches
    else if (ctx.ecriture && ctx.rectEcriture) { const r = ctx.rectEcriture; lx = ((r.left + r.width * (.25 + ctx.caret * .5)) / ctx.W * 2 - 1) - _p.x; ly = (1 - (r.top + r.height * .45) / ctx.H * 2) - _p.y; }   // elle se penche sur ton texte
    else if (regardCible) { _c.copy(regardCible).project(camera); lx = _c.x - _p.x; ly = _c.y - _p.y; }
    else if (ctx.curseurActif && etat !== 'dort') { lx = (ctx.curseur.x / ctx.W * 2 - 1) - _p.x; ly = (1 - ctx.curseur.y / ctx.H * 2) - _p.y; }
    else { _c.copy(pos).add(vel).project(camera); lx = (_c.x - _p.x) * 6; ly = (_c.y - _p.y) * 6; }
    const l = Math.hypot(lx, ly) || 1, f = Math.min(1, l * 2.2) / l;
    regard.x += (lx * f - regard.x) * Math.min(1, dt * 7); regard.y += (ly * f - regard.y) * Math.min(1, dt * 7);

    blinkT -= dt; if (blinkT <= 0) { blinkV = .16; blinkT = Math.random() < .2 ? .3 : rnd(1.8, 5); }
    blinkV = Math.max(0, blinkV - dt); const blink = blinkV > 0 ? Math.sin(blinkV / .16 * Math.PI) : 0;

    // expressions : état + humeur imitée + réaction de mot
    const dort = etat === 'dort' || (etat === 'sieste' && etatT > 3.5), seul = profil.seul, imi = mimique.mood, expr = fx.expr;
    let joy = joie > 0 ? 1 : 0, sad = clamp(seul * .9 + (profil.valence < -.4 ? .3 : 0), 0, 1), brow = 0, spark = 0, relax = 0, wide = 0;
    if (!joy && profil.valence > .5 && !seul) joy = .4;
    if (imi === 'joie') joy = Math.max(joy, 1); else if (imi === 'calme') joy = Math.max(joy, .5);        // v26 : calme, les yeux restent ouverts (ils se fermaient pendant toute l'écriture)
    else if (imi === 'elan') { spark = 1; joy = Math.max(joy, .5); }
    else if (imi === 'melancolie') { sad = Math.max(sad, .85); joy = 0; brow = .6; }
    else if (imi === 'tempete') { sad = Math.max(sad, .35); brow = -.7; joy = 0; wide = .4; }
    if (expr === 'joie') joy = 1; else if (expr === 'triste') { sad = .9; joy = 0; brow = .7; } else if (expr === 'leve') { wide = .8; spark = .6; } else if (expr === 'wow') wide = 1;
    if (peur > 0) { wide = 1; brow = .9; sad = .3; joy = 0; spark = 0; }
    if (surprise > 0) wide = Math.max(wide, .7);
    if (tournis > 0) { wide = Math.max(wide, .5); brow = .5; joy = 0; }
    if (tenue && !tournis) { wide = Math.max(wide, .45); joy = Math.max(joy, .6); }                    // v56 : tenue, lancée, fou rire
    if (lancee > 0) { wide = 1; joy = 1; }
    if (rire > 0) { joy = 1; wide = 0; sad = 0; brow = 0; }
    // v58 : filantes et vie en solo
    if (fil === 'voeu') { joy = Math.max(joy, .7); if (Math.random() < dt * 5) particules.burst(_b.copy(corps.position).addScaledVector(_u, 2), doree, 1, .1); }
    else if (fil === 'bouche') { wide = 1; spark = Math.max(spark, .7); joy = 0; }
    else if (fil === 'suit') joy = Math.max(joy, .5);
    else if (fil === 'court') { wide = Math.max(wide, .6); joy = Math.max(joy, .6); }
    const ta = etat === 'croque' && solo && solo.arrive != null ? etatT - solo.arrive : -1, joues = ta > .7 && ta < 2.7, grimace = ta > 1.5 && ta < 3.8;
    if (grimace) { brow = -.7; sad = .35; joy = 0; wide = .3; spark = 0; }
    if (etat === 'planche') { relax = 1; joy = Math.max(joy, .5); }
    if (etat === 'polit' && solo && solo.arrive != null) { joy = Math.max(joy, .6); relax = Math.max(relax, .3); }
    if (etat === 'jongle') { joy = Math.max(joy, .6); spark = Math.max(spark, .3); }
    // v39 : expressions faites avec les traits existants (donc compatibles avec tout : clignement, sommeil, accessoires)
    const repos0 = dort || imi || expr || peur > 0 || surprise > 0 || joie > 0 || calin ? 0 : 1 - sad;
    if (P.expression === 'emerveillee') spark = Math.max(spark, repos0);
    else if (P.expression === 'curieuse') { wide = Math.max(wide, .55 * repos0); spark = Math.max(spark, .35 * repos0); }
    else if (P.expression === 'ensommeillee') relax = Math.max(relax, .4 * repos0);
    const V = vue, k6 = Math.min(1, dt * 6), k12 = Math.min(1, dt * 12);   // v25 : les traits du visage passent vite d'une expression à l'autre (plus de visages superposés en transparence)
    V.joie += (joy - V.joie) * k12; V.triste += (sad - V.triste) * Math.min(1, dt * 3); V.sourcils += (brow - V.sourcils) * k6;
    V.eclat += (spark - V.eclat) * k6; V.calme += (relax - V.calme) * k6; V.grands += (wide - V.grands) * Math.min(1, dt * 9);
    V.sommeil += ((dort ? 1 : fil === 'voeu' ? .92 : baille > .3 ? .8 : eternue > .7 ? .55 : 0) - V.sommeil) * Math.min(1, dt * 2.5);
    V.cligne = blink; V.app = apparition; V.clair = clair ? 1 : 0; V.yeuxEtoiles = yeuxEt; V.perso = P;
    // l'expression choisie, seulement au repos : sommeil, peur, joie, mots, humeur imitée passent devant
    const ie = EXPRESSIONS.indexOf(P.expression), repos = dort || imi || expr || peur > 0 || surprise > 0 || joie > 0 || calin ? 0 : 1 - sad;
    exprV.x += ((rire > 0 ? 1 : ie === 1 ? repos : 0) - exprV.x) * k12; exprV.y += ((ie === 2 ? repos : P.expression === 'ensommeillee' ? .55 * repos : 0) - exprV.y) * k12; exprV.z += ((ie === 3 ? repos : 0) - exprV.z) * k12; exprV.w += ((baille > .3 || fil === 'bouche' || eternue > .7 ? 1 : ie === 4 ? repos : 0) - exprV.w) * k12;   // bâillement : bouche ronde
    const vit = vel.length(); V.battement = Math.sin(t * (dort ? .8 : 7 + vit * .6)) * (dort ? .2 : 1);

    // forme : étirement dans le sens du mouvement, respiration, penchée dans les virages
    base(); const lat = vel.dot(_r);
    const etir = 1 + clamp(vit * .028, 0, .25), resp = 1 + Math.sin(t * (dort ? 1.1 : 2.2)) * .035 * (dort ? 1.6 : 1);
    const ecr = dort ? .93 : 1 + (etire > 0 ? Math.sin(etire / 1.4 * Math.PI) * .22 : 0);
    const sec = rire > 0 ? 1 + Math.sin(t * 26) * .07 : pirouette > 0 ? 1 + Math.sin(pirouette / .9 * Math.PI) * .12 : 1;   // v56 : secouée de rire, étirée pendant la pirouette
    ecraseV.set(resp / Math.sqrt(etir) * (calin ? 1.12 : 1) * (joues ? 1.13 + Math.sin(t * 14) * .025 : 1) * (peur > 0 ? .9 : 1) / Math.sqrt(sec), resp * Math.sqrt(etir) * ecr * (calin ? .9 : 1) * sec);
    const pEcrit = etat === 'ecrit' && ctx.rectEcriture ? clamp(((ctx.rectEcriture.left + ctx.rectEcriture.width / 2) - ecranPos.x) / ctx.W, -1, 1) * -.3 : 0;   // penchée vers le texte
    V.penche += (clamp(-lat * .035 + vAz * .12, -.45, .45) + pEcrit + (tournis > 0 ? Math.sin(t * 6) * .3 * Math.min(1, tournis) : 0) + (peur > 0 ? Math.sin(t * 40) * .06 : 0) + (rire > 0 ? Math.sin(t * 19) * .22 : 0) + (tenue ? Math.sin(t * 11) * .14 : 0) + (etat === 'planche' && solo ? solo.dir * 1.3 * Math.min(1, etatT / 1.2, (SOLO.planche - etatT) / 1) : 0) - V.penche) * Math.min(1, dt * 6);
    lueur.maj(dt, t, V);                                                 // couleur, expressions, regard, ailes, perso (silhouette, matière, articles portés)

    // taille : bien visible, et à peu près constante à l'écran quand elle s'éloigne ou se rapproche (s = « uSize » de la v11 : le corps fait s/4 de rayon)
    const dc = camera.position.distanceTo(pos), ech = clamp(dc / distRef(), .8, 1.5);
    const taille = ECHELLES[profil.stade] * (1 + evolue * .07 * Math.sin(evolue * 6)) * (.4 + .6 * apparition) * (mobile ? .9 : 1);
    petite += ((etat === 'ecrit' ? .5 : 1) - petite) * Math.min(1, dt * 5);   // v28 : clavier ouvert, elle se fait petite dans l'en-tête
    const s = 12 * taille * P.taille * ech * (distRef() / 52) * petite;
    const bob = Math.sin(t * 1.7) * .25 * (dort ? .3 : 1), tr = peur > 0 ? .12 : 0;
    corps.position.copy(pos).addScaledVector(_u, bob).add(_a.set((Math.random() - .5) * tr, (Math.random() - .5) * tr, (Math.random() - .5) * tr));
    corps.scale.setScalar(s * .25 * (1 - cacheF * .97)); corps.visible = cacheF < .97;   // v57 : cachée derrière une étoile
    { const on = etat === 'jongle', R = s * .25;                          // v58 : trois grains de poussière d'étoile qu'elle lance d'un côté à l'autre
      for (let i = 0; i < 3; i++) { const b = balles[i], m = b.material; m.opacity += ((on ? .95 : 0) - m.opacity) * Math.min(1, dt * 5); b.visible = m.opacity > .02; if (!b.visible) continue;
        const ph = etatT * 1.25 + i / 3, j = Math.floor(ph), p = ph - j, sens = j % 2 ? 1 : -1;
        b.position.copy(corps.position).addScaledVector(_r, sens * R * 1.5 * (1 - 2 * p)).addScaledVector(_u, R * (.2 + 8 * p * (1 - p))).addScaledVector(_f, -R * .5); b.scale.setScalar(R * 1.25); m.color.copy(i === 1 ? blanc : doree); } }
    // orientation : face à la caméra, mais elle tourne la tête vers là où elle va et ce qu'elle regarde (trois-quarts, profil en voyage),
    // lacet et tangage doux et bornés (le visage reste lisible) ; elle revient de face à l'arrêt, pendant qu'on écrit, qu'on la règle ou qu'elle dort
    let lc = clamp(lat * .16, -1.2, 1.2) + regard.x * .3, tg = clamp(-vel.dot(_u) * .05, -.35, .35) - regard.y * .2;
    if (dort) { lc *= .25; tg = .2; } else if (etat === 'ecrit' || etat === 'pose' || calin) { lc *= .4; tg *= .5; }
    if (hoche > 0) tg += Math.sin((1 - hoche / .7) * Math.PI * 2) * .4;            // hochement de tête à la fin d'une phrase
    if (baille > 0) tg -= Math.sin(baille / 2.4 * Math.PI) * .25;                  // tête en arrière en bâillant
    if (eternue > .7) tg -= (2.2 - eternue) / 1.5 * .35; else if (eternue > 0) tg += eternue / .7 * .35;   // v58 : l'éternuement
    lacet += (clamp(lc, -1.3, 1.3) - lacet) * Math.min(1, dt * 3); tangage += (clamp(tg, -.45, .45) - tangage) * Math.min(1, dt * 3);
    const tour = pirouette > 0 ? Math.PI * 2 * lisse01(1 - pirouette / .9) : 0;     // v56 : la pirouette, un tour complet sur elle-même
    _m.lookAt(camera.position, corps.position, _u); corps.quaternion.setFromRotationMatrix(_m).multiply(_q.setFromEuler(_e.set(tangage, lacet + tour, 0)));

    // écran : sert au clic, à la bulle
    _p.copy(corps.position).project(camera);
    const pxUnit = ctx.H / (2 * Math.tan(camera.fov * Math.PI / 360) * Math.max(1, dc));
    ecranPos.x = (_p.x + 1) / 2 * ctx.W; ecranPos.y = (1 - _p.y) / 2 * ctx.H; ecranPos.rpx = s * .27 * pxUnit;

    // étincelles : sillage, petits « z » pendant le sommeil, cœurs pendant le câlin
    if (!dort && vit > 4 && Math.random() < dt * (lancee > 0 || etat === 'revient' ? 45 : 14)) particules.burst(corps.position, Math.random() < .5 || !lancee ? coul : blanc, 1, lancee > 0 ? .2 : .12);   // v56 : lancée, une traînée d'étoiles
    if (rire > 0 && Math.random() < dt * 8) particules.burst(corps.position, Math.random() < .5 ? rose : coul, 1, .5);
    if (dort) { zT -= dt; if (zT <= 0) { zT = rnd(1.8, 3); particules.burst(_p.copy(corps.position).addScaledVector(_u, 2.2).addScaledVector(_r, 1.2), blanc, 1, .1); } }
    if (calin && Math.random() < dt * 5) particules.burst(corps.position, rose, 1, .45);
    if (couchee && dort && Math.random() < dt * 12) { const a = rnd(-1.9, 1.9), r = s * .25 * 1.25;   // v57 : sa couverture d'étoiles (un arc doré qui scintille sous elle)
      particules.burst(_p.copy(corps.position).addScaledVector(_r, Math.sin(a) * r).addScaledVector(_u, -Math.cos(a) * r * .8 + r * .15).addScaledVector(_f, -r * .4), Math.random() < .7 ? doree : blanc, 1, .03); }
    // v39 : effets — petites étoiles en orbite, traînée de comète, poudre d'étoiles qui tombe doucement
    if ((P.orbite || amiP() >= 5) && !dort && Math.random() < dt * 9) { const a = t * 2.4 + Math.random() * .4; particules.burst(_p.copy(corps.position).addScaledVector(_r, Math.cos(a) * 2.6).addScaledVector(_u, Math.sin(a) * .7 + .3).addScaledVector(_f, Math.sin(a) * 1.2), Math.random() < .6 ? blanc : coul, 1, .05); }
    if (P.traine && !dort && Math.random() < dt * (vit > 1 ? 30 : 8)) particules.burst(_p.copy(corps.position).addScaledVector(vel, vit > .5 ? -.18 / Math.max(vit, 1) * 6 : 0).addScaledVector(_u, rnd(-.6, .6)).addScaledVector(_r, rnd(-.6, .6)), Math.random() < .5 ? coul : blanc, 1, .15);
    if (P.poudre && !dort && Math.random() < dt * 6) particules.burst(_p.copy(corps.position).addScaledVector(_u, -rnd(1.6, 2.6)).addScaledVector(_r, rnd(-1.4, 1.4)), Math.random() < .7 ? new THREE.Color(1, .86, .5) : blanc, 1, .08);
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

  // ───── v56 : la prendre, la promener, la lancer ; pirouette, fou rire ; ce qu'elle dit quand on la touche ─────
  function faitPirouette() {
    if (pirouette > 0) return; base(); pirouette = .9; vel.addScaledVector(_u, 11); joie = 3.4; bond = .9; surprise = 0;
    particules.burst(corps.position, coul, 26, 1.2, true); dire(choix(['Hop !', 'Tadaa !', 'Une pirouette !', 'Youpi !']), { priorite: true, duree: 1800 });
  }
  function prendre(x, y) {
    if (!montree || sauve.visible === false || etat === 'dort' && Math.random() < .3) return false;   // endormie : parfois elle ne se laisse pas faire
    const now = performance.now(); calin = false; lancee = 0;
    if (couchee) { couchee = false; jeux.coucheeA = 0; sauverJeux(); dire('Hm ? Déjà le matin ?', { priorite: true, duree: 2000 }); ditPrise = now; }   // v57 : la prendre la réveille
    if (cache) return false;
    tenue = { x, y, d: camera.position.distanceTo(pos), hist: [{ x, y, t: now }], tour: 0, ang: null, inv: [], sx: 0 };
    surprise = Math.max(surprise, .6); joie = Math.max(joie, 1.5); particules.burst(corps.position, coul, 10, .6);
    if (now - ditPrise > 6000) { ditPrise = now; dire(choix(['Wiii !', 'Où on va ?', 'Hé, doucement !', 'Je vole !']), { priorite: true, duree: 1600 }); }
    return true;
  }
  function tirer(x, y) {
    if (!tenue) return; const now = performance.now(), dx = x - tenue.x, dy = y - tenue.y; tenue.x = x; tenue.y = y; doigt = { x, y, t: now };
    const h = tenue.hist; h.push({ x, y, t: now }); while (h.length > 2 && now - h[0].t > 160) h.shift();
    if (Math.hypot(dx, dy) < 3) return;
    // tourner en rond : on additionne les virages (un demi-tour brusque, c'est un aller-retour, pas un virage)
    const a = Math.atan2(dy, dx); if (tenue.ang !== null) { let da = a - tenue.ang; if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2; if (Math.abs(da) < 2.2) tenue.tour += da; } tenue.ang = a;
    tenue.tour *= .995;
    if (Math.abs(tenue.tour) > Math.PI * 3.2 && !tournis) { tenue.tour = 0; tournis = 3.6; surprise = Math.max(surprise, .5); dire(choix(['J’ai le tournis…', 'Ouh là, ça tourne !', 'Tout tourne…']), { priorite: true, duree: 2600 }); }
    // frotter vite : des allers-retours rapprochés
    const sx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : Math.sign(dy) * 2;
    if (tenue.sx && sx === -tenue.sx) tenue.inv.push(now); tenue.sx = sx; tenue.inv = tenue.inv.filter(t0 => now - t0 < 1300);
    if (tenue.inv.length >= 5 && now > rireLibre && !tournis) { tenue.inv = []; rire = 2.4; rireLibre = now + 4500; joie = 3; dire(choix(['Hahaha ! Arrête !', 'Hihihi, ça chatouille !', 'Hahaha !']), { priorite: true, duree: 2200 }); }
  }
  function lacher(W = innerWidth, H = hVue) {
    if (!tenue) return; const h = tenue.hist, a = h[0], b = h[h.length - 1], dt = Math.max(.016, (b.t - a.t) / 1000);
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, v = Math.hypot(vx, vy), d = tenue.d; tenue = null;
    if (performance.now() - b.t < 120 && v > 900) {                    // un geste vif : elle file, puis revient
      base(); const k = 2 * Math.tan(camera.fov * Math.PI / 360) * d / H * .9;
      vel.copy(_r).multiplyScalar(vx * k).addScaledVector(_u, -vy * k); const vit = vel.length(); if (vit > 150) vel.multiplyScalar(150 / vit);
      lancee = 1.3; revenue = false; dire(choix(['Wiiiii !', 'Aaaah !', 'Je vooole !']), { priorite: true, duree: 1400 }); return;
    }
    maison.x = clamp(b.x / W * 2 - 1, -.82, .82); maison.y = clamp(1 - b.y / H * 2, -.68, .72);   // posée doucement : elle reste là
    etat = 'flotte'; etatT = 0; prochainChangement = rnd(25, 40); vel.multiplyScalar(.3); joie = Math.max(joie, 1.5); poseeJusqu = performance.now() + 15000;
    if (Math.random() < .7) dire(choix(['Ici, c’est bien.', 'Je reste là.', 'Merci pour la balade !']), { priorite: true, duree: 2200 });
  }
  // ───── v57 : bonjour, attraper une filante, aller voir un endroit, cache-cache ─────
  const cleJour = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function bonjour() {
    const h = new Date().getHours(); if (h < 5 || h >= 14 || jeux.bonjour === cleJour()) return false;
    jeux.bonjour = cleJour(); sauverJeux(); joie = 4; etire = 1.4; particules.burst(corps.position, doree, 24, 1.1, true);
    dire(serie >= 2 ? t('Bonjour ! {n} jours d’affilée, on continue ?', { n: serie }) : serie === 1 ? 'Bonjour ! Hier, tu as écrit. On recommence ?' : 'Bonjour ! Une nouvelle journée commence.', { priorite: true, duree: 4200 });
    return true;
  }
  function attraper(x, y, surPrise) {
    if (!montree || sauve.visible === false || cache || tenue) return false;
    if (etat === 'dort') { dire('Zzz… pas maintenant…', { priorite: true, duree: 1800 }); return false; }
    base(); const p = ndcPoint(x / innerWidth * 2 - 1, 1 - y / hVue * 2, camera.position.distanceTo(pos), new THREE.Vector3());
    particules.burst(p, doree, 16, .7, true); surprise = .8; souvenir = null;
    forceCible = { point: p, vite: true, jusqu: performance.now() + 3500, surArrivee: () => {
      particules.burst(p, doree, 34, 1.4, true); joie = 4; bond = 0; jeux.attrapes = (jeux.attrapes || 0) + 1; sauverJeux();
      dire(choix(['Attrapée !', 'Je l’ai !', 'Elle est toute chaude !', 'Un vœu pour toi !']), { priorite: true, duree: 2400 }); surPrise && surPrise(); } };
    return true;
  }
  function allerIci(x, y, e) {
    if (!montree || sauve.visible === false || cache || tenue) return false;
    if (etat === 'dort') { dire(couchee ? 'Zzz… demain…' : 'Mmh… plus tard…', { priorite: true, duree: 1800 }); return false; }
    if (e && e.text) { dire(choix(['Oh, cette étoile-là ?', 'Je vais voir !']), { priorite: true, duree: 1600 }); setTimeout(() => { prochainSouvenir = rnd(70, 130); demarrerSouvenir(e); }, 700); return true; }
    base(); const nx = clamp(x / innerWidth * 2 - 1, -.82, .82), ny = clamp(1 - y / hVue * 2, -.68, .72), p = ndcPoint(nx, ny, distRef(), new THREE.Vector3());
    dire(choix(['J’arrive !', 'Là-bas ?', 'On va voir !']), { priorite: true, duree: 1400 });
    forceCible = { point: p, jusqu: performance.now() + 6000, surArrivee: () => { maison.x = nx; maison.y = ny; poseeJusqu = performance.now() + 15000;
      dire(choix(['Rien ici… juste du ciel.', 'C’est joli, par ici.', 'Un jour, il y aura une étoile ici.', 'Je reste un peu là.']), { priorite: true, duree: 2600 }); } };
    return true;
  }
  function proposerCache({ force = false, occupe } = {}) {          // elle propose de jouer : la bulle se touche
    const now = performance.now(); if (!jouer || cache || couchee || etat === 'dort' || occupe || now - proposeCache < (force ? 60000 : 240000) || etoiles().size < 3) return false;
    if (!force && Math.random() < .7) return false;
    proposeCache = now; dire('On joue à cache-cache ? Touche ici.', { priorite: true, duree: 7000, clic: () => jouer('cache') }); return true;
  }
  function seCacher(id) {
    if (!montree || cache) return false; calin = false; tenue = null; souvenir = null; forceCible = null;
    dire('Compte jusqu’à trois… je me cache !', { priorite: true, duree: 1100 }); cache = { id, t0: performance.now() }; joie = 3; return true;
  }
  function sortir(trouvee) {
    if (!cache) return; const v = etoiles().get(cache.id); cache = null; cacheF = Math.min(cacheF, .99);
    if (v) { pos.copy(v.groupe.position).addScaledVector(_f, -2); particules.burst(v.groupe.position, doree, 30, 1.3, true); v.pulse = Math.max(v.pulse, 1); }
    joie = 4; bond = 0; etire = 1.4;
    dire(trouvee ? choix(['Trouvée !', 'Zut, tu m’as eue !', 'Bravo, j’étais là !']) : 'Coucou ! J’étais là, tu ne m’as pas trouvée.', { priorite: true, duree: 2800 });
  }

  function phraseToucher() {
    const P = persoI(), h = new Date().getHours(), auj = new Date().toDateString(), l = [];
    if (h >= 5 && h < 10) l.push('Bonjour ! Bien dormi ?', 'Le ciel se réveille doucement.');
    else if (h >= 11 && h < 14) l.push('C’est l’heure de manger, non ?');
    else if (h >= 18 && h < 23) l.push('Comment s’est passée ta journée ?', 'La nuit tombe, les étoiles arrivent.');
    else if (h >= 23 || h < 5) l.push('Il est tard…', 'Tu ne dors pas ?', '*bâille*');
    l.push(entrees().some(e => new Date(e.date).toDateString() === auj) ? 'Ton étoile d’aujourd’hui brille bien.' : choix(['Tu me racontes ta journée ?', 'Une étoile pour aujourd’hui ?']));
    const acc = { 1: 'Mon anneau brille, non ?', 2: 'Mon antenne capte les étoiles.', 3: 'Je vois tout, avec ces lunettes.', 4: 'Je suis la reine des étoiles.', 5: 'Abracadabra !',
      6: 'Je suis une petite planète !', 7: 'Ma lune me tient compagnie.', 8: 'Bip bip.', 9: 'Ma comète me suit partout.', 10: 'Tu as vu mon croissant ?' }[P.acc];
    const tex = { nacre: 'Je brille comme une perle.', givre: 'Brr, j’ai un peu froid.', paillettes: 'Je pétille !', nebuleuse: 'Ça tourbillonne en moi.', aurore: 'J’ai des aurores plein le cœur.',
      cosmos: 'Il fait nuit, à l’intérieur de moi.', soleil: 'Je chauffe un peu, attention.', galaxie: 'J’ai toute une galaxie dans le ventre.', lune: 'Je suis faite de pierre de lune.' }[P.texture];
    const forme = { chat: 'Miaou !', fantome: 'Bouh ! … Je t’ai fait peur ?', coeur: '♥ ♥ ♥', etoile: 'Je suis une vraie étoile.', comete: 'Je file comme une comète !' }[P.forme];
    [acc, tex, forme].forEach(x => { if (x) l.push(x, x); });           // ce qu'elle porte revient plus souvent
    if (sauve.nom) l.push(t('Oui, c’est moi, {nom} !', { nom: sauve.nom }));
    { const p = prenom(); if (p) l.push(t('Coucou {p} !', { p }), t('{p} ! Je pensais à toi.', { p }), t('Tu sais quoi, {p} ? Je suis bien avec toi.', { p })); }   // v59 : ton prénom
    l.push(...phrasesCtx);                                               // la série, une date qui approche, la saison
    const n = sauve.caresses || 0; if (n > 0 && n % 25 === 0) return t('{n} caresses ! Je les compte, tu sais.', { n });
    const gen = ['Hihi.', 'Encore !', 'Mmh…', 'Oh, ça chatouille !', '♥', 'Coucou !', 'Tu m’as trouvée !', 'Je suis contente de te voir.', 'On fait un tour ?', 'Je t’aime bien.',
      'Tu peux me prendre et me promener, tu sais.', 'Touche-moi deux fois, pour voir.', 'Frotte-moi vite, pour voir…',
      'Touche deux fois le ciel, j’irai voir.', estNuit(new Date().getHours()) ? 'Un long câlin, et je vais au lit.' : 'Touche une étoile filante, je l’attrape !'];
    const liste = Math.random() < .55 ? l : gen; let p = choix(liste);
    for (let k = 0; k < 6 && recentes.includes(p); k++) p = choix(Math.random() < .5 ? l : gen);   // pas les mêmes phrases coup sur coup
    recentes.push(p); if (recentes.length > 5) recentes.shift(); return p;
  }

  // ───── souvenirs : elle va près d'une ancienne étoile et la lit ─────
  function lancerSouvenir() {
    const liste = entrees(); if (liste.length < 2) return;
    const now = Date.now(), cand = liste.map(e => { const p = posEtoile(e.id); return p ? { e, s: proj(p) } : null; }).filter(c => c && c.s.vu && c.s.x > 90 && c.s.x < innerWidth - 90 && c.s.y > 110 && c.s.y < innerHeight - 200);
    if (!cand.length) { prochainSouvenir = 20; return; }
    cand.forEach(c => { c.p = (1 + Math.min(120, (now - (c.e.touched || c.e.date)) / 86400000)) * rnd(.5, 1.5); });
    demarrerSouvenir(cand.sort((a, b) => b.p - a.p)[0].e);
  }
  // v68 : un commentaire sur ce que tu as écrit (personnes, lieux, mots, humeur), plutôt que de relire ta phrase : tu écris de toi à toi
  function commentaire(e, quand) {
    const tx = e.text || '', l = [], noms = [...tx.matchAll(/(^|[^\p{L}\d_])([@#])([\p{L}\d_-]{2,30})/gu)].map(m => [m[2], m[3]]);
    const p = noms.find(x => x[0] === '@'), lieu = noms.find(x => x[0] === '#');
    if (p) l.push(t('Tu parlais de {n} ici. Ça m’a fait sourire.', { n: p[1] }), t('{n} était là ce jour-là.', { n: p[1] }), t('J’aime bien quand tu parles de {n}.', { n: p[1] }));
    if (lieu) l.push(t('{n}… tu y retournes bientôt ?', { n: lieu[1] }), t('Ah, {n}. Je m’en souviens.', { n: lieu[1] }));
    const mots = tx.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/);
    const r = LEXIQUE.find(x => mots.some(m => x.re.test(m)));
    if (r && r.expr === 'joie') l.push(t('Il y avait de la joie dans cette étoile.'), t('Cette note sent le bonheur.'));
    if (r && r.expr === 'triste') l.push(t('Ce jour-là pesait un peu. Regarde le chemin depuis.'), t('Tu as traversé ça. Je suis fière de toi.'));
    if (r && (r.expr === 'leve' || r.expr === 'wow')) l.push(t('Il y avait du ciel dans ce que tu as écrit.'));
    const hum = { joie: [t('Quelle belle journée c’était !'), t('Cette étoile brille plus que les autres, non ?')], calme: [t('Une journée douce. J’aime bien cette étoile.'), t('Elle est paisible, celle-là.')],
      elan: [t('Tu avais plein d’énergie ce jour-là !'), t('Celle-ci pétille encore.')], melancolie: [t('Une étoile un peu bleue. Elle compte aussi.'), t('Même les jours gris font de belles étoiles.')],
      tempete: [t('Un jour d’orage… et pourtant, elle brille.'), t('Tu as tenu bon ce jour-là.')] }[e.mood] || [t('Je tourne autour de tes souvenirs.')];
    l.push(...hum);
    if (tx.length > 500) l.push(t('Tu avais beaucoup à dire ce jour-là.'));
    const c = choix(l); return quand ? quand.charAt(0).toUpperCase() + quand.slice(1) + '… ' + c : c;
  }
  function demarrerSouvenir(e, quandImpose = null) {   // v45 : quandImpose (« Il y a un an, ce jour-là ») pour l'anniversaire d'une étoile
    souvenir = { id: e.id, fin: performance.now() + 15000, arrive() {
      const jours = Math.round((Date.now() - e.date) / 86400000), quand = quandImpose || (jours <= 0 ? t('aujourd’hui') : jours === 1 ? t('hier') : t('il y a {n} jours', { n: jours }));
      const brut = e.text.replace(/^ *(-{3,}|—+) *$/gm, '').replace(/^(#{1,4}|[-•*]|\d+\.|>) +/gm, '').replace(/\s+/g, ' ').trim(), court = brut.length > 78 ? brut.slice(0, 76).replace(/\s+\S*$/, '') + '…' : brut;
      fx = { expr: { joie: 'joie', melancolie: 'triste', tempete: 'wow', elan: 'leve', calme: null }[e.mood] || null, jusqu: performance.now() + 5000 };
      dire(commentaire(e, quandImpose ? quand : null), { duree: 6500, priorite: true, clic: () => ouvrirPensee(e.id) });
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
    souvenirDe(e, quand) { if (!e || !e.text) return false; prochainSouvenir = rnd(70, 130); demarrerSouvenir(e, quand); return true; },
    montrer() { if (montree) return; montree = true; apparition = 0; majProfil(true); base(); ndcPoint(0, .05, distRef(), pos); vel.set(0, 0, 0);   // elle naît devant toi, où que regarde la caméra
      particules.burst(pos, new THREE.Color(1, .95, .8), 40, 2.6, true); },
    nom: () => sauve.nom || '', renommer(n) { sauve.nom = (n || '').trim().slice(0, 18) || t('Lueur'); sauver(sauve); dire(t('Bonjour ! Moi, c’est {nom}.', { nom: sauve.nom }), { priorite: true, duree: 4500 }); },
    visible: () => sauve.visible !== false, basculer() { sauve.visible = !(sauve.visible !== false); sauver(sauve); return sauve.visible; },
    // la lueur est-elle sous le pointeur ? (cercle autour du corps, en pixels)
    touche(x, y) { if (!montree || !sauve.visible || cache) return false; const r = Math.max(34, ecranPos.rpx * 1.25); return (x - ecranPos.x) ** 2 + (y - ecranPos.y) ** 2 < r * r; },
    caresse() {
      const now = performance.now();
      if (couchee && etat === 'dort') { particules.burst(corps.position, doree, 6, .3); dire(choix(['Zzz…', 'Encore cinq minutes…', 'Mmh… bonne nuit…']), { priorite: true, duree: 2000 }); return; }   // v57 : couchée, elle dort
      if (etat === 'sieste' && etatT > 3.5 && solo) { solo.reveillee = true; etatT = 99; etire = 1.4; dire(choix(['Oh ! Je faisais la sieste.', 'Hm ? J’étais bien, là…']), { priorite: true, duree: 2000 }); return; }   // v58
      if (etat !== 'ecrit' && now - derniereCaresse < 450) { derniereCaresse = 0; faitPirouette(); return; }   // v56 : deux tapes, une pirouette
      derniereCaresse = now;
      sauve.caresses = (sauve.caresses || 0) + 1; sauver(sauve); bond = 0; particules.burst(corps.position, rose, 12, .7);
      if (etat === 'ecrit') {   // v33 : touchée pendant qu'on écrit, elle réagit de plusieurs façons
        const r = Math.random();
        if (r < .3) { surprise = 1.2; vel.addScaledVector(_u, 5); dire(choix(['Oh !', 'Hé, je lisais !', 'Tu m’as surprise !']), { priorite: true, duree: 2000 }); }
        else if (r < .55) { etire = 1.4; dire(choix(['Mmh… continue.', 'Je suis là.', 'Prends ton temps.']), { priorite: true, duree: 2200 }); }
        else { joie = 3.4; surprise = 0; dire(choix(['Hihi.', 'Ça chatouille !', '♥', 'J’aime bien te lire.']), { priorite: true, duree: 2200 }); }
        return;
      }
      joie = 3.4; surprise = 0;
      if (bonjour()) return;
      if (amiP() >= 2 && Math.random() < .25) { particules.burst(corps.position, rose, 22, .9, true); const p = prenom();   // v59 : complices, des bisous
        dire(choix(['Bisou !', '♥ Smack !', p ? t('Je t’aime fort, {p}.', { p }) : 'Je t’aime fort.', p ? t('Tu es mon étoile préférée, {p}.', { p }) : 'Tu es mon étoile préférée.']), { priorite: true, duree: 2400 }); return; }                                             // v57 : le premier toucher du matin
      if (Math.random() < .15 && proposerCache({ force: true })) return;
      const ph = phraseToucher(); dire(ph, { priorite: true, duree: Math.max(2200, ph.length * 70) });
    },
    prendre, tirer, lacher, tenue: () => !!tenue,
    chercher(item, clic, surRetour) { if (!montree || !sauve.visible) return false; chercheDemande = { item, clic, surRetour }; return true; },   // v59
    ecran: () => proj(corps.position),   // v61 : où elle est à l'écran (pour l'animation de la trouvaille)
    occupee: () => etat === 'cherche' || !!chercheDemande || !!cache || !!tenue,
    consoler(texte) { if (!montree || etat === 'dort' || cache) return; base(); const p = ndcPoint(0, -.42, distRef() * .75, new THREE.Vector3());   // v59 : un jour triste, elle vient tout près
      forceCible = { point: p, vite: true, jusqu: performance.now() + 4000, surArrivee: () => { calin = true; setTimeout(() => { calin = false; }, 4500); dire(texte, { priorite: true, duree: 4800 }); } }; },
    forcerSolo: n => { animSuivante = n; etat = 'flotte'; etatT = 999; }, eternuer: () => { eternue = 2.2; },   // v58 : pour les tests
    attraper, allerIci, seCacher, sortir, cachee: () => cache ? cache.id : null, couchee: () => couchee,
    calin(actif, discret = false) { calin = actif;
      if (!actif && etat === 'calin' && !discret && estNuit(new Date().getHours())) {   // v57 : le soir, un câlin la met au lit
        jeux.coucheeA = Date.now(); sauverJeux(); couchee = true; tCouchee = 0; etat = 'dort'; etatT = 0; joie = 0; particules.burst(corps.position, doree, 30, 1, true);
        dire(choix(['Bonne nuit… à demain.', 'Dors bien, moi aussi…', 'Bonne nuit, je garde tes étoiles.']), { priorite: true, duree: 3200 }); return; }
      if (!actif && etat === 'calin' && !discret) { joie = 4; particules.burst(corps.position, rose, 26, 1.3, true); dire('Merci.', { priorite: true, duree: 2200 }); } },
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
      if (/[\p{L}\d)»”"][.!?…]\s?$/u.test(texte.slice(0, curseur)) && hoche <= 0) hoche = .7;   // une phrase finie : elle hoche la tête
      const m = texte.slice(0, curseur).match(/([\p{L}’'-]{3,})[\s.,;:!?…]$/u);                    // un mot vient d'être terminé
      if (m) { const mot = norm(m[1]); const r = LEXIQUE.find(x => x.re.test(mot)); if (r) { fx = { expr: r.expr, jusqu: performance.now() + 2800 }; if (bullesEcriture < 4 && dire(choix(r.dit), { duree: 2800 })) bullesEcriture++; } }
      const n = texte.slice(0, curseur).match(/(?:^|[^\p{L}\d_])([@#])([\p{L}\d_-]{2,30})[\s.,;:!?…]$/u);   // v61 : un @nom ou un #lieu vient d'être écrit
      if (n && bullesEcriture < 6 && dire(n[1] === '@' ? choix([tr('Ah, {n} !', { n: n[2] }), tr('Coucou {n} !', { n: n[2] }), tr('Je me souviendrai de {n}.', { n: n[2] })]) : choix([tr('{n}, je note.', { n: n[2] }), tr('J’aimerais voir {n}.', { n: n[2] }), tr('Ah, à {n} ?', { n: n[2] })]), { duree: 2600 })) { bullesEcriture++; hoche = .7; }
      if (texte.length > 240 && !longDit) { longDit = true; dire('Tu as beaucoup à dire…', { duree: 3000 }); }
    },
    allerVers(point, duree = 6500, surArrivee = null) { forceCible = { point: point.clone(), jusqu: performance.now() + duree, surArrivee }; },   // v49 : l'étape du voyage
    guider(txt) { dire(txt, { priorite: true, duree: 9000 }); },   // v36 : le tutoriel lui fait expliquer la première note
    patiente() { if (!patienceDite) { patienceDite = true; dire('Prends ton temps.', { duree: 3200 }); } },
    imiter(mood, couleur, duree = 0) {
      const change = mood && mood !== mimique.mood;
      mimique = mood ? { mood, couleur: couleur ? new THREE.Color(couleur) : null, fin: duree ? performance.now() + duree : 0 } : { mood: null, couleur: null };
      if (change && montree) { particules.burst(corps.position, mimique.couleur || coul, 14, .9, true); bond = 0; if (mood === 'joie' || mood === 'elan') joie = Math.max(joie, 1.2); else etire = 1.4; }   // elle prend l'humeur aussitôt, avec un petit éclat
    },
    // le doigt (ou la souris) touche l'écran : elle regarde, et sursaute si on tape vite plusieurs fois
    toucher(x, y) {
      const now = performance.now(); doigt = { x, y, t: now }; tapes = tapes.filter(t0 => now - t0 < 1100); tapes.push(now);
      if (tapes.length >= 3 && now - dernierSursaut > 4000 && montree && etat !== 'dort') { dernierSursaut = now; tapes = []; base(); vel.addScaledVector(_u, 9); surprise = 1.6; dire(choix(['Oh !', 'Hé !', 'Doucement !', 'Tu m’as fait peur !']), { priorite: true, duree: 1600 }); }
    },
    // une pensée vient d'être enregistrée : un bond de joie tout de suite
    enregistre(parle = true) { joie = Math.max(joie, 4); bond = 0; etire = 1.4; base(); vel.addScaledVector(_u, 7); if (montree) particules.burst(corps.position, coul, 22, 1.2, true);
      if (parle) dire(choix(['Ah, d’accord !', 'Ah oui, je vois…', 'Merci de me l’avoir confié.', 'Je garde ça précieusement.', 'Oh ! Quelle journée.']), { priorite: true, duree: 2600 }); },   // v33 : elle réagit à la note qu'on vient de finir

    finEcriture() { mimique = { mood: null, couleur: null }; },
    regler(c) { clair = c; },
    etat: () => ({ etat, stade: profil.stade, jours: profil.jours, seul: profil.seul, caresses: sauve.caresses, nom: sauve.nom, pos: pos.toArray().map(x => Math.round(x * 10) / 10), ecran: [Math.round(ecranPos.x), Math.round(ecranPos.y)] }),
  };
}
