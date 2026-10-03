// L'accueil raconté, au premier lancement : bienvenue, la lueur, la première entrée, la première étoile, la poussière
// d'étoiles et la boutique, puis « Ton univers commence ici ». On FAIT au lieu de lire ; « Passer » partout.
// (La langue se choisit juste avant, sur l'écran de chargement.)
import { t } from './langue.js';

const CLE = 'constellation.accueil';
export const dejaVu = () => { try { return localStorage.getItem(CLE) === '1'; } catch (e) { return true; } };
export const marquerVu = () => { try { localStorage.setItem(CLE, '1'); } catch (e) {} };

const ETAPES = ['bienvenue', 'lueur', 'ecrire', 'etoile', 'poussiere', 'rappel', 'appli', 'fin'];   // v29 : rappel du soir et écran d'accueil

// ctx : { montrerLueur(), nom(), renommer(nom), ouvrirEcrire(), ouvrirBoutique(), toast(txt), fini(), activerRappel(heure) → Promise<{ ok, message }>, installer() → Promise<bool> | null }
export function monterAccueil(ctx) {
  const $ = id => document.getElementById(id);
  const zone = $('accueil'), carteEl = $('ac-carte'), points = $('ac-points'), bulle = $('ac-bulle'), passer = $('ac-passer');
  let etape = -1, actif = false;

  function carte(html) {
    carteEl.classList.add('cache');
    setTimeout(() => { carteEl.innerHTML = html; carteEl.classList.toggle('cache', !html); const i = carteEl.querySelector('input'); if (i) i.focus({ preventScroll: true }); }, 260);
  }
  const echap = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function montrerBulle(txt) { if (!txt) { bulle.hidden = true; return; } bulle.textContent = txt; bulle.hidden = false; }

  function aller(n) {
    etape = n; const e = ETAPES[n];
    points.replaceChildren(...ETAPES.map((_, i) => { const p = document.createElement('i'); if (i <= n) p.className = 'on'; return p; }));
    passer.hidden = e === 'fin'; montrerBulle(null);
    document.body.classList.toggle('ac-ecrire', e === 'ecrire'); document.body.classList.toggle('ac-fin', e === 'fin');
    if (e === 'bienvenue') carte(`<h2>${t('Bienvenue dans ton univers.')}</h2><p>${t('Pour l’instant, il est vide. C’est à toi de le construire, une pensée à la fois.')}</p><div class="ligne"><button class="plein" data-a="suivant">${t('Commencer')}</button></div>`);
    if (e === 'lueur') { ctx.montrerLueur();
      carte(`<h2>${t('Voici ta lueur.')}</h2><p>${t('Elle t’accompagne et grandit avec toi. Comment veux-tu l’appeler ?')}</p><input id="ac-nom" maxlength="18" autocomplete="off" placeholder="${t('Un prénom')}" value="${echap(ctx.nom())}" aria-label="${t('Un prénom')}"><div class="ligne"><button class="plein" data-a="nommer">${t('Continuer')}</button><button data-a="suivant">${t('Je choisirai plus tard')}</button></div>`); }
    if (e === 'ecrire') { carte(''); setTimeout(() => montrerBulle(t('Touche + pour écrire ta journée. Tu peux y glisser une photo.')), 400); }
    if (e === 'etoile') carte(`<h2>${t('Ta première étoile.')}</h2><p>${t('Chaque jour où tu écris en allume une nouvelle. Sa couleur, c’est ton humeur.')}</p><div class="ligne"><button class="plein" data-a="suivant">${t('Continuer')}</button></div>`);
    if (e === 'poussiere') carte(`<h2>${t('Ta poussière d’étoiles.')}</h2><p>${t('Tu en gagnes chaque jour où tu écris. Elle sert à personnaliser ta lueur et ton ciel, dans la boutique.')}</p><div class="ligne"><button class="plein" data-a="boutique">${t('Ouvrir la boutique')}</button></div>`);
    if (e === 'rappel') carte(`<h2>${t('Un petit rappel ?')}</h2><p>${t('Ta lueur peut te faire signe chaque jour, à l’heure de ton choix, pour écrire ta journée.')}</p><label class="ac-heure">${t('Chaque jour à')} <input id="ac-heure" type="time" value="21:00" aria-label="${t('Heure du rappel')}"></label><div class="ligne"><button class="plein" data-a="rappel">${t('Activer le rappel')}</button><button data-a="suivant">${t('Non merci')}</button></div>`);
    if (e === 'appli') {
      if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) { aller(etape + 1); return; }   // déjà ouverte comme une appli
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), peut = !!ctx.installer && ctx.peutInstaller && ctx.peutInstaller();
      carte(`<h2>${t('Comme une appli.')}</h2><p>${t('Ajoute Constellation à ton écran d’accueil : elle s’ouvrira en plein écran, sans la barre du navigateur, avec plus de place pour écrire.')}</p>`
        + (peut ? '' : `<p class="ac-astuce">${ios ? t('Touche Partager, puis « Sur l’écran d’accueil ».') : t('Menu ⋮ du navigateur, puis « Ajouter à l’écran d’accueil ».')}</p>`)
        + `<div class="ligne">${peut ? `<button class="plein" data-a="installer">${t('Ajouter à l’écran d’accueil')}</button><button data-a="suivant">${t('Plus tard')}</button>` : `<button class="plein" data-a="suivant">${t('Continuer')}</button>`}</div>`);
    }
    if (e === 'fin') carte(`<h2>${t('Ton univers commence ici.')}</h2><p>${t('Reviens demain pour une nouvelle étoile. La boutique, tes réglages et la langue sont dans ⋯.')}</p><div class="ligne"><button class="plein" data-a="finir">${t('C’est parti')}</button></div>`);
  }
  function terminer() {
    actif = false; marquerVu(); zone.hidden = true; montrerBulle(null);
    document.body.classList.remove('accueil', 'ac-ecrire', 'ac-fin'); ctx.fini();
  }

  carteEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (a === 'suivant') aller(etape + 1);
    if (a === 'nommer') { const v = ($('ac-nom').value || '').trim(); if (v) ctx.renommer(v); aller(etape + 1); }
    if (a === 'boutique') { carte(''); ctx.ouvrirBoutique(); }
    if (a === 'finir') terminer();
    if (a === 'rappel') { b.disabled = true; const h = ($('ac-heure').value || '21:00'); Promise.resolve(ctx.activerRappel && ctx.activerRappel(h)).then(r => { if (r && r.message) ctx.toast(r.message); aller(etape + 1); }, () => aller(etape + 1)); }
    if (a === 'installer') { b.disabled = true; Promise.resolve(ctx.installer()).finally(() => aller(etape + 1)); }
  });
  carteEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ac-nom') { e.preventDefault(); carteEl.querySelector('[data-a=nommer]').click(); } e.stopPropagation(); });
  passer.addEventListener('click', () => { if (!$('ecrire').hidden) $('ecrire-fermer').click(); if (!$('boutique').hidden) $('boutique').hidden = true; ctx.montrerLueur(); aller(ETAPES.indexOf('fin')); });
  // la boutique se ferme (objet pris ou « plus tard ») : on passe à la fin
  new MutationObserver(() => { if (actif && ETAPES[etape] === 'poussiere' && $('boutique').hidden) setTimeout(() => aller(ETAPES.indexOf('rappel')), 500); })
    .observe($('boutique'), { attributes: true, attributeFilter: ['hidden'] });

  return {
    actif: () => actif,
    allerA(nom) { if (!actif) this.demarrer(); aller(ETAPES.indexOf(nom)); },   // pour les tests
    ecrireEnCours: () => actif && ETAPES[etape] === 'ecrire',
    demarrer() { actif = true; zone.hidden = false; document.body.classList.add('accueil'); aller(0); },
    surPlus() { if (actif && ETAPES[etape] === 'ecrire') montrerBulle(null); },
    surEcrireFerme() { if (actif && ETAPES[etape] === 'ecrire') setTimeout(() => { if (actif && ETAPES[etape] === 'ecrire' && $('ecrire').hidden) montrerBulle(t('Touche + pour écrire ta journée. Tu peux y glisser une photo.')); }, 600); },
    // la première entrée est gardée : l'étoile naît, puis on la présente
    surEntree(gain) { if (!actif || ETAPES[etape] !== 'ecrire') return; montrerBulle(null);
      setTimeout(() => { if (gain) ctx.toast(t('+ ✦{n} poussière d’étoiles', { n: gain })); }, 1200); setTimeout(() => aller(ETAPES.indexOf('etoile')), 2400); },
    surAchat() { if (actif && ETAPES[etape] === 'poussiere') setTimeout(() => { document.getElementById('boutique').hidden = true; }, 1400); },
  };
}
