// Panneau « Analyses » : météo intérieure (courbe de ciel) et bilan du mois.
import { meteo, resumeMeteo, bilanMois, VALENCE } from './analyse.js';
import { t } from './langue.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : n.setAttribute(k, v));
  n.append(...enfants); return n;
};

// ctx : { entries(), couleur(k), encre(), survoler(ids, titre), ouvrirJour(cle), ecrire() }
// v26 : page « Suivi » refaite (feuille plein écran sur téléphone) : onglets en segments, chiffres clés, courbe, répartition ; le mois en calendrier.
const NOMS = { joie: 'joie', elan: 'élan', calme: 'calme', melancolie: 'mélancolie', tempete: 'tempête' };
export function monterAnalyse(zone, ctx) {
  let onglet = 'meteo', periode = 30, mois = new Date().getMonth(), annee = new Date().getFullYear();
  const ongletsZ = zone.querySelector('#ana-onglets'), corps = zone.querySelector('#ana-corps');
  zone.querySelector('#ana-fermer').addEventListener('click', () => { zone.hidden = true; });
  const seg = (choix, actif, f) => { const b = el('div', { class: 'seg', role: 'tablist' }); choix.forEach(([k, nom]) => b.append(el('button', { type: 'button', role: 'tab', 'aria-selected': k === actif, onclick: () => f(k) }, nom))); return b; };
  const nom = k => t(NOMS[k] || k);

  function dessinerCourbe(canvas, jours) {
    const pr = Math.min(devicePixelRatio || 1, 2), W = canvas.clientWidth || 300, H = 150;
    canvas.width = W * pr; canvas.height = H * pr; const g = canvas.getContext('2d'); g.scale(pr, pr); g.clearRect(0, 0, W, H);
    const encre = ctx.encre(), haut = 8, bas = H - 8, y = val => haut + (1 - (val + 1) / 2) * (bas - haut), cw = W / jours.length;
    g.globalAlpha = .14; g.fillStyle = encre; [1, 0, -1].forEach(val => g.fillRect(0, Math.round(y(val)), W, 1));
    jours.forEach((j, i) => { if (!j.dominante) return; g.globalAlpha = .2; g.fillStyle = ctx.couleur(j.dominante); g.fillRect(i * cw, haut, Math.max(1, cw - (cw > 4 ? 1 : 0)), bas - haut); });
    const pts = jours.map((j, i) => j.n ? [i * cw + cw / 2, y(j.valeur), j] : null).filter(Boolean);
    g.globalAlpha = .85; g.lineWidth = 1.5; g.strokeStyle = encre; g.beginPath(); pts.forEach(([x, yy], i) => i ? g.lineTo(x, yy) : g.moveTo(x, yy)); g.stroke();
    const r = jours.length > 40 ? 2 : 3;
    pts.forEach(([x, yy, j]) => { g.globalAlpha = 1; g.fillStyle = ctx.couleur(j.dominante); g.fillRect(x - r, yy - r, r * 2, r * 2); });
  }

  function humeurs() {
    corps.append(seg([7, 30, 90].map(n => [n, t('{n} jours', { n })]), periode, k => { periode = k; rendre(); }));
    const jours = meteo(ctx.entries(), periode), ecrits = jours.filter(j => j.n);
    if (!ecrits.length) {
      corps.append(el('div', { class: 'ana-vide' }, el('p', {}, t('Aucune humeur sur cette période.')), el('p', { class: 'doux' }, t('Choisis une humeur en écrivant : elle apparaîtra ici.')),
        ctx.ecrire ? el('button', { type: 'button', class: 'plein', onclick: () => { zone.hidden = true; ctx.ecrire(); } }, t('Écrire maintenant')) : ''));
      return;
    }
    const cpt = {}; ecrits.forEach(j => Object.entries(j.humeurs).forEach(([k, n]) => { cpt[k] = (cpt[k] || 0) + n; }));
    const tri = Object.entries(cpt).sort((a, b) => b[1] - a[1]), total = tri.reduce((s, [, n]) => s + n, 0);
    const moy = ecrits.reduce((s, j) => s + j.valeur, 0) / ecrits.length;
    const ciel = t(moy > .35 ? 'dégagé' : moy > -.1 ? 'variable' : moy > -.4 ? 'nuageux' : 'orageux');
    const chiffre = (val, lab, pastille) => el('div', { class: 'chiffre' }, el('strong', {}, pastille ? el('i', { style: 'background:' + pastille }) : '', val), el('span', {}, lab));
    corps.append(el('div', { class: 'chiffres' },
      chiffre(ecrits.length + ' / ' + periode, t('jours écrits')), chiffre(nom(tri[0][0]), t('humeur dominante'), ctx.couleur(tri[0][0])), chiffre(ciel, t('ciel moyen'))));
    const canvas = el('canvas', { class: 'meteo', role: 'img', 'aria-label': t('Courbe de l’humeur dans le temps') });
    corps.append(el('h3', { class: 'ana-titre' }, t('Le fil des jours')),
      el('div', { class: 'courbe' }, el('div', { class: 'axe' }, el('span', {}, t('éclaircie')), el('span', {}, t('orage'))), canvas),
      el('div', { class: 'echelle' }, el('span', {}, jours[0].date.toLocaleDateString(document.documentElement.lang || undefined, { day: 'numeric', month: 'short' })), el('span', {}, t('aujourd’hui'))));
    const barre = el('div', { class: 'repartition', 'aria-hidden': 'true' }), liste = el('ul', { class: 'rep-liste' });
    tri.forEach(([k, n]) => {
      const pc = Math.round(n / total * 100);
      barre.append(el('i', { style: `background:${ctx.couleur(k)};flex:${n}` }));
      liste.append(el('li', {}, el('i', { style: 'background:' + ctx.couleur(k) }), el('span', {}, nom(k)), el('b', {}, pc + ' %')));
    });
    corps.append(el('h3', { class: 'ana-titre' }, t('Répartition')), barre, liste, el('p', { class: 'texte-ana doux' }, resumeMeteo(jours)));
    requestAnimationFrame(() => dessinerCourbe(canvas, jours));
  }

  function leMois() {
    const b = bilanMois(ctx.entries(), annee, mois), n = new Date(annee, mois + 1, 0).getDate();
    const auj = new Date(), estCeMois = auj.getFullYear() === annee && auj.getMonth() === mois;
    corps.append(el('div', { class: 'nav-mois' },
      el('button', { type: 'button', 'aria-label': t('Mois précédent'), onclick: () => { mois--; if (mois < 0) { mois = 11; annee--; } rendre(); } }, '‹'),
      el('strong', {}, b.titre),
      el('button', { type: 'button', 'aria-label': t('Mois suivant'), onclick: () => { mois++; if (mois > 11) { mois = 0; annee++; } rendre(); } }, '›')));
    corps.querySelector('.nav-mois button:last-child').disabled = estCeMois;      // pas de mois à venir
    const jours = meteo(ctx.entries(), n, new Date(annee, mois, n)), cal = el('div', { class: 'calendrier' });
    t('L M M J V S D').split(' ').forEach(x => cal.append(el('span', { class: 'jsem' }, x)));
    const dec = (new Date(annee, mois, 1).getDay() + 6) % 7; for (let i = 0; i < dec; i++) cal.append(el('span'));
    jours.forEach(j => {
      const d = j.date, cle = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const c = el('button', { type: 'button', class: 'jour' + (j.dominante ? ' plein-j' : '') + (estCeMois && d.getDate() === auj.getDate() ? ' auj' : ''), 'aria-label': d.toLocaleDateString(document.documentElement.lang || undefined, { day: 'numeric', month: 'long' }) + (j.dominante ? ' · ' + nom(j.dominante) : '') }, String(d.getDate()));
      if (j.dominante) { c.style.setProperty('--c', ctx.couleur(j.dominante)); c.addEventListener('click', () => { zone.hidden = true; ctx.ouvrirJour && ctx.ouvrirJour(cle); }); } else c.disabled = true;
      cal.append(c);
    });
    corps.append(cal);
    const res = el('ul', { class: 'bilan-liste' }); b.phrases.forEach(p => res.append(el('li', {}, p)));
    corps.append(el('h3', { class: 'ana-titre' }, t('En résumé')), res);
    if (b.ids.length > 1) corps.append(el('button', { type: 'button', class: 'plein large', onclick: () => ctx.survoler(b.ids, t('Bilan') + ' · ' + b.titre) }, t('Survoler le mois')));
  }

  function rendre() {
    ongletsZ.replaceChildren(seg([['meteo', t('Humeurs')], ['bilan', t('Le mois')]], onglet, k => { onglet = k; corps.scrollTop = 0; rendre(); }));
    corps.replaceChildren(); onglet === 'meteo' ? humeurs() : leMois();
  }
  return Object.assign(rendre, { ouvrir: o => { if (o) onglet = o; zone.hidden = false; rendre(); } });
}
