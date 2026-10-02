// Langue de l'interface : français ou anglais. Choisie au premier lancement (présélection selon le navigateur),
// mémorisée sur l'appareil, changeable dans les réglages. Le français sert de clé : t('Bonjour') → 'Hello' en anglais.
import { EN as DICO, EN_HTML } from './en.js';

const CLE = 'constellation.langue';
const lue = (() => { try { return localStorage.getItem(CLE); } catch (e) { return null; } })();
export const choisie = lue === 'fr' || lue === 'en';                                     // l'utilisateur a-t-il déjà choisi ?
export const LANGUE = choisie ? lue : (/^fr\b/i.test(navigator.language || 'fr') ? 'fr' : 'en');
export const EN = LANGUE === 'en';
export const DP = EN ? ': ' : ' : ';                                                  // deux-points : espace avant en français seulement
export const LOC = EN ? 'en-GB' : 'fr-FR';                                              // dates : 1 October 2026, semaines du lundi
document.documentElement.lang = LANGUE;

export function memoriser(l) { try { localStorage.setItem(CLE, l); } catch (e) {} }
export function changer(l) { memoriser(l); if (l !== LANGUE) location.reload(); }

// t('{n} jours', { n: 3 }) : traduit puis remplace les {variables}
export function t(fr, vars) {
  let s = EN && DICO[fr] != null ? DICO[fr] : fr;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return s;
}
// pluriel : t(pl(n, '{n} jour', '{n} jours'), { n }) — en français 0 et 1 sont au singulier, en anglais seul 1 l'est
export const pl = (n, un, plusieurs) => (EN ? n === 1 : n <= 1) ? un : plusieurs;
export const tn = (n, un, plusieurs, vars = {}) => t(pl(n, un, plusieurs), { n, ...vars });

// noms des mois et des jours dans la langue choisie
const fmt = o => new Intl.DateTimeFormat(LOC, o);
export const MOIS = Array.from({ length: 12 }, (_, m) => fmt({ month: 'long' }).format(new Date(2026, m, 15)));
export const MOIS_COURT = EN ? Array.from({ length: 12 }, (_, m) => fmt({ month: 'short' }).format(new Date(2026, m, 15)))
  : ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const JOURS = Array.from({ length: 7 }, (_, j) => fmt({ weekday: 'long' }).format(new Date(2026, 0, 4 + j)));   // 4 janv. 2026 = dimanche

// la page HTML : textes, aria-label, title, placeholder ; les blocs riches (data-t) sont remplacés en entier
export function traduirePage(racine = document.body) {
  if (!EN) return;
  racine.querySelectorAll('[data-t]').forEach(n => { const h = EN_HTML[n.dataset.t]; if (h != null) n.innerHTML = h; });
  const marche = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const brut = n.nodeValue, cle = brut.trim();
    if (cle && DICO[cle] != null) n.nodeValue = brut.replace(cle, DICO[cle]);
  }
  racine.querySelectorAll('[aria-label],[title],[placeholder]').forEach(n => {
    for (const a of ['aria-label', 'title', 'placeholder']) { const v = n.getAttribute(a); if (v && DICO[v] != null) n.setAttribute(a, DICO[v]); }
  });
}
