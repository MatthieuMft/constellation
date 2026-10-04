// v60 : relire comme un livre. Une page par jour écrit, en plein écran ; on glisse vers la gauche ou la droite pour changer de jour.
// Sous chaque journée : « Ce jour-là » (il y a une semaine, un mois, un an), quand ces jours-là ont été écrits.
import { t, LOC } from './langue.js';
import { blocs } from './jour.js';
import { dateDeCle, cleJour } from './store.js';

const el = (tag, attrs = {}, ...enfants) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => k === 'class' ? n.className = v : k.startsWith('on') ? n.addEventListener(k.slice(2), v) : v === false || v == null ? 0 : n.setAttribute(k, v === true ? '' : v));
  n.append(...enfants.flat().filter(x => x != null && x !== false)); return n;
};

// ctx : { jours() → clés triées, items(cle), couleurJour(cle), mediaUrl(cle), voirMedia(item, m), album(k, n), ouvrirJour(cle) }
export function creerLecture(ctx) {
  let ecran = null, cle = null;
  const fermer = () => { if (ecran) ecran.remove(); ecran = null; };
  function medias(item) {
    const l = (item.medias || []).concat(item.media ? [item.media] : []); if (!l.length) return null;
    return el('div', { class: 'lec-medias' }, l.map(m => { const b = el('button', { type: 'button', class: 'vignette', onclick: () => ctx.voirMedia(item, m) });
      ctx.mediaUrl(m.cle).then(u => { if (!u) return; if (m.kind === 'fichier') { b.append(el('span', {}, m.nom || t('Fichier'))); return; } b.append(m.kind === 'video' ? el('video', { src: u, muted: true, preload: 'metadata', playsinline: true }) : el('img', { src: u, alt: '' })); if (m.kind === 'video') b.append(el('i', { class: 'lecture' }, '▶')); });
      return b; }));
  }
  function decale(c, { j = 0, m = 0, a = 0 }) { const d = dateDeCle(c); return cleJour(new Date(d.getFullYear() - a, d.getMonth() - m, d.getDate() - j, 12)); }
  function page(sens = 0) {
    const L = ctx.jours(), i = L.indexOf(cle), d = dateDeCle(cle), c = ctx.couleurJour(cle);
    const liste = ctx.items(cle).slice().sort((a, b) => a.date - b.date);
    const corps = ecran.querySelector('.lec-corps'), tete = ecran.querySelector('.lec-date');
    tete.replaceChildren(el('small', {}, d.toLocaleDateString(LOC, { weekday: 'long' })), el('strong', {}, d.toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric' })));
    ecran.style.setProperty('--c', c || 'var(--line)');
    ecran.querySelector('.lec-prec').disabled = i <= 0; ecran.querySelector('.lec-suiv').disabled = i < 0 || i >= L.length - 1;
    ecran.querySelector('.lec-pos').textContent = i >= 0 ? (i + 1) + ' / ' + L.length : '';
    const contenu = liste.map(it => el('article', { class: 'lec-entree' },
      el('time', {}, new Date(it.date).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' })),
      it.titre ? el('h3', {}, it.titre) : null, it.texte ? blocs(it.texte, ctx.album) : null, it.legende ? el('p', {}, it.legende) : null, medias(it)));
    const echos = [[{ j: 7 }, t('il y a une semaine')], [{ m: 1 }, t('il y a un mois')], [{ a: 1 }, t('il y a un an')]].map(([o, lab]) => [decale(cle, o), lab]).filter(([k]) => L.includes(k));
    const pied = echos.length ? el('div', { class: 'lec-echos' }, el('p', { class: 'album-lab' }, t('Ce jour-là')), echos.map(([k, lab]) => {
      const it = ctx.items(k)[0], s = it ? ((it.titre ? it.titre + ' · ' : '') + (it.texte || '')).replace(/\s+/g, ' ').trim() : '';
      return el('button', { type: 'button', onclick: () => aller(k, k < cle ? -1 : 1) }, el('small', {}, lab), el('span', {}, s.length > 90 ? s.slice(0, 88) + '…' : s));
    })) : null;
    corps.replaceChildren(...contenu, pied || ''); corps.scrollTop = 0;
    if (sens) { corps.classList.remove('vers-g', 'vers-d'); void corps.offsetWidth; corps.classList.add(sens > 0 ? 'vers-g' : 'vers-d'); }
  }
  function aller(k, sens) { if (!k) return; cle = k; page(sens); }
  function voisin(delta) { const L = ctx.jours(), i = L.indexOf(cle); const k = L[i + delta]; if (k) aller(k, delta); }
  function ouvrir(depart = null) {
    fermer(); const L = ctx.jours(); if (!L.length) return false;
    cle = depart && L.includes(depart) ? depart : (depart ? (L.filter(k => k <= depart).pop() || L[0]) : L[L.length - 1]);
    ecran = el('div', { class: 'lecture-ecran', role: 'dialog', 'aria-label': t('Relire mon journal') },
      el('div', { class: 'lec-tete' },
        el('button', { type: 'button', class: 'lec-prec nav-jour', 'aria-label': t('Jour précédent'), onclick: () => voisin(-1) }, '‹'),
        el('div', { class: 'lec-date' }),
        el('button', { type: 'button', class: 'lec-suiv nav-jour', 'aria-label': t('Jour suivant'), onclick: () => voisin(1) }, '›'),
        el('button', { type: 'button', class: 'fermer', 'aria-label': t('Fermer'), onclick: fermer }, '×')),
      el('div', { class: 'lec-corps' }),
      el('div', { class: 'lec-pied' }, el('span', { class: 'lec-pos' }), el('button', { type: 'button', class: 'lien', onclick: () => { const k = cle; fermer(); ctx.ouvrirJour(k); } }, t('Voir dans le ciel'))));
    // glisser d'un jour à l'autre
    const corps = ecran.querySelector('.lec-corps'); let g = null;
    corps.addEventListener('pointerdown', e => { g = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    corps.addEventListener('pointerup', e => { if (!g) return; const dx = e.clientX - g.x, dy = e.clientY - g.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && performance.now() - g.t < 800) voisin(dx < 0 ? 1 : -1); g = null; });
    corps.addEventListener('pointercancel', () => { g = null; });
    ecran.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') voisin(-1); if (e.key === 'ArrowRight') voisin(1); if (e.key === 'Escape') fermer(); });
    document.body.append(ecran); page(); ecran.tabIndex = -1; ecran.focus(); return true;
  }
  return { ouvrir, fermer, ouvert: () => !!ecran, cle: () => cle };
}
