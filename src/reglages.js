// Réglages : ce qui reste gratuit (mouvement, rappel du soir, langue, données, aide).
// L'apparence du ciel (ambiances, matière, lumière, humeurs, looks) se débloque dans la boutique : voir ciel-ui.js.
import { t, LANGUE, changer } from './langue.js';
const CLE = 'constellation.reglages.v1';

export const DEFAUT = { theme: 'nuit', lueur: .7, brume: 1, vitesse: .35, flou: .5, scintillement: 1, animation: 1, cinema: .8, humeurs: {} };

export function chargerReglages() {
  try { const r = JSON.parse(localStorage.getItem(CLE)); if (r) return { ...DEFAUT, ...r, humeurs: { ...(r.humeurs || {}) } }; } catch (e) {}
  return { ...DEFAUT, humeurs: {} };
}
export function sauverReglages(r) { try { localStorage.setItem(CLE, JSON.stringify(r)); } catch (e) {} }

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : n.setAttribute(k, v));
  n.append(...enfants); return n;
};

// un curseur fin (classe fil) : nom, valeur, piste. Partagé avec ciel-ui.js.
const pct = (v, min, max) => Math.round((v - min) / (max - min) * 100) + '%';
export function fil(R, [k, nom, min, max], maj) {
  const sortie = el('output', {}, (+R[k]).toFixed(2));
  const i = el('input', { type: 'range', min, max, step: .05, value: R[k], 'aria-label': nom });
  i.style.setProperty('--v', pct(R[k], min, max));
  i.addEventListener('input', () => { sortie.textContent = (+i.value).toFixed(2); i.style.setProperty('--v', pct(+i.value, min, max)); maj({ [k]: +i.value }); });
  return el('label', { class: 'fil' }, el('span', {}, nom), sortie, i);
}

// ctx : { lire(), maj(patch), rappel?, extras?() }   (themes, moods, couleur, remplacer : acceptés, plus utilisés ici)
// Panneau en tiroir : mouvement, rappel du soir, langue, puis données et aide.
export function monterReglages(zone, ctx) {
  function section(titre, ...contenu) { return el('section', { class: 'reg-section' }, el('h2', {}, titre), ...contenu); }

  function rendre() {
    const R = ctx.lire(); zone.replaceChildren();
    zone.append(el('button', { id: 'reg-fermer', 'aria-label': t('Fermer'), onclick: () => { zone.hidden = true; } }, '×'), el('h1', { class: 'reg-titre' }, t('Réglages')));

    // mouvement (accessibilité) : à 0, le ciel ne bouge plus du tout
    zone.append(section(t('Mouvement'), fil(R, ['animation', t('Animation du ciel'), 0, 2], ctx.maj),
      el('p', { class: 'note-reg' }, t('À 0, le ciel reste immobile : plus d’ondes, de dérive ni de passages.'))));

    // rappel du soir : une notification à l'heure choisie, sur ordinateur comme sur smartphone
    if (ctx.rappel) {
      const r = ctx.rappel, c = r.config();
      const bascule = el('button', { 'aria-pressed': String(c.actif), onclick: async () => { await r.maj({ actif: !r.config().actif }); rendre(); } }, c.actif ? t('Activé') : t('Désactivé'));
      const heure = el('input', { type: 'time', value: c.heure, 'aria-label': t('Heure du rappel') });
      heure.addEventListener('change', async () => { if (heure.value) { await r.maj({ heure: heure.value }); rendre(); } });
      const p = r.permission();
      const etat = t(!r.supporte() ? 'Ce navigateur ne gère pas les notifications : le rappel apparaît dans l’appli quand elle est ouverte.'
        : p === 'granted' ? 'Notifications autorisées. Le rappel s’affiche si rien n’est écrit ce jour-là.'
        : p === 'denied' ? 'Notifications bloquées dans le navigateur : le rappel n’apparaît que dans l’appli ouverte.'
        : 'Au premier activage, le navigateur vous demande l’autorisation.');
      zone.append(section(t('Rappel du soir'),
        el('div', { class: 'bascule' }, el('span', {}, t('Rappel quotidien')), bascule),
        el('div', { class: 'bascule' }, el('span', {}, t('Heure')), heure),
        el('button', { class: 'lien', onclick: () => r.tester() }, t('envoyer un test')),
        el('p', { class: 'note-reg' }, etat + ' ' + t('Appli fermée : il faut l’avoir installée (Chrome, Edge, Android) ; sur iPhone, ajoutez-la d’abord à l’écran d’accueil.'))));
    }

    // langue : un appui recharge l'appli dans l'autre langue (les exemples intacts suivent)
    zone.append(section('Langue · Language', el('div', { class: 'choix' },
      el('button', { 'aria-pressed': String(LANGUE === 'fr'), lang: 'fr', onclick: () => changer('fr') }, 'Français'),
      el('button', { 'aria-pressed': String(LANGUE === 'en'), lang: 'en', onclick: () => changer('en') }, 'English'))));
    // données, aide… : ce qui ne mérite pas une ligne dans le menu
    let extras = []; try { extras = ctx.extras ? ctx.extras() : []; } catch (e) {}   // au tout premier rendu, main.js n'est pas encore prêt
    extras.forEach(([titre, boutons]) => boutons.length && zone.append(section(titre, el('div', { class: 'choix' }, ...boutons.map(([nom, action]) => el('button', { onclick: action }, nom))))));
  }
  rendre();
  return rendre;
}
