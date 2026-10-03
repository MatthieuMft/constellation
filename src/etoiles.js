// Ton univers à toi : la poussière d'étoiles (✦), gagnée en écrivant, et tout ce qu'elle débloque pour ta lueur et ton ciel.
// Règles : on gagne pour avoir écrit (jamais selon la longueur ou le contenu), on ne perd jamais rien, tout reste sur l'appareil.
// Les prix font la progression : on construit son univers petit à petit, jour après jour.
//
// Catalogue (contrat partagé, mêmes clés partout) — chaque article : { cle, cat: 'lueur'|'ciel', groupe, type, nom, sous, prix, … }
//   type 'choix'        exclusif dans son champ (on en porte un ; le défaut gratuit est DEFAUT_CHOIX[champ]) ;
//                       + source 'perso' (creature.personnaliser({ [champ]: val })) ou 'reglage' (réglages R de main.js), champ, val
//   type 'interrupteur' allumé / éteint une fois acheté (éteints : etat.eteints) ; ceux de la lueur ont source 'perso' + champ (booléen)
//   type 'reglage'      débloque un contrôle (curseur, palette) et, pour la matière du ciel, l'effet lui-même ;
//                       + source, champs, defaut = valeurs à utiliser tant que l'article n'est pas acheté
//
// API :
//   ARTICLES, GROUPES { lueur: [{ cle, nom }], ciel: [...] }, DEFAUT_CHOIX, PALIERS, GAIN_JOUR
//   articles(cat?) · article(cle) · groupe(cat, cle) · restants(cat) · solde() · possede(cle) · actif(cle) · debloque(palier, nJours)
//   crediter(joursEcrits) → gain · acheter(cle) → bool · basculer(cle) → actif
//   patch(a, oui) → { champ: valeur } pour porter / retirer un choix, ou allumer / éteindre un interrupteur de la lueur
//   porte(a, perso, reglages) → bool : ce choix est-il celui qui est porté ?
//   reglagesEffectifs(R) · persoEffectif(P) : ce que le rendu doit utiliser (ce qui n'est pas acheté reprend sa valeur « éteinte »)
//   migrer({ reglages, perso }) → clés offertes : une seule fois, offre ce qui était déjà personnalisé avant la v11
import { t } from './langue.js';
import { DEFAUT } from './reglages.js';

const CLE = 'constellation.etoiles.v1';
export const GAIN_JOUR = 10;                         // ✦10 la première fois qu'on écrit pour un jour

// ce qui pousse tout seul, selon le nombre de jours écrits (pas forcément à la suite). Le reste s'achète.
export const PALIERS = [
  { j: 1,   cle: 'etoile',        nom: t('Ta première étoile'),  sous: t('Le jour où tu écris pour la première fois.') },
  { j: 7,   cle: 'constellation', nom: t('Tes constellations'),  sous: t('Les jours écrits à la suite se relient par un fil de lumière.') },
  { j: 30,  cle: 'nebuleuses',    nom: t('Les nébuleuses'),      sous: t('Les mois et les semaines deviennent des nuages de lumière.') },
  { j: 365, cle: 'galaxie',       nom: t('Ta première galaxie'), sous: t('Une année entière d’écriture. La suite arrive à ce moment-là.') },
];

// le défaut gratuit de chaque choix exclusif
export const DEFAUT_CHOIX = { forme: 'rond', texture: 'lisse', expression: 'douce', acc: 0, habit: 0, theme: 'nuit' };

export const GROUPES = {
  // v38 : la boutique Lueur rangée en rubriques claires ; les finitions (yeux, taille) en bas
  lueur: [['forme', t('Forme')], ['matiere', t('Matière')], ['expression', t('Expressions')], ['accessoire', t('Accessoires')],
    ['habit', t('Habits')], ['membres', t('Membres')], ['effets', t('Effets')], ['finitions', t('Finitions')]].map(([cle, nom]) => ({ cle, nom })),
  ciel: [['ambiance', t('Ambiances')], ['matiere', t('Couleurs')], ['astres', t('Astres')], ['planetes', t('Planètes')], ['animations', t('Animations')]].map(([cle, nom]) => ({ cle, nom })),
};

