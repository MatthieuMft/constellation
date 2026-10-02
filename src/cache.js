// Cache des vecteurs de sens (IndexedDB) : le modèle profond ne recalcule jamais un texte déjà vu.
const NOM = 'constellation-cache', MAGASIN = 'vecteurs';
let base = null;
const ouvrir = () => base || (base = new Promise(res => {
  try {
    const r = indexedDB.open(NOM, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN);
    r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
  } catch (e) { res(null); }
}));

export async function lire(cle) {
  const d = await ouvrir(); if (!d) return null;
  return new Promise(res => { try { const q = d.transaction(MAGASIN).objectStore(MAGASIN).get(cle); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } });
}
export async function ecrire(cle, valeur) {
  const d = await ouvrir(); if (!d) return;
  try { d.transaction(MAGASIN, 'readwrite').objectStore(MAGASIN).put(valeur, cle); } catch (e) {}
}
export function empreinte(texte) {
  let h = 2166136261; for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '-' + texte.length;
}
export async function avecCache(cle, calcul) {
  const v = await lire(cle); if (v) return v;
  const n = await calcul(); ecrire(cle, n); return n;
}
