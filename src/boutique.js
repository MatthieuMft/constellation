// Le panneau « Boutique » : tout ce que la poussière d'étoiles (✦) débloque, en deux onglets, « Ta lueur » et « Ton ciel ».
// Une section par groupe du catalogue (etoiles.js), une carte par article, avec sa vignette dessinée en lumière, sans aplat.
// Un toucher achète (et porte, ou allume) ; un objet à toi se porte / se retire, s'allume / s'éteint, ou ouvre son réglage.
// (Les paliers du ciel ne sont plus listés ici : ils s'annoncent d'eux-mêmes quand ils arrivent.)
//
// API : const boutique = monterBoutique(zone, ctx) → { ouvrir(onglet = 'lueur', cleMiseEnAvant?), fermer(), rendre(), ouvert() }
//   ouvrir('ciel') ouvre l'onglet du ciel ; ouvrir(_, 'lune') ouvre l'onglet de l'article, fait défiler jusqu'à lui et le fait briller.
//   ctx = { surChange(cle, actif), surAchat(cle), equipe(article) → bool, equiper(article, oui), ouvrirReglage(article) }
//     equipe / equiper : pour les choix (porté ou non ; oui = false revient au défaut gratuit) et les interrupteurs de la lueur
//     (source 'perso' : ailes, bras, pieds, étincelles) ; etoiles.patch(article, oui) donne le patch à appliquer.
//     surChange : après tout changement (achat, choix, interrupteur) ; surAchat : juste après un achat (toast, effet).
//     ouvrirReglage : un article « reglage » à toi a été touché (ouvrir « Personnaliser ma lueur » ou « … mon ciel » sur lui).
//     apercu(canvas) (facultatif) : dessine la lueur telle qu'elle est maintenant (aperçu fixe en haut de l'onglet « Ta lueur »)
//     vignette3D(canvas, o) (facultatif) : les articles de la lueur montrent la vraie lueur 3D qui les porte (creature.vignette, voir LUEUR3D) ;
//     sans lui, les anciennes vignettes dessinées en 2D.
import { t } from './langue.js';
import * as E from './etoiles.js';
import { THEMES } from './themes.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : k.startsWith('aria-') && typeof v === 'boolean' ? n.setAttribute(k, String(v)) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};

// ───────── vignettes : des points de lumière doux (dégradés radiaux, mode additif), jamais de contour ni d'aplat ─────────
const TAU = Math.PI * 2;
const sprites = {};
function sprite(c, coeur = true) {                   // c : '#rrggbb' ; coeur : un point blanc au centre (une étoile), sinon un voile
  const k = c + coeur; if (sprites[k]) return sprites[k];
  const s = 64, e = document.createElement('canvas'); e.width = e.height = s; const x = e.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  if (coeur) { g.addColorStop(0, '#fff'); g.addColorStop(.12, c); g.addColorStop(.4, c + '55'); g.addColorStop(1, c + '00'); }
  else { g.addColorStop(0, c + 'cc'); g.addColorStop(.35, c + '66'); g.addColorStop(.7, c + '1a'); g.addColorStop(1, c + '00'); }
  x.fillStyle = g; x.fillRect(0, 0, s, s); return sprites[k] = e;
}
const point = (x, c, px, py, r, a = 1) => { x.globalAlpha = a; x.drawImage(sprite(c), px - r, py - r, 2 * r, 2 * r); x.globalAlpha = 1; };
const voile = (x, c, px, py, r, a = 1) => { x.globalAlpha = a; x.drawImage(sprite(c, false), px - r, py - r, 2 * r, 2 * r); x.globalAlpha = 1; };
const graine = s => () => (s = s * 16807 % 2147483647) / 2147483647;
const add = x => { x.globalCompositeOperation = 'lighter'; }, normal = x => { x.globalCompositeOperation = 'source-over'; };
function fond(x, n = 14, s = 7, c = '#dfe8ff') { const r = graine(s); add(x); for (let i = 0; i < n; i++) point(x, c, 6 + r() * 148, 6 + r() * 148, 1.5 + r() * 2.5, .2 + r() * .45); }
function trait(x, x0, y0, x1, y1, c, w, a = 1, fondu = true) {             // un trait de lumière qui s'éteint vers (x1, y1)
  const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c); g.addColorStop(1, fondu ? c + '00' : c);
  x.globalAlpha = a; x.strokeStyle = g; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.globalAlpha = 1;
}
function branches(x, px, py, l, c, a = 1) {           // la croix fine d'une étoile brillante
  for (const [dx, dy] of [[1, 0], [0, 1]]) { const g = x.createLinearGradient(px - dx * l, py - dy * l, px + dx * l, py + dy * l);
    g.addColorStop(0, c + '00'); g.addColorStop(.5, c); g.addColorStop(1, c + '00'); x.globalAlpha = a; x.fillStyle = g;
    x.fillRect(px - (dx ? l : .7), py - (dy ? l : .7), dx ? 2 * l : 1.4, dy ? 2 * l : 1.4); } x.globalAlpha = 1;
}
function scintille(x, px, py, r, c = '#ffffff', a = 1) {   // ✦ : quatre branches effilées et un cœur doux
  x.globalAlpha = a; x.fillStyle = c; x.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * .2 : r, an = i * Math.PI / 4 - Math.PI / 2; x.lineTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr); }
  x.fill(); x.globalAlpha = 1; point(x, c, px, py, r * .8, .7 * a);
}
function etoile5(x, px, py, r, c, a = 1) {           // une petite étoile à cinq branches, bords adoucis par sa propre lueur
  x.save(); x.globalAlpha = a; x.shadowColor = c; x.shadowBlur = r * 1.6; x.fillStyle = c; x.lineJoin = 'round'; x.strokeStyle = c; x.lineWidth = r * .28; x.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .45 : r, an = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr); }
  x.closePath(); x.fill(); x.stroke(); x.restore();
}
function sphere(x, cx, cy, R, c0, c1, c2) {           // un astre éclairé d'en haut à gauche
  const g = x.createRadialGradient(cx - R * .4, cy - R * .45, R * .05, cx, cy, R); g.addColorStop(0, c0); g.addColorStop(.55, c1); g.addColorStop(1, c2);
  x.save(); x.shadowColor = c1; x.shadowBlur = R * .5; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill(); x.restore();
}

// ── la lueur en miniature : une silhouette en dégradé lumineux, un visage, et ce qu'on lui ajoute ──
const COUL = { lisse: ['#fffaf0', '#ffe2a8', '#ffb86b'], nacre: ['#ffffff', '#f6effc', '#cdbfe6'], givre: ['#f6feff', '#c6ecff', '#86c8ee'],
  paillettes: ['#fffaf0', '#ffe2a8', '#ffb86b'], nebuleuse: ['#efe6ff', '#9076f0', '#33267e'], rose: ['#fff3f8', '#ffb8d4', '#ff7eaa'] };
