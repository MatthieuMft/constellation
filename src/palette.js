// Palette de commandes : une barre unique pour tout faire (commandes + recherche par le sens).
import { norm } from './embed.js';
import { t } from './langue.js';

// ctx : { commandes(): [{nom, mots?, etat?, raccourci?, action}], rechercher(texte), effacer(), ouverte() }
export function monterPalette(el, ctx) {
  const champ = el.querySelector('input'), ul = el.querySelector('ul');
  let items = [], sel = 0, minuteur = null;

  function filtrer() {
    const brut = champ.value.trim(), q = norm(brut), toutes = ctx.commandes();
    let res = q ? toutes.filter(c => q.split(/\s+/).every(t => norm(c.nom + ' ' + (c.mots || '')).includes(t))) : toutes;
    if (brut.length >= 2) res = [...res, { nom: t('Chercher « {q} » dans mes pensées', { q: brut }), recherche: brut, etat: 'sens' }];
    items = res; sel = 0; rendre();
  }
  function rendre() {
    ul.replaceChildren();
    items.forEach((c, i) => {
      const li = document.createElement('li'), b = document.createElement('button');
      li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === sel); b.type = 'button'; b.tabIndex = -1;
      const nom = document.createElement('span'); nom.textContent = c.nom; b.append(nom);
      const droite = c.raccourci || c.etat; if (droite) { const k = document.createElement('kbd'); k.textContent = droite; b.append(k); }
      b.addEventListener('mousemove', () => { if (sel !== i) { sel = i; majSelection(); } });
      b.addEventListener('click', () => valider(i));
      li.append(b); ul.append(li);
    });
  }
  function majSelection() { [...ul.children].forEach((li, i) => { li.setAttribute('aria-selected', i === sel); if (i === sel) li.scrollIntoView({ block: 'nearest' }); }); }

  function ouvrir() { el.hidden = false; champ.value = ''; filtrer(); champ.focus(); }
  function fermer(effacer = true) { clearTimeout(minuteur); el.hidden = true; champ.blur(); if (effacer) ctx.effacer(); }
  function valider(i = sel) {
    const c = items[i]; if (!c) return;
    if (c.recherche) { ctx.rechercher(c.recherche); fermer(false); return; }
    fermer(true); c.action();
  }

  champ.addEventListener('input', () => {
    filtrer(); clearTimeout(minuteur); const b = champ.value.trim();
    minuteur = setTimeout(() => b.length >= 2 ? ctx.rechercher(b) : ctx.effacer(), 260);   // les étoiles s'allument pendant la frappe
  });
  champ.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, items.length); majSelection(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(1, items.length); majSelection(); }
    else if (e.key === 'Enter') { e.preventDefault(); valider(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(true); }
  });
  el.querySelector('.p-fond').addEventListener('pointerdown', () => fermer(true));

  addEventListener('keydown', e => {
    const dansChamp = /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
    if (((e.key === '/' && !dansChamp) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && el.hidden) { e.preventDefault(); ouvrir(); }
  });
  return { ouvrir, fermer, ouverte: () => !el.hidden };
}