const L = 'lueur', C = 'ciel';
const choix = (cat, groupe, cle, nom, sous, prix, source, champ, val) => ({ cle, cat, groupe, type: 'choix', nom, sous, prix, source, champ, val });
const inter = (cat, groupe, cle, nom, sous, prix, champ) => ({ cle, cat, groupe, type: 'interrupteur', nom, sous, prix, ...(champ ? { source: 'perso', champ } : {}) });
const regl = (cat, groupe, cle, nom, sous, prix, source, defaut) => ({ cle, cat, groupe, type: 'reglage', nom, sous, prix, source, champs: Object.keys(defaut), defaut });

// la boutique : les trois premiers objets coûtent ✦10, on peut donc en prendre un dès la première entrée
export const ARTICLES = [
  // ── ta lueur ──
  choix(L, 'forme', 'forme-chat',    t('Silhouette chat'),    t('Des oreilles pointues et une petite queue.'), 150, 'perso', 'forme', 'chat'),
  choix(L, 'forme', 'forme-fantome', t('Silhouette fantôme'), t('Un bas en vagues qui ondule doucement.'),     150, 'perso', 'forme', 'fantome'),
  choix(L, 'forme', 'forme-coeur',   t('Silhouette cœur'),    t('Ta lueur prend la forme d’un cœur.'),         200, 'perso', 'forme', 'coeur'),
  choix(L, 'forme', 'forme-etoile',  t('Silhouette étoile'),  t('Cinq branches arrondies, toutes douces.'),    250, 'perso', 'forme', 'etoile'),
  choix(L, 'forme', 'forme-comete',  t('Silhouette comète'),  t('Une chevelure de lumière qui file derrière elle.'), 220, 'perso', 'forme', 'comete'),   // v39
  choix(L, 'matiere', 'texture-nacre',      t('Nacre'),      t('Des reflets irisés, comme une perle.'),           60, 'perso', 'texture', 'nacre'),
  choix(L, 'matiere', 'texture-givre',      t('Givre'),      t('Une surface glacée qui scintille.'),              70, 'perso', 'texture', 'givre'),
  choix(L, 'matiere', 'texture-paillettes', t('Paillettes'), t('De minuscules éclats qui pétillent.'),            80, 'perso', 'texture', 'paillettes'),
  choix(L, 'matiere', 'texture-aurore',     t('Aurore'),        t('Des voiles de lumière qui ondulent.'),          90, 'perso', 'texture', 'aurore'),   // v39
  choix(L, 'matiere', 'texture-cosmos',     t('Espace profond'), t('Un bout de nuit semé de minuscules étoiles.'), 110, 'perso', 'texture', 'cosmos'),
  choix(L, 'matiere', 'texture-soleil',     t('Soleil'),        t('Une surface qui bouillonne de lumière.'),        120, 'perso', 'texture', 'soleil'),
  choix(L, 'matiere', 'texture-nebuleuse',  t('Nébuleuse'),  t('Un petit ciel qui tourbillonne à l’intérieur.'), 100, 'perso', 'texture', 'nebuleuse'),
  regl(L, 'matiere', 'couleur-lueur', t('Couleur de la lueur'), t('Choisis sa teinte, ou laisse-la suivre ton humeur.'), 30, 'perso', { couleur: null }),
  choix(L, 'expression', 'expression-rieuse',     t('Rieuse'),     t('Des yeux plissés de bonheur.'),                30, 'perso', 'expression', 'rieuse'),
  choix(L, 'expression', 'expression-reveuse',    t('Rêveuse'),    t('Un regard doux, à demi fermé.'),               30, 'perso', 'expression', 'reveuse'),
  choix(L, 'expression', 'expression-malicieuse', t('Malicieuse'), t('Un clin d’œil et un sourire en coin.'),        40, 'perso', 'expression', 'malicieuse'),
  choix(L, 'expression', 'expression-emerveillee',  t('Émerveillée'),  t('Des étoiles à la place des yeux.'),         50, 'perso', 'expression', 'emerveillee'),   // v39
  choix(L, 'expression', 'expression-curieuse',     t('Curieuse'),     t('De grands yeux pleins de reflets.'),        30, 'perso', 'expression', 'curieuse'),
  choix(L, 'expression', 'expression-ensommeillee', t('Ensommeillée'), t('Les paupières lourdes, toute paisible.'),   30, 'perso', 'expression', 'ensommeillee'),
  choix(L, 'expression', 'expression-etonnee',    t('Étonnée'),    t('De grands yeux ronds et une petite bouche.'),  30, 'perso', 'expression', 'etonnee'),
  regl(L, 'finitions', 'couleur-yeux', t('Couleur des yeux'), t('Des yeux de la couleur de ton choix.'), 30, 'perso', { yeuxCouleur: null }),
  inter(L, 'finitions', 'yeux-etoiles', t('Yeux étoilés'), t('Un reflet en étoile dans les yeux de ta lueur.'), 10),
  regl(L, 'finitions', 'taille-yeux', t('Taille des yeux'), t('Petits, normaux ou grands.'), 20, 'perso', { yeux: 1 }),
  choix(L, 'accessoire', 'acc-anneau',   t('Anneau'),              t('Un halo qui flotte au-dessus de sa tête.'), 30, 'perso', 'acc', 1),
  choix(L, 'accessoire', 'acc-antenne',  t('Antenne'),             t('Une tige fine et une petite lanterne.'),    30, 'perso', 'acc', 2),
  choix(L, 'accessoire', 'acc-lunettes', t('Lunettes'),            t('De petites lunettes rondes.'),              40, 'perso', 'acc', 3),
  choix(L, 'accessoire', 'acc-couronne', t('Couronne d’étoiles'),  t('Trois étoiles qui flottent.'),              60, 'perso', 'acc', 4),
  choix(L, 'accessoire', 'acc-chapeau',  t('Chapeau de magicien'), t('Pointu et étoilé.'),                        50, 'perso', 'acc', 5),
  choix(L, 'accessoire', 'acc-saturne',   t('Anneaux de planète'), t('Deux anneaux inclinés autour d’elle, comme Saturne.'), 120, 'perso', 'acc', 6),   // v39
  choix(L, 'accessoire', 'acc-lune',      t('Petite lune'),        t('Une lune qui tourne autour d’elle.'),                   90, 'perso', 'acc', 7),
  choix(L, 'accessoire', 'acc-satellite', t('Satellite'),          t('Il fait le tour d’elle, son feu clignote.'),           100, 'perso', 'acc', 8),
  regl(L, 'accessoire', 'couleur-accessoire', t('Couleur de l’accessoire'), t('Pour l’accessoire que tu portes.'), 20, 'perso', { accCouleur: '#ffd98a' }),
  choix(L, 'habit', 'habit-echarpe', t('Écharpe'),       t('Une écharpe douce nouée sous le visage.'),       60, 'perso', 'habit', 1),
  choix(L, 'habit', 'habit-noeud',   t('Nœud papillon'), t('Un petit nœud bien mis.'),                       50, 'perso', 'habit', 2),
  choix(L, 'habit', 'habit-cape',    t('Cape'),          t('Une cape de lumière qui flotte derrière elle.'), 90, 'perso', 'habit', 3),
  inter(L, 'membres', 'membres-ailes', t('Petites ailes'), t('Des ailes de lumière qui battent.'), 120, 'ailes'),
  inter(L, 'membres', 'membres-bras',  t('Petits bras'),   t('Pour faire coucou.'),                 80, 'bras'),
  inter(L, 'membres', 'membres-pieds', t('Petits pieds'),  t('Deux petits pieds qui pendent.'),     80, 'pieds'),
  regl(L, 'finitions', 'taille-lueur', t('Taille'), t('Plus petite ou plus grande.'), 20, 'perso', { taille: 1 }),
  inter(L, 'effets', 'orbite',  t('Étoiles en orbite'),   t('De petites étoiles tournent autour d’elle.'), 60, 'orbite'),   // v39
  inter(L, 'effets', 'traine',  t('Traînée de comète'),   t('Une traînée de lumière quand elle file.'),     70, 'traine'),
  inter(L, 'effets', 'poudre',  t('Poudre d’étoiles'),    t('Une poussière dorée tombe doucement sous elle.'), 50, 'poudre'),
  inter(L, 'effets', 'etincelles', t('Étincelles'), t('Elle sème de petites étincelles.'), 40, 'etincelles'),
  // ── ton ciel ──
  choix(C, 'ambiance', 'theme-nuit',   t('Ciel Nuit'),   t('Le ciel de départ, bleu nuit.'),                  0,   'reglage', 'theme', 'nuit'),   // v23 : pour y revenir depuis la boutique
  choix(C, 'ambiance', 'theme-aube',   t('Ciel Aube'),   t('Un ciel rose et violet, comme au petit matin.'), 60,  'reglage', 'theme', 'aube'),
  choix(C, 'ambiance', 'theme-ocean',  t('Ciel Océan'),  t('Un ciel bleu profond, comme sous la mer.'),      80,  'reglage', 'theme', 'ocean'),
  choix(C, 'ambiance', 'theme-papier', t('Ciel Papier'), t('Un ciel clair, comme une page de carnet.'),      100, 'reglage', 'theme', 'papier'),
  regl(C, 'matiere', 'couleurs-humeurs', t('Couleurs des humeurs'), t('Choisis la couleur de chaque humeur.'), 50, 'reglage', { humeurs: {} }),
  inter(C, 'astres', 'lune',            t('La Lune'),           t('La vraie lune du jour, avec sa phase.'),       70),
  inter(C, 'astres', 'lactee',          t('Voie lactée'),       t('Une grande bande de lumière au loin.'),        250),
  // v40 : tes planètes (planetes.js). « nouvelle » s'achète autant de fois qu'on veut (une planète de plus, jusqu'à six) ;
  // les options s'achètent une fois et valent pour toutes les planètes (on les active sur chacune dans « Mes planètes »)
  { cle: 'planete-solide', cat: C, groupe: 'planetes', type: 'nouvelle', nom: t('Planète solide'), sous: t('Des océans et des continents, à nommer et à personnaliser.'), prix: 150, planete: 'solide' },
  { cle: 'planete-gazeuse', cat: C, groupe: 'planetes', type: 'nouvelle', nom: t('Planète gazeuse'), sous: t('Des bandes de couleurs qui tournent doucement.'), prix: 150, planete: 'gazeuse' },
  regl(C, 'planetes', 'pl-nuages',        t('Nuages vaporeux'),  t('De fins voiles de nuages autour de tes planètes.'), 40, 'planete', {}),
  regl(C, 'planetes', 'pl-cerisiers',     t('Cerisiers'),        t('Des cerisiers en fleurs qui luisent.'),               60, 'planete', {}),
  regl(C, 'planetes', 'pl-sapins',        t('Sapins'),           t('Des sapins tout ronds.'),                             60, 'planete', {}),
  regl(C, 'planetes', 'pl-maisons',       t('Maisonnettes'),     t('Des petites maisons rondes, la fenêtre allumée.'),    80, 'planete', {}),
  regl(C, 'planetes', 'pl-anneaux',       t('Anneaux'),          t('Fins, larges ou penchés, autour de tes planètes.'),   100, 'planete', {}),
  regl(C, 'planetes', 'pl-anneau-double', t('Double anneau'),    t('Un second anneau, plus loin.'),                       60, 'planete', {}),
  regl(C, 'planetes', 'pl-couleurs',      t('Couleurs libres'),  t('Choisis toi-même la couleur des océans, des terres, des bandes.'), 50, 'planete', {}),
  inter(C, 'animations', 'croix',       t('Croix de lumière'),    t('Tes étoiles brillent avec de longues branches.'),             10),
  inter(C, 'animations', 'filantes-or', t('Filantes dorées'),     t('Des étoiles filantes dorées, plus souvent.'),                 10),
  inter(C, 'animations', 'poussiere',   t('Poussière d’étoiles'), t('Un voile de poussière qui traverse le ciel.'),                30),
  inter(C, 'animations', 'filantes',    t('Étoiles filantes'),    t('Elles traversent ton ciel de temps en temps.'),               40),
  inter(C, 'animations', 'satellites',  t('Satellites'),          t('Un petit point qui clignote et passe.'),                      50),
  inter(C, 'animations', 'lucioles',    t('Lucioles'),            t('De petites étincelles qui tournent autour de tes étoiles.'), 60),
  inter(C, 'animations', 'cometes',     t('Comètes'),             t('Une longue queue de lumière, de temps en temps.'),            120),
  inter(C, 'animations', 'dessins',     t('Dessins d’étoiles'),   t('Parfois, les étoiles dessinent une forme.'),                  150),
  inter(C, 'animations', 'aurores',     t('Aurores boréales'),    t('Un rideau de lumière ondule dans le ciel.'),                  200),
  inter(C, 'animations', 'baleine',     t('Baleine d’étoiles'),   t('Une baleine de lumière nage au loin.'),                       300),
];
const PAR_CLE = Object.fromEntries(ARTICLES.map(a => [a.cle, a]));

