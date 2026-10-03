// v48 : humeur et activités (idée de Daylio). Dans la note du jour, de petites icônes à cocher : sport, amis, travail…
// Rangées avec l'humeur du jour dans constellation.jours.v2 : jours[cle].activites = ['sport', …] (champ ajouté, rien d'ancien ne change).
// Le Suivi en tire « ce qui va avec tes bons jours » : l'humeur moyenne des jours avec chaque activité, comparée à la moyenne.
import { t } from './langue.js';

const I = d => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d}"/></svg>`;
export const ACTIVITES = [
  { k: 'sport', nom: 'Sport', i: I('M4 13l3-3 3 2 3-5 3 3 M3 16.5h14') },
  { k: 'amis', nom: 'Amis', i: I('M7 9a2.5 2.5 0 1 0 0-.01 M13.5 9.5a2 2 0 1 0 0-.01 M2.5 16c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4 M11.5 13c.6-.6 1.3-.9 2-.9 1.8 0 3.2 1.3 3.5 3.4') },
  { k: 'famille', nom: 'Famille', i: I('M3 9.5L10 4l7 5.5 M5 8v8h10V8 M8.5 16v-4h3v4') },
  { k: 'amour', nom: 'Amour', i: I('M10 16s-6-3.6-6-7.6A3.2 3.2 0 0 1 10 6.6a3.2 3.2 0 0 1 6 1.8C16 12.4 10 16 10 16z') },
  { k: 'travail', nom: 'Travail', i: I('M3 7h14v9H3z M7.5 7V4.5h5V7 M3 11h14') },
  { k: 'etudes', nom: 'Études', i: I('M2.5 7.5L10 4l7.5 3.5L10 11z M5.5 9v4c1.2 1.3 2.7 2 4.5 2s3.3-.7 4.5-2V9') },
  { k: 'nature', nom: 'Nature', i: I('M10 17V9 M10 12c-3 0-5-2-5-5 3 0 5 2 5 5z M10 10c0-3 2-5 5-5 0 3-2 5-5 5z') },
  { k: 'creation', nom: 'Création', i: I('M4 16l2.5-.6L15.5 6.4a1.4 1.4 0 0 0-2-2L4.6 13.4z M12.5 5.5l2 2') },
  { k: 'lecture', nom: 'Lecture', i: I('M10 6c-1.6-1.2-3.6-1.6-6.5-1.5V15c2.9-.1 4.9.3 6.5 1.5 1.6-1.2 3.6-1.6 6.5-1.5V4.5C13.6 4.4 11.6 4.8 10 6z M10 6v10.5') },
  { k: 'musique', nom: 'Musique', i: I('M7.5 14.5V5l8-1.5V13 M7.5 14.5a2 2 0 1 1-2-2 2 2 0 0 1 2 2z M15.5 13a2 2 0 1 1-2-2 2 2 0 0 1 2 2z') },
  { k: 'repos', nom: 'Bien dormi', i: I('M14.5 12.5A6 6 0 0 1 7.5 5.5 6 6 0 1 0 14.5 12.5z') },
  { k: 'ecrans', nom: 'Écrans', i: I('M3 4.5h14v9H3z M7 16.5h6 M10 13.5v3') },
];
export const nomActivite = k => t((ACTIVITES.find(a => a.k === k) || { nom: k }).nom);

// une rangée de bascules ; lire() rend les clés cochées, ecrire(liste) les coche
export function monterActivites(zone, { surChange } = {}) {
  const coches = new Set();
  zone.replaceChildren();
  for (const a of ACTIVITES) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.k = a.k; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = a.i + '<span></span>'; b.querySelector('span').textContent = t(a.nom); b.title = t(a.nom);
    b.addEventListener('click', () => { coches.has(a.k) ? coches.delete(a.k) : coches.add(a.k); b.setAttribute('aria-pressed', String(coches.has(a.k))); surChange && surChange(a.k, coches.has(a.k)); });
    zone.append(b);
  }
  return {
    lire: () => ACTIVITES.map(a => a.k).filter(k => coches.has(k)),
    ecrire(l = []) { coches.clear(); l.forEach(k => coches.add(k)); zone.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(coches.has(b.dataset.k)))); },
  };
}

// jours : [{ cle, valeur (-1…1), activites: [] }] → activités vues au moins 2 fois, triées de la plus « éclaircie » à la plus « orageuse »
export function liensActivites(jours) {
  const avec = jours.filter(j => j.activites && j.activites.length);
  if (avec.length < 3) return { assez: false, n: avec.length, liste: [] };
  const moy = avec.reduce((s, j) => s + j.valeur, 0) / avec.length, par = {};
  for (const j of avec) for (const k of j.activites) { (par[k] = par[k] || []).push(j.valeur); }
  const liste = Object.entries(par).filter(([, v]) => v.length >= 2).map(([k, v]) => { const m = v.reduce((s, x) => s + x, 0) / v.length; return { k, n: v.length, moyenne: m, ecart: m - moy }; })
    .sort((a, b) => b.ecart - a.ecart);
  return { assez: liste.length > 0, n: avec.length, moyenne: moy, liste };
}
