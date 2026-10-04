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
  const fermer = () => { if (tour) { tour.mort = true; cancelAnimationFrame(tour.raf); tour = null; } if (ecran) ecran.remove(); ecran = null; };
  function medias(item) {
    const l = (item.medias || []).concat(item.media ? [item.media] : []); if (!l.length) return null;
    return el('div', { class: 'lec-medias' }, l.map(m => { const b = el('button', { type: 'button', class: 'vignette', onclick: () => ctx.voirMedia(item, m) });
      ctx.mediaUrl(m.cle).then(u => { if (!u) return; if (m.kind === 'fichier') { b.append(el('span', {}, m.nom || t('Fichier'))); return; } b.append(m.kind === 'video' ? el('video', { src: u, muted: true, preload: 'metadata', playsinline: true }) : el('img', { src: u, alt: '' })); if (m.kind === 'video') b.append(el('i', { class: 'lecture' }, '▶')); });
      return b; }));
  }
  function decale(c, { j = 0, m = 0, a = 0 }) { const d = dateDeCle(c); return cleJour(new Date(d.getFullYear() - a, d.getMonth() - m, d.getDate() - j, 12)); }
  function construire(k) {                                              // le contenu d'une page (une journée)
    const L = ctx.jours(), liste = ctx.items(k).slice().sort((a, b) => a.date - b.date);
    const contenu = liste.map(it => el('article', { class: 'lec-entree' },
      el('time', {}, new Date(it.date).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' })),
      it.titre ? el('h3', {}, it.titre) : null, it.texte ? blocs(it.texte, ctx.album) : null, it.legende ? el('p', {}, it.legende) : null, medias(it)));
    const echos = [[{ j: 7 }, t('il y a une semaine')], [{ m: 1 }, t('il y a un mois')], [{ a: 1 }, t('il y a un an')]].map(([o, lab]) => [decale(k, o), lab]).filter(([x]) => L.includes(x));
    const pied = echos.length ? el('div', { class: 'lec-echos' }, el('p', { class: 'album-lab' }, t('Ce jour-là')), echos.map(([x, lab]) => {
      const it = ctx.items(x)[0], s = it ? ((it.titre ? it.titre + ' · ' : '') + (it.texte || '')).replace(/\s+/g, ' ').trim() : '';
      return el('button', { type: 'button', onclick: () => aller(x, x < cle ? -1 : 1) }, el('small', {}, lab), el('span', {}, s.length > 90 ? s.slice(0, 88) + '…' : s));
    })) : null;
    return [...contenu, pied].filter(Boolean);
  }
  function entete() {
    const L = ctx.jours(), i = L.indexOf(cle), d = dateDeCle(cle), c = ctx.couleurJour(cle), tete = ecran.querySelector('.lec-date');
    tete.replaceChildren(el('small', {}, d.toLocaleDateString(LOC, { weekday: 'long' })), el('strong', {}, d.toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric' })));
    ecran.style.setProperty('--c', c || 'var(--line)');
    ecran.querySelector('.lec-prec').disabled = i <= 0; ecran.querySelector('.lec-suiv').disabled = i < 0 || i >= L.length - 1;
    ecran.querySelector('.lec-pos').textContent = i >= 0 ? (i + 1) + ' / ' + L.length : '';
  }
  // v73 (Matthieu : « trop rigide ») : une page souple. Elle se soulève par un coin, se replie le long d'un pli qui bouge,
  // et son dos apparaît, ombré, comme une vraie feuille. On peut l'attraper du doigt et la tirer : elle suit le geste,
  // puis termine de tourner (ou retombe) quand on lâche. Mouvement réduit demandé par le téléphone : on change simplement de page.
  // Géométrie : le coin C va vers le point P ; le pli est la médiatrice de [CP]. La partie côté coin est repliée (symétrie par rapport au pli).
  const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tour = null;
  function couper(poly, f) {                                            // garde la partie du polygone où f ≥ 0
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }); }
    }
    return out;
  }
  const clip = (e, pts) => { e.style.clipPath = pts && pts.length > 2 ? 'polygon(' + pts.map(q => q.x.toFixed(1) + 'px ' + q.y.toFixed(1) + 'px').join(',') + ')' : 'polygon(0 0,0 0,0 0)'; };
  const bande = (i, M, u) => { i.style.left = M.x + 'px'; i.style.top = (M.y - 3000) + 'px'; i.style.transform = 'rotate(' + Math.atan2(u.y, u.x) + 'rad)'; };
  function dessiner(T, P) {
    // la feuille ne se déchire pas : le coin reste à une largeur de page de la reliure
    const S = { x: 0, y: T.Cy }, S2 = { x: 0, y: T.H - T.Cy }, D = Math.hypot(T.W, T.H);
    let dx = P.x - S.x, dy = P.y - S.y, d = Math.hypot(dx, dy); if (d > T.W) P = { x: S.x + dx / d * T.W, y: S.y + dy / d * T.W };
    dx = P.x - S2.x; dy = P.y - S2.y; d = Math.hypot(dx, dy); if (d > D) P = { x: S2.x + dx / d * D, y: S2.y + dy / d * D };
    T.P = P;
    const cx = T.W - P.x, cy = T.Cy - P.y, l = Math.hypot(cx, cy), rect = [{ x: 0, y: 0 }, { x: T.W, y: 0 }, { x: T.W, y: T.H }, { x: 0, y: T.H }];
    if (l < .5) { clip(T.feuille, rect); clip(T.dos, null); clip(T.ombre, null); return; }
    const n = { x: cx / l, y: cy / l }, M = { x: (T.W + P.x) / 2, y: (T.Cy + P.y) / 2 }, cote = q => (q.x - M.x) * n.x + (q.y - M.y) * n.y;
    const coin = couper(rect, cote), refl = q => { const k = 2 * cote(q); return { x: q.x - k * n.x, y: q.y - k * n.y }; };
    // le pli n'est pas une arête droite : la feuille s'arrondit (une courbe qui bombe vers le coin), ce qui la rend souple
    const sur = coin.filter(q => Math.abs(cote(q)) < 1e-6), b = Math.min(30, l * .14);
    let plier = poly => poly;
    if (sur.length === 2) {
      const [A, B] = sur, courbe = []; for (let i = 1; i < 12; i++) { const u = i / 12, h = b * Math.pow(Math.sin(Math.PI * u), .8); courbe.push({ x: A.x + (B.x - A.x) * u + n.x * h, y: A.y + (B.y - A.y) * u + n.y * h }); }
      const pres = (q, r) => Math.abs(q.x - r.x) < .01 && Math.abs(q.y - r.y) < .01;
      plier = poly => { for (let i = 0; i < poly.length; i++) { const a = poly[i], c = poly[(i + 1) % poly.length];
        if (pres(a, A) && pres(c, B)) return [...poly.slice(0, i + 1), ...courbe, ...poly.slice(i + 1)];
        if (pres(a, B) && pres(c, A)) return [...poly.slice(0, i + 1), ...courbe.slice().reverse(), ...poly.slice(i + 1)]; } return poly; };
    }
    clip(T.feuille, plier(couper(rect, q => -cote(q)))); clip(T.dos, plier(coin.map(refl))); clip(T.ombre, plier(coin));
    bande(T.ombre.firstChild, { x: M.x + n.x * b * .6, y: M.y + n.y * b * .6 }, n); T.ombre.style.setProperty('--o', Math.min(70, l * .35) + 'px');
    bande(T.dos.firstChild, M, { x: -n.x, y: -n.y }); T.dos.style.setProperty('--o', Math.min(170, l * .5) + 'px');
  }
  function monter(sens, k, y0) {                                         // prépare la feuille qui tourne (sens > 0 : on avance)
    const livre = ecran.querySelector('.lec-livre'), corps = ecran.querySelector('.lec-corps'), W = livre.clientWidth, H = livre.clientHeight;
    const Cy = y0 != null && y0 < H * .45 ? 0 : H, haut = corps.scrollTop;
    const recto = el('div', { class: 'lec-recto' }), feuille = el('div', { class: 'lec-feuille' }, recto);
    const ombre = el('div', { class: 'lec-ombre' }, el('i')), dos = el('div', { class: 'lec-dos' }, el('i')), dosO = el('div', { class: 'lec-dos-ombre' }, dos);
    if (sens > 0) { recto.append(...corps.childNodes); corps.replaceChildren(...construire(k)); corps.scrollTop = 0; } else recto.append(...construire(k));
    livre.append(ombre, feuille, dosO); if (sens > 0) recto.scrollTop = haut;
    const T = { sens, W, H, Cy, feuille, ombre, dos, debut: { x: sens > 0 ? W : -W, y: Cy }, fin: { x: sens > 0 ? -W : W, y: Cy }, cible: null, raf: 0, mort: false };
    const nettoyer = () => { T.mort = true; cancelAnimationFrame(T.raf); feuille.remove(); ombre.remove(); dosO.remove(); if (tour === T) tour = null; };
    T.annuler = () => { if (sens > 0) { corps.replaceChildren(...recto.childNodes); corps.scrollTop = haut; } nettoyer(); };
    T.valider = () => { if (sens < 0) { corps.replaceChildren(...recto.childNodes); corps.scrollTop = 0; } cle = k; entete(); nettoyer(); };
    T.terminer = () => (T.cible === 'fin' ? T.valider : T.annuler)();
    tour = T; dessiner(T, T.debut); return T;
  }
  function glisser(T, vers, ms, arc, apres) {                            // le coin file vers « vers », en se soulevant un peu (arc)
    const de = { ...T.P }, t0 = performance.now();
    const pas = now => {
      if (T.mort) return;
      const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, h = Math.sin(Math.PI * e) * arc;
      dessiner(T, { x: de.x + (vers.x - de.x) * e, y: de.y + (vers.y - de.y) * e + (T.Cy ? -h : h) });
      if (k < 1) T.raf = requestAnimationFrame(pas); else apres();
    };
    T.raf = requestAnimationFrame(pas);
  }
  function page(sens = 0, k = cle) {
    const corps = ecran.querySelector('.lec-corps');
    if (tour) tour.terminer();                                           // une page tournée pendant qu'une autre tourne encore : on termine la première d'un coup
    if (!sens || reduit()) { cle = k; entete(); corps.replaceChildren(...construire(k)); corps.scrollTop = 0; return; }
    const T = monter(sens, k, null); T.cible = 'fin';
    glisser(T, T.fin, 900, T.H * .2, () => T.valider());
  }
  function aller(k, sens) { if (!k) return; page(sens, k); }
  function voisin(delta) { if (tour) tour.terminer(); const L = ctx.jours(), i = L.indexOf(cle); const k = L[i + delta]; if (k) aller(k, delta); }
  // attraper la page du doigt
  function geste(livre) {
    let g = null;
    livre.addEventListener('pointerdown', e => { if (!tour && e.isPrimary) g = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), T: null }; });
    livre.addEventListener('pointermove', e => {
      if (!g || e.pointerId !== g.id) return;
      const r = livre.getBoundingClientRect(), dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.T) {
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.3) { if (Math.abs(dy) > 14) g = null; return; }
        const sens = dx < 0 ? 1 : -1, L = ctx.jours(), k = L[L.indexOf(cle) + sens]; if (!k || reduit()) { g = null; return; }
        g.x0 = g.x - r.left; g.y0 = g.y - r.top; g.T = monter(sens, k, g.y0); g.t = performance.now();
        try { livre.setPointerCapture(e.pointerId); } catch (err) {}
      }
      const T = g.T, fx = e.clientX - r.left, fy = e.clientY - r.top;
      const px = T.sens > 0 ? T.W - (g.x0 - fx) * (2 * T.W / Math.max(60, g.x0)) : -T.W + (fx - g.x0) * (2 * T.W / Math.max(60, T.W - g.x0));
      dessiner(T, { x: px, y: T.Cy + (fy - g.y0) * .8 });
    });
    const lacher = (e, annule) => {
      if (!g || e.pointerId !== g.id) return; const T = g.T, vite = performance.now() - g.t < 300; g = null; if (!T) return;
      const prog = T.sens > 0 ? (T.W - T.P.x) / (2 * T.W) : (T.P.x + T.W) / (2 * T.W);
      if (!annule && (prog > .3 || (vite && prog > .06))) { T.cible = 'fin'; glisser(T, T.fin, 250 + 450 * (1 - prog), 0, () => T.valider()); }
      else { T.cible = 'debut'; glisser(T, T.debut, 180 + 380 * prog, 0, () => T.annuler()); }
    };
    livre.addEventListener('pointerup', e => lacher(e, false)); livre.addEventListener('pointercancel', e => lacher(e, true));
  }
  function ouvrir(depart = null) {
    fermer(); const L = ctx.jours(); if (!L.length) return false;
    cle = depart && L.includes(depart) ? depart : (depart ? (L.filter(k => k <= depart).pop() || L[0]) : L[L.length - 1]);
    ecran = el('div', { class: 'lecture-ecran', role: 'dialog', 'aria-label': t('Relire mon journal') },
      el('div', { class: 'lec-tete' },
        el('button', { type: 'button', class: 'lec-prec nav-jour', 'aria-label': t('Jour précédent'), onclick: () => voisin(-1) }, '‹'),
        el('div', { class: 'lec-date' }),
        el('button', { type: 'button', class: 'lec-suiv nav-jour', 'aria-label': t('Jour suivant'), onclick: () => voisin(1) }, '›'),
        el('button', { type: 'button', class: 'fermer', 'aria-label': t('Fermer'), onclick: fermer }, '×')),
      el('div', { class: 'lec-livre' }, el('div', { class: 'lec-corps' })),
      el('div', { class: 'lec-pied' }, el('span', { class: 'lec-pos' }), el('button', { type: 'button', class: 'lien', onclick: () => { const k = cle; fermer(); ctx.ouvrirJour(k); } }, t('Voir dans le ciel'))));
    geste(ecran.querySelector('.lec-livre'));
    ecran.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') voisin(-1); if (e.key === 'ArrowRight') voisin(1); if (e.key === 'Escape') fermer(); });
    document.body.append(ecran); page(0, cle); ecran.tabIndex = -1; ecran.focus(); return true;
  }
  return { ouvrir, fermer, ouvert: () => !!ecran, cle: () => cle };
}