function lire() { try { const o = JSON.parse(localStorage.getItem(CLE)); if (o && typeof o === 'object') return o; } catch (e) {} return null; }
let etat = Object.assign({ solde: 0, credites: [], achats: [], eteints: [], migre11: false }, lire() || {});
const ecrire = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {} };

// MODE ESSAI (v16) : tout débloqué par défaut. Retiré en v30 (demande de Matthieu) : tout se gagne de nouveau avec la poussière.
// Mettre true pour le retrouver (les interrupteurs arrivent éteints).
export const TOUT_DEBLOQUE = false;
if (TOUT_DEBLOQUE) {
  const neufs = ARTICLES.filter(a => !etat.achats.includes(a.cle));
  if (neufs.length) {
    etat.achats.push(...neufs.map(a => a.cle));
    etat.eteints = [...new Set([...etat.eteints, ...neufs.filter(a => a.type === 'interrupteur').map(a => a.cle)])];
    ecrire();
  }
} else if (!etat.finEssai) {                 // v30 : on reprend ce que le mode essai avait donné (seuls les articles gratuits restent), la poussière est gardée
  etat.achats = etat.achats.filter(k => (PAR_CLE[k] || {}).prix === 0); etat.eteints = []; etat.finEssai = true; ecrire();
}

// v41 : un cadeau unique de ✦500 pour essayer les planètes (demande de Matthieu : « je peux pas les débloquer »)
export let cadeauRecu = 0;
if (!etat.cadeau41) { etat.solde += 500; etat.cadeau41 = true; cadeauRecu = 500; ecrire(); }

