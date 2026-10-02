// Service worker : l'application s'ouvre tout de suite et fonctionne hors-ligne, et peut rappeler d'écrire.
// - fichiers du site : servis depuis le cache (ouverture instantanée, même sur un réseau mobile faible) ;
//   chaque mise en ligne change VERSION : le navigateur installe alors la nouvelle version en arrière-plan,
//   puis la page se recharge d'elle-même (voir main.js). Donc : incrémenter VERSION à chaque livraison ;
// - rappel du soir : notification (periodic background sync, quand le navigateur l'autorise) et clic qui rouvre l'appli.
const VERSION = 'constellation-v13';
const T = 'vendor/three@0.170.0/';
const COQUILLE = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'src/main.js', 'src/store.js', 'src/embed.js', 'src/layout.js', 'src/themes.js', 'src/rendu.js', 'src/reglages.js',
  'src/cache.js', 'src/analyse.js', 'src/panneaux.js', 'src/ciel.js', 'src/sauvegarde.js',
  'src/palette.js', 'src/volume.js', 'src/finition.js', 'src/evenements.js', 'src/scenes.js', 'src/creature.js', 'src/lueur3d.js', 'src/lueur3d-formes.js', 'src/lueur3d-accessoires.js', 'src/lueur3d-habits.js',
  'src/temps.js', 'src/monde.js', 'src/jour.js', 'src/media.js', 'src/rappels.js', 'src/rythme.js', 'src/dates.js', 'src/marques.js', 'src/lueur-ui.js', 'src/langue.js', 'src/en.js', 'src/etoiles.js', 'src/boutique.js', 'src/accueil.js', 'src/decor.js', 'src/ciel-ui.js',
  T + 'three.module.min.js', ...['controls/OrbitControls.js', 'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js',
    'postprocessing/OutputPass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/MaskPass.js', 'postprocessing/Pass.js',
    'shaders/CopyShader.js', 'shaders/OutputShader.js', 'shaders/LuminosityHighPassShader.js'].map(f => T + 'addons/' + f)];

self.addEventListener('install', e => {          // cache: 'reload' : on prend les fichiers frais, pas ceux du cache HTTP
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(COQUILLE.map(u => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const reseau = () => fetch(req).then(r => { if (r.ok) { const copie = r.clone(); caches.open(VERSION).then(c => c.put(req, copie)); } return r; });
  if (req.mode === 'navigate') {                 // la page elle-même (avec ou sans ?ecrire=1) : celle du cache, sinon le réseau
    e.respondWith(caches.open(VERSION).then(c => c.match('index.html')).then(hit => hit || reseau()).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || reseau()).catch(() => Response.error()));
});

// ───── rappel du soir ─────
const idb = () => new Promise(res => { const r = indexedDB.open('constellation-cache', 1); r.onupgradeneeded = () => r.result.createObjectStore('vecteurs'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
const lire = async k => { const d = await idb(); if (!d) return null; return new Promise(res => { const q = d.transaction('vecteurs').objectStore('vecteurs').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); };
const ecrire = async (k, v) => { const d = await idb(); if (d) d.transaction('vecteurs', 'readwrite').objectStore('vecteurs').put(v, k); };
const cle = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

async function verifierRappel() {
  const c = await lire('rappel-config'); if (!c || !c.actif) return;
  const maintenant = new Date(), [h, m] = c.heure.split(':').map(Number), echeance = new Date(maintenant); echeance.setHours(h, m, 0, 0);
  if (maintenant < echeance) return;
  const aujourdhui = cle();
  if ((await lire('rappel-dernier-ecrit')) === aujourdhui || (await lire('rappel-derniere-notif')) === aujourdhui) return;
  await ecrire('rappel-derniere-notif', aujourdhui);
  await self.registration.showNotification('Constellation', { body: c.langue === 'en' ? (c.nom || 'Your glow') + ' is waiting: a thought for tonight?' : (c.nom || 'Votre lueur') + ' vous attend : une pensée pour ce soir ?', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'constellation-rappel', data: { url: './?ecrire=1' } });
}
self.addEventListener('periodicsync', e => { if (e.tag === 'constellation-rappel') e.waitUntil(verifierRappel()); });
self.addEventListener('message', e => { if (e.data === 'verifier-rappel') e.waitUntil(verifierRappel()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => (l.length ? l[0].focus() : self.clients.openWindow(url))));
});