function silhouette(forme, cx, cy, R) {
  const p = new Path2D();
  if (forme === 'chat') {
    p.arc(cx, cy, R, 0, TAU);
    for (const s of [-1, 1]) {
      const a1 = -Math.PI / 2 + s * .3, a2 = -Math.PI / 2 + s * 1.08, b1 = [cx + Math.cos(a1) * R * .95, cy + Math.sin(a1) * R * .95], b2 = [cx + Math.cos(a2) * R * .95, cy + Math.sin(a2) * R * .95];
      const [d, f] = s > 0 ? [b1, b2] : [b2, b1];
      p.moveTo(...d); p.quadraticCurveTo(cx + s * R * 1.05, cy - R * 1.95, ...f); p.closePath();
    }
  } else if (forme === 'fantome') {
    p.moveTo(cx - R, cy); p.arc(cx, cy, R, Math.PI, 0); p.lineTo(cx + R, cy + R * .75);
    const w = 2 * R / 3; for (let i = 0; i < 3; i++) { const x0 = cx + R - i * w; p.quadraticCurveTo(x0 - w / 2, cy + R * 1.35, x0 - w, cy + R * .75); }
    p.closePath();
  } else if (forme === 'coeur') {
    p.moveTo(cx, cy + R * 1.05);
    p.bezierCurveTo(cx - R * .4, cy + R * .72, cx - R * 1.3, cy + R * .2, cx - R * 1.2, cy - R * .38);
    p.bezierCurveTo(cx - R * 1.1, cy - R * 1.05, cx - R * .25, cy - R * 1.15, cx, cy - R * .55);
    p.bezierCurveTo(cx + R * .25, cy - R * 1.15, cx + R * 1.1, cy - R * 1.05, cx + R * 1.2, cy - R * .38);
    p.bezierCurveTo(cx + R * 1.3, cy + R * .2, cx + R * .4, cy + R * .72, cx, cy + R * 1.05); p.closePath();
  } else if (forme === 'etoile') {
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? R * .6 : R * 1.12, an = -Math.PI / 2 + i * Math.PI / 5; i ? p.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr) : p.moveTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); }
    p.closePath();
  } else p.arc(cx, cy, R, 0, TAU);
  return p;
}
function corps(x, p, g, forme) {
  const { cx, cy, R, c } = g, d = x.createRadialGradient(cx - R * .35, cy - R * .42, R * .08, cx, cy, R * 1.25);
  d.addColorStop(0, c[0]); d.addColorStop(.5, c[1]); d.addColorStop(1, c[2]);
  x.save(); normal(x); x.shadowColor = c[1]; x.shadowBlur = R * .7; x.fillStyle = d; x.fill(p);
  if (forme === 'etoile') { x.lineJoin = 'round'; x.lineWidth = R * .36; x.strokeStyle = d; x.stroke(p); }
  x.restore();
}
function matiere(x, p, tex, { cx, cy, R }) {
  const r = graine(11); x.save(); x.clip(p);
  if (tex === 'nacre') {
    const g = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ['#ffbfe9', '#bdf3ff', '#dccaff', '#fff0bd', '#bfffe9'].forEach((c, i, l) => g.addColorStop(i / (l.length - 1), c));
    x.globalAlpha = .6; x.fillStyle = g; x.fillRect(cx - R * 1.4, cy - R * 1.4, R * 2.8, R * 2.8); x.globalAlpha = 1;
    add(x); voile(x, '#ffffff', cx - R * .35, cy - R * .45, R * .7, .8); voile(x, '#bdf3ff', cx + R * .5, cy + R * .45, R * .6, .5);
  } else if (tex === 'givre') {
    add(x);
    for (let i = 0; i < 12; i++) { const a = r() * TAU, px = cx + (r() - .5) * 1.7 * R, py = cy + (r() - .5) * 1.7 * R, l = R * (.18 + r() * .25);
      trait(x, px, py, px + Math.cos(a) * l, py + Math.sin(a) * l, '#ffffff', 1, .55); trait(x, px, py, px - Math.cos(a) * l * .6, py - Math.sin(a) * l * .6, '#ffffff', 1, .4); }
    for (let i = 0; i < 6; i++) scintille(x, cx + (r() - .5) * 1.5 * R, cy + (r() - .5) * 1.5 * R, R * (.1 + r() * .1), '#ffffff', .9);
  } else if (tex === 'paillettes') {
    add(x);
    for (let i = 0; i < 46; i++) point(x, r() > .45 ? '#ffffff' : '#ffd36b', cx + (r() - .5) * 2 * R, cy + (r() - .5) * 2 * R, R * (.05 + r() * .08), .95);
    for (let i = 0; i < 4; i++) scintille(x, cx + (r() - .5) * 1.4 * R, cy + (r() - .5) * 1.4 * R, R * .16, '#ffffff', 1);
  } else if (tex === 'nebuleuse') {
    add(x);
    for (let i = 0; i < 10; i++) { const a = i * .95, dd = R * (.12 + i * .085); voile(x, ['#ff7ad9', '#6fc8ff', '#b48cff'][i % 3], cx + Math.cos(a) * dd, cy + Math.sin(a) * dd, R * .6, .55); }
    for (let i = 0; i < 16; i++) point(x, '#ffffff', cx + (r() - .5) * 1.8 * R, cy + (r() - .5) * 1.8 * R, R * (.03 + r() * .06), .9);
  }
  x.restore();
}
function visage(x, o, { cx, cy, R }) {
  const s = o.yeux || 1, ey = cy + R * (o.forme === 'coeur' ? -.12 : o.forme === 'etoile' ? .04 : 0), ex = R * .32, rx = R * .13 * s, ry = R * .17 * s, sombre = '#2a1a10';
  normal(x);
  const reflet = (px, py, k = 1) => {
    x.fillStyle = '#fff';
    if (o.etoiles) { x.save(); x.translate(px, py); x.beginPath(); for (let i = 0; i < 8; i++) { const r2 = i % 2 ? R * .025 : R * .075; x.lineTo(Math.cos(i * Math.PI / 4 - Math.PI / 2) * r2, Math.sin(i * Math.PI / 4 - Math.PI / 2) * r2); } x.fill(); x.restore(); }
    else { x.beginPath(); x.arc(px, py, rx * .32 * k, 0, TAU); x.fill(); }
  };
  const remplir = (px, py, r1, r2) => {
    if (o.yeuxCouleur) { const g = x.createRadialGradient(px, py + r2 * .25, 0, px, py, r2 * 1.05); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, o.yeuxCouleur); g.addColorStop(1, '#1a1430'); x.fillStyle = g; }
    else x.fillStyle = sombre;
    x.beginPath(); x.ellipse(px, py, r1, r2, 0, 0, TAU); x.fill();
  };
  const ouvert = (px, k = 1) => { remplir(px, ey, rx * k, ry * k); reflet(px + rx * .25 * k, ey - ry * .32 * k, k); };
  const plisse = (px, haut) => { x.strokeStyle = sombre; x.lineWidth = R * .07; x.lineCap = 'round'; x.beginPath();
    if (haut) x.arc(px, ey + ry * .55, rx * 1.25, Math.PI * 1.15, Math.PI * 1.85); else x.arc(px, ey - ry * .45, rx * 1.25, Math.PI * .15, Math.PI * .85); x.stroke(); };
  const sourire = (dx = 0, k = 1) => { x.strokeStyle = '#5a2a1a'; x.lineWidth = R * .055; x.lineCap = 'round'; x.beginPath(); x.arc(cx + dx, ey + R * .24, R * .12 * k, Math.PI * .18, Math.PI * .82); x.stroke(); };
  const joues = a => { for (const c of [-1, 1]) voile(x, '#ff7f9f', cx + c * R * .58, ey + R * .3, R * .22, a); };
  switch (o.expr) {
    case 'rieuse':
      plisse(cx - ex, true); plisse(cx + ex, true); joues(.55);
      x.fillStyle = '#5a2a1a'; x.beginPath(); x.ellipse(cx, ey + R * .27, R * .17, R * .14, 0, 0, Math.PI); x.fill(); break;
    case 'reveuse':
      for (const px of [cx - ex, cx + ex]) { x.save(); x.beginPath(); x.rect(px - rx * 2, ey - ry * .05, rx * 4, ry * 2); x.clip(); ouvert(px); x.restore();
        x.strokeStyle = sombre; x.lineWidth = R * .05; x.lineCap = 'round'; x.beginPath(); x.moveTo(px - rx * 1.25, ey - ry * .05); x.quadraticCurveTo(px, ey - ry * .35, px + rx * 1.25, ey - ry * .05); x.stroke(); }
      joues(.3); sourire(0, .8); break;
    case 'malicieuse':
      plisse(cx - ex, true); ouvert(cx + ex);
      x.strokeStyle = '#5a2a1a'; x.lineWidth = R * .055; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - R * .1, ey + R * .3); x.quadraticCurveTo(cx + R * .08, ey + R * .4, cx + R * .24, ey + R * .22); x.stroke(); break;
    case 'etonnee':
      ouvert(cx - ex, 1.3); ouvert(cx + ex, 1.3);
      x.fillStyle = '#5a2a1a'; x.beginPath(); x.ellipse(cx, ey + R * .34, R * .065, R * .085, 0, 0, TAU); x.fill(); break;
    default: ouvert(cx - ex); ouvert(cx + ex); sourire();
  }
}
function queue(x, { cx, cy, R, c }) {
  x.save(); normal(x); x.shadowColor = c[1]; x.shadowBlur = R * .5; x.strokeStyle = c[2]; x.lineWidth = R * .2; x.lineCap = 'round';
  x.beginPath(); x.moveTo(cx + R * .7, cy + R * .6); x.quadraticCurveTo(cx + R * 1.55, cy + R * .75, cx + R * 1.35, cy - R * .15); x.stroke(); x.restore();
}
function lueurV(x, o = {}) {
  const forme = o.forme || 'rond', g = { cx: o.cx ?? 80, cy: o.cy ?? 86, R: o.R ?? 30, c: o.c || COUL[o.texture || 'lisse'] };
  add(x); voile(x, o.halo || '#ffe6b0', g.cx, g.cy, g.R * 3, .6); normal(x);
  if (o.derriere) o.derriere(x, g);
  if (forme === 'chat') queue(x, g);
  const p = silhouette(forme, g.cx, g.cy, g.R); corps(x, p, g, forme);
  if (o.texture) matiere(x, p, o.texture, g);
  visage(x, o, g);
  if (o.devant) { normal(x); o.devant(x, g); }
}
function lueurSeule(x, cx, cy, R, o = {}) { lueurV(x, { cx, cy, R, ...o }); }