export const articles = cat => cat ? ARTICLES.filter(a => a.cat === cat) : ARTICLES;
export const article = k => PAR_CLE[k] || null;
export const groupe = (cat, k) => (GROUPES[cat] || []).find(g => g.cle === k) || null;
export const solde = () => etat.solde;
export const possede = k => etat.achats.includes(k);
export const actif = k => possede(k) && !((PAR_CLE[k] || {}).type === 'interrupteur' && etat.eteints.includes(k));   // acheté (et allumé)
export const restants = cat => articles(cat).filter(a => a.type !== 'nouvelle' && !possede(a.cle)).length;
export const eteint = k => etat.eteints.includes(k);
export const debloque = (cle, nJours) => TOUT_DEBLOQUE || nJours >= (PALIERS.find(p => p.cle === cle) || { j: 0 }).j;

// à chaque enregistrement : ✦10 pour chaque jour écrit qui n'a pas encore rapporté. Renvoie le gain.
// La première fois (mise à jour depuis une version sans poussière), les jours déjà écrits rapportent aussi.
export function crediter(joursEcrits) {
  const deja = new Set(etat.credites); let gain = 0;
  for (const k of joursEcrits) if (!deja.has(k)) { deja.add(k); gain += GAIN_JOUR; }
  if (!gain) return 0;
  etat.credites = [...deja]; etat.solde += gain; ecrire(); return gain;
}
export function acheter(k) {
  const a = article(k); if (!a || a.type === 'nouvelle' || possede(k) || etat.solde < a.prix) return false;
  etat.solde -= a.prix; etat.achats.push(k); etat.eteints = etat.eteints.filter(x => x !== k); ecrire(); return true;
}
// v40 : payer sans posséder (une nouvelle planète, autant de fois qu'on veut) ; offrir (quand une ancienne planète devient une vraie planète)
export function donner(n) { etat.solde += n; ecrire(); }                 // v46 : récompense (nommer une constellation)
export function payer(prix) { if (etat.solde < prix) return false; etat.solde -= prix; ecrire(); return true; }
export function offrir(k) { if (article(k) && !possede(k)) { etat.achats.push(k); ecrire(); } }
export function basculer(k) {                       // un interrupteur acheté peut être éteint puis rallumé, sans le racheter
  const a = article(k); if (!possede(k) || !a || a.type !== 'interrupteur') return actif(k);
  etat.eteints = actif(k) ? [...etat.eteints, k] : etat.eteints.filter(x => x !== k); ecrire(); return actif(k);
}

