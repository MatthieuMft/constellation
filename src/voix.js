// v82 : enregistrer sa voix (Matthieu). Le micro du téléphone (MediaRecorder), 5 minutes au plus ; la note vocale devient un média
// de l'entrée du jour (IndexedDB, comme les photos). Elle ne quitte jamais l'appareil. Un petit lecteur la fait réécouter.
import { t } from './langue.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};
const MAX = 300;                                                          // secondes
export const mmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const possible = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

// une barre en bas de l'écran pendant l'enregistrement : point rouge, durée, Annuler, Terminer. surFin(fichier) reçoit un File audio (fichier.duree en s).
export function enregistrer({ surFin, surErreur, surFermer = () => {} }) {
  if (!possible()) { surErreur(t('Ton navigateur ne sait pas enregistrer le son.')); return null; }
  let rec = null, flux = null, morceaux = [], debut = 0, minuteur = 0, annule = false;
  const temps = el('span', { class: 'voix-temps' }, '0:00');
  const barre = el('div', { class: 'voix-barre', role: 'status' }, el('i', { class: 'voix-point', 'aria-hidden': 'true' }), el('span', { class: 'voix-t' }, t('Je t’écoute…')), temps,
    el('button', { type: 'button', onclick: () => { annule = true; finir(); } }, t('Annuler')),
    el('button', { type: 'button', class: 'plein', onclick: () => finir() }, t('Terminer')));
  document.body.append(barre);
  const nettoyer = () => { clearInterval(minuteur); barre.remove(); surFermer(); if (flux) flux.getTracks().forEach(p => p.stop()); flux = null; };
  function finir() { if (rec && rec.state !== 'inactive') rec.stop(); else nettoyer(); }
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(f => {
    flux = f; if (!barre.isConnected) { nettoyer(); return; }
    const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find(x => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x)) || '';
    rec = new MediaRecorder(f, type ? { mimeType: type } : undefined);
    rec.ondataavailable = e => { if (e.data && e.data.size) morceaux.push(e.data); };
    rec.onstop = () => {
      const duree = (performance.now() - debut) / 1000; nettoyer();
      if (annule || !morceaux.length || duree < .8) return;
      const mime = (rec.mimeType || type || 'audio/webm').split(';')[0], ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
      const d = new Date(), fichier = new File(morceaux, t('Voix') + ' ' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0') + '.' + ext, { type: mime });
      fichier.duree = Math.round(duree); surFin(fichier);
    };
    rec.start(1000); debut = performance.now();
    minuteur = setInterval(() => { const s = (performance.now() - debut) / 1000; temps.textContent = mmss(s); if (s >= MAX) finir(); }, 250);
  }).catch(() => { nettoyer(); surErreur(t('Le micro n’est pas autorisé. Autorise-le dans les réglages du navigateur.')); });
  return { finir, annuler: () => { annule = true; finir(); } };
}

// un petit lecteur : ▶ / ❚❚, une barre qu'on peut toucher pour avancer, la durée
export function lecteur(url, duree = 0, nom = '') {
  const audio = new Audio(); audio.preload = 'metadata'; audio.src = url;
  const bouton = el('button', { type: 'button', class: 'voix-jouer', 'aria-label': t('Écouter') }, '▶');
  const plein = el('i'), piste = el('span', { class: 'voix-piste' }, plein), temps = el('span', { class: 'voix-temps' }, mmss(duree));
  const total = () => isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duree;
  bouton.addEventListener('click', e => { e.stopPropagation(); audio.paused ? audio.play() : audio.pause(); });
  audio.addEventListener('play', () => { bouton.textContent = '❚❚'; bouton.setAttribute('aria-label', t('Pause')); });
  audio.addEventListener('pause', () => { bouton.textContent = '▶'; bouton.setAttribute('aria-label', t('Écouter')); });
  audio.addEventListener('ended', () => { plein.style.width = '0%'; temps.textContent = mmss(total()); });
  audio.addEventListener('timeupdate', () => { const T = total(); if (T) { plein.style.width = (audio.currentTime / T * 100) + '%'; temps.textContent = mmss(audio.paused ? T : audio.currentTime); } });
  piste.addEventListener('click', e => { e.stopPropagation(); const r = piste.getBoundingClientRect(), T = total(); if (T) { audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * T; if (audio.paused) audio.play(); } });
  return el('div', { class: 'voix-lecteur', title: nom }, bouton, el('span', { class: 'voix-nom' }, t('Ma voix')), piste, temps);
}
