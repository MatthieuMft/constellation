// Le panneau « Personnaliser ma lueur » : on n'y trouve que ce qui a été débloqué dans la boutique, rangé par groupe.
// Choix exclusifs en rangées de boutons (le défaut gratuit d'abord), réglages avec leur contrôle, interrupteurs en bascules.
//
// API : const perso = monterPerso({ zone, corps, creature, nommer, objets })
//         → { ouvrir(cle?), fermer(), rendre(), ouvert(), rect() }   ouvrir('couleur-yeux') fait défiler jusqu'à ce réglage et le fait briller
//   creature : { perso(), personnaliser(patch), apercu(canvas) } ; nommer() : ouvrir « Changer de nom »
//   objets = { basculer(cle), boutique(cle?) }
//     basculer : allume / éteint un interrupteur acheté (etoiles.basculer + ce qui en dépend, côté main.js) ;
//                ceux de la lueur (ailes, bras, pieds, étincelles) sont ensuite recopiés ici dans creature.personnaliser.
//     boutique : ferme ce panneau et ouvre la boutique (sur l'onglet « Ta lueur », ou sur l'article cle).
import { t, tn } from './langue.js';
import * as E from './etoiles.js';
const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : k.startsWith('aria-') && typeof v === 'boolean' ? n.setAttribute(k, String(v)) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};

const COULEURS = ['#ffd98a', '#ff9ec0', '#8fd0ff', '#b9a0ff', '#8ff0c0', '#ff9a6b', '#f5f0e6'];
const DEFAUTS = { forme: t('Ronde'), texture: t('Lisse'), expression: t('Douce'), acc: t('Aucun'), habit: t('Aucun') };
const YEUX = [[t('Petits'), .85], [t('Normaux'), 1], [t('Grands'), 1.25]];

