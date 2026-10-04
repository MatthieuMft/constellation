// v77 : mon livre du mois (Matthieu). Le mois mis en page comme un petit livre : une couverture (le mois, les jours écrits,
// les constellations nées), puis une page par jour écrit (la date, l'humeur, le texte avec ses titres et listes, les photos).
// « Enregistrer en PDF » ouvre l'impression du téléphone (choisir « Enregistrer au format PDF ») : seul le livre est imprimé.
import { t, tn, LOC } from './langue.js';
import { blocs } from './jour.js';
import { dateDeCle } from './store.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};

// ctx : { items(), humeur(cle) → { mood, color } | null, couleur(mood), nomHumeur(mood), constellations(mois) → [{ nom, image (dataURL) }], mediaUrl(cle) }
export function creerLivre(ctx) {
  let ecran = null, mois = null;
  const fermer = () => { if (ecran) ecran.remove(); ecran = null; document.body.classList.remove('livre-ouvert'); };
  const moisAvec = () => [...new Set(ctx.items().filter(i => !i.sample && i.jour).map(i => i.jour.slice(0, 7)))].sort();
  function pages() {
    const notes = ctx.items().filter(i => !i.sample && i.jour && i.jour.startsWith(mois + '-')).sort((a, b) => a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : a.date - b.date);
    const jours = [...new Set(notes.map(i => i.jour))], nomMois = dateDeCle(mois + '-15').toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
    const mots = notes.reduce((s, i) => s + ((i.titre || '') + ' ' + (i.texte || '')).split(/\s+/).filter(Boolean).length, 0), cons = ctx.constellations(mois);
    const couverture = el('section', { class: 'livre-page livre-couverture' },
      el('p', { class: 'livre-sur' }, t('Mon journal')), el('h1', {}, nomMois.charAt(0).toUpperCase() + nomMois.slice(1)),
      el('p', { class: 'livre-chiffres' }, tn(jours.length, '{n} jour écrit', '{n} jours écrits') + ' · ' + tn(mots, '{n} mot', '{n} mots')),
      cons.length ? el('div', { class: 'livre-cons' }, cons.map(c => el('figure', {}, el('img', { src: c.image, alt: '' }), el('figcaption', {}, c.nom)))) : null);
    const L = [couverture];
    for (const k of jours) {
      const h = ctx.humeur(k), c = h ? (h.color || ctx.couleur(h.mood)) : null, d = dateDeCle(k);
      const page = el('section', { class: 'livre-page' },
        el('div', { class: 'livre-tete' }, el('small', {}, d.toLocaleDateString(LOC, { weekday: 'long' })), el('h2', {}, d.toLocaleDateString(LOC, { day: 'numeric', month: 'long' })),
          h ? el('p', { class: 'livre-humeur' }, el('i', { style: 'background:' + c }), ctx.nomHumeur(h.mood)) : null));
      for (const i of notes.filter(n => n.jour === k)) {
        if (i.titre) page.append(el('h3', {}, i.titre));
        if (i.texte) page.append(el('div', { class: 'livre-texte' }, blocs(i.texte)));
        if (i.legende) page.append(el('p', {}, i.legende));
        const medias = (i.medias || []).concat(i.media ? [i.media] : []).filter(m => m.kind === 'image');
        if (medias.length) { const g = el('div', { class: 'livre-photos' }); page.append(g); medias.forEach(m => ctx.mediaUrl(m.cle).then(u => { if (u) g.append(el('img', { src: u, alt: '' })); })); }
      }
      L.push(page);
    }
    if (!jours.length) L.push(el('section', { class: 'livre-page' }, el('p', { class: 'livre-vide' }, t('Aucun jour écrit ce mois-ci.'))));
    return L;
  }
  function rendre() {
    const M = moisAvec(), i = M.indexOf(mois), nomMois = dateDeCle(mois + '-15').toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
    ecran.querySelector('.livre-mois').textContent = nomMois;
    ecran.querySelector('.livre-prec').disabled = i <= 0; ecran.querySelector('.livre-suiv').disabled = i < 0 || i >= M.length - 1;
    ecran.querySelector('.livre-pages').replaceChildren(...pages()); ecran.querySelector('.livre-pages').scrollTop = 0;
  }
  function changer(delta) { const M = moisAvec(), k = M[M.indexOf(mois) + delta]; if (k) { mois = k; rendre(); } }
  function ouvrir(m = null) {
    fermer(); const M = moisAvec(); if (!M.length) return false;
    mois = m && M.includes(m) ? m : M[M.length - 1];
    ecran = el('div', { class: 'livre-ecran', role: 'dialog', 'aria-label': t('Mon livre du mois') },
      el('div', { class: 'livre-barre' },
        el('button', { type: 'button', class: 'livre-prec nav-jour', 'aria-label': t('Mois précédent'), onclick: () => changer(-1) }, '‹'),
        el('strong', { class: 'livre-mois' }),
        el('button', { type: 'button', class: 'livre-suiv nav-jour', 'aria-label': t('Mois suivant'), onclick: () => changer(1) }, '›'),
        el('button', { type: 'button', class: 'fermer', 'aria-label': t('Fermer'), onclick: fermer }, '×')),
      el('div', { class: 'livre-pages' }),
      el('div', { class: 'livre-pied' }, el('span', {}, t('Puis choisis « Enregistrer au format PDF ».')), el('button', { type: 'button', class: 'plein', onclick: () => window.print() }, t('Enregistrer en PDF'))));
    ecran.addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); });
    document.body.append(ecran); document.body.classList.add('livre-ouvert'); rendre(); return true;
  }
  return { ouvrir, fermer, ouvert: () => !!ecran };
}
