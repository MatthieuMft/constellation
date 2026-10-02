// Sauvegarde automatique dans un dossier choisi (File System Access API : Chrome, Edge).
// Le dossier est mémorisé ; après un redémarrage, le navigateur redemande l'autorisation d'un clic.
import { lire, ecrire } from './cache.js';

const CLE = 'dossier-sauvegarde';
export const disponible = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

let dossier = null, minuteur = null, derniere = null;

const jour = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

async function ecrireFichier(h, nom, texte) {
  const f = await h.getFileHandle(nom, { create: true }), w = await f.createWritable();
  await w.write(texte); await w.close();
}

// état : 'indisponible' | 'aucun' | 'actif' | 'a-reconnecter'
export async function etat() {
  if (!disponible()) return 'indisponible';
  if (!dossier) dossier = await lire(CLE);
  if (!dossier) return 'aucun';
  try { return (await dossier.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'actif' : 'a-reconnecter'; } catch (e) { return 'a-reconnecter'; }
}
export async function choisir() {                  // à appeler depuis un clic
  dossier = await window.showDirectoryPicker({ mode: 'readwrite', id: 'constellation' });
  await ecrire(CLE, dossier); return dossier.name;
}
export async function reconnecter() {              // à appeler depuis un clic
  if (!dossier) dossier = await lire(CLE); if (!dossier) return false;
  return (await dossier.requestPermission({ mode: 'readwrite' })) === 'granted';
}
export async function arreter() { dossier = null; await ecrire(CLE, null); }
export const nomDossier = () => dossier ? dossier.name : '';

// Écrit « constellation.json » (dernier état) et « constellation-AAAA-MM-JJ.json » (instantané du jour).
export async function sauvegarder(donnees) {                    // donnees : { items, jours }
  if (!dossier || (await etat()) !== 'actif') return false;
  const texte = JSON.stringify({ version: 2, exporte: new Date().toISOString(), jours: donnees.jours, items: donnees.items }, null, 2);
  if (texte === derniere) return true;
  await ecrireFichier(dossier, 'constellation.json', texte);
  await ecrireFichier(dossier, 'constellation-' + jour() + '.json', texte);
  derniere = texte; return true;
}
// Regroupe les sauvegardes rapprochées (frappes, modifications en rafale).
export function planifier(donnees, surResultat) {
  clearTimeout(minuteur);
  minuteur = setTimeout(async () => { try { surResultat && surResultat(await sauvegarder(donnees)); } catch (e) { surResultat && surResultat(false, e); } }, 900);
}
