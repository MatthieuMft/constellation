// v83 : transmettre sa galaxie en souvenir (Matthieu : « pour faire comme une passation », « un souvenir, il ne peut pas continuer »).
// Un fichier .constellation, chiffré avec un mot de passe (AES-GCM, clé tirée du mot de passe par PBKDF2) : sans lui, illisible.
// Chez celui qui le reçoit, la galaxie se garde à part (IndexedDB « constellation-recues ») et ne se lit qu'en lecture seule :
// rien ne se mélange à son propre journal, rien ne s'y écrit.
const ENTETE = 'CONSTELLATION-GALAXIE-1\n', ITER = 210000;
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const deb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function cle(mdp, sel) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(mdp), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function chiffrer(objet, mdp) {
  const sel = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cle(mdp, sel), new TextEncoder().encode(JSON.stringify(objet)));
  return new Blob([ENTETE, JSON.stringify({ sel: b64(sel), iv: b64(iv), data: b64(data) })], { type: 'application/octet-stream' });
}
export const estGalaxie = texte => typeof texte === 'string' && texte.startsWith(ENTETE);
// renvoie l'objet, ou lance 'mdp' (mauvais mot de passe) / 'format' (pas un fichier de galaxie)
export async function dechiffrer(texte, mdp) {
  if (!estGalaxie(texte)) throw new Error('format');
  let o; try { o = JSON.parse(texte.slice(ENTETE.length)); } catch (e) { throw new Error('format'); }
  try { const brut = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deb64(o.iv) }, await cle(mdp, deb64(o.sel)), deb64(o.data)); return JSON.parse(new TextDecoder().decode(brut)); }
  catch (e) { throw new Error('mdp'); }
}

// ── les galaxies reçues : la liste dans localStorage, le contenu (photos, voix comprises) dans IndexedDB ──
const LISTE = 'constellation.recues.v1';
let base = null;
const ouvrirBase = () => base || (base = new Promise(res => { try { const r = indexedDB.open('constellation-recues', 1); r.onupgradeneeded = () => r.result.createObjectStore('galaxies'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
const tx = async (mode, f) => { const d = await ouvrirBase(); if (!d) throw new Error('stockage'); return new Promise((res, rej) => { const q = f(d.transaction('galaxies', mode).objectStore('galaxies')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
export function recues() { try { const l = JSON.parse(localStorage.getItem(LISTE)); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
export async function garder(g) {
  const id = 'g' + Date.now().toString(36), jours = [...new Set(g.items.map(i => i.jour))].sort();
  await tx('readwrite', s => s.put(g, id));
  const l = recues(); l.push({ id, auteur: g.auteur || '', recue: Date.now(), n: jours.length, du: jours[0] || null, au: jours.at(-1) || null });
  try { localStorage.setItem(LISTE, JSON.stringify(l)); } catch (e) {}
  return id;
}
export const lire = id => tx('readonly', s => s.get(id));
export async function oublier(id) {
  try { await tx('readwrite', s => s.delete(id)); } catch (e) {}
  try { localStorage.setItem(LISTE, JSON.stringify(recues().filter(g => g.id !== id))); } catch (e) {}
}
