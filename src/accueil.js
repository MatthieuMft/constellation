// L'accueil raconté, au premier lancement : bienvenue, la lueur, la première entrée, la première étoile, la poussière
// d'étoiles et la boutique, puis « Ton univers commence ici ». On FAIT au lieu de lire ; « Passer » partout.
// (La langue se choisit juste avant, sur l'écran de chargement.)
import { t, LANGUE, changer } from './langue.js';

const CLE = 'constellation.accueil';
export const dejaVu = () => { try { return localStorage.getItem(CLE) === '1'; } catch (e) { return true; } };
export const marquerVu = () => { try { localStorage.setItem(CLE, '1'); } catch (e) {} };

const ETAPES = ['bienvenue', 'lueur', 'ecrire', 'etoile', 'poussiere', 'rappel', 'appli', 'fin'];   // v29 : rappel du soir et écran d'accueil

// ctx : { montrerLueur(), nom(), renommer(nom), ouvrirEcrire(), ouvrirBoutique(), toast(txt), fini(), activerRappel(heure) → Promise<{ ok, message }>, installer() → Promise<bool> | null }
export function monterAccueil(ctx) {
  const $ = id => document.getElementById(id);
  const zone = $('accueil'), carteEl = $('ac-carte'), points = $('ac-points'), bulle = $('ac-bulle'), passer = $('ac-passer');
  let etape = -1, actif = false, guide = 0, guideMin = null;   // v36 : guide de la première note (0 rien, 1 humeur, 2 texte, 3 cristalliser)
  function guiderNote(n) { if (n <= guide) return; guide = n; document.body.classList.remove('ac-g1', 'ac-g2', 'ac-g3'); if (n < 4) document.body.classList.add('ac-g' + n);
    if (n === 1) ctx.guider(t('D’abord, touche l’émotion qui colle à ta journée.'));
    if (n === 2) ctx.guider(t('Maintenant, écris quelques mots sur ta journée.'));
    if (n === 3) ctx.guider(t('Quand tu as fini, touche Cristalliser.')); }

  function carte(html) {
    carteEl.classList.add('cache');
    setTimeout(() => { carteEl.innerHTML = html; carteEl.classList.toggle('cache', !html); /* v36 : plus de clavier qui s'ouvre tout seul */ }, 260);
  }
  const echap = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function montrerBulle(txt) { if (!txt) { bulle.hidden = true; return; } bulle.textContent = txt; bulle.hidden = false; }

  function aller(n) {
    etape = n; const e = ETAPES[n];
    points.replaceChildren(...ETAPES.map((_, i) => { const p = document.createElement('i'); if (i <= n) p.className = 'on'; return p; }));
    passer.hidden = e === 'fin'; montrerBulle(null);
    document.body.classList.toggle('ac-ecrire', e === 'ecrire'); document.body.classList.toggle('ac-fin', e === 'fin');
    if (e === 'bienvenue') carte(`<h2>${t('Bienvenue dans ton univers.')}</h2><p>${t('Pour l’instant, il est vide. C’est à toi de le construire, une pensée à la fois.')}</p><div class="ac-langue" role="group" aria-label="Langue · Language"><button type="button" data-langue="fr"${LANGUE === 'fr' ? ' class="actif"' : ''}>Français</button><button type="button" data-langue="en"${LANGUE === 'en' ? ' class="actif"' : ''}>English</button></div><div class="ligne"><button class="plein" data-a="suivant">${t('Commencer')}</button></div>`);
    // v36 : on voit d'abord la lueur arriver, puis la carte
    if (e === 'lueur') { ctx.montrerLueur(); carte(''); setTimeout(() => { if (ETAPES[etape] === 'lueur') carte(`<h2>${t('Salut, je suis ta lueur !')}</h2><p>${t('Je vais t’accompagner et grandir avec toi. Comment veux-tu m’appeler ?')}</p><input id="ac-nom" maxlength="18" autocomplete="off" placeholder="${t('Un prénom')}" value="${echap(ctx.nom())}" aria-label="${t('Un prénom')}"><div class="ligne"><button class="plein" data-a="nommer">${t('Continuer')}</button><button data-a="suivant">${t('Je choisirai plus tard')}</button></div>`); }, 1700); }
    if (e === 'ecrire') { carte(''); setTimeout(() => montrerBulle(t('Touche + pour écrire ta journée. Tu peux y glisser une photo.')), 400); }
    if (e === 'etoile') carte(`<h2>${t('Regarde, ta première étoile !')}</h2><p>${t('Chaque jour où tu écris, j’en allume une nouvelle. Sa couleur, c’est ton humeur.')}</p><div class="ligne"><button class="plein" data-a="suivant">${t('Continuer')}</button></div>`);
    if (e === 'poussiere') carte(`<h2>${t('Et voici de la poussière d’étoiles.')}</h2><p>${t('Tu en gagnes chaque jour où tu écris. Avec, tu peux me faire belle et décorer ton ciel, dans la boutique.')}</p><div class="ligne"><button class="plein" data-a="boutique">${t('Ouvrir la boutique')}</button></div>`);
    if (e === 'rappel') carte(`<h2>${t('Un petit rappel ?')}</h2><p>${t('Je peux te faire signe chaque jour, à l’heure de ton choix, pour qu’on écrive ta journée ensemble.')}</p><label class="ac-heure">${t('Chaque jour à')} <input id="ac-heure" type="time" value="21:00" aria-label="${t('Heure du rappel')}"></label><div class="ligne"><button class="plein" data-a="rappel">${t('Activer le rappel')}</button><button data-a="suivant">${t('Non merci')}</button></div>`);
    if (e === 'appli') {
      if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) { aller(etape + 1); return; }   // déjà ouverte comme une appli
            carte(`<h2>${t('Comme une appli.')}</h2><p>${t('Mets-moi sur ton écran d’accueil : je m’ouvrirai en plein écran, sans la barre du navigateur, avec plus de place pour écrire.')}</p>`
        + `<p class="ac-astuce" id="ac-astuce" hidden></p>`
        + `<div class="ligne"><button class="plein" data-a="installer">${t('Ajouter à l’écran d’accueil')}</button><button data-a="suivant">${t('Plus tard')}</button></div>`);   // v34 : toujours un bouton ; si le navigateur ne permet pas l'ajout en un geste, il montre où toucher
    }
    if (e === 'fin') carte(`<h2>${t('Ton univers commence ici.')}</h2><p>${t('Reviens demain, on allumera une nouvelle étoile. La boutique, les réglages et la langue sont dans ⋯. À demain !')}</p><div class="ligne"><button class="plein" data-a="finir">${t('C’est parti')}</button></div>`);
  }
  function terminer() {
    actif = false; marquerVu(); zone.hidden = true; montrerBulle(null); document.body.classList.remove('ac-g1', 'ac-g2', 'ac-g3');
    document.body.classList.remove('accueil', 'ac-ecrire', 'ac-fin'); ctx.fini();
  }

  carteEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (a === 'suivant') aller(etape + 1);
    if (a === 'nommer') { const v = ($('ac-nom').value || '').trim(); if (v) ctx.renommer(v); aller(etape + 1); }
    if (a === 'boutique') { carte(''); ctx.ouvrirBoutique(); }
    if (a === 'finir') terminer();
    if (a === 'rappel') { b.disabled = true; const h = ($('ac-heure').value || '21:00'); Promise.resolve(ctx.activerRappel && ctx.activerRappel(h)).then(r => { if (r && r.message) ctx.toast(r.message); aller(etape + 1); }, () => aller(etape + 1)); }
    if (b.dataset.langue) { changer(b.dataset.langue); return; }   // v34 : changer de langue recharge la page (le tutoriel reprend au début)
    if (a === 'installer') {
      if (ctx.peutInstaller && ctx.peutInstaller()) { b.disabled = true; Promise.resolve(ctx.installer()).finally(() => aller(etape + 1)); return; }
      const as = document.getElementById('ac-astuce'); if (as) { as.innerHTML = ctx.astuceInstall ? ctx.astuceInstall() : ''; as.hidden = false; }
      b.textContent = t('C’est fait'); b.dataset.a = 'suivant';
    }
  });
  carteEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ac-nom') { e.preventDefault(); carteEl.querySelector('[data-a=nommer]').click(); } e.stopPropagation(); });
  passer.addEventListener('click', () => { if (!$('ecrire').hidden) $('ecrire-fermer').click(); if (!$('boutique').hidden) $('boutique').hidden = true; ctx.montrerLueur(); aller(ETAPES.indexOf('fin')); });
  // la boutique se ferme (objet pris ou « plus tard ») : on passe à la fin
  new MutationObserver(() => { if (actif && ETAPES[etape] === 'poussiere' && $('boutique').hidden) setTimeout(() => aller(ETAPES.indexOf('rappel')), 500); })
    .observe($('boutique'), { attributes: true, attributeFilter: ['hidden'] });

  return {
    actif: () => actif,
    etapeNom: () => actif ? ETAPES[etape] : null,   // v37 : la lueur se place selon l'étape
    allerA(nom) { if (!actif) this.demarrer(); aller(ETAPES.indexOf(nom)); },   // pour les tests
    ecrireEnCours: () => actif && ETAPES[etape] === 'ecrire',
    demarrer() { actif = true; zone.hidden = false; document.body.classList.add('accueil'); aller(0); },
    surPlus() { if (actif && ETAPES[etape] === 'ecrire') { montrerBulle(null); guide = 0; setTimeout(() => guiderNote(1), 700); } },
    surHumeurNote() { if (actif && ETAPES[etape] === 'ecrire' && guide >= 1) setTimeout(() => guiderNote(2), 500); },
    surTexteNote(n) { if (!actif || ETAPES[etape] !== 'ecrire' || !guide) return; if (n > 0 && guide < 2) guiderNote(2);
      clearTimeout(guideMin); if (n >= 3) guideMin = setTimeout(() => guiderNote(3), 1800); },
    surEcrireFerme() { document.body.classList.remove('ac-g1', 'ac-g2', 'ac-g3'); if (guide < 4) guide = 0; if (actif && ETAPES[etape] === 'ecrire') setTimeout(() => { if (actif && ETAPES[etape] === 'ecrire' && $('ecrire').hidden) montrerBulle(t('Touche + pour écrire ta journée. Tu peux y glisser une photo.')); }, 600); },
    // la première entrée est gardée : l'étoile naît, puis on la présente
    surEntree(gain) { if (!actif || ETAPES[etape] !== 'ecrire') return; montrerBulle(null); guide = 4; document.body.classList.remove('ac-g1', 'ac-g2', 'ac-g3');
      setTimeout(() => { if (gain) ctx.toast(t('+ ✦{n} poussière d’étoiles', { n: gain })); }, 1200); setTimeout(() => aller(ETAPES.indexOf('etoile')), 2400); },
    surAchat() { if (actif && ETAPES[etape] === 'poussiere') setTimeout(() => { document.getElementById('boutique').hidden = true; }, 1400); },
  };
}