// accessoires, habits, membres
const ACC = '#ffd98a';
function lueurAvec(x, quoi, accent = ACC) {
  const lumiere = (c, b) => { x.shadowColor = c; x.shadowBlur = b; };
  const d = {
    anneau: { cy: 94, devant: (x, { cx, cy, R }) => { x.save(); lumiere(accent, 12); x.strokeStyle = accent; x.lineWidth = R * .1; x.beginPath(); x.ellipse(cx, cy - R * 1.38, R * .62, R * .16, 0, 0, TAU); x.stroke(); x.restore(); add(x); voile(x, accent, cx, cy - R * 1.38, R * .9, .5); } },
    antenne: { cy: 96, devant: (x, { cx, cy, R }) => { x.save(); lumiere(accent, 8); x.strokeStyle = accent; x.lineWidth = R * .06; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy - R * .96); x.quadraticCurveTo(cx - R * .05, cy - R * 1.45, cx + R * .28, cy - R * 1.75); x.stroke(); x.restore();
      sphere(x, cx + R * .3, cy - R * 1.8, R * .17, '#ffffff', accent, '#ff9a4a'); add(x); point(x, accent, cx + R * .3, cy - R * 1.8, R * .7, .8); } },
    lunettes: { devant: (x, { cx, cy, R }) => { x.save(); lumiere(accent, 6); x.strokeStyle = accent; x.lineWidth = R * .06;
      for (const s of [-1, 1]) { x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.arc(cx + s * R * .32, cy, R * .23, 0, TAU); x.fill(); x.stroke(); }
      x.beginPath(); x.moveTo(cx - R * .1, cy - R * .03); x.quadraticCurveTo(cx, cy - R * .1, cx + R * .1, cy - R * .03); x.stroke(); x.restore(); } },
    couronne: { cy: 94, devant: (x, { cx, cy, R }) => { for (const [dx, dy, k] of [[-.48, -1.22, .17], [0, -1.48, .22], [.48, -1.22, .17]]) { etoile5(x, cx + dx * R, cy + dy * R, R * k, accent); add(x); point(x, accent, cx + dx * R, cy + dy * R, R * k * 2.4, .5); normal(x); } } },
    chapeau: { cy: 100, R: 28, devant: (x, { cx, cy, R }) => {
      const g = x.createLinearGradient(cx - R * .5, cy - R * 2, cx + R * .5, cy - R * .8); g.addColorStop(0, '#a99bff'); g.addColorStop(.6, '#5b4bc4'); g.addColorStop(1, '#2c2370');
      x.save(); lumiere('#8f7cff', 12); x.fillStyle = g; x.beginPath(); x.moveTo(cx - R * .62, cy - R * .78); x.quadraticCurveTo(cx - R * .1, cy - R * 1.4, cx + R * .45, cy - R * 2.15);
      x.quadraticCurveTo(cx + R * .35, cy - R * 1.3, cx + R * .62, cy - R * .78); x.closePath(); x.fill();
      x.beginPath(); x.ellipse(cx, cy - R * .78, R * .85, R * .16, 0, 0, TAU); x.fill(); x.restore();
      add(x); scintille(x, cx + R * .05, cy - R * 1.25, R * .14, '#ffe9a8'); scintille(x, cx + R * .3, cy - R * 1.7, R * .09, '#ffe9a8'); point(x, accent, cx + R * .45, cy - R * 2.15, R * .35, .8); } },
    echarpe: { devant: (x, { cx, cy, R }) => {
      const g = x.createLinearGradient(cx - R, cy + R * .4, cx + R, cy + R * .7); g.addColorStop(0, '#ffb0b8'); g.addColorStop(1, '#e0506a');
      x.save(); lumiere('#ff7a8c', 8); x.fillStyle = g; x.beginPath(); x.moveTo(cx - R * .86, cy + R * .4); x.quadraticCurveTo(cx, cy + R * .78, cx + R * .86, cy + R * .4);
      x.lineTo(cx + R * .8, cy + R * .66); x.quadraticCurveTo(cx, cy + R * 1.02, cx - R * .8, cy + R * .66); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(cx + R * .3, cy + R * .7); x.lineTo(cx + R * .58, cy + R * .62); x.quadraticCurveTo(cx + R * .7, cy + R * 1.05, cx + R * .66, cy + R * 1.32); x.lineTo(cx + R * .4, cy + R * 1.34); x.quadraticCurveTo(cx + R * .42, cy + R * 1.0, cx + R * .3, cy + R * .7); x.fill(); x.restore(); } },
    noeud: { devant: (x, { cx, cy, R }) => {
      const y = cy + R * .78, g = x.createLinearGradient(cx - R * .5, y, cx + R * .5, y); g.addColorStop(0, '#ff7eaa'); g.addColorStop(.5, '#ffc2d8'); g.addColorStop(1, '#ff7eaa');
      x.save(); lumiere('#ff8fb8', 8); x.fillStyle = g; x.lineJoin = 'round'; x.strokeStyle = g; x.lineWidth = R * .08;
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx, y); x.lineTo(cx + s * R * .48, y - R * .24); x.lineTo(cx + s * R * .48, y + R * .24); x.closePath(); x.fill(); x.stroke(); }
      x.beginPath(); x.ellipse(cx, y, R * .11, R * .13, 0, 0, TAU); x.fill(); x.restore(); } },
    cape: { cy: 76, derriere: (x, { cx, cy, R }) => {
      const g = x.createLinearGradient(0, cy, 0, cy + R * 1.9); g.addColorStop(0, '#b77bff'); g.addColorStop(1, '#5a2fd000');
      x.save(); add(x); x.fillStyle = g; x.beginPath(); x.moveTo(cx - R * .7, cy + R * .2); x.quadraticCurveTo(cx - R * 1.35, cy + R * 1.0, cx - R * 1.45, cy + R * 1.85);
      for (let i = 0; i < 4; i++) { const x0 = cx - R * 1.45 + i * R * .725; x.quadraticCurveTo(x0 + R * .36, cy + R * (i % 2 ? 1.65 : 2.05), x0 + R * .725, cy + R * 1.85); }
      x.quadraticCurveTo(cx + R * 1.35, cy + R * 1.0, cx + R * .7, cy + R * .2); x.closePath(); x.fill(); x.restore(); },
      devant: (x, { cx, cy, R }) => { sphere(x, cx, cy + R * .92, R * .1, '#ffffff', ACC, '#c98a2a'); } },
    ailes: { derriere: (x, { cx, cy, R }) => { add(x);
      for (const s of [-1, 1]) for (const [a, l, w] of [[-.55, 1.0, .3], [-.15, .9, .26], [.25, .7, .22]]) {
        x.save(); x.translate(cx + s * R * .78, cy - R * .05); x.rotate(s * a); x.scale(s, 1);
        const g = x.createRadialGradient(R * l * .45, 0, 0, R * l * .45, 0, R * l * .6); g.addColorStop(0, '#ffffffcc'); g.addColorStop(.6, '#cfe6ff66'); g.addColorStop(1, '#cfe6ff00');
        x.fillStyle = g; x.beginPath(); x.ellipse(R * l * .5, 0, R * l * .55, R * w, 0, 0, TAU); x.fill(); x.restore(); } normal(x); } },
    bras: { derriere: (x, g) => { const { cx, cy, R, c } = g; x.save(); x.shadowColor = c[1]; x.shadowBlur = R * .4; x.strokeStyle = c[1]; x.lineWidth = R * .26; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - R * .8, cy + R * .1); x.quadraticCurveTo(cx - R * 1.25, cy - R * .05, cx - R * 1.32, cy - R * .62); x.stroke();
      x.beginPath(); x.moveTo(cx + R * .8, cy + R * .2); x.quadraticCurveTo(cx + R * 1.2, cy + R * .35, cx + R * 1.3, cy + R * .7); x.stroke(); x.restore();
      add(x); point(x, '#ffe2a8', cx - R * 1.32, cy - R * .64, R * .3, .6); normal(x); } },
    pieds: { cy: 78, derriere: (x, g) => { const { cx, cy, R, c } = g; x.save(); x.shadowColor = c[1]; x.shadowBlur = R * .4; x.strokeStyle = c[2]; x.lineWidth = R * .2; x.lineCap = 'round';
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * R * .3, cy + R * .8); x.lineTo(cx + s * R * .34, cy + R * 1.2); x.stroke(); }
      x.fillStyle = c[1]; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * R * .4, cy + R * 1.28, R * .2, R * .12, 0, 0, TAU); x.fill(); } x.restore(); } },
  }[quoi];
  lueurV(x, d);
}
// une palette de petites pastilles de lumière sous la lueur
function nuancier(x, couleurs, y = 140) { add(x); couleurs.forEach((c, i) => point(x, c, 80 + (i - (couleurs.length - 1) / 2) * 22, y, 9, .95)); normal(x); }
// une flèche fine de lumière (taille)
function fleche(x, x0, y0, x1, y1, c = '#ffe2a8') {
  add(x); trait(x, x0, y0, x1, y1, c, 1.6, .9, false); const a = Math.atan2(y1 - y0, x1 - x0);
  for (const s of [-1, 1]) trait(x, x1, y1, x1 - Math.cos(a + s * .5) * 8, y1 - Math.sin(a + s * .5) * 8, c, 1.6, .9, false); normal(x);
}

