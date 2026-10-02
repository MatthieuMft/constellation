// Le rythme du journal : série d'écriture, bilan d'humeur d'une semaine / d'un mois, saisons. Que du calcul, aucune scène ici.
import { MOODS, cleJour, dateDeCle } from './store.js';
import { VALENCE } from './analyse.js';
import { t, tn } from './langue.js';

const JOUR = 86400000;
const decaler = (cle, n) => { const d = dateDeCle(cle); d.setDate(d.getDate() + n); return cleJour(d); };

// Séries : suites de jours consécutifs écrits. { chaines: [[cle, cle, …]], actuelle, record }
// La série « actuelle » reste vivante si l'on a écrit aujourd'hui OU hier (on n'a pas encore perdu la journée en cours).
export function series(cles, aujourdhui) {
  const set = new Set(cles), tries = [...set].sort(), chaines = []; let cour = [];
  for (const c of tries) { if (cour.length && decaler(cour[cour.length - 1], 1) === c) cour.push(c); else { if (cour.length) chaines.push(cour); cour = [c]; } }
  if (cour.length) chaines.push(cour);
  let actuelle = 0, depart = set.has(aujourdhui) ? aujourdhui : decaler(aujourdhui, -1);
  while (set.has(depart)) { actuelle++; depart = decaler(depart, -1); }
  return { chaines, actuelle, record: chaines.reduce((m, c) => Math.max(m, c.length), 0), ecritAujourdhui: set.has(aujourdhui) };
}

// Bilan d'une période. jours : [{ mood, n }] (les jours écrits dans la période), total : nombre de jours de la période.
export function bilan(jours, total, quand) {
  if (!jours.length) return t('{quand} : rien d’écrit pour l’instant.', { quand });
  const compte = {}; let val = 0, nv = 0;
  jours.forEach(j => { if (j.mood && MOODS[j.mood]) { compte[j.mood] = (compte[j.mood] || 0) + 1; val += VALENCE[j.mood] ?? 0; nv++; } });
  const base = t('{quand} : {n} sur {total}', { quand, n: tn(jours.length, '{n} jour écrit', '{n} jours écrits'), total });
  if (!nv) return base + '.';
  const top = Object.entries(compte).sort((a, b) => b[1] - a[1])[0], moy = val / nv;
  const ton = t(moy > .35 ? 'plutôt lumineuse' : moy < -.35 ? 'plus lourde que d’habitude' : 'en équilibre');
  return base + t(', surtout {humeur} ({ton}).', { humeur: MOODS[top[0]].label.toLowerCase(), ton });
}

// Saisons (hémisphère nord) : nom + teinte du ciel (ajoutée aux couleurs du thème) + couleur d'une nébuleuse encore vide.
const SAISONS = {
  hiver:     { cle: 'hiver', nom: t('hiver'),     teinte: [-.001, .004, .014],   vide: '#7088c8' },
  printemps: { cle: 'printemps', nom: t('printemps'), teinte: [-.001, .009, .003],  vide: '#7fb596' },
  ete:       { cle: 'ete', nom: t('été'),       teinte: [.012, .007, -.002],   vide: '#cfa56a' },
  automne:   { cle: 'automne', nom: t('automne'),   teinte: [.013, .003, -.002],  vide: '#c9806f' },
};
export const saisonDuMois = m => m === 11 || m <= 1 ? SAISONS.hiver : m <= 4 ? SAISONS.printemps : m <= 7 ? SAISONS.ete : SAISONS.automne;

export { JOUR, decaler };
