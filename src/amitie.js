// v59 : votre amitié. Elle grandit surtout avec les jours écrits (10 points chacun, recomptés depuis le journal),
// un peu avec les jeux et les caresses (3 points par jour au plus) : on ne peut pas tout débloquer en une soirée.
// Clé à part (constellation.amitie.v1) : { jeux: { jour, pts }, jeuxPts, prenom, palierVu }.
import { t } from './langue.js';

const CLE = 'constellation.amitie.v1';
export const PALIERS = [
  { min: 0, nom: 'On se découvre', debloque: '' },
  { min: 30, nom: 'Copains d’étoile', debloque: 'Elle te demande ton prénom et l’utilise.' },
  { min: 80, nom: 'Complices', debloque: 'Des bisous et des mots tendres quand tu la touches.' },
  { min: 150, nom: 'Inséparables', debloque: 'Elle dessine des cœurs d’étoiles dans le ciel.' },
  { min: 300, nom: 'Étoiles jumelles', debloque: 'Elle t’accueille à chaque visite.' },
  { min: 500, nom: 'Constellation à deux', debloque: 'Une couronne d’étoiles tourne autour d’elle.' },
];

export function creerAmitie(joursEcrits) {
  let e = {}; try { e = JSON.parse(localStorage.getItem(CLE)) || {}; } catch (x) {}
  e.jeux = e.jeux || { jour: null, pts: 0 }; e.jeuxPts = e.jeuxPts || 0; e.palierVu = e.palierVu || 0;
  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(e)); } catch (x) {} };
  const points = () => joursEcrits() * 10 + e.jeuxPts;
  const palier = () => { const p = points(); let i = 0; PALIERS.forEach((P, k) => { if (p >= P.min) i = k; }); return i; };
  return {
    points, palier,
    nom: (i = palier()) => t(PALIERS[i].nom),
    prenom: () => e.prenom || '',
    nommer(p) { e.prenom = String(p || '').trim().slice(0, 24); sauver(); },
    jouer(jour) { if (e.jeux.jour !== jour) e.jeux = { jour, pts: 0 }; if (e.jeux.pts >= 3) return; e.jeux.pts++; e.jeuxPts++; sauver(); },   // 3 points de jeu par jour au plus
    reste() { const i = palier(); return i + 1 < PALIERS.length ? PALIERS[i + 1].min - points() : 0; },
    nouveauPalier() { const i = palier(); if (i > e.palierVu) { e.palierVu = i; sauver(); return i; } if (i < e.palierVu) { e.palierVu = i; sauver(); } return 0; },
  };
}