// ── le ciel en miniature ──
const HUMEURS = ['#6fc3ff', '#ffd36b', '#ff7a9c', '#9b8cff', '#ff6b4a'];
function themeV(x, th) {
  const g = x.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, th.haut); g.addColorStop(1, th.bas); normal(x); x.fillStyle = g; x.fillRect(0, 0, 160, 160);
  const r = graine(5), c = th.etoile;
  if (th.clair) { for (let i = 0; i < 12; i++) voile(x, c, 8 + r() * 144, 8 + r() * 144, 2 + r() * 2.5, .5); voile(x, c, 102, 58, 9, 1); branches(x, 102, 58, 22, c, .8); }
  else { add(x); voile(x, c, 60, 110, 46, .12); for (let i = 0; i < 14; i++) point(x, c, 8 + r() * 144, 8 + r() * 144, 2 + r() * 3, .3 + r() * .5); point(x, c, 102, 58, 18); branches(x, 102, 58, 24, c, .8); }
}
function baleineChemin() {                            // une baleine tournée vers la gauche, la queue relevée
  const P = [[26, 96], [36, 76], [58, 66], [86, 66], [110, 74], [128, 84], [140, 72], [152, 60], [150, 80], [146, 98], [132, 94], [112, 100], [84, 110], [54, 110], [34, 104]];
  const p = new Path2D(), m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s = m(P[P.length - 1], P[0]); p.moveTo(...s);
  P.forEach((q, i) => p.quadraticCurveTo(...q, ...m(q, P[(i + 1) % P.length]))); p.closePath(); return { p, P };
}

