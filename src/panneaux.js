// Panneau « Analyses » : météo intérieure (courbe de ciel) et bilan du mois.
import { meteo, resumeMeteo, bilanMois, VALENCE } from './analyse.js';
import { t } from './langue.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : n.setAttribute(k, v));
  n.append(...enfants); return n;
};

// ctx : { entries(), couleur(k), encre(), survoler(ids, titre) }
export function monterAnalyse(zone, ctx) {
  let onglet = 'meteo', periode = 30, mois = new Date().getMonth(), annee = new Date().getFullYear();

  function dessinerMeteo(canvas, jours) {
    const pr = Math.min(devicePixelRatio || 1, 2), W = canvas.clientWidth || 280, H = 170;
    canvas.width = W * pr; canvas.height = H * pr; const g = canvas.getContext('2d'); g.scale(pr, pr); g.clearRect(0, 0, W, H);
    const encre = ctx.encre(), haut = 14, bas = H - 22, y = val => haut + (1 - (val + 1) / 2) * (bas - haut);
    const cw = W / jours.length;
    g.font = '10px ui-monospace, Consolas, monospace'; g.fillStyle = encre; g.strokeStyle = encre;
    jours.forEach((j, i) => {                                   // colonne teintée par l'humeur dominante du jour
      if (!j.dominante) return;
      g.globalAlpha = .22; g.fillStyle = ctx.couleur(j.dominante); g.fillRect(i * cw + .5, haut, Math.max(1, cw - 1), bas - haut);
    });
    g.globalAlpha = .18; g.fillStyle = encre; g.fillRect(0, y(0), W, 1);                   // ligne du temps moyen
    g.globalAlpha = .5; g.fillText(t('éclaircie'), 0, haut - 3); g.fillText(t('orage'), 0, bas + 11);
    // courbe : on relie les jours écrits
    const pts = jours.map((j, i) => j.n ? [i * cw + cw / 2, y(j.valeur), j] : null).filter(Boolean);
    g.globalAlpha = .9; g.lineWidth = 1.5; g.strokeStyle = encre; g.beginPath();
    pts.forEach(([x, yy], i) => i ? g.lineTo(x, yy) : g.moveTo(x, yy)); g.stroke();
    pts.forEach(([x, yy, j]) => { g.globalAlpha = 1; g.fillStyle = ctx.couleur(j.dominante); g.fillRect(x - 3, yy - 3, 6, 6); g.strokeStyle = encre; g.lineWidth = 1; g.strokeRect(x - 3, yy - 3, 6, 6); });
    g.globalAlpha = .5; g.fillStyle = encre; g.fillText(t('{n} j', { n: periode }), 0, H - 2); g.textAlign = 'right'; g.fillText(t('aujourd’hui'), W, H - 2);
  }

  function rendre() {
    zone.replaceChildren(el('button', { id: 'ana-fermer', 'aria-label': t('Fermer'), onclick: () => { zone.hidden = true; } }, '×'));
    const onglets = el('div', { class: 'onglets' });
    [['meteo', t('Humeurs')], ['bilan', t('Le mois')]].forEach(([k, nom]) => onglets.append(el('button', { 'aria-pressed': k === onglet, onclick: () => { onglet = k; rendre(); } }, nom)));
    zone.append(onglets);

    if (onglet === 'meteo') {
      const sel = el('div', { class: 'grille' });
      [30, 90].forEach(p => sel.append(el('button', { 'aria-pressed': p === periode, onclick: () => { periode = p; rendre(); } }, t('{n} jours', { n: p }))));
      const jours = meteo(ctx.entries(), periode), canvas = el('canvas', { class: 'meteo', role: 'img', 'aria-label': t('Courbe de l’humeur dans le temps') });
      zone.append(sel, canvas, el('p', { class: 'texte-ana' }, resumeMeteo(jours)));
      const lg = el('div', { class: 'legende' }); Object.keys(VALENCE).forEach(k => lg.append(el('span', {}, el('i', { style: 'background:' + ctx.couleur(k) }), t({ joie: 'joie', calme: 'calme', elan: 'élan', melancolie: 'mélancolie', tempete: 'tempête' }[k] || k))));
      zone.append(lg);
      requestAnimationFrame(() => dessinerMeteo(canvas, jours));
    } else {
      const b = bilanMois(ctx.entries(), annee, mois);
      const nav = el('div', { class: 'nav-mois' },
        el('button', { 'aria-label': t('Mois précédent'), onclick: () => { mois--; if (mois < 0) { mois = 11; annee--; } rendre(); } }, '←'),
        el('strong', {}, b.titre),
        el('button', { 'aria-label': t('Mois suivant'), onclick: () => { mois++; if (mois > 11) { mois = 0; annee++; } rendre(); } }, '→'));
      zone.append(nav);
      b.phrases.forEach(p => zone.append(el('p', { class: 'texte-ana' }, p)));
      if (b.ids.length > 1) zone.append(el('button', { class: 'plein', onclick: () => ctx.survoler(b.ids, t('Bilan') + ' · ' + b.titre) }, t('Survoler le mois')));
    }
  }
  return Object.assign(rendre, { ouvrir: o => { if (o) onglet = o; zone.hidden = false; rendre(); } });
}
