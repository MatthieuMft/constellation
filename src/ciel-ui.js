// Le panneau « Personnaliser mon ciel » : ambiances, matière, lumière, humeurs, astres, animations et looks.
// On n'y règle que ce qui a été débloqué dans la boutique. La Nuit est toujours là ; les autres ambiances montrent leur prix
// et mènent à la boutique. Les looks (une ambiance enregistrée, retrouvée d'un toucher) ont quitté les Réglages pour venir ici.
//
// API : const cielUI = monterCielPerso({ zone, corps, ctx }) → { ouvrir(cle?), fermer(), rendre(), ouvert() }
//   zone : la feuille #perso-ciel (bouton #ciel-fermer) ; corps : #ciel-corps ; ouvrir('brume') fait défiler jusqu'à ce réglage et le fait briller
//   ctx = { lire(), maj(patch), themes, moods, couleur(k), remplacer(r), basculer(cle), boutique(cle?) }
//     lire / maj / remplacer : les réglages R de main.js (valeurs enregistrées ; le rendu, lui, passe par etoiles.reglagesEffectifs)
//     themes : THEMES ; moods : MOODS ; couleur(k) : couleur actuelle d'une humeur
//     basculer(cle) : allume / éteint un astre ou une animation achetés ; boutique(cle?) : ouvre la boutique (onglet « Ton ciel » ou l'article)
import { t, tn, EN } from './langue.js';
import * as E from './etoiles.js';

const CLE_LOOKS = 'constellation.looks.v1';
const lireLooks = () => { try { return JSON.parse(localStorage.getItem(CLE_LOOKS)) || {}; } catch (e) { return {}; } };
const ecrireLooks = l => { try { localStorage.setItem(CLE_LOOKS, JSON.stringify(l)); } catch (e) {} };

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : k.startsWith('aria-') && typeof v === 'boolean' ? n.setAttribute(k, String(v)) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};

// [article, champ de R, nom, min, max]