const DESSINS = {
  // ta lueur
  'forme-chat': x => lueurV(x, { forme: 'chat', cy: 92 }),
  'forme-fantome': x => lueurV(x, { forme: 'fantome', cy: 78 }),
  'forme-coeur': x => lueurV(x, { forme: 'coeur', cy: 84 }),
  'forme-etoile': x => lueurV(x, { forme: 'etoile', cy: 86 }),
  'texture-nacre': x => lueurV(x, { texture: 'nacre', halo: '#e8dcff' }),
  'texture-givre': x => lueurV(x, { texture: 'givre', halo: '#bfe6ff' }),
  'texture-paillettes': x => lueurV(x, { texture: 'paillettes' }),
  'texture-nebuleuse': x => lueurV(x, { texture: 'nebuleuse', halo: '#b48cff' }),
  'couleur-lueur': x => { lueurV(x, { c: COUL.rose, halo: '#ffb8d4', cy: 76 }); nuancier(x, ['#ffd98a', '#ff9ec0', '#8fd0ff', '#b9a0ff', '#8ff0c0']); },
  'expression-rieuse': x => lueurV(x, { expr: 'rieuse' }),
  'expression-reveuse': x => lueurV(x, { expr: 'reveuse' }),
  'expression-malicieuse': x => lueurV(x, { expr: 'malicieuse' }),
  'expression-etonnee': x => lueurV(x, { expr: 'etonnee' }),
  'couleur-yeux': x => { lueurV(x, { yeuxCouleur: '#4fa8ff', yeux: 1.25, cy: 76 }); nuancier(x, ['#4fa8ff', '#8ff0c0', '#b9a0ff', '#ff9ec0']); },
  'taille-yeux': x => { lueurV(x, { yeux: 1.45, cy: 74, R: 32 }); fleche(x, 80, 132, 52, 132); fleche(x, 80, 132, 108, 132); },
  'acc-anneau': x => lueurAvec(x, 'anneau'),
  'acc-antenne': x => lueurAvec(x, 'antenne'),
  'acc-lunettes': x => lueurAvec(x, 'lunettes'),
  'acc-couronne': x => lueurAvec(x, 'couronne'),
  'acc-chapeau': x => lueurAvec(x, 'chapeau'),
  'couleur-accessoire': x => { lueurAvec(x, 'anneau', '#ff8fc0'); },
  'habit-echarpe': x => lueurAvec(x, 'echarpe'),
  'habit-noeud': x => lueurAvec(x, 'noeud'),
  'habit-cape': x => lueurAvec(x, 'cape'),
  'membres-ailes': x => lueurAvec(x, 'ailes'),
  'membres-bras': x => lueurAvec(x, 'bras'),
  'membres-pieds': x => lueurAvec(x, 'pieds'),
  'taille-lueur': x => { lueurSeule(x, 42, 98, 15); lueurSeule(x, 108, 84, 30); fleche(x, 56, 128, 92, 128); },
  'etincelles': x => { lueurV(x, { cx: 92, cy: 70, R: 28 }); add(x); const r = graine(4);
    for (let i = 0; i < 9; i++) { const k = i / 8, px = 70 - k * 50 + (r() - .5) * 14, py = 92 + k * 46 + (r() - .5) * 14; i % 3 ? point(x, '#ffe9a8', px, py, 3 + r() * 4, .9 - k * .4) : scintille(x, px, py, 7 - k * 3, '#ffe9a8', .95 - k * .4); } },
  // ton ciel
  'theme-nuit': x => themeV(x, THEMES.nuit),
  'theme-aube': x => themeV(x, THEMES.aube),
  'theme-ocean': x => themeV(x, THEMES.ocean),
  'theme-papier': x => themeV(x, THEMES.papier),
  'brume': x => { fond(x, 10, 9); for (const [px, py, r, c, a] of [[40, 92, 52, '#8f7cff', .5], [92, 80, 58, '#6fa8ff', .45], [122, 104, 46, '#ff8fc0', .4], [70, 116, 44, '#b9a0ff', .45], [104, 60, 36, '#cfd8ff', .3]]) voile(x, c, px, py, r, a);
    point(x, '#ffffff', 52, 46, 7); point(x, '#ffffff', 118, 36, 5); },
  'scintillement': x => { fond(x, 8, 12); const P = [[46, 52, 15], [112, 44, 10], [86, 96, 19], [36, 118, 8], [128, 116, 12], [70, 30, 6]];
    P.forEach(([px, py, r], i) => i % 2 ? point(x, '#e8eeff', px, py, r * .9) : scintille(x, px, py, r, '#ffffff')); },
  'rotation': x => { fond(x, 8, 3); add(x); const cx = 80, cy = 82, Rr = 50; point(x, '#ffe9c0', cx, cy, 10);
    for (let i = 0; i < 6; i++) { const a = -Math.PI * .1 + i * TAU / 6; const g = x.createConicGradient ? null : null;
      for (let k = 0; k < 14; k++) { const b = a - k * .045; point(x, '#cfe0ff', cx + Math.cos(b) * Rr, cy + Math.sin(b) * Rr * .62, 2.6 - k * .12, (1 - k / 14) * .7); }
      point(x, '#ffffff', cx + Math.cos(a) * Rr, cy + Math.sin(a) * Rr * .62, 7); } },
  'optique': x => { fond(x, 6, 21); add(x); const cx = 64, cy = 66; voile(x, '#ffe6c0', cx, cy, 52, .7); point(x, '#ffffff', cx, cy, 22);
    trait(x, cx, cy, cx + 74, cy, '#9fc8ff', 2, .9); trait(x, cx, cy, cx - 60, cy, '#9fc8ff', 2, .9);
    for (const [k, r, a] of [[.55, 9, .35], [1.0, 15, .25], [1.35, 6, .45]]) { const px = cx + (110 - cx) * k, py = cy + (124 - cy) * k, g = x.createRadialGradient(px, py, r * .55, px, py, r);
      g.addColorStop(0, '#9fe0ff00'); g.addColorStop(.8, '#bfa8ff'); g.addColorStop(1, '#bfa8ff00'); x.globalAlpha = a; x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); x.globalAlpha = 1; } },
  'couleurs-humeurs': x => { fond(x, 6, 30); add(x); HUMEURS.forEach((c, i) => { const a = -Math.PI / 2 + i * TAU / 5, px = 80 + Math.cos(a) * 38, py = 84 + Math.sin(a) * 38; voile(x, c, px, py, 26, .55); point(x, c, px, py, 12); }); },
  'lune': x => { fond(x, 10, 40); add(x); voile(x, '#fff3d6', 82, 78, 70, .35); normal(x); sphere(x, 82, 78, 32, '#fffdf2', '#ece4c8', '#b9ae8e');
    x.save(); x.beginPath(); x.arc(82, 78, 32, 0, TAU); x.clip();
    for (const [px, py, r] of [[72, 66, 7], [90, 90, 5], [70, 92, 4], [96, 70, 3.5]]) voile(x, '#7d7258', px, py, r * 1.6, .45);
    const g = x.createRadialGradient(100, 70, 22, 100, 70, 40); g.addColorStop(0, '#05060ff0'); g.addColorStop(.8, '#05060fe0'); g.addColorStop(1, '#05060f00');
    x.fillStyle = g; x.fillRect(40, 30, 100, 100); x.restore(); },
  'planete-anneaux': x => { fond(x, 10, 50); normal(x); const cx = 80, cy = 82, R = 28, an = -.35;
    const anneau = (avant) => { x.save(); x.translate(cx, cy); x.rotate(an); add(x); for (const [rx, w, c, a] of [[60, 5, '#ffd99a', .75], [50, 3, '#ffe8c0', .6], [68, 1.6, '#e8b870', .5]]) {
      x.globalAlpha = a; x.strokeStyle = c; x.lineWidth = w; x.beginPath(); x.ellipse(0, 0, rx, rx * .24, 0, avant ? 0 : Math.PI, avant ? Math.PI : TAU); x.stroke(); } x.restore(); };
    anneau(false); sphere(x, cx, cy, R, '#fff2cf', '#e2a957', '#6a3d12');
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip(); x.translate(cx, cy); x.rotate(an); for (const [y, h, a] of [[-12, 4, .25], [-3, 6, .2], [8, 3, .3], [15, 5, .18]]) { x.globalAlpha = a; x.fillStyle = '#8a5520'; x.fillRect(-R, y, 2 * R, h); } x.restore();
    anneau(true); },
  'planete-bleue': x => { fond(x, 10, 60); add(x); voile(x, '#6fb8ff', 80, 82, 58, .5); normal(x); const cx = 80, cy = 82, R = 32; sphere(x, cx, cy, R, '#e6f6ff', '#3a8fe0', '#0b2a6b');
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip(); add(x);
    for (const [px, py, rx, ry, a] of [[70, 66, 18, 4, .7], [88, 78, 22, 4.5, .6], [72, 92, 16, 3.5, .55], [94, 100, 14, 3, .4], [62, 80, 10, 3, .5]]) { const g = x.createRadialGradient(px, py, 0, px, py, rx); g.addColorStop(0, '#ffffffcc'); g.addColorStop(1, '#ffffff00');
      x.globalAlpha = a; x.fillStyle = g; x.beginPath(); x.ellipse(px, py, rx, ry, -.2, 0, TAU); x.fill(); } x.globalAlpha = 1; normal(x);
    const o = x.createRadialGradient(cx - 14, cy - 16, R * .6, cx - 6, cy - 8, R * 1.3); o.addColorStop(0, '#05060f00'); o.addColorStop(1, '#05060fcc'); x.fillStyle = o; x.fillRect(cx - R, cy - R, 2 * R, 2 * R); x.restore(); },
  'planete-rouge': x => { fond(x, 14, 70); normal(x); const cx = 96, cy = 222, R = 150; add(x); voile(x, '#ff8a4a', cx, cy - R + 20, 90, .35); normal(x); sphere(x, cx, cy, R, '#ffd2b0', '#d9653a', '#4a140a');
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip(); for (const [d, w, a] of [[16, 6, .25], [30, 9, .2], [46, 5, .3], [60, 8, .18]]) { x.globalAlpha = a; x.strokeStyle = '#7a2a10'; x.lineWidth = w; x.beginPath(); x.arc(cx, cy, R - d, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
    x.globalAlpha = .6; const s = x.createRadialGradient(70, 112, 0, 70, 112, 13); s.addColorStop(0, '#ffe0c0'); s.addColorStop(.5, '#c84a20'); s.addColorStop(1, '#c84a2000'); x.fillStyle = s; x.beginPath(); x.ellipse(70, 112, 15, 7, -.15, 0, TAU); x.fill(); x.restore();
    add(x); x.save(); x.shadowColor = '#ffb07a'; x.shadowBlur = 14; x.strokeStyle = '#ffb07a66'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R + 1, Math.PI * 1.08, Math.PI * 1.92); x.stroke(); x.restore(); },
  'lactee': x => { const r = graine(80); add(x); x.save(); x.translate(80, 80); x.rotate(-.6);
    const g = x.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, '#cfd8ff00'); g.addColorStop(.5, '#fff1d8aa'); g.addColorStop(1, '#cfd8ff00'); x.fillStyle = g; x.fillRect(-120, -34, 240, 68);
    for (let i = 0; i < 360; i++) { const u = (r() - .5) * 240, v = (r() + r() + r() - 1.5) * 26; point(x, r() > .8 ? '#fff0d0' : '#dfe8ff', u, v, .8 + r() * 1.8, .35 + r() * .6); }
    normal(x); x.globalAlpha = .5; x.fillStyle = '#05060f'; x.shadowColor = '#05060f'; x.shadowBlur = 8; x.beginPath(); x.moveTo(-120, 3); for (let u = -120; u <= 120; u += 20) x.lineTo(u, 3 + Math.sin(u * .07) * 4); for (let u = 120; u >= -120; u -= 20) x.lineTo(u, 7 + Math.sin(u * .05) * 3); x.fill();
    x.restore(); fond(x, 6, 81); },
  'poussiere': x => { fond(x, 6, 90); const r = graine(91); add(x);
    for (let i = 0; i < 160; i++) { const k = r(), px = r() * 175 - 8, py = 30 + k * 100 + Math.sin(px * .04) * 14 + (r() - .5) * 26, a = .2 + r() * .55;
      if (r() > .75) trait(x, px, py, px - 6 - r() * 6, py + 1, '#ffe9c4', .9, a); else point(x, '#ffe9c4', px, py, .8 + r() * 1.6, a); } },
  'filantes': x => { fond(x, 10, 100); add(x);
    for (const [a, b, l] of [[128, 34, 74], [146, 86, 48], [96, 22, 36]]) { trait(x, a, b, a - l, b + l * .8, '#d8ecff', 2, 1); point(x, '#e8f4ff', a, b, 9); } },
  'satellites': x => { fond(x, 14, 110); add(x); for (let i = 0; i < 16; i++) point(x, '#cfe0ff', 18 + i * 5.2, 124 - i * 4, 1.4, .1 + i * .03);
    const px = 104, py = 58; trait(x, px - 3, py, px - 14, py, '#9fc8ff', 3, .8, false); trait(x, px + 3, py, px + 14, py, '#9fc8ff', 3, .8, false);
    point(x, '#ffffff', px, py, 9); voile(x, '#ff6b6b', px, py, 20, .5); voile(x, '#ffffff', px, py, 30, .25); },
  'lucioles': x => { fond(x, 8, 120); add(x); const cx = 80, cy = 82; point(x, '#cfe0ff', cx, cy, 16);
    for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + .3, rx = 44, ry = 24, px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
      for (let k = 1; k < 6; k++) point(x, '#ffd36b', cx + Math.cos(a - k * .06) * rx, cy + Math.sin(a - k * .06) * ry, 2 - k * .25, .5 - k * .08);
      point(x, '#ffe08a', px, py, 4.5 + (i % 3)); } },
  'cometes': x => { fond(x, 10, 130); add(x); const hx = 122, hy = 40;
    const g = x.createLinearGradient(hx, hy, 24, 132); g.addColorStop(0, '#e8f4ffcc'); g.addColorStop(1, '#9fc8ff00');
    x.fillStyle = g; x.beginPath(); x.moveTo(hx + 2, hy - 4); x.quadraticCurveTo(70, 70, 14, 118); x.lineTo(34, 140); x.quadraticCurveTo(84, 86, hx + 4, hy + 3); x.closePath(); x.fill();
    trait(x, hx, hy, 30, 112, '#8fd8ff', 1.4, .8); point(x, '#ffffff', hx, hy, 14); voile(x, '#cfe8ff', hx, hy, 26, .5); },
  'dessins': x => { fond(x, 10, 140); add(x); const P = []; for (let i = 0; i < 10; i++) { const tt = i / 10 * TAU, hx = 16 * Math.pow(Math.sin(tt), 3), hy = -(13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt)); P.push([80 + hx * 3.3, 78 + hy * 3.3]); }
    x.strokeStyle = '#cfe0ff'; x.globalAlpha = .4; x.lineWidth = 1; x.beginPath(); P.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.stroke(); x.globalAlpha = 1;
    P.forEach(([px, py], i) => point(x, i % 3 ? '#e8eeff' : '#ffd9e6', px, py, i % 3 ? 6 : 9)); },
  'aurores': x => { fond(x, 10, 150); add(x);
    for (let i = 0; i < 70; i++) { const px = 4 + i * 2.2, b = 118 + Math.sin(i * .16) * 12, h = 52 + Math.sin(i * .11 + 1) * 22 + Math.sin(i * .37) * 6, tp = b - h;
      const g = x.createLinearGradient(0, b, 0, tp); g.addColorStop(0, '#5cffb000'); g.addColorStop(.12, '#5cffb0'); g.addColorStop(.6, '#3fd6c0aa'); g.addColorStop(1, '#b07aff00');
      x.globalAlpha = .28; x.fillStyle = g; x.fillRect(px, tp, 2.6, h); } x.globalAlpha = 1; },
  'baleine': x => { fond(x, 10, 160); const { p, P } = baleineChemin(); add(x);
    const g = x.createLinearGradient(26, 66, 150, 110); g.addColorStop(0, '#6fa8ff55'); g.addColorStop(1, '#9b8cff22'); x.fillStyle = g; x.fill(p);
    x.strokeStyle = '#cfe0ff'; x.globalAlpha = .35; x.lineWidth = 1; x.stroke(p); x.globalAlpha = 1;
    P.forEach(([px, py], i) => point(x, '#e0ecff', px, py, i % 4 ? 4.5 : 7)); point(x, '#ffffff', 44, 88, 4);
    for (const [px, py, r] of [[50, 54, 3], [44, 46, 2.4], [56, 44, 2.4], [50, 38, 2]]) point(x, '#cfe8ff', px, py, r * 1.6, .8); },
};

