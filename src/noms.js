// v60 : personnes et lieux. @Léa (une personne) et #parc (un lieu, ou un thème) écrits dans une note, ou posés sur une photo
// ou une vidéo (« Qui ? Où ? »), deviennent un album : ses photos et vidéos, puis ses étoiles, de la plus récente à la plus ancienne.
// Rien de nouveau dans le journal, sauf un champ facultatif tags: ['@Léa', '#parc'] sur un média (constellation.journal.v2, rien d'autre ne change).
import { t, tn, LOC } from './langue.js';
import { RE_NOM } from './jour.js';
import { dateDeCle } from './store.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};
const RE_TOKEN = /[@#][\p{L}\d_-]{2,30}/gu;

// ctx : { items(), couleur(item), mediaUrl(cle), voirMedia(item, m), ouvrirJour(cle), surligner(jours, libelle), sauver(), rafraichir() }
export function creerNoms(ctx) {
  const cle = (k, n) => k + n.toLowerCase();
  function nomsTexte(i) { const l = []; for (const m of ((i.titre || '') + '\n' + (i.texte || '')).matchAll(RE_NOM)) l.push([m[2], m[3]]); return l; }
  function nomsDe(i) {                                                  // [['@', 'Léa'], ['#', 'parc']] sans doublon
    const vus = new Map();
    for (const [k, n] of nomsTexte(i)) if (!vus.has(cle(k, n))) vus.set(cle(k, n), [k, n]);
    for (const m of i.medias || []) for (const x of m.tags || []) { const k = x[0], n = x.slice(1); if (!vus.has(cle(k, n))) vus.set(cle(k, n), [k, n]); }
    return [...vus.values()];
  }
  function index() {
    const M = new Map(), prendre = (k, n) => { const c = cle(k, n); let o = M.get(c); if (!o) M.set(c, o = { k, nom: n, formes: new Map(), items: new Set(), medias: [] }); o.formes.set(n, (o.formes.get(n) || 0) + 1); return o; };
    for (const i of ctx.items()) {
      const dansTexte = new Set();
      for (const [k, n] of nomsTexte(i)) { const o = prendre(k, n); o.items.add(i); dansTexte.add(o); }
      for (const m of i.medias || []) for (const x of m.tags || []) { const o = prendre(x[0], x.slice(1)); o.items.add(i); if (!o.medias.some(z => z.m === m)) o.medias.push({ item: i, m, pose: true }); }
      for (const o of dansTexte) for (const m of i.medias || []) if (!o.medias.some(z => z.m === m)) o.medias.push({ item: i, m, pose: false });   // les photos d'une note qui parle d'elle
    }
    for (const o of M.values()) { o.nom = [...o.formes].sort((a, b) => b[1] - a[1])[0][0]; o.liste = [...o.items].sort((a, b) => b.date - a.date); o.jours = new Set(o.liste.map(i => i.jour)); o.medias.sort((a, b) => (b.pose - a.pose) || (b.item.date - a.item.date)); }
    return M;
  }

  let ecran = null;
  const fermer = () => { if (ecran) ecran.remove(); ecran = null; };
  function cadre(titre, sous, ...corps) {
    fermer();
    ecran = el('div', { class: 'album-ecran', role: 'dialog', 'aria-label': titre },
      el('div', { class: 'album-tete' }, el('div', {}, el('strong', {}, titre), sous ? el('small', {}, sous) : null), el('button', { type: 'button', class: 'fermer', 'aria-label': t('Fermer'), onclick: fermer }, '×')),
      el('div', { class: 'album-corps' }, ...corps));
    document.body.append(ecran);
    return ecran;
  }
  function vignette(item, m) {
    const b = el('button', { type: 'button', class: 'vignette', 'aria-label': m.nom || t('le média'), onclick: () => ctx.voirMedia(item, m) });
    ctx.mediaUrl(m.cle).then(u => { if (!u) { b.textContent = '·'; return; } if (m.kind === 'fichier') { b.append(el('span', {}, m.nom || t('Fichier'))); return; }
      b.append(m.kind === 'video' ? el('video', { src: u, muted: true, preload: 'metadata', playsinline: true }) : el('img', { src: u, alt: '' })); if (m.kind === 'video') b.append(el('i', { class: 'lecture' }, '▶')); });
    return b;
  }
  const extrait = i => { const s = ((i.titre ? i.titre + ' · ' : '') + (i.texte || '')).replace(/^#{1,4} +|^[-•*>] +|^\d+\. +/gm, '').replace(/\s+/g, ' ').trim(); return s.length > 150 ? s.slice(0, 148) + '…' : s; };

  function album(k, n) {
    const o = index().get(cle(k, n));
    if (!o) { cadre(k + n, t('Rien pour l’instant'), el('p', { class: 'album-vide' }, t('Personne ni lieu à ce nom dans ton journal.'))); return; }
    const nbM = o.medias.filter(z => z.m.kind !== 'fichier').length;
    const sous = tn(o.jours.size, '{n} étoile', '{n} étoiles') + (nbM ? ' · ' + tn(nbM, '{n} photo ou vidéo', '{n} photos et vidéos') : '');
    const ciel = el('button', { type: 'button', class: 'album-ciel', onclick: () => { fermer(); ctx.surligner(o.jours, o.k + o.nom); } }, t('Voir dans le ciel'));
    const gal = nbM ? el('div', { class: 'album-galerie' }, o.medias.filter(z => z.m.kind !== 'fichier').map(z => vignette(z.item, z.m))) : null;
    const liste = el('div', { class: 'album-etoiles' }, o.liste.map(i => {
      const c = ctx.couleur(i), a = el('button', { type: 'button', class: 'album-etoile', onclick: () => { fermer(); ctx.ouvrirJour(i.jour); } },
        el('time', {}, dateDeCle(i.jour).toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })), el('span', {}, extrait(i) || t('(photo seulement)')));
      if (c) a.style.setProperty('--c', c); return a;
    }));
    cadre(o.k + o.nom, sous, ciel, gal ? el('p', { class: 'album-lab' }, t('Photos et vidéos')) : null, gal, el('p', { class: 'album-lab' }, t('Ses étoiles')), liste);
  }

  function page() {
    const M = [...index().values()], groupe = (k, titre) => {
      const l = M.filter(o => o.k === k).sort((a, b) => b.jours.size - a.jours.size || a.nom.localeCompare(b.nom));
      return [el('p', { class: 'album-lab' }, titre), l.length ? el('div', { class: 'album-noms' }, l.map(o => el('button', { type: 'button', onclick: () => album(o.k, o.nom) }, o.k + o.nom, el('small', {}, String(o.jours.size)))))
        : el('p', { class: 'album-vide' }, k === '@' ? t('Écris @ suivi d’un prénom dans une note, par exemple @Léa.') : t('Écris # suivi d’un lieu ou d’un thème, par exemple #parc.'))];
    };
    cadre(t('Personnes et lieux'), t('Touche un nom pour ouvrir son album'), ...groupe('@', t('Personnes')), ...groupe('#', t('Lieux et thèmes')));
  }

  function taguer(item, m) {
    document.querySelector('.qui-ou-boite')?.remove();
    const b = el('div', { class: 'qui-ou-boite boite-figure', role: 'dialog' });
    const champ = el('input', { type: 'text', value: (m.tags || []).join(' '), placeholder: '@Léa #parc' });
    const connus = [...index().values()].sort((a, c) => c.jours.size - a.jours.size).slice(0, 10);
    const ajouter = x => { const v = champ.value.trim(); if (!new RegExp('(^|\\s)' + x.replace(/[-]/g, '\\-') + '(\\s|$)', 'iu').test(v)) champ.value = (v ? v + ' ' : '') + x; champ.focus(); };
    const valider = () => {
      const l = [...new Map((champ.value.match(RE_TOKEN) || []).map(x => [x.toLowerCase(), x])).values()];
      if (l.length) m.tags = l; else delete m.tags; item.touched = Date.now(); ctx.sauver(); b.remove(); ctx.rafraichir();
    };
    champ.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); valider(); } if (e.key === 'Escape') b.remove(); e.stopPropagation(); });
    b.append(el('p', { class: 'lab' }, t('Qui ? Où ?')), el('p', { class: 'sous' }, t('@ pour une personne, # pour un lieu. Plusieurs noms possibles.')),
      el('div', { class: 'rang' }, champ, el('button', { type: 'button', onclick: valider }, 'OK')),
      connus.length ? el('div', { class: 'album-noms petits' }, connus.map(o => el('button', { type: 'button', onclick: () => ajouter(o.k + o.nom) }, o.k + o.nom))) : null,
      el('button', { type: 'button', class: 'lien annuler', onclick: () => b.remove() }, t('Annuler')));
    document.body.append(b); champ.focus();
  }

  return { nomsDe, index, album, page, taguer, fermer, ouvert: () => !!ecran };
}