// porter / retirer un choix (retirer = revenir au défaut gratuit), allumer / éteindre un interrupteur de la lueur.
// Choisir une ambiance remet les couleurs d'humeur de cette ambiance, comme avant.
export function patch(a, oui) {
  if (!a || !a.champ) return {};
  if (a.type === 'interrupteur') return { [a.champ]: !!oui };
  const p = { [a.champ]: oui ? a.val : DEFAUT_CHOIX[a.champ] };
  if (a.champ === 'theme') p.humeurs = {};
  return p;
}
export const porte = (a, perso = {}, reglages = {}) => !!a && a.type === 'choix' && (a.source === 'perso' ? perso : reglages)[a.champ] === a.val;

// ce qui n'est pas acheté reprend sa valeur « éteinte » ; les interrupteurs de la lueur suivent actif()
const copie = v => v && typeof v === 'object' ? { ...v } : v;
function effectif(source, o) {
  const r = { ...o };
  for (const a of ARTICLES) {
    if (a.source !== source) continue;
    if (a.type === 'choix') { if (!possede(a.cle) && r[a.champ] === a.val) r[a.champ] = DEFAUT_CHOIX[a.champ]; }
    else if (a.type === 'reglage') { if (!possede(a.cle)) for (const [k, v] of Object.entries(a.defaut)) r[k] = copie(v); }
    else r[a.champ] = actif(a.cle);
  }
  return r;
}
// v21 (choix de Matthieu) : brume, scintillement, rotation, lueur, profondeur de champ et cinéma ne se règlent plus : valeurs fixes
export const FIXES = { brume: DEFAUT.brume, scintillement: DEFAUT.scintillement, vitesse: DEFAUT.vitesse, lueur: DEFAUT.lueur, flou: DEFAUT.flou, cinema: DEFAUT.cinema };
export const reglagesEffectifs = R => ({ ...effectif('reglage', R), ...FIXES });
export const persoEffectif = P => effectif('perso', P);