export function monterCielPerso({ zone, corps, ctx }) {
  // v20 : sur téléphone, plein écran avec le ciel en direct en haut (ctx.apercuCiel recopie l'image du ciel dans ce canvas)
  if (ctx.apercuCiel) { const c = el('canvas', { width: '720', height: '440', 'aria-hidden': 'true' }); corps.before(el('div', { class: 'bq-apercu apercu-ciel' }, c)); ctx.apercuCiel(c); zone.classList.add('plein'); }
  const section = (titre, cle, ...contenu) => el('section', { class: 'reg-section', 'data-groupe': cle }, el('h2', {}, titre), ...contenu);

  function rendre() {
    const R = ctx.lire(), a = k => E.possede(k), blocs = [];

    // ambiances : de vraies miniatures du dégradé et d'une étoile ; celles qui ne sont pas à toi montrent leur prix
    const tuiles = el('div', { class: 'tuiles' });
    Object.entries(ctx.themes).forEach(([k, th]) => {
      const art = E.articles('ciel').find(x => x.champ === 'theme' && x.val === k), libre = !art || a(art.cle);
      const b = el('button', { class: 'tuile' + (libre ? '' : ' verrou'), 'data-cle': art ? art.cle : null, 'aria-pressed': libre ? k === R.theme : null,
        'aria-label': libre ? t('Ciel {nom}', { nom: th.nom }) : t('Ciel {nom}, à débloquer pour ✦{prix}', { nom: th.nom, prix: art.prix }),
        onclick: () => { if (!libre) { ctx.boutique(art.cle); return; } ctx.maj({ theme: k, humeurs: {} }); rendre(); } },
        el('i', { class: 'mini-etoile' }), el('span', {}, th.nom), !libre && el('b', { class: 'tuile-prix' }, el('i', { class: 'cadenas', 'aria-hidden': 'true' }), '✦ ' + art.prix));
      b.style.background = `linear-gradient(180deg, ${th.haut}, ${th.bas})`; b.style.setProperty('--etoile', th.clair ? th.ui.ink : th.etoile); b.style.setProperty('--encre', th.ui.ink);
      tuiles.append(b);
    });
    blocs.push(section(E.groupe('ciel', 'ambiance').nom, 'ambiance', tuiles));

    // humeurs : une ligne de pastilles
    if (a('couleurs-humeurs')) {
      const puces = el('div', { class: 'puces' });
      Object.entries(ctx.moods).forEach(([k, m]) => {
        const c = el('input', { type: 'color', value: ctx.couleur(k), 'aria-label': m.label });
        c.addEventListener('input', () => ctx.maj({ humeurs: { ...ctx.lire().humeurs, [k]: c.value } }));
        puces.append(el('label', { class: 'puce', title: m.label }, c, el('span', {}, m.label.slice(0, EN ? 5 : 4).toLowerCase())));
      });
      const s = section(t('Humeurs'), 'couleurs-humeurs', puces, el('button', { class: 'lien', onclick: () => { ctx.maj({ humeurs: {} }); rendre(); } }, t('rétablir')));
      s.dataset.cle = 'couleurs-humeurs'; blocs.push(s);
    }

    // astres et animations : ce qui est à toi s'allume ou s'éteint d'un toucher
    for (const g of ['astres', 'animations']) {
      const l = E.articles('ciel').filter(x => x.groupe === g && a(x.cle));
      if (l.length) blocs.push(section(E.groupe('ciel', g).nom, g, el('div', { class: 'choix' }, l.map(x => el('button', { 'aria-pressed': E.actif(x.cle), 'data-cle': x.cle, title: x.sous,
        onclick: () => { ctx.basculer(x.cle); rendre(); } }, x.nom)))));
    }

    // looks : enregistrer l'ambiance courante, la retrouver en un clic
    const nom = el('input', { type: 'text', placeholder: t('nommer cette ambiance'), maxlength: '24', 'aria-label': t('Nom du look') });
    const enregistrer = () => { const n = nom.value.trim(); if (!n) return; const l = lireLooks(); l[n] = JSON.parse(JSON.stringify(ctx.lire())); ecrireLooks(l); rendre(); };
    nom.addEventListener('keydown', e => { if (e.key === 'Enter') enregistrer(); });
    const chips = el('div', { class: 'chips' });
    Object.entries(lireLooks()).forEach(([n, look]) => chips.append(el('span', { class: 'chip' },
      el('button', { onclick: () => { ctx.remplacer({ ...look, humeurs: { ...(look.humeurs || {}) } }); rendre(); } }, n),
      el('button', { class: 'chip-x', 'aria-label': t('Supprimer') + ' ' + n, onclick: () => { const l = lireLooks(); delete l[n]; ecrireLooks(l); rendre(); } }, '×'))));
    blocs.push(section(t('Looks'), 'looks', el('div', { class: 'rang-reg' }, nom, el('button', { 'aria-label': t('Enregistrer'), onclick: enregistrer }, '+')), chips));

    const reste = E.restants('ciel');
    blocs.push(el('p', { class: 'reg-note' }, reste ? tn(reste, 'Encore {n} chose à débloquer pour ton ciel dans la boutique.', 'Encore {n} choses à débloquer pour ton ciel dans la boutique.') : t('Tout est débloqué pour ton ciel.')),
      el('div', { class: 'choix' }, el('button', { onclick: () => ctx.boutique() }, t('Ouvrir la boutique'))));
    corps.replaceChildren(...blocs);
  }
  function briller(cle) {
    const n = cle && (corps.querySelector(`[data-cle="${cle}"]`) || corps.querySelector(`[data-groupe="${(E.article(cle) || {}).groupe}"]`)); if (!n) return;
    const r = n.getBoundingClientRect(), rc = corps.getBoundingClientRect(); corps.scrollTop += (r.top - rc.top) - 12;
    n.classList.remove('eclat'); void n.offsetWidth; n.classList.add('eclat'); setTimeout(() => n.classList.remove('eclat'), 1900);
  }

  const ouvrir = cle => { rendre(); zone.hidden = false; corps.scrollTop = 0; if (typeof cle === 'string') requestAnimationFrame(() => briller(cle)); };
  const fermer = () => { zone.hidden = true; };
  zone.querySelector('#ciel-fermer').addEventListener('click', fermer);
  return { ouvrir, fermer, rendre, ouvert: () => !zone.hidden };
}
