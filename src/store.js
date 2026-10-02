// Stockage local du journal. Rien ne quitte le navigateur.
// Modèle (v2) : des ENTRÉES rangées par JOUR. Une étoile = un jour ; sa couleur = l'humeur du jour.
// Depuis la v9, on n'écrit plus que du JOURNAL (photos et vidéos dans l'entrée : medias[]). Les anciennes notes, tâches et
// médias restent lus et affichés comme du journal, rien n'est perdu.
//   item = { id, jour:'AAAA-MM-JJ', date, type:'journal'|'note'|'tache'|'media', texte, titre?, mood?, color?, medias?:[media], fait?, media?, legende?, touched, sample? }
//   jours[cle] = { humeur?, couleur? }   (humeur choisie pour le jour ; sinon celle de la dernière entrée de journal)
import { t, EN } from './langue.js';
const CLE_V1 = 'constellation.journal.v1', CLE_ITEMS = 'constellation.journal.v2', CLE_JOURS = 'constellation.jours.v2';

export const MOODS = {
  calme:      { label: t('Calme'),      color: '#6fc3ff' },
  joie:       { label: t('Joie'),       color: '#ffd36b' },
  elan:       { label: t('Élan'),       color: '#ff7a9c' },
  melancolie: { label: t('Mélancolie'), color: '#9b8cff' },
  tempete:    { label: t('Tempête'),    color: '#ff6b4a' },
};
export const TYPES = {
  journal: { label: t('Journal'), pluriel: t('Journal') },
  note:    { label: t('Note'),    pluriel: t('Notes') },
  tache:   { label: t('Tâche'),   pluriel: t('Tâches') },
  media:   { label: t('Média'),   pluriel: t('Médias') },
};

