// v74 : chercher dans mon journal (Matthieu). Un mot, plusieurs mots, un @prénom ou un #lieu : tous les jours où ils apparaissent,
// du plus récent au plus ancien, avec le passage trouvé surligné. Sans accents ni majuscules à respecter.
// Rien trouvé mot pour mot : les notes qui s'en approchent (mots de la même famille, empreinte locale d'embed.js, sans internet).
import { t, tn, LOC } from './langue.js';
import { dateDeCle } from './store.js';
import { legere, cos } from './embed.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};
// texte « à plat » (sans accents, en minuscules) et, pour chaque lettre à plat, sa place dans le texte d'origine
function aplatir(s) {
  let plat = ''; const ori = [];
  for (let i = 0; i < s.length; i++) { const p = s[i].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); for (const c of p) { plat += c; ori.push(i); } }
  return { plat, ori };
}
const propre = s => (s || '').replace(/^#{1,4} +|^[-•*>] +|^\d+\. +|^-{3,}$/gm, '').replace(/[ \t]+/g, ' ');

// ctx : { items(), couleur(item), ouvrirJour(cle) → relire ce jour, surligner(jours, libelle) }
export function creerRecherche(ctx) {
  let ecran = null, minuteur = null;
  const fermer = () => { clearTimeout(minuteur); if (ecran) ecran.remove(); ecran = null; };
  const notes = () => ctx.items().filter(i => !i.sample && ((i.texte || '').trim() || (i.titre || '').trim() || (i.legende || '').trim())).sort((a, b) => b.date - a.date);
  function trouver(q) {
    const mots = aplatir(q.trim()).plat.split(/\s+/).filter(Boolean); if (!mots.length) return { exacts: [], proches: [] };
    const exacts = [];
    for (const i of notes()) {
      const brut = propre([i.titre, i.texte, i.legende].filter(Boolean).join('\n')), { plat, ori } = aplatir(brut);
      const pos = mots.map(m => plat.indexOf(m)); if (pos.some(p => p < 0)) continue;
      exacts.push({ item: i, brut, debut: ori[pos[0]], fin: ori[pos[0] + mots[0].length - 1] + 1 });
    }
    let proches = [];
    if (!exacts.length && q.trim().length >= 3 && !/^[@#]/.test(q.trim())) {
      const v = legere(q);
      proches = notes().map(i => ({ item: i, brut: propre([i.titre, i.texte].filter(Boolean).join('\n')), s: cos(v, legere((i.titre || '') + ' ' + (i.texte || ''))) }))
        .filter(x => x.s > .12).sort((a, b) => b.s - a.s).slice(0, 5);
    }
    return { exacts, proches };
  }
  function extrait(r) {                                                  // une ligne autour du passage trouvé, le mot surligné
    const s = r.brut.replace(/\n+/g, ' · ');
    if (r.debut == null) { const x = s.trim(); return [x.length > 150 ? x.slice(0, 148) + '…' : x]; }
    const decal = (r.brut.slice(0, r.debut).match(/\n+/g) || []).reduce((a, m) => a + 3 - m.length, 0), d = r.debut + decal, f = r.fin + decal;
    const a = Math.max(0, d - 60), b = Math.min(s.length, f + 90);
    return [(a > 0 ? '…' : '') + s.slice(a, d), el('mark', {}, s.slice(d, f)), s.slice(f, b) + (b < s.length ? '…' : '')];
  }
  function ligne(r) {
    const i = r.item, c = ctx.couleur(i);
    const b = el('button', { type: 'button', class: 'album-etoile', onclick: () => { fermer(); ctx.ouvrirJour(i.jour); } },
      el('time', {}, dateDeCle(i.jour).toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })), el('span', {}, extrait(r)));
    if (c) b.style.setProperty('--c', c); return b;
  }
  function rendre() {
    const q = ecran.querySelector('input').value, zone = ecran.querySelector('.cherche-res');
    if (q.trim().length < 2) { zone.replaceChildren(el('p', { class: 'album-vide' }, t('Un mot, un @prénom ou un #lieu.'))); return; }
    const { exacts, proches } = trouver(q);
    if (exacts.length) {
      const jours = new Set(exacts.map(r => r.item.jour));
      zone.replaceChildren(el('p', { class: 'album-lab' }, tn(jours.size, '{n} jour', '{n} jours')),
        el('button', { type: 'button', class: 'album-ciel', onclick: () => { fermer(); ctx.surligner(jours, q.trim()); } }, t('Voir dans le ciel')),
        el('div', { class: 'album-etoiles' }, exacts.map(ligne)));
    } else if (proches.length) {
      zone.replaceChildren(el('p', { class: 'album-vide' }, t('Pas ce mot exact. Des notes qui s’en approchent :')), el('div', { class: 'album-etoiles' }, proches.map(ligne)));
    } else zone.replaceChildren(el('p', { class: 'album-vide' }, t('Rien trouvé dans ton journal.')));
  }
  function ouvrir(q = '') {
    fermer();
    const champ = el('input', { type: 'search', value: q, placeholder: t('Chercher dans mon journal'), 'aria-label': t('Chercher dans mon journal'), autocomplete: 'off', enterkeyhint: 'search' });
    ecran = el('div', { class: 'album-ecran cherche-ecran', role: 'dialog', 'aria-label': t('Chercher dans mon journal') },
      el('div', { class: 'album-tete' }, champ, el('button', { type: 'button', class: 'fermer', 'aria-label': t('Fermer'), onclick: fermer }, '×')),
      el('div', { class: 'album-corps' }, el('div', { class: 'cherche-res' })));
    champ.addEventListener('input', () => { clearTimeout(minuteur); minuteur = setTimeout(rendre, 160); });
    champ.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } if (e.key === 'Enter') { e.preventDefault(); champ.blur(); } e.stopPropagation(); });
    document.body.append(ecran); rendre(); champ.focus();
  }
  return { ouvrir, fermer, ouvert: () => !!ecran, trouver };
}