// ── la lueur en 3D (rendue une fois par la scène : creature.vignette) : l'article porté, de trois-quarts, sur le fond sombre des vignettes.
//    perso : le patch de l'article ; R, cx, cy (px sur 160) facultatifs : sinon cadrée sur ce qu'elle porte ; apres : décor 2D par-dessus ; une liste = plusieurs lueurs
const LUEUR3D = {
  'forme-chat': { perso: { forme: 'chat' } }, 'forme-fantome': { perso: { forme: 'fantome' } }, 'forme-coeur': { perso: { forme: 'coeur' } }, 'forme-etoile': { perso: { forme: 'etoile' } },
  'texture-nacre': { perso: { texture: 'nacre' } }, 'texture-givre': { perso: { texture: 'givre' } }, 'texture-paillettes': { perso: { texture: 'paillettes' } }, 'texture-nebuleuse': { perso: { texture: 'nebuleuse' } },
  'couleur-lueur': { perso: { couleur: '#ff9ec0' }, cy: 72, R: 27, apres: x => nuancier(x, ['#ffd98a', '#ff9ec0', '#8fd0ff', '#b9a0ff', '#8ff0c0']) },
  'expression-rieuse': { perso: { expression: 'rieuse' }, az: -.3 }, 'expression-reveuse': { perso: { expression: 'reveuse' }, az: -.3 },
  'expression-malicieuse': { perso: { expression: 'malicieuse' }, az: -.3 }, 'expression-etonnee': { perso: { expression: 'etonnee' }, az: -.3 },
  'couleur-yeux': { perso: { yeuxCouleur: '#4fa8ff', yeux: 1.25 }, cy: 72, R: 27, az: -.3, apres: x => nuancier(x, ['#4fa8ff', '#8ff0c0', '#b9a0ff', '#ff9ec0']) },
  'yeux-etoiles': { etoiles: true, perso: { yeux: 1.3 }, az: -.3 },
  'taille-yeux': { perso: { yeux: 1.45 }, cy: 74, R: 29, az: -.3, apres: x => { fleche(x, 80, 136, 52, 136); fleche(x, 80, 136, 108, 136); } },
  'acc-anneau': { perso: { acc: 1 } }, 'acc-antenne': { perso: { acc: 2 } }, 'acc-lunettes': { perso: { acc: 3 } }, 'acc-couronne': { perso: { acc: 4 } }, 'acc-chapeau': { perso: { acc: 5 } },
  'couleur-accessoire': { perso: { acc: 1, accCouleur: '#ff8fc0' } },
  'habit-echarpe': { perso: { habit: 1 } }, 'habit-noeud': { perso: { habit: 2 } }, 'habit-cape': { perso: { habit: 3 } },
  'membres-ailes': { perso: { ailes: true } }, 'membres-bras': { perso: { bras: true } }, 'membres-pieds': { perso: { pieds: true } },
  'taille-lueur': [{ cx: 42, cy: 96, R: 14 }, { cx: 106, cy: 80, R: 28, apres: x => fleche(x, 56, 132, 92, 132) }],
  'etincelles': { cx: 94, cy: 68, R: 26, apres: x => { add(x); const r = graine(4);
    for (let i = 0; i < 9; i++) { const k = i / 8, px = 70 - k * 50 + (r() - .5) * 14, py = 92 + k * 46 + (r() - .5) * 14; i % 3 ? point(x, '#ffe9a8', px, py, 3 + r() * 4, .9 - k * .4) : scintille(x, px, py, 7 - k * 3, '#ffe9a8', .95 - k * .4); } } },
};

