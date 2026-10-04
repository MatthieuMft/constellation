// Ambiances : ciel, couleurs d'interface, humeurs adaptées.
import { t } from './langue.js';
const sombre = { ink: '#f1ece4', soft: 'rgba(241,236,228,.58)', line: 'rgba(241,236,228,.28)', panel: 'rgba(5,6,15,.62)', inv: '#0b0d1c', bg: '#05060f' };

export const THEMES = {
  nuit:   { nom: t('Nuit'),   haut: '#02030a', bas: '#0d1026', etoile: '#dfe8ff', clair: false, ember: '#8a3b22', ui: sombre },
  aube:   { nom: t('Aube'),   haut: '#1b1740', bas: '#b85d78', etoile: '#ffe9e0', clair: false, ember: '#7a3040', ui: { ...sombre, panel: 'rgba(24,14,40,.62)', bg: '#1b1740' } },
  ocean:  { nom: t('Océan'),  haut: '#021622', bas: '#0c6073', etoile: '#bff3ff', clair: false, ember: '#2a4f5a', ui: { ...sombre, panel: 'rgba(2,20,30,.62)', bg: '#021622' } },
  // v55 : trois nouvelles ambiances
  crepuscule: { nom: t('Crépuscule'), haut: '#120f2e', bas: '#c2654a', etoile: '#ffe6cc', clair: false, ember: '#7a3a22', ui: { ...sombre, panel: 'rgba(22,14,36,.62)', bg: '#120f2e' } },
  boreal:     { nom: t('Boréal'),     haut: '#020c14', bas: '#0f5a4c', etoile: '#d6fff0', clair: false, ember: '#1f4a3c', ui: { ...sombre, panel: 'rgba(2,16,20,.62)', bg: '#020c14' } },
  nebuleuse:  { nom: t('Nébuleuse'),  haut: '#0d0420', bas: '#55226a', etoile: '#ffe0fb', clair: false, ember: '#5a2350', ui: { ...sombre, panel: 'rgba(18,6,32,.62)', bg: '#0d0420' } },
  papier: { nom: t('Papier'), haut: '#f6f1e8', bas: '#e2d6c2', etoile: '#3a3550', clair: true,  ember: '#a89a86',
            ui: { ink: '#1d1a2b', soft: 'rgba(29,26,43,.62)', line: 'rgba(29,26,43,.35)', panel: 'rgba(246,241,232,.78)', inv: '#f6f1e8', bg: '#f6f1e8' },
            humeurs: { calme: '#2f7fbf', joie: '#d99a00', elan: '#d6336c', melancolie: '#6a4fd6', tempete: '#d6401f' } },
};
