// L'intérieur d'une étoile : la journée, avec son humeur et ses entrées de journal (photos et vidéos comprises).
// Les anciennes notes, tâches et médias s'affichent dans le même fil, comme du journal : rien n'est perdu.
import { MOODS, dateDeCle } from './store.js';
import { t, tn, LOC } from './langue.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};
// le texte d'une entrée : « # », « ## », « ### » → titres, « - » → puces, « 1. » → liste numérotée, le reste → paragraphes
function blocs(texte) {
  const out = []; let para = [];
  const pousser = () => { const s = para.join('\n').replace(/^\n+|\n+$/g, ''); if (s) out.push(el('p', {}, s)); para = []; };
  let liste = null;
  const fermer = () => { if (liste) { out.push(liste); liste = null; } };
  for (const l of texte.split('\n')) {
    const m = l.match(/^(#{1,3}) +(.*)$/), pu = l.match(/^[-•*] +(.*)$/), nu = l.match(/^(\d+)\. +(.*)$/);
    if (m && m[2].trim()) { pousser(); fermer(); out.push(el('h4', { class: 'titre-' + m[1].length }, m[2])); }
    else if (pu || nu) {
      pousser(); const tag = pu ? 'ul' : 'ol';
      if (!liste || liste.tagName.toLowerCase() !== tag) { fermer(); liste = el(tag, nu && +nu[1] !== 1 ? { start: nu[1] } : {}); }
      liste.append(el('li', {}, pu ? pu[1] : nu[2]));
    } else { fermer(); para.push(l); }
  }
  pousser(); fermer(); return out;
}
const heure = ms => new Date(ms).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' });

// ctx : { items(cle), humeur(cle), setHumeur(cle, mood, couleur), couleur(k), ajouter(cle), modifier(item), supprimer(item), basculerFait(item, fait), voirMedia(item, media), mediaUrl(cle) }
export function monterJour(zone, ctx) {
  let cle = null;

  function carteTexte(item) {
    const c = item.type === 'journal' && item.mood ? (item.color || ctx.couleur(item.mood)) : null;
    const carte = el('article', { class: 'carte carte-' + item.type });
    if (c) carte.style.setProperty('--c', c);
    carte.append(el('div', { class: 'tete' }, item.sample ? el('span', { class: 'exemple', title: t('Entrée inventée pour l’exemple') }, t('exemple')) : null, el('time', {}, heure(item.date)), actions(item)));
    if (item.titre) carte.append(el('h3', {}, item.titre));
    if (item.texte) carte.append(...blocs(item.texte));
    if (item.medias && item.medias.length) carte.append(grilleMedias(item, item.medias));
    const tags = ctx.tagsDe(item); if (tags.length) carte.append(el('div', { class: 'tags' }, tags.map(tg => el('button', { class: 'tag', title: t('Voir toutes les entrées #{tag}', { tag: tg }), onclick: () => ctx.filtrer(tg) }, '#' + tg))));
    return carte;
  }
  const actions = item => el('span', { class: 'actions' },
    el('button', { class: 'discret', title: t('Modifier'), 'aria-label': t('Modifier'), onclick: () => ctx.modifier(item) }, t('modifier')),
    el('button', { class: 'discret', title: t('Supprimer'), 'aria-label': t('Supprimer'), onclick: () => ctx.supprimer(item) }, t('supprimer')));

  function carteTaches(liste) {
    const faites = liste.filter(t => t.fait).length;
    const carte = el('article', { class: 'carte carte-tache' }, el('div', { class: 'tete' }, el('span', { class: 'type' }, t('Tâches')), el('time', {}, faites + ' / ' + liste.length)));
    liste.forEach(ta => carte.append(el('div', { class: 'tache' + (ta.fait ? ' fait' : '') },
      el('label', {}, el('input', { type: 'checkbox', checked: ta.fait, onchange: e => ctx.basculerFait(ta, e.target.checked) }), el('span', {}, ta.texte)),
      el('button', { class: 'discret', 'aria-label': t('Modifier la tâche'), onclick: () => ctx.modifier(ta) }, t('modifier')),
      el('button', { class: 'discret', 'aria-label': t('Supprimer la tâche'), onclick: () => ctx.supprimer(ta) }, '×'))));
    return carte;
  }

  // photos et vidéos glissées dans une entrée de journal
  function grilleMedias(item, medias) {
    const grille = el('div', { class: 'vignettes' });
    medias.forEach(m => {
      const b = el('button', { class: 'vignette', 'aria-label': t('Ouvrir {nom}', { nom: m.nom || t('le média') }), onclick: () => ctx.voirMedia(item, m) });
      ctx.mediaUrl(m.cle).then(u => {
        if (!u) { b.textContent = t('introuvable'); return; }
        b.append(m.kind === 'video' ? el('video', { src: u, muted: true, preload: 'metadata', playsinline: true }) : el('img', { src: u, alt: m.nom || '' }));
        if (m.kind === 'video') b.append(el('i', { class: 'lecture' }, '▶'));
      });
      grille.append(el('figure', {}, b));
    });
    return grille;
  }
  // ancienne entrée « média » (avant la v9) : une carte de journal avec sa photo et sa légende
  function carteMedia(item) {
    const carte = el('article', { class: 'carte carte-media' }, el('div', { class: 'tete' }, el('time', {}, heure(item.date)), actions(item)));
    carte.append(grilleMedias(item, [item.media]));
    if (item.legende) carte.append(el('p', {}, item.legende));
    return carte;
  }

  function rendre(k) {
    if (k) cle = k; if (!cle) return;
    const d = dateDeCle(cle), liste = ctx.items(cle).slice().sort((a, b) => a.date - b.date), h = ctx.humeur(cle);
    const gardeDefil = zone.scrollTop; zone.replaceChildren();
    // en-tête fixe : date + jour précédent / suivant
    const $$ = id => document.getElementById(id);
    $$('f-semaine').textContent = d.toLocaleDateString(LOC, { weekday: 'long' });
    $$('f-jour').textContent = d.toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric' });
    $$('f-suiv').disabled = cle >= ctx.aujourdhui;

    // humeur du jour (fixe, compacte) : toujours la couleur de l'étoile
    // dates qui comptent : bandeau fixe sous l'en-tête
    const dq = ctx.datesDuJour(cle), zd = $$('f-dates'); zd.replaceChildren(); zd.hidden = !dq.length;
    dq.forEach(x => zd.append(el('button', { class: 'date-chip', title: t('Modifier cette date'), onclick: () => ctx.editerDate(cle, x) }, '★ ' + x.titre + (x.annuelle && x.depuis > 0 ? ' · ' + tn(x.depuis, '{n} an', '{n} ans') : ''))));
    $$('f-date').textContent = dq.length ? '★' : '☆'; $$('f-date').classList.toggle('active', !!dq.length);
    const zh = $$('f-humeur'); zh.replaceChildren();
    const chips = el('div', { class: 'chips-humeur', role: 'radiogroup', 'aria-label': t('Humeur du jour') });
    Object.entries(MOODS).forEach(([m, v]) => { const b = el('button', { 'aria-checked': !!h && !h.color && h.mood === m, role: 'radio', title: v.label, 'aria-label': v.label, onclick: () => { ctx.setHumeur(cle, m, null); rendre(); } }); b.style.setProperty('--c', ctx.couleur(m)); chips.append(b); });
    const libre = el('input', { type: 'color', value: (h && h.color) || '#c9a0ff', 'aria-label': t('Couleur libre'), onchange: e => { ctx.setHumeur(cle, 'calme', e.target.value); rendre(); } });
    chips.append(el('label', { class: 'libre-chip', title: t('Couleur libre'), 'aria-checked': !!(h && h.color) }, libre));
    zh.append(el('span', { class: 'h-lab' }, h ? (h.color ? t('couleur libre') : (MOODS[h.mood] ? MOODS[h.mood].label : '')) : t('humeur ?')), chips);

    // un seul fil, dans l'ordre de la journée ; les anciennes tâches restent cochables, regroupées en une carte
    if (!liste.length) zone.append(el('p', { class: 'vide' }, t('Journée vide. Raconte-la.')));
    const taches = liste.filter(i => i.type === 'tache'); let tachesPosees = false;
    liste.forEach(i => {
      if (i.type === 'tache') { if (!tachesPosees) { zone.append(carteTaches(taches)); tachesPosees = true; } return; }
      zone.append(i.type === 'media' ? carteMedia(i) : carteTexte(i));
    });

    const pied = document.getElementById('f-ajout'); pied.replaceChildren(el('button', { onclick: () => ctx.ajouter(cle) }, t('+ Écrire')));
    zone.scrollTop = k ? 0 : gardeDefil;
  }
  return { rendre, cle: () => cle };
}