function vignette(c, k) {
  const x = c.getContext('2d'), W = c.width; x.fillStyle = '#05060f'; x.fillRect(0, 0, W, W); x.save(); x.scale(W / 160, W / 160);
  if (k === 'yeux-etoiles') {
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .7; x.drawImage(sprite('#ffe6b0'), -70, -68, 300, 300); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    const R = 30, cx = 80, cy = 82, og = x.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R); og.addColorStop(0, '#fffaf0'); og.addColorStop(.55, '#ffe2a8'); og.addColorStop(1, '#ffb86b');
    x.fillStyle = og; x.beginPath(); x.arc(cx, cy, R, 0, 6.29); x.fill();
    for (const s of [-1, 1]) { const ex = cx + s * R * .32, ey = cy + R * .05;
      x.fillStyle = '#2a1a10'; x.beginPath(); x.ellipse(ex, ey, R * .13, R * .17, 0, 0, 6.29); x.fill();
      x.fillStyle = '#fff'; x.save(); x.translate(ex + R * .02, ey - R * .03); x.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? R * .025 : R * .075; x.lineTo(Math.cos(i * Math.PI / 4 - Math.PI / 2) * r, Math.sin(i * Math.PI / 4 - Math.PI / 2) * r); } x.fill(); x.restore(); }
  } else if (k === 'croix') {
    x.globalCompositeOperation = 'lighter';
    for (const [px, py, c2] of [[55, 60, '#6fc3ff'], [105, 95, '#ffd36b'], [70, 115, '#ff7a9c']]) {
      x.drawImage(sprite(c2), px - 14, py - 14, 28, 28);
      const lg = x.createLinearGradient(px - 26, 0, px + 26, 0); lg.addColorStop(0, c2 + '00'); lg.addColorStop(.5, c2); lg.addColorStop(1, c2 + '00');
      x.fillStyle = lg; x.fillRect(px - 26, py - .7, 52, 1.4);
      const lv = x.createLinearGradient(0, py - 26, 0, py + 26); lv.addColorStop(0, c2 + '00'); lv.addColorStop(.5, c2); lv.addColorStop(1, c2 + '00');
      x.fillStyle = lv; x.fillRect(px - .7, py - 26, 1.4, 52);
    }
  } else if (k === 'filantes-or') {
    x.globalCompositeOperation = 'lighter';
    for (const [a, b, l] of [[120, 40, 80], [140, 90, 55]]) { const lg = x.createLinearGradient(a, b, a - l, b + l * .9); lg.addColorStop(0, '#ffd98a'); lg.addColorStop(1, '#ffd98a00'); x.strokeStyle = lg; x.lineWidth = 2; x.beginPath(); x.moveTo(a, b); x.lineTo(a - l, b + l * .9); x.stroke(); x.drawImage(sprite('#ffd98a'), a - 10, b - 10, 20, 20); }
  } else if (DESSINS[k]) { try { DESSINS[k](x); } catch (e) {} }
  x.restore(); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
}

// ───────── le panneau ─────────
const DEBUT = ['yeux-etoiles', 'croix', 'filantes-or'];          // les trois objets à ✦10, tant qu'aucun n'est pris

