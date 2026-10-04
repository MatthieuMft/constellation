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
//     v40 : photoPlanete(canvas, planète) : une image de la planète ; surPlanete(id, montrer) : après un changement (le ciel suit)
//   ouvrir('planete:<id>') ouvre directement la personnalisation de cette planète ; ouvrir('planetes') la liste « Mes planètes »
import { t, tn, EN } from './langue.js';
import * as E from './etoiles.js';
import * as PL from './planetes.js';

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
  let edition = null;                                   // v40 : la planète qu'on personnalise (sinon, le panneau du ciel)

  // ───── v40 : personnaliser une planète ─────
  function rendrePlanete(id) {
    const p = PL.planete(id); if (!p) { edition = null; rendre(); return; }
    const a = k => E.possede(PL.OPTIONS[k]);
    const changer = (patch, montrer = false) => { PL.maj(id, patch); ctx.surPlanete(id, montrer); rendrePlanete(id); };
    // v54 : on ne montre ici que ce qui est acheté (le reste est dans la boutique, demande de Matthieu)
    const option = (nom, k, presse, faire) => a(k) ? el('button', { 'aria-pressed': presse, onclick: faire }, nom) : null;
    const pasAchete = Object.values(PL.OPTIONS).filter(k => !E.possede(k)).length;
    const vue = el('canvas', { width: '480', height: '480', class: 'pl-vue', 'aria-hidden': 'true' }); ctx.photoPlanete(vue, PL.effective(p));
    const nom = el('input', { type: 'text', value: p.nom, maxlength: '18', 'aria-label': t('Nom de la planète') });
    nom.addEventListener('input', () => PL.maj(id, { nom: nom.value.trim() || p.nom }));
    nom.addEventListener('keydown', e => { if (e.key === 'Enter') nom.blur(); });
    const blocs = [
      el('div', { class: 'choix pl-retour' }, el('button', { class: 'lien', onclick: () => { edition = null; rendre(); requestAnimationFrame(() => briller('planetes')); } }, '‹ ' + t('Mes planètes'))),
      el('div', { class: 'pl-scene' }, vue),
      section(t('Nom'), 'pl-nom', el('div', { class: 'rang-reg' }, nom)),
      section(t('Type'), 'pl-type', el('div', { class: 'choix' },
        [['solide', t('Solide')], ['gazeuse', t('Gazeuse')]].map(([k, n]) => el('button', { 'aria-pressed': p.type === k, onclick: () => changer({ type: k }) }, n)))),
    ];
    // couleurs : les palettes (gratuites), puis les couleurs libres
    const tuiles = el('div', { class: 'tuiles pl-palettes' });
    Object.entries(PL.PALETTES[p.type]).forEach(([k, pal]) => {
      const c = p.type === 'gazeuse' ? [pal.bandes[0], pal.bandes[1], pal.bandes[2]] : [pal.ocean, pal.sable, pal.terre];
      const b = el('button', { class: 'tuile', 'aria-pressed': p.palette === k, onclick: () => changer({ palette: k, couleurs: {} }) }, el('span', {}, pal.nom));
      b.style.background = `linear-gradient(135deg, ${c[0]} 0 38%, ${c[1]} 38% 55%, ${c[2]} 55%)`; b.style.setProperty('--encre', '#1d1a2b'); tuiles.append(b);
    });
    const libres = [];
    if (a('couleurs')) {
      const pal = PL.PALETTES[p.type][p.palette], cs = p.couleurs || {};
      const champs = p.type === 'gazeuse' ? [['b1', t('Bande 1'), pal.bandes[0]], ['b2', t('Bande 2'), pal.bandes[1]]] : [['ocean', t('Océan'), pal.ocean], ['terre', t('Terre'), pal.terre], ['sable', t('Sable'), pal.sable]];
      const puces = el('div', { class: 'puces' });
      champs.forEach(([k, n, def]) => { const c = el('input', { type: 'color', value: cs[k] || def, 'aria-label': n });
        c.addEventListener('change', () => changer({ couleurs: { ...(PL.planete(id).couleurs || {}), [k]: c.value } }));
        puces.append(el('label', { class: 'puce', title: n }, c, el('span', {}, n.toLowerCase()))); });
      libres.push(puces);
    }
    blocs.push(section(t('Couleurs'), 'pl-couleurs', tuiles, ...libres));
    // éléments
    if (p.type === 'solide') {
      const el2 = [option(t('Nuages'), 'nuages', !!p.nuages, () => changer({ nuages: !p.nuages })),
        option(t('Cerisiers'), 'cerisier', p.arbres === 'cerisier', () => changer({ arbres: p.arbres === 'cerisier' ? null : 'cerisier' })),
        option(t('Sapins'), 'sapin', p.arbres === 'sapin', () => changer({ arbres: p.arbres === 'sapin' ? null : 'sapin' })),
        option(t('Cristaux'), 'cristal', p.arbres === 'cristal', () => changer({ arbres: p.arbres === 'cristal' ? null : 'cristal' })),   // v55
        option(t('Maisonnettes'), 'maisons', !!p.maisons, () => changer({ maisons: !p.maisons }))].filter(Boolean);
      if (el2.length) blocs.push(section(t('Éléments'), 'pl-elements', el('div', { class: 'choix' }, el2)));
    }
    else blocs.push(section(t('Éléments'), 'pl-elements', el('div', { class: 'choix' },
      el('button', { 'aria-pressed': !!p.tempete, onclick: () => changer({ tempete: !p.tempete }) }, t('Tempête')))));
    // anneaux
    if (a('anneaux')) {
      const anneaux = [[null, t('Aucun')], ['fin', t('Fin')], ['large', t('Large')], ['penche', t('Penché')]].map(([k, n]) => el('button', { 'aria-pressed': (p.anneaux || null) === k, onclick: () => changer({ anneaux: k }) }, n));
      if (p.anneaux) anneaux.push(option(t('Double anneau'), 'double', !!p.double, () => changer({ double: !p.double })));
      blocs.push(section(t('Anneaux'), 'pl-anneaux', el('div', { class: 'choix' }, anneaux)));
    }
    // v55 : autour d'elle (petite lune, aurores polaires), pour les deux types
    const autour = [option(t('Petite lune'), 'lune', !!p.lune, () => changer({ lune: !p.lune })),
      option(t('Aurores polaires'), 'aurores', !!p.aurores, () => changer({ aurores: !p.aurores }))].filter(Boolean);
    if (autour.length) blocs.push(section(t('Autour d’elle'), 'pl-autour', el('div', { class: 'choix' }, autour)));
    blocs.push(section(t('Dans ton ciel'), 'pl-ciel', el('div', { class: 'choix' },
      el('button', { 'aria-pressed': !!p.allumee, onclick: () => changer({ allumee: !p.allumee }, !p.allumee) }, p.allumee ? t('Visible') : t('Rangée')))));
    if (pasAchete) blocs.push(el('p', { class: 'reg-note' }, tn(pasAchete, 'Encore {n} chose à débloquer pour tes planètes.', 'Encore {n} choses à débloquer pour tes planètes.')),
      el('div', { class: 'choix' }, el('button', { onclick: () => ctx.boutique('pl-nuages') }, t('Ouvrir la boutique'))));
    corps.replaceChildren(...blocs);
  }

  function rendre() {
    zone.classList.toggle('edition-planete', !!edition);       // v40 : on regarde la planète, pas le ciel
    if (edition) { rendrePlanete(edition); return; }
    const R = ctx.lire(), a = k => E.possede(k), blocs = [];

    // ambiances : de vraies miniatures du dégradé et d'une étoile ; celles qui ne sont pas à toi montrent leur prix
    const tuiles = el('div', { class: 'tuiles' });
    Object.entries(ctx.themes).forEach(([k, th]) => {
      const art = E.articles('ciel').find(x => x.champ === 'theme' && x.val === k), libre = !art || !art.prix || a(art.cle);
      if (!libre) return;                                   // v54 : seulement les ambiances à toi ; les autres sont dans la boutique
      const b = el('button', { class: 'tuile' + (libre ? '' : ' verrou'), 'data-cle': art ? art.cle : null, 'aria-pressed': libre ? k === R.theme : null,
        'aria-label': libre ? t('Ciel {nom}', { nom: th.nom }) : t('Ciel {nom}, à débloquer pour ✦{prix}', { nom: th.nom, prix: art.prix }),
        onclick: () => { if (!libre) { ctx.boutique(art.cle); return; } ctx.maj({ theme: k, humeurs: {} }); rendre(); } },
        el('i', { class: 'mini-etoile' }), el('span', {}, th.nom), !libre && el('b', { class: 'tuile-prix' }, el('i', { class: 'cadenas', 'aria-hidden': 'true' }), '✦ ' + art.prix));
      b.style.background = `linear-gradient(180deg, ${th.haut}, ${th.bas})`; b.style.setProperty('--etoile', th.clair ? th.ui.ink : th.etoile); b.style.setProperty('--encre', th.ui.ink);
      tuiles.append(b);
    });
    blocs.push(section(E.groupe('ciel', 'ambiance').nom, 'ambiance', tuiles));

    // v40 : mes planètes, chacune se personnalise d'un toucher
    {
      const l = PL.liste(), grille = el('div', { class: 'bq-grille' });
      l.forEach(p => { const c = el('canvas', { width: '160', height: '160', 'aria-hidden': 'true' }); ctx.photoPlanete(c, PL.effective(p));
        grille.append(el('button', { type: 'button', class: 'bq-art pris' + (p.allumee ? ' on' : ''), 'data-cle': 'planete:' + p.id, onclick: () => ouvrirPlanete(p.id) },
          c, el('span', { class: 'bq-nom' }, p.nom), el('small', { class: 'bq-prix' }, p.allumee ? t('Dans ton ciel') : t('Rangée')))); });
      const s = section(t('Mes planètes'), 'planetes', l.length ? grille : el('p', { class: 'reg-note' }, t('Tu n’as pas encore de planète. Il y en a dans la boutique.')),
        l.length < PL.MAX ? el('div', { class: 'choix' }, el('button', { onclick: () => ctx.boutique('planete-solide') }, t('Une nouvelle planète'))) : null);
      blocs.push(s);
    }

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
      const l = E.articles('ciel').filter(x => x.groupe === g && x.type === 'interrupteur' && a(x.cle));
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
    const n = cle && (corps.querySelector(`[data-cle="${cle}"]`) || corps.querySelector(`[data-groupe="${(E.article(cle) || {}).groupe || cle}"]`)); if (!n) return;
    const r = n.getBoundingClientRect(), rc = corps.getBoundingClientRect(); corps.scrollTop += (r.top - rc.top) - 12;
    n.classList.remove('eclat'); void n.offsetWidth; n.classList.add('eclat'); setTimeout(() => n.classList.remove('eclat'), 1900);
  }

  function ouvrirPlanete(id) { edition = id; rendre(); corps.scrollTop = 0; }
  const ouvrir = cle => {
    if (typeof cle === 'string' && cle.startsWith('planete:')) { edition = cle.slice(8); rendre(); zone.hidden = false; corps.scrollTop = 0; return; }
    if (typeof cle === 'string' && E.article(cle) && E.article(cle).groupe === 'planetes') cle = 'planetes';
    edition = null; rendre(); zone.hidden = false; corps.scrollTop = 0; if (typeof cle === 'string') requestAnimationFrame(() => briller(cle)); };
  const fermer = () => { zone.hidden = true; };
  zone.querySelector('#ciel-fermer').addEventListener('click', fermer);
  return { ouvrir, fermer, rendre, ouvert: () => !zone.hidden };
}