export function monterPerso({ zone, corps, creature, nommer, objets }) {
  // v20 : comme la boutique, la lueur fixe en haut, redessinée à chaque changement (plein écran sur téléphone)
  const apercu = el('canvas', { width: '480', height: '480', 'aria-hidden': 'true' });
  corps.before(el('div', { class: 'bq-apercu' }, apercu)); zone.classList.add('plein');
  const majApercu = () => { if (creature.apercu) creature.apercu(apercu); };
  // v81 (Matthieu : « ça saute sur mobile ») : choisir une couleur ne reconstruit plus la page, on met juste à jour la rangée et l'aperçu
  function pastilles(valeur, choisir, { suit = false, defaut = false } = {}) {
    const ligne = el('div', { class: 'pastilles' });
    const marquer = v => ligne.querySelectorAll('[aria-pressed]').forEach(n => n.setAttribute('aria-pressed', String(
      n.classList.contains('libre') ? !!v && !COULEURS.includes(v) : n.classList.contains('suit') || n.classList.contains('pastille-texte') ? v == null : n.dataset.c === v)));
    const surChoix = v => { choisir(v); marquer(v); majApercu(); };
    if (suit) ligne.append(el('button', { class: 'pastille suit', 'aria-pressed': valeur == null, title: t('Suit mon humeur'), 'aria-label': t('Couleur : suit mon humeur'), onclick: () => surChoix(null) }));
    COULEURS.forEach(c => { const b = el('button', { class: 'pastille', 'data-c': c, 'aria-pressed': valeur === c, 'aria-label': t('Couleur') + ' ' + c, onclick: () => surChoix(c) }); b.style.setProperty('--c', c); ligne.append(b); });
    const libre = el('input', { type: 'color', value: valeur && !COULEURS.includes(valeur) ? valeur : '#c9a0ff', 'aria-label': t('Couleur libre'), oninput: e => surChoix(e.target.value), onchange: e => surChoix(e.target.value) });
    ligne.append(el('label', { class: 'pastille libre', 'aria-pressed': !!valeur && !COULEURS.includes(valeur), title: t('Couleur libre') }, libre));
    if (defaut) ligne.append(el('button', { class: 'pastille-texte', 'aria-pressed': valeur == null, onclick: () => surChoix(null) }, t('Par défaut')));
    return ligne;
  }
  const groupe = (titre, cle, ...contenu) => el('section', { class: 'reg-section', 'data-groupe': cle }, el('h2', {}, titre), ...contenu);
  const bloc = (cle, titre, ...contenu) => el('div', { class: 'perso-bloc', 'data-cle': cle }, titre && el('p', { class: 'reg-sous' }, titre), ...contenu);

  function rendre() {
    const P = creature.perso(), maj = patch => { creature.personnaliser(patch); rendre(); }, teinte = patch => creature.personnaliser(patch, true);
    const a = k => E.possede(k), art = k => E.article(k), nomG = k => E.groupe('lueur', k).nom;
    // une rangée de choix exclusifs : le défaut gratuit d'abord, puis ce qui a été acheté
    const rangee = champ => {
      const pris = E.articles('lueur').filter(x => x.type === 'choix' && x.champ === champ && a(x.cle));
      if (!pris.length) return null;
      const def = E.DEFAUT_CHOIX[champ], porte = pris.some(x => x.val === P[champ]) ? P[champ] : def;
      return el('div', { class: 'choix', 'data-cle': pris[0].cle },
        el('button', { 'aria-pressed': porte === def, onclick: () => maj({ [champ]: def }) }, DEFAUTS[champ]),
        pris.map(x => el('button', { 'aria-pressed': porte === x.val, 'data-cle': x.cle, title: x.sous, onclick: () => maj({ [champ]: x.val }) }, x.nom)));
    };
    // un interrupteur acheté : allumé / éteint ; ceux de la lueur sont recopiés dans sa personnalisation
    const bascule = x => el('button', { 'aria-pressed': E.actif(x.cle), 'data-cle': x.cle, title: x.sous, onclick: () => {
      objets.basculer(x.cle); if (x.champ) creature.personnaliser({ [x.champ]: E.actif(x.cle) }); rendre(); } }, x.nom);
    const bascules = cles => { const l = cles.filter(a).map(k => bascule(art(k))); return l.length ? el('div', { class: 'choix' }, l) : null; };
    const taille = () => {
      const pct = v => ((v - .8) / .55 * 100) + '%', i = el('input', { type: 'range', min: '0.8', max: '1.35', step: '0.05', value: String(P.taille), 'aria-label': t('Taille'),
        oninput: e => { creature.personnaliser({ taille: +e.target.value }); majApercu(); e.target.style.setProperty('--v', pct(+e.target.value)); } });
      i.style.setProperty('--v', pct(P.taille)); return i;
    };

    const sections = [];
    const ajoute = (cle, ...contenu) => { const c = contenu.filter(Boolean); if (c.length) sections.push(groupe(nomG(cle), cle, ...c)); return c.length; };
    // v38 : mêmes rubriques que la boutique (Forme, Matière, Expressions, Accessoires, Habits, Membres, Effets, Finitions)
    ajoute('forme', rangee('forme'));
    ajoute('matiere', rangee('texture'), a('couleur-lueur') && bloc('couleur-lueur', art('couleur-lueur').nom, pastilles(P.couleur, c => teinte({ couleur: c }), { suit: true })));
    ajoute('expression', rangee('expression'));
    const nAcc = ajoute('accessoire', rangee('acc')), nHabit = ajoute('habit', rangee('habit'));
    // la couleur de l'accessoire vaut aussi pour l'habit : seulement si l'un des deux est porté
    if (a('couleur-accessoire') && (nAcc || nHabit) && (P.acc || P.habit))
      sections[sections.length - 1].append(bloc('couleur-accessoire', art('couleur-accessoire').nom, pastilles(P.accCouleur, c => teinte({ accCouleur: c || '#ffd98a' }))));
    ajoute('membres', bascules(['membres-ailes', 'membres-bras', 'membres-pieds']));
    ajoute('effets', bascules(['orbite', 'traine', 'poudre', 'etincelles']));
    ajoute('finitions',
      a('couleur-yeux') && bloc('couleur-yeux', art('couleur-yeux').nom, pastilles(P.yeuxCouleur, c => teinte({ yeuxCouleur: c }), { defaut: true })),
      a('taille-yeux') && bloc('taille-yeux', art('taille-yeux').nom, el('div', { class: 'choix' }, YEUX.map(([n, v]) => el('button', { 'aria-pressed': Math.abs(P.yeux - v) < .05, onclick: () => maj({ yeux: v }) }, n)))),
      a('yeux-etoiles') && bloc('yeux-etoiles', null, bascules(['yeux-etoiles'])),
      a('taille-lueur') && bloc('taille-lueur', art('taille-lueur').nom, taille()));

    majApercu();
    const reste = E.restants('lueur'), y = corps.scrollTop;
    corps.replaceChildren(
      ...(sections.length ? sections : [el('p', { class: 'reg-note' }, t('Tu n’as encore rien débloqué.'))]),
      el('p', { class: 'reg-note' }, reste ? tn(reste, 'Encore {n} chose à débloquer pour ta lueur dans la boutique.', 'Encore {n} choses à débloquer pour ta lueur dans la boutique.') : t('Tout est débloqué pour ta lueur.')),
      el('div', { class: 'choix' },
        el('button', { onclick: () => objets.boutique() }, t('Ouvrir la boutique')),
        el('button', { onclick: () => nommer() }, t('Changer de nom'))));
    corps.scrollTop = y;
  }
  function briller(cle) {
    const n = cle && (corps.querySelector(`[data-cle="${cle}"]`) || corps.querySelector(`[data-groupe="${(E.article(cle) || {}).groupe}"]`)); if (!n) return;
    const r = n.getBoundingClientRect(), rc = corps.getBoundingClientRect(); corps.scrollTop += (r.top - rc.top) - 12;
    n.classList.remove('eclat'); void n.offsetWidth; n.classList.add('eclat'); setTimeout(() => n.classList.remove('eclat'), 1900);
  }

  const ouvrir = cle => { rendre(); zone.hidden = false; corps.scrollTop = 0; if (typeof cle === 'string') requestAnimationFrame(() => briller(cle)); };
  const fermer = () => { zone.hidden = true; };
  zone.querySelector('#perso-fermer').addEventListener('click', fermer);
  return { ouvrir, fermer, rendre, ouvert: () => !zone.hidden, rect: () => zone.getBoundingClientRect() };
}
