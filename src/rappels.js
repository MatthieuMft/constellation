// Rappel du soir, sur PC comme sur smartphone (même code web).
//  - appli ouverte (ou en arrière-plan) : un minuteur déclenche la notification à l'heure choisie, si rien n'a été écrit aujourd'hui ;
//  - appli installée (Chrome, Edge, Android) : le service worker vérifie aussi en tâche de fond (« periodic background sync ») ;
//  - appli fermée sans installation, ou iPhone hors appli installée : le navigateur ne permet pas de réveiller la page à heure fixe.
// Quand l'appli est ouverte et visible à l'heure dite, on ne notifie pas : la petite lueur invite dans l'appli.
import { ecrire, lire } from './cache.js';
import { t, LANGUE } from './langue.js';

const CLE = 'constellation.rappel';
export const supporte = () => typeof Notification !== 'undefined';
export function config() { try { return { actif: false, heure: '21:00', ...(JSON.parse(localStorage.getItem(CLE)) || {}) }; } catch (e) { return { actif: false, heure: '21:00' }; } }
const enregistrer = c => { try { localStorage.setItem(CLE, JSON.stringify(c)); } catch (e) {} };
export const permission = () => supporte() ? Notification.permission : 'indisponible';

const cleDuJour = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export function prochaineEcheance(heure, depuis = new Date()) {
  const [h, m] = heure.split(':').map(Number), d = new Date(depuis); d.setHours(h, m, 0, 0);
  if (d <= depuis) d.setDate(d.getDate() + 1); return d;
}

let minuteur = null, hooks = null;
async function afficher(titre, corps) {
  const options = { body: corps, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'constellation-rappel', renotify: true, data: { url: './?ecrire=1' } };
  try { const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null; if (reg) { await reg.showNotification(titre, options); return true; } } catch (e) {}
  try { const n = new Notification(titre, options); n.onclick = () => { focus(); n.close(); }; return true; } catch (e) { return false; }
}

// hooks : { ecritAujourdhui(): bool, message(): {titre, corps}, invite(): void }
export function planifier(h) {
  hooks = h || hooks; clearTimeout(minuteur); const c = config(); if (!c.actif || !hooks) return;
  const dans = Math.min(prochaineEcheance(c.heure) - new Date(), 2 ** 31 - 1);
  minuteur = setTimeout(declencher, dans);
}
export async function declencher() {
  const c = config(); if (!c.actif || !hooks) return;
  const aujourdhui = cleDuJour();
  if (!hooks.ecritAujourdhui() && (await lire('rappel-derniere-notif')) !== aujourdhui) {
    await ecrire('rappel-derniere-notif', aujourdhui);
    if (document.visibilityState === 'visible') hooks.invite();                         // l'appli est sous les yeux : invitation douce, pas de notification système
    else if (permission() === 'granted') { const m = hooks.message(); await afficher(m.titre, m.corps); }
  }
  planifier();
}
// à appeler à chaque retour au premier plan : un minuteur peut avoir été retardé (veille de l'ordinateur)
export function rattraper() {
  const c = config(); if (!c.actif || !hooks) return;
  const maintenant = new Date(), [h, m] = c.heure.split(':').map(Number), echeance = new Date(maintenant); echeance.setHours(h, m, 0, 0);
  if (maintenant >= echeance) declencher(); else planifier();
}

export async function synchroniserSW(dernierEcrit) {            // le service worker lit ceci dans IndexedDB
  const c = config(); await ecrire('rappel-config', { actif: c.actif, heure: c.heure, nom: c.nom || '', langue: LANGUE }); if (dernierEcrit) await ecrire('rappel-dernier-ecrit', dernierEcrit);
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null;
    if (reg && reg.periodicSync) { if (c.actif) await reg.periodicSync.register('constellation-rappel', { minInterval: 6 * 3600 * 1000 }); else await reg.periodicSync.unregister('constellation-rappel'); }
  } catch (e) {}
}

// active / désactive ; renvoie { ok, message }
export async function activer(actif, heure, nom) {
  const c = { ...config(), actif, nom: nom || config().nom || '' }; if (heure) c.heure = heure;
  if (actif) {
    if (!supporte()) return { ok: false, message: t('Ce navigateur ne gère pas les notifications. Le rappel ne s’affichera que dans l’appli ouverte.'), config: { ...c, actif: true } };
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission === 'denied') { enregistrer({ ...c, actif: true }); planifier(); return { ok: false, message: t('Notifications refusées par le navigateur : le rappel ne s’affichera que dans l’appli ouverte.') }; }
  }
  enregistrer(c); planifier(); await synchroniserSW(); return { ok: true, message: actif ? t('Rappel activé à {h}.', { h: c.heure }) : t('Rappel désactivé.') };
}
export async function tester(message) { if (permission() !== 'granted') return false; return afficher(message.titre, message.corps); }
function focus() { try { window.focus(); } catch (e) {} }