export function monterBoutique(zone, ctx) {
  const corps = zone.querySelector('.p-corps'), soldeEl = zone.querySelector('#bq-solde');
  const onglets = [...zone.querySelectorAll('[data-onglet]')];
  const mot = el('p', { class: 'bq-mot', role: 'status', 'aria-live': 'polite' }); zone.append(mot);
  // aperçu (v19) : en haut, la lueur telle qu'elle est, qui ne bouge pas et change à chaque article touché (onglet « Ta lueur »)
  // v20 : onglet « Ton ciel » : un aperçu en direct du ciel (téléphone seulement : sur PC, le ciel est visible à côté)
  const apercu = el('canvas', { width: '480', height: '480', 'aria-hidden': 'true' }), boiteApercu = el('div', { class: 'bq-apercu' }, apercu);
  const ciel = el('canvas', { width: '720', height: '440', 'aria-hidden': 'true' }), boiteCiel = el('div', { class: 'bq-apercu apercu-ciel' }, ciel);
  corps.before(boiteApercu, boiteCiel); if (ctx.apercuCiel) ctx.apercuCiel(ciel);
  const majApercu = () => { const on = onglet === 'lueur' && !!ctx.apercu; boiteApercu.hidden = !on; boiteCiel.hidden = on || !ctx.apercuCiel; zone.classList.add('plein'); if (on) ctx.apercu(apercu); };
  let onglet = 'lueur', minuteur = 0;
  const toiles = {};                                   // une vignette n'est dessinée qu'une fois
  const toile = a => toiles[a.cle] || (toiles[a.cle] = (() => { const c = el('canvas', { width: '160', height: '160', 'aria-hidden': 'true' }), v3 = ctx.vignette3D && LUEUR3D[a.cle];
    if (v3) { const x = c.getContext('2d'); x.fillStyle = '#05060f'; x.fillRect(0, 0, 160, 160); [].concat(v3).forEach((o, i) => ctx.vignette3D(c, i ? { mode: 'lighten', ...o } : o)); }   // fond sombre en attendant la 3D
    else vignette(c, a.cle); return c; })());
  const equipe = a => !!(ctx.equipe && ctx.equipe(a));
  const equiper = (a, oui) => { if (ctx.equiper) ctx.equiper(a, oui); };
  const signaler = a => { if (ctx.surChange) ctx.surChange(a.cle, E.actif(a.cle)); };

  function dire(txt) {
    mot.textContent = txt; mot.classList.add('on'); clearTimeout(minuteur);
    minuteur = setTimeout(() => mot.classList.remove('on'), 2800);
  }
  function toucher(a) {
    if (!E.possede(a.cle)) {
      if (!E.acheter(a.cle)) { dire(t('Encore ✦{n} à gagner en écrivant.', { n: a.prix - E.solde() })); return; }
      if (a.type === 'choix' || a.source === 'perso' && a.type === 'interrupteur') equiper(a, true);
      signaler(a); if (ctx.surAchat) ctx.surAchat(a.cle); rendre(true); briller(a.cle, false); return;
    }
    if (a.type === 'choix') equiper(a, !equipe(a));
    else if (a.type === 'interrupteur') { const v = E.basculer(a.cle); if (a.source === 'perso') equiper(a, v); }
    else { if (ctx.ouvrirReglage) ctx.ouvrirReglage(a); return; }
    signaler(a); rendre(true);
  }
  function carte(a) {
    const pris = E.possede(a.cle);
    let ligne, cls = 'bq-art', presse = null;
    if (!pris) { ligne = '✦ ' + a.prix; if (E.solde() < a.prix) cls += ' cher'; }
    else if (a.type === 'choix') { presse = equipe(a); ligne = presse ? (a.cat === 'lueur' ? t('Porté') : t('Choisi')) : t('À toi'); cls += ' pris' + (presse ? ' on' : ''); }
    else if (a.type === 'interrupteur') { presse = E.actif(a.cle); ligne = presse ? t('Allumé') : t('Éteint'); cls += ' pris' + (presse ? ' on' : ''); }
    else { ligne = t('Débloqué') + ' ›'; cls += ' pris regle'; }
    return el('button', { type: 'button', class: cls, 'data-cle': a.cle, 'aria-pressed': presse, 'aria-disabled': !pris && E.solde() < a.prix ? 'true' : null, title: a.sous, onclick: () => toucher(a) },
      toile(a), el('span', { class: 'bq-nom' }, a.nom), el('small', { class: 'bq-sous' }, a.sous), el('small', { class: 'bq-prix' }, ligne));
  }
  const section = (titre, liste, ...avant) => el('section', { class: 'reg-section bq-section' }, el('h2', {}, titre), ...avant, el('div', { class: 'bq-grille' }, liste.map(carte)));

  function contenu() {
    const blocs = [], debut = onglet === 'lueur' && DEBUT.every(k => !E.possede(k));
    if (debut) blocs.push(section(t('Pour commencer'), DEBUT.map(E.article), el('p', { class: 'bq-note haut' }, t('Un premier cadeau, pour ✦10.'))));
    E.GROUPES[onglet].forEach(g => {
      const liste = E.articles(onglet).filter(a => a.groupe === g.cle && !(debut && DEBUT.includes(a.cle)));
      if (liste.length) blocs.push(section(g.nom, liste));
    });
    blocs.push(el('p', { class: 'bq-note' }, t('Tu gagnes ✦10 chaque jour où tu écris. Touche un objet à toi pour le porter, l’allumer ou le régler.')));
    return blocs;
  }
  function rendre(garder = false) {
    const y = corps.scrollTop;
    soldeEl.textContent = '✦ ' + E.solde();
    onglets.forEach(b => { const on = b.dataset.onglet === onglet; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on) corps.setAttribute('aria-labelledby', b.id); });
    corps.replaceChildren(...contenu()); corps.scrollTop = garder ? y : 0;
    majApercu();
  }
  function briller(cle, defiler = true) {
    const n = corps.querySelector(`[data-cle="${cle}"]`); if (!n) return;
    if (defiler) { const r = n.getBoundingClientRect(), rc = corps.getBoundingClientRect(); corps.scrollTop += (r.top - rc.top) - (rc.height - r.height) / 2; }
    n.classList.remove('eclat'); void n.offsetWidth; n.classList.add('eclat'); setTimeout(() => n.classList.remove('eclat'), 1900);
  }
  function choisirOnglet(o) { onglet = o === 'ciel' ? 'ciel' : 'lueur'; rendre(); }
  onglets.forEach(b => b.addEventListener('click', () => choisirOnglet(b.dataset.onglet)));
  const liste = onglets[0] && onglets[0].parentElement;
  if (liste) liste.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = onglets.findIndex(b => b.dataset.onglet === onglet), b = onglets[(i + (e.key === 'ArrowRight' ? 1 : onglets.length - 1)) % onglets.length];
    choisirOnglet(b.dataset.onglet); b.focus(); e.preventDefault();
  });

  function ouvrir(o = 'lueur', cle) {
    const a = cle && E.article(cle);
    onglet = a ? a.cat : o === 'ciel' ? 'ciel' : 'lueur';
    zone.hidden = false; rendre();
    if (a) requestAnimationFrame(() => briller(a.cle));
  }
  const fermer = () => { zone.hidden = true; mot.classList.remove('on'); };
  zone.querySelector('#bq-fermer').addEventListener('click', fermer);
  return { ouvrir, fermer, rendre: () => rendre(true), ouvert: () => !zone.hidden };
}
