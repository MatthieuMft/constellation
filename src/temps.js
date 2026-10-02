// Le temps comme paysage : années → 12 mois en anneau → semaines → jours, du plus grand au plus petit.
// Chaque niveau est un amas qui contient le suivant ; on y plonge en zoomant.
import * as THREE from 'three';
import { cleJour } from './store.js';
import { MOIS, MOIS_COURT, JOURS, EN, t } from './langue.js';

export const NOMS_MOIS = MOIS;
export const NOMS_JOURS = JOURS;
export const cleMois = (y, m) => y + '-' + String(m + 1).padStart(2, '0');

const lundi0 = d => (d.getDay() + 6) % 7;                                                       // 0 = lundi
export const indexSemaine = d => Math.floor((d.getDate() - 1 + lundi0(new Date(d.getFullYear(), d.getMonth(), 1))) / 7);
export const nbSemaines = (y, m) => indexSemaine(new Date(y, m + 1, 0, 12)) + 1;
export const nbJoursMois = (y, m) => new Date(y, m + 1, 0).getDate();
export function joursDeSemaine(y, m, w) { const r = []; for (let j = 1; j <= nbJoursMois(y, m); j++) { const d = new Date(y, m, j, 12); if (indexSemaine(d) === w) r.push(d); } return r; }

export const GEO = { ecartAnnees: 640, rayonMois: 165, rayonAnnee: 235, rayonSemaines: 27, rayonMoisNoeud: 44, rayonSemaine: 11, rayonJours: 7 };
const bruit = s => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

export const posAnnee = (y, y0) => new THREE.Vector3((y - y0) * GEO.ecartAnnees, 0, 0);
export function posMois(y, m, y0) { const a = m / 12 * Math.PI * 2 - Math.PI / 2; return posAnnee(y, y0).add(new THREE.Vector3(Math.cos(a) * GEO.rayonMois, Math.sin(m * 1.3) * 6, Math.sin(a) * GEO.rayonMois)); }
export function posSemaine(y, m, w, y0) {
  const a = w / Math.max(nbSemaines(y, m), 5) * Math.PI * 2 - Math.PI / 2 + .4;
  return posMois(y, m, y0).add(new THREE.Vector3(Math.cos(a) * GEO.rayonSemaines, Math.sin((m * 7 + w) * 1.7) * 2.5, Math.sin(a) * GEO.rayonSemaines));
}
export function posJour(d, y0) {
  const a = lundi0(d) / 7 * Math.PI * 2 - Math.PI / 2;
  return posSemaine(d.getFullYear(), d.getMonth(), indexSemaine(d), y0).add(new THREE.Vector3(Math.cos(a) * GEO.rayonJours, (bruit(d.getTime() / 86400000) - .5) * 2.4, Math.sin(a) * GEO.rayonJours));
}

// Distances caméra → cible qui définissent le niveau de zoom.
export const DIST = { jour: 15, semaine: 42, mois: 100, annee: 360 };
export const SEUILS = { jour: 28, semaine: 66, mois: 170, annee: 600 };
export function niveauPour(dist) { return dist <= SEUILS.jour ? 'jour' : dist <= SEUILS.semaine ? 'semaine' : dist <= SEUILS.mois ? 'mois' : dist <= SEUILS.annee ? 'annee' : 'annees'; }
export const distAnnees = (y0, y1) => Math.max(1200, (y1 - y0 + 1) * GEO.ecartAnnees * 1.15);

export const libelleJour = d => NOMS_JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + NOMS_MOIS[d.getMonth()];
export const libelleSemaine = d0 => t('semaine du {d}', { d: d0.getDate() + ' ' + MOIS_COURT[d0.getMonth()] });
export { cleJour };
