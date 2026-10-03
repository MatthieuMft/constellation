// v45 : verrou par code (4 chiffres) à l'ouverture de l'appli, et au retour après plus d'une minute en arrière-plan.
// Le code n'est jamais gardé en clair : seulement une empreinte, dans constellation.verrou.v1 = { empreinte, sel }.
// Ce n'est pas un coffre-fort (le journal reste lisible par qui fouille le navigateur) : c'est un rideau contre les regards.
//
// API :
//   verrou.actif()                         true si un code est défini
//   verrou.fermer()                        affiche l'écran du code (sans effet si pas de code ou déjà affiché)
//   verrou.choisir() -> Promise<bool>      demande un nouveau code deux fois ; true s'il est enregistré
//   verrou.retirer()                       supprime le code
//   verrou.surOubli(fn)                    ce que fait « Code oublié ? » (main.js : proposer de tout effacer)
import { t } from './langue.js';

const CLE = 'constellation.verrou.v1', ABSENCE = 60000;
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE)) || null; } catch (e) { return null; } };
function empreinte(code, sel) {                     // FNV-1a répété : rapide, sans API asynchrone (marche aussi hors https)
  let h = 2166136261 >>> 0; const s = sel + ':' + code;
  for (let k = 0; k < 2000; k++) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) + k; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}

let ecranOuvert = null, oubli = null, cache = 0;

function construire({ titre, sousTitre, surCode, annuler }) {
  const fond = document.createElement('div'); fond.className = 'verrou'; fond.setAttribute('role', 'dialog'); fond.setAttribute('aria-modal', 'true');
  const h = document.createElement('p'); h.className = 'verrou-titre'; h.textContent = titre;
  const st = document.createElement('p'); st.className = 'verrou-note'; st.textContent = sousTitre || '';
  const points = document.createElement('div'); points.className = 'verrou-points';
  for (let i = 0; i < 4; i++) points.append(document.createElement('span'));
  const pave = document.createElement('div'); pave.className = 'verrou-pave';
  let saisie = '';
  const maj = () => [...points.children].forEach((p, i) => p.classList.toggle('on', i < saisie.length));
  const taper = c => {
    if (c === '⌫') { saisie = saisie.slice(0, -1); maj(); return; }
    if (saisie.length >= 4) return; saisie += c; maj();
    if (saisie.length === 4) setTimeout(() => { const code = saisie; saisie = ''; maj(); surCode(code, { erreur: msg => { st.textContent = msg; points.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 260 }); }, titre: x => { h.textContent = x; st.textContent = ''; } }); }, 120);
  };
  for (const c of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = c;
    if (!c) b.style.visibility = 'hidden'; else b.addEventListener('click', () => taper(c));
    if (c === '⌫') b.setAttribute('aria-label', t('Effacer un chiffre'));
    pave.append(b);
  }
  const bas = document.createElement('div'); bas.className = 'verrou-bas';
  if (annuler) { const a = document.createElement('button'); a.type = 'button'; a.className = 'lien'; a.textContent = t('Annuler'); a.addEventListener('click', annuler); bas.append(a); }
  else { const o = document.createElement('button'); o.type = 'button'; o.className = 'lien'; o.textContent = t('Code oublié ?'); o.addEventListener('click', () => oubli && oubli()); bas.append(o); }
  const clavier = e => { if (/^[0-9]$/.test(e.key)) taper(e.key); else if (e.key === 'Backspace') taper('⌫'); };
  addEventListener('keydown', clavier);
  fond.append(h, points, st, pave, bas); document.body.append(fond);
  return () => { removeEventListener('keydown', clavier); fond.remove(); };
}

export const verrou = {
  actif: () => !!lire(),
  surOubli(fn) { oubli = fn; },
  fermer() {
    const v = lire(); if (!v || ecranOuvert) return;
    const retirer = construire({ titre: t('Ton code'), surCode: (code, ui) => {
      if (empreinte(code, v.sel) === v.empreinte) { ecranOuvert(); ecranOuvert = null; } else ui.erreur(t('Ce n’est pas le bon code.'));
    } });
    ecranOuvert = retirer;
  },
  choisir() {
    return new Promise(res => {
      let premier = null;
      const fin = ok => { retirer(); res(ok); };
      const retirer = construire({ titre: t('Choisis un code à 4 chiffres'), sousTitre: t('Il sera demandé à chaque ouverture.'), annuler: () => fin(false), surCode: (code, ui) => {
        if (!premier) { premier = code; ui.titre(t('Tape-le encore une fois')); return; }
        if (code !== premier) { premier = null; ui.titre(t('Choisis un code à 4 chiffres')); ui.erreur(t('Les deux codes sont différents. On recommence.')); return; }
        const sel = Math.random().toString(36).slice(2, 10);
        try { localStorage.setItem(CLE, JSON.stringify({ empreinte: empreinte(code, sel), sel })); } catch (e) { fin(false); return; }
        fin(true);
      } });
    });
  },
  retirer() { try { localStorage.removeItem(CLE); } catch (e) {} if (ecranOuvert) { ecranOuvert(); ecranOuvert = null; } },
};

// au retour dans l'appli après plus d'une minute ailleurs : on referme
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') cache = Date.now();
  else if (cache && Date.now() - cache > ABSENCE) verrou.fermer();
});
