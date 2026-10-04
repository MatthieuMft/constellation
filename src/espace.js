// v78 : une seule mise en page pour les espaces du menu (Ma semaine, Mon journal, Suivi, Ma lueur et mon ciel).
// Une page plein écran : un en-tête (titre, une ligne dessous, ×), puis des sections aux titres en petites capitales,
// des rangées (pictogramme, nom, ligne d'aide, ›) et des cartes. Matthieu : « tout est un peu éparpillé ».
import { t } from './langue.js';
import { PICTOS } from './pictos.js';

export const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k === 'html' ? n.innerHTML = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};

let ouverte = null;
export const fermerEspace = () => { if (ouverte) { ouverte.remove(); ouverte = null; } };
export const espaceOuvert = () => !!ouverte;
// tete : un nœud à la place du titre (ex. le champ de recherche de Mon journal)
export function ouvrirEspace({ titre, sous = null, tete = null, classe = '' }, ...corps) {
  fermerEspace();
  const zone = el('div', { class: 'album-corps e-corps' }, ...corps);
  ouverte = el('div', { class: 'album-ecran espace ' + classe, role: 'dialog', 'aria-label': titre },
    el('div', { class: 'album-tete e-tete' }, tete || el('div', {}, el('strong', {}, titre), sous ? el('small', {}, sous) : null),
      el('button', { type: 'button', class: 'fermer', 'aria-label': t('Fermer'), onclick: fermerEspace }, '×')),
    zone);
  ouverte.addEventListener('keydown', e => { if (e.key === 'Escape' && !/INPUT|TEXTAREA/.test(e.target.tagName)) fermerEspace(); });
  document.body.append(ouverte);
  return { ecran: ouverte, corps: zone };
}
export const titreSection = txt => el('p', { class: 'album-lab' }, txt);
// une rangée : on la touche, l'espace se ferme (sauf garder) et l'action part
export function rangee({ ic, nom, sous, d, garder = false, action }) {
  return el('button', { type: 'button', class: 'm-ligne e-ligne', onclick: () => { if (!garder) fermerEspace(); action(); } },
    ic && PICTOS[ic] ? el('span', { class: 'm-ic', html: PICTOS[ic] }) : null,
    el('span', { class: 'm-t' }, nom, sous ? el('small', {}, sous) : null),
    d ? el('span', { class: 'm-d' }, d) : null, el('span', { class: 'm-chev' }, '›'));
}
export const groupe = (...rangees) => el('div', { class: 'e-groupe' }, ...rangees);