const DAY = 86400000;
export const cleJour = d => { d = d instanceof Date ? d : new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const dateDeCle = k => { const [y, m, j] = k.split('-').map(Number); return new Date(y, m - 1, j, 12); };
export const nouvelId = () => 'i-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ───────── humeur d'un jour ─────────
export function humeurDuJour(cle, items, jours) {
  const m = jours[cle]; if (m && m.humeur) return { mood: m.humeur, color: m.couleur || null };
  const j = items.filter(i => i.jour === cle && i.type === 'journal' && i.mood).sort((a, b) => b.date - a.date)[0];
  return j ? { mood: j.mood, color: j.color || null } : null;
}

// ───────── anciennes pensées d'exemple ─────────
// Les versions d'avant la v9 ajoutaient 17 exemples inventés. Il n'y en a plus (le ciel commence vide), mais ceux qui sont
// encore chez quelqu'un portent un numéro (ex) : si l'on change de langue, les exemples encore intacts sont retraduits.

const TEXTES_EX = {
  fr: [
    'Pitch client demain. Je repasse la direction artistique en boucle, les caractères, les marges, le rythme du scroll. Je crois que ça tient enfin.',
    ['Pitch client', 'Plan : direction artistique, démo du scroll, budget. Penser à relire les marges avant l’envoi.'],
    'Envoyer la maquette finale',
    'Relire le brief',
    'Réunion interminable. On a changé le brief trois fois, le client veut tout et son contraire. Je rentre avec la tête pleine de bruit.',
    'Marché du dimanche, des abricots, la lumière sur les toits. Je ne pensais à rien et c’était très bien.',
    'J’ai retrouvé une photo de la maison de mon grand-père. Le jardin, le figuier, l’odeur du bois. Il manque tellement.',
    'Elle a ri à table pendant une heure entière. On a cuisiné ensemble, la maison sentait le basilic. Un de ces soirs qu’on voudrait garder.',
    'Mal dormi encore. Le plafond, les pensées qui tournent, le réveil à quatre heures. Je suis fatigué d’être fatigué.',
    'Nouvelle idée de site, de la 3D, des particules, un univers poétique. Je dessine des croquis dans le train, je n’arrive plus à m’arrêter.',
    ['Idée de site 3D', 'Un journal en forme de ciel : une étoile par jour, des nébuleuses pour les mois, zoom continu.'],
    'Marche au bord de la mer, le vent, les vagues qui reviennent toujours. J’ai laissé mes soucis sur le sable.',
    'Mon projet a été publié. Les retours sont beaux, un inconnu m’a écrit pour dire merci. Je suis fier, simplement.',
    'Dispute avec mon frère au téléphone, des mots trop durs. Je regrette, j’ai peur qu’il ne rappelle pas.',
    'Dimanche lent, un livre, du thé, la pluie contre la fenêtre. Le silence de la maison m’a fait du bien.',
    'Je me suis inscrit pour courir un semi-marathon. Premier entraînement ce matin, le souffle court mais le cœur content.',
    'Soir d’automne, les arbres rougissent. Je pense à ceux qui sont partis, à ce qu’on ne dit jamais à temps.',
  ],
  en: [
    'Client pitch tomorrow. I keep going over the art direction, the typefaces, the margins, the rhythm of the scroll. I think it finally holds together.',
    ['Client pitch', 'Outline: art direction, scroll demo, budget. Remember to check the margins before sending.'],
    'Send the final mockup',
    'Reread the brief',
    'Endless meeting. The brief changed three times, the client wants everything and its opposite. I come home with my head full of noise.',
    'Sunday market, apricots, light on the rooftops. I wasn’t thinking about anything and it was lovely.',
    'I found a photo of my grandfather’s house. The garden, the fig tree, the smell of wood. I miss him so much.',
    'She laughed at the table for a whole hour. We cooked together, the house smelled of basil. One of those evenings you’d like to keep.',
    'Slept badly again. The ceiling, thoughts going round and round, awake at four. I’m tired of being tired.',
    'New website idea: 3D, particles, a poetic universe. I sketch on the train and I can’t stop.',
    ['3D website idea', 'A journal shaped like a sky: one star per day, nebulae for the months, continuous zoom.'],
    'A walk by the sea, the wind, the waves that always come back. I left my worries on the sand.',
    'My project went live. The feedback is lovely, a stranger wrote to say thank you. I’m proud, simply.',
    'Argument with my brother on the phone, words that were too harsh. I regret it, I’m afraid he won’t call back.',
    'Slow Sunday, a book, some tea, rain against the window. The quiet of the house did me good.',
    'I signed up to run a half marathon. First training run this morning, short of breath but happy at heart.',
    'Autumn evening, the trees are turning red. I think of those who are gone, of what we never say in time.',
  ],
};
const texteEx = (n, langue = EN ? 'en' : 'fr') => { const x = TEXTES_EX[langue][n]; return Array.isArray(x) ? { titre: x[0], texte: x[1] } : { texte: x }; };

// exemples encore intacts : on les remet dans la langue choisie (les anciens, sans numéro, sont reconnus par leur texte français)
function relocaliser(items) {
  const fr = TEXTES_EX.fr.map(x => Array.isArray(x) ? x[1] : x), langue = EN ? 'en' : 'fr';
  let change = false;
  for (const i of items) {
    if (!i.sample) continue;
    let n = i.ex;
    if (n == null) { n = fr.indexOf(i.texte); if (n < 0) n = TEXTES_EX.en.findIndex(x => (Array.isArray(x) ? x[1] : x) === i.texte); if (n < 0) continue; i.ex = n; change = true; }
    const o = texteEx(n, langue); if (!o) continue;
    if (i.texte !== o.texte) { i.texte = o.texte; change = true; }
    if (o.titre && i.titre !== o.titre) { i.titre = o.titre; change = true; }
  }
  return change;
}

// ───────── lecture / migration ─────────
function lire(cle) { try { const b = localStorage.getItem(cle); return b ? JSON.parse(b) : null; } catch (e) { return null; } }

export function charger() {
  const items = lire(CLE_ITEMS), jours = lire(CLE_JOURS);
  if (Array.isArray(items)) { relocaliser(items); return { items, jours: jours || {} }; }
  const v1 = lire(CLE_V1);                                          // ancien format : une entrée = une étoile
  if (Array.isArray(v1)) {
    const items2 = v1.map(e => ({ id: e.id, jour: cleJour(e.date), date: e.date, type: 'journal', texte: e.text, mood: e.mood, color: e.color, touched: e.touched || e.date, sample: e.sample }));
    return { items: items2, jours: {} };
  }
  return { items: [], jours: {} };                                  // premier lancement : le ciel est vide, il se construit en écrivant
}

const ecouteurs = [];
export const surSauvegarde = fn => ecouteurs.push(fn);          // notifié à chaque enregistrement (sauvegarde dans un dossier)

export function sauver(items, jours) {
  try { localStorage.setItem(CLE_ITEMS, JSON.stringify(items)); localStorage.setItem(CLE_JOURS, JSON.stringify(jours)); } catch (e) {}
  ecouteurs.forEach(f => { try { f({ items, jours }); } catch (e) {} });
}
