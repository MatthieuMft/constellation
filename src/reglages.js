// Réglages : ce qui reste gratuit (mouvement, rappel du soir, langue, données, aide).
// L'apparence du ciel (ambiances, matière, lumière, humeurs, looks) se débloque dans la boutique : voir ciel-ui.js.
import { t, LANGUE, changer } from './langue.js';
import { PICTOS } from './pictos.js';
const CLE = 'constellation.reglages.v1';

export const DEFAUT = { theme: 'nuit', lueur: .7, brume: 1, vitesse: .35, flou: .5, scintillement: 1, animation: 1, cinema: .8, joystick: false, humeurs: {} };   // v52 : joystick caché par défaut

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
// v52 : une page d'accueil rangée par groupes (Chaque jour, Affichage, Protection, Aide), chaque ligne ouvre sa petite page.
// « Tout effacer » est isolé en bas de Mes données. Les extras (données, son, verrou, aide) viennent de main.js : [titre, boutons, cle].
export function monterReglages(zoneP, ctx) {
  const zone = zoneP.querySelector('#reg-corps'), titre = zoneP.querySelector('.p-titre'); let page = null;
  zoneP.querySelector('#reg-fermer').addEventListener('click', () => { zoneP.hidden = true; page = null; });
  const retour = el('button', { type: 'button', class: 'reg-retour', hidden: '', onclick: () => { page = null; rendre(); } }, '‹ ' + t('Réglages'));
  titre.before(retour);
  const section = (...contenu) => el('section', { class: 'reg-section' }, ...contenu);
  const choix = boutons => el('div', { class: 'choix' }, ...boutons.map(([nom, action, cls]) => el('button', { onclick: action, class: cls || '' }, nom)));

  function pages() {
    const R = ctx.lire(), P = {};
    P.mouvement = { titre: t('Mouvement'), sous: t('Animation du ciel') + ' ' + (+R.animation).toFixed(2) + ' · ' + t('joystick') + ' : ' + t(R.joystick ? 'oui' : 'non'), corps: () => section(
      fil(R, ['animation', t('Animation du ciel'), 0, 2], ctx.maj),
      el('p', { class: 'note-reg' }, t('À 0, le ciel reste immobile : plus d’ondes, de dérive ni de passages.')),
      el('div', { class: 'bascule' }, el('span', {}, t('Joystick à l’écran')), el('button', { 'aria-pressed': String(!!R.joystick), onclick: () => { ctx.maj({ joystick: !ctx.lire().joystick }); rendre(); } }, t(R.joystick ? 'oui' : 'non'))),
      el('p', { class: 'note-reg' }, t('Les gestes suffisent : glisse pour tourner, pince pour zoomer, deux doigts pour te déplacer.'))) };
    if (ctx.rappel) {
      const r = ctx.rappel, c = r.config();
      P.rappel = { titre: t('Rappel du soir'), sous: (c.actif ? t('Activé') : t('Désactivé')) + ' · ' + c.heure, corps: () => {
        const bascule = el('button', { 'aria-pressed': String(c.actif), onclick: async () => { await r.maj({ actif: !r.config().actif }); rendre(); } }, c.actif ? t('Activé') : t('Désactivé'));
        const heure = el('input', { type: 'time', value: c.heure, 'aria-label': t('Heure du rappel') });
        heure.addEventListener('change', async () => { if (heure.value) { await r.maj({ heure: heure.value }); rendre(); } });
        const p = r.permission();
        const etat = t(!r.supporte() ? 'Ce navigateur ne gère pas les notifications : le rappel apparaît dans l’appli quand elle est ouverte.'
          : p === 'granted' ? 'Notifications autorisées. Le rappel s’affiche si rien n’est écrit ce jour-là.'
          : p === 'denied' ? 'Notifications bloquées dans le navigateur : le rappel n’apparaît que dans l’appli ouverte.'
          : 'Au premier activage, le navigateur vous demande l’autorisation.');
        return section(el('div', { class: 'bascule' }, el('span', {}, t('Rappel quotidien')), bascule), el('div', { class: 'bascule' }, el('span', {}, t('Heure')), heure),
          el('button', { class: 'lien', onclick: () => r.tester() }, t('envoyer un test')),
          el('p', { class: 'note-reg' }, etat + ' ' + t('Appli fermée : il faut l’avoir installée (Chrome, Edge, Android) ; sur iPhone, ajoutez-la d’abord à l’écran d’accueil.')));
      } };
    }
    P.langue = { titre: 'Langue · Language', sous: LANGUE === 'fr' ? 'Français' : 'English', corps: () => section(el('div', { class: 'choix' },
      el('button', { 'aria-pressed': String(LANGUE === 'fr'), lang: 'fr', onclick: () => changer('fr') }, 'Français'),
      el('button', { 'aria-pressed': String(LANGUE === 'en'), lang: 'en', onclick: () => changer('en') }, 'English'))) };
    let extras = []; try { extras = ctx.extras ? ctx.extras() : []; } catch (e) {}   // au tout premier rendu, main.js n'est pas encore prêt
    for (const [titreX, boutons, cle, sous] of extras) if (boutons.length) P[cle] = { titre: titreX, sous, corps: () => {
      const normaux = boutons.filter(b => b[2] !== 'danger'), danger = boutons.filter(b => b[2] === 'danger');
      const f = document.createDocumentFragment(); f.append(section(choix(normaux)));
      if (danger.length) f.append(el('section', { class: 'reg-section reg-danger' }, el('h2', {}, t('Zone sensible')), choix(danger), el('p', { class: 'note-reg' }, t('Demande deux confirmations. Exporte ton journal avant.'))));
      return f;
    } };
    return P;
  }
  const GROUPES = () => [[t('Chaque jour'), ['rappel', 'son']], [t('Affichage'), ['langue', 'mouvement']], [t('Protection'), ['verrou', 'donnees']], [t('Aide'), ['aide']]];

  function rendre() {
    const P = pages(); zone.replaceChildren(); zone.scrollTop = 0;
    if (page && !P[page]) page = null;
    retour.hidden = !page; titre.textContent = page ? P[page].titre : t('Réglages'); zoneP.classList.toggle('dedans', !!page);
    if (page) { zone.append(P[page].corps()); return; }
    for (const [g, cles] of GROUPES()) {
      const ok = cles.filter(k => P[k]); if (!ok.length) continue;
      zone.append(el('h2', { class: 'reg-groupe' }, g));
      for (const k of ok) {
        const b = el('button', { type: 'button', class: 'm-ligne', onclick: () => { page = k; rendre(); } });
        const ic = el('span', { class: 'm-ic' }); ic.innerHTML = PICTOS[k] || ''; const tx = el('span', { class: 'm-t' }, P[k].titre);
        if (P[k].sous) tx.append(el('small', {}, P[k].sous));
        b.append(ic, tx, el('span', { class: 'm-chev' }, '›')); zone.append(b);
      }
    }
  }
  rendre();
  return rendre;
}
