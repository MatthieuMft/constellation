// Photos, vidéos et fichiers : stockés dans IndexedDB, sur l'appareil. Les images sont réduites (1600 px, JPEG) pour rester légères.
import { t } from './langue.js';
const NOM = 'constellation-media', MAGASIN = 'fichiers';
export const LIMITE_VIDEO = 150 * 1024 * 1024;                     // 150 Mo
let base = null;
const ouvrir = () => base || (base = new Promise(res => {
  try { const r = indexedDB.open(NOM, 1); r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); }
}));
const tx = async (mode, f) => { const d = await ouvrir(); if (!d) throw new Error(t('Stockage indisponible')); return new Promise((res, rej) => { const q = f(d.transaction(MAGASIN, mode).objectStore(MAGASIN)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };

const urls = new Map();
const cle = () => 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function reduireImage(fichier, max = 1600) {
  const bmp = await createImageBitmap(fichier);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85)); return { blob, w, h };
}

// retourne { cle, kind, nom, w?, h? }
export async function stocker(fichier) {
  const kind = fichier.type.startsWith('video/') ? 'video' : fichier.type.startsWith('image/') ? 'image' : 'fichier';
  if (kind === 'video' && fichier.size > LIMITE_VIDEO) throw new Error(t('Vidéo trop lourde (150 Mo maximum)'));
  if (kind === 'fichier' && fichier.size > LIMITE_VIDEO) throw new Error(t('Fichier trop lourd (150 Mo maximum)'));
  const k = cle();
  if (kind === 'image') { const { blob, w, h } = await reduireImage(fichier); await tx('readwrite', s => s.put(blob, k)); return { cle: k, kind, nom: fichier.name, w, h }; }
  await tx('readwrite', s => s.put(fichier, k)); return { cle: k, kind, nom: fichier.name };
}
export async function url(k) {
  if (urls.has(k)) return urls.get(k);
  const blob = await tx('readonly', s => s.get(k)); if (!blob) return null;
  const u = URL.createObjectURL(blob); urls.set(k, u); return u;
}
export async function supprimer(k) { try { await tx('readwrite', s => s.delete(k)); } catch (e) {} if (urls.has(k)) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); } }
export async function enDataURL(k) {                              // pour l'export (images seulement)
  const blob = await tx('readonly', s => s.get(k)); if (!blob) return null;
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
}
export async function depuisDataURL(dataurl) { const blob = await (await fetch(dataurl)).blob(); const k = cle(); await tx('readwrite', s => s.put(blob, k)); return k; }
