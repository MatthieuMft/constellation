// v48 : ambiance sonore (idée de Nightbook). Tout est synthétisé (Web Audio), aucun fichier à télécharger.
//  - nappe : un accord très doux qui respire lentement, filtré (désactivée par défaut) ;
//  - effets : une petite cloche quand une étoile naît, un tintement plus léger aux moments de fête (activés par défaut).
// Le navigateur n'autorise le son qu'après un premier toucher : on démarre au premier geste.
// Réglages dans constellation.son.v1 = { nappe: false, effets: true }.
const CLE = 'constellation.son.v1';
let conf = { nappe: false, effets: true };
try { conf = { ...conf, ...(JSON.parse(localStorage.getItem(CLE)) || {}) }; } catch (e) {}

let ac = null, maitre = null, echo = null, nappe = null;
function contexte() {
  if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  ac = new C(); maitre = ac.createGain(); maitre.gain.value = .9; maitre.connect(ac.destination);
  // un écho doux (retour filtré) donne de l'espace aux cloches
  echo = ac.createDelay(1.2); echo.delayTime.value = .33; const retour = ac.createGain(); retour.gain.value = .32; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
  echo.connect(f); f.connect(retour); retour.connect(echo); f.connect(maitre);
  return ac;
}
function cloche(freq, quand = 0, vol = .16, duree = 2.6) {
  const a = contexte(); if (!a) return; const t0 = a.currentTime + quand;
  for (const [mult, v] of [[1, 1], [2.76, .18], [5.4, .06]]) {          // un son de cloche : la fondamentale et deux partiels
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol * v, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + duree / mult ** .4);
    o.connect(g); g.connect(maitre); g.connect(echo); o.start(t0); o.stop(t0 + duree + .1);
  }
}
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];      // do pentatonique : rien ne sonne faux

function demarrerNappe() {
  const a = contexte(); if (!a || nappe) return;
  const g = a.createGain(); g.gain.value = 0; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = .4;
  const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = .05; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  const oscs = [130.81, 196, 261.63, 329.63].flatMap((fr, i) => [-4, 4].map(det => { const o = a.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = fr; o.detune.value = det; const og = a.createGain(); og.gain.value = i ? .05 : .07; o.connect(og); og.connect(f); o.start(); return o; }));
  f.connect(g); g.connect(maitre); g.gain.linearRampToValueAtTime(.35, a.currentTime + 4);
  nappe = { g, oscs, lfo };
}
function arreterNappe() {
  if (!nappe || !ac) return; const n = nappe; nappe = null;
  n.g.gain.cancelScheduledValues(ac.currentTime); n.g.gain.setTargetAtTime(0, ac.currentTime, .6);
  setTimeout(() => { n.oscs.forEach(o => o.stop()); n.lfo.stop(); }, 3000);
}

let geste = false;
const auPremierGeste = () => { if (geste) return; geste = true; if (conf.nappe) demarrerNappe(); };
addEventListener('pointerdown', auPremierGeste, { passive: true }); addEventListener('keydown', auPremierGeste);
document.addEventListener('visibilitychange', () => { if (!ac) return; document.hidden ? ac.suspend().catch(() => {}) : ac.resume().catch(() => {}); });

export const son = {
  conf: () => ({ ...conf }),
  regler(patch) {
    conf = { ...conf, ...patch }; try { localStorage.setItem(CLE, JSON.stringify(conf)); } catch (e) {}
    if ('nappe' in patch) conf.nappe ? demarrerNappe() : arreterNappe();
  },
  naissance() { if (!conf.effets) return; [0, 2, 4].forEach((i, k) => cloche(PENTA[i], k * .12, .14)); },          // une étoile naît : trois notes qui montent
  fete() { if (!conf.effets) return; [3, 5].forEach((i, k) => cloche(PENTA[i], k * .1, .1, 2)); },
  tinte() { if (!conf.effets) return; cloche(PENTA[(Math.random() * PENTA.length) | 0] * 2, 0, .045, 1.2); },     // toucher une étoile
};