// passage à la v11 : ce qui avait déjà été personnalisé (avant que tout s'achète) est offert, une seule fois
export function migrer({ reglages: R = {}, perso: P = {} } = {}) {
  if (etat.migre11) return [];
  const dons = [], offrir = k => { if (k && article(k) && !possede(k)) { etat.achats.push(k); dons.push(k); } };
  const de = (champ, val) => (ARTICLES.find(a => a.champ === champ && a.val === val) || {}).cle;
  const diff = (a, b) => a != null && Math.abs(+a - +b) > 1e-3;
  if (R.theme && R.theme !== 'nuit') offrir(de('theme', R.theme));
  if (P.acc > 0) offrir(de('acc', P.acc));
  if (P.couleur) offrir('couleur-lueur');
  if (P.accCouleur && String(P.accCouleur).toLowerCase() !== '#ffd98a') offrir('couleur-accessoire');
  if (diff(P.yeux, 1)) offrir('taille-yeux');
  if (diff(P.taille, 1)) offrir('taille-lueur');
  if (P.etincelles) offrir('etincelles');
  if (R.humeurs && Object.keys(R.humeurs).length) offrir('couleurs-humeurs');
  if (diff(R.brume, DEFAUT.brume)) offrir('brume');
  if (diff(R.scintillement, DEFAUT.scintillement)) offrir('scintillement');
  if (diff(R.vitesse, DEFAUT.vitesse)) offrir('rotation');
  if (diff(R.lueur, DEFAUT.lueur) || diff(R.flou, DEFAUT.flou) || diff(R.cinema, DEFAUT.cinema)) offrir('optique');
  etat.migre11 = true; ecrire(); return dons;
}
