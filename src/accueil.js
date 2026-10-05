// L'accueil raconté, au premier lancement. v84 (Matthieu : « un parcours guidé pas à pas ») : la lueur accompagne,
// un projecteur montre où toucher, et on FAIT chaque chose une fois : nommer la lueur, choisir l'humeur, un titre (H1),
// un séparateur, le contenu de la note, un @prénom ou un #lieu, cristalliser, puis le menu, le Suivi et la boutique.
// « Passer » partout. (La langue se choisit sur la première carte.)
import { t, LANGUE, changer } from './langue.js';

const CLE = 'constellation.accueil';
export const dejaVu = () => { try { return localStorage.getItem(CLE) === '1'; } catch (e) { return true; } };
// v85 (Matthieu : « forcer pour tous au moins une fois le nouveau tuto ») : une clé à part pour le parcours guidé.
// Il se lance une seule fois, à une ouverture où l'étoile du jour n'est pas encore écrite (voir apresIntro dans main.js).
const CLE_PARCOURS = 'constellation.parcours.v85';
export const parcoursVu = () => { try { return localStorage.getItem(CLE_PARCOURS) === '1'; } catch (e) { return true; } };
export const marquerVu = () => { try { localStorage.setItem(CLE, '1'); localStorage.setItem(CLE_PARCOURS, '1'); } catch (e) {} };

// ctx : { montrerLueur(), nom(), renommer(nom), ouvrirMenu(), fermerMenu(), fermerBoutique(), toast(txt), fini(),
//         activerRappel(heure) → Promise<{ ok, message }>, peutInstaller(), installer() → Promise<bool>, astuceInstall() }
export function monterAccueil(ctx) {
  const $ = id => document.getElementById(id);
  const zone = $('accueil'), carteEl = $('ac-carte'), points = $('ac-points'), passer = $('ac-passer');
  const bulle = $('ac-bulle'), proj = document.createElement('div'); proj.id = 'ac-projecteur'; proj.hidden = true; document.body.append(proj);
  const tactile = matchMedia('(pointer: coarse)').matches;
  const echap = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let etape = -1, actif = false, passe = false, achete = false, humeurTouchee = false, minuteur = 0, rendu = '', repetition = false, retour = false;   // v85 : retour = quelqu'un qui écrivait déjà avant le parcours guidé   // v84 : « Revoir le parcours » = une répétition, la note d'essai n'est pas gardée

  // ── ce qu'on regarde dans la page ──
  const ed = () => $('editeur');
  const visible = el => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
  const barreBtn = k => { const z = $('barre-clavier'); if (!z || z.hidden) return null; const b = z.querySelector(`[data-bloc="${k}"]`); if (b) z.scrollLeft = b.offsetLeft - (z.clientWidth - 96) / 2 + b.offsetWidth / 2; return b; };
  const menuBtn = k => { const m = $('bloc-menu'); return m && !m.hidden ? m.querySelector(`[data-bloc="${k}"]`) : null; };
  const titre = () => ed().querySelector('[data-b="1"]');
  const titreOk = () => !!titre() && titre().textContent.trim().length > 2;
  const separe = () => !!ed().querySelector('hr');
  const corps = () => { const hr = ed().querySelector('hr'); let s = ''; for (let b = hr && hr.nextElementSibling; b; b = b.nextElementSibling) if (!/^[1-4]$/.test(b.dataset.b || '')) s += ' ' + b.textContent; return s.trim(); };
  const corpsLong = () => corps().length >= 15;
  const nomFini = k => new RegExp(`(^|\\s)${k}[\\p{L}][\\p{L}\\-’']*\\s`, 'u').test(($('texte').value || '') + (document.activeElement === ed() ? '' : ' '));   // le mot est fini : espace après, ou clavier fermé
  const valider = () => { const z = $('barre-clavier'); return z && !z.hidden ? z.querySelector('.bc-valider') : $('valider'); };
  const ligne = k => $('menu').hidden ? null : $('menu-liste').querySelector(`[data-cle="${k}"]`);
  const AIDE_OUTILS = () => t('Il y a d’autres outils : petits titres, listes, citation… Tout est expliqué dans Menu › Réglages › Guide de l’écriture.');

  const ETAPES = [
    { n: 'bienvenue', carte: () => retour ? `<h2>${t('Du nouveau dans ton univers !')}</h2><p>${t('Je te montre, pas à pas, comment écrire ta journée et où trouver tout le reste.')}</p><p>${t('On le fait une seule fois, avec ta vraie note du jour.')}</p><div class="ligne"><button class="plein" data-a="suivant">${t('Continuer')}</button></div>` : `<h2>${t('Bienvenue dans ton univers.')}</h2><p>${t('Chaque jour où tu écris devient une étoile. Tes semaines deviennent des constellations.')}</p><div class="ac-langue" role="group" aria-label="Langue · Language"><button type="button" data-langue="fr"${LANGUE === 'fr' ? ' class="actif"' : ''}>Français</button><button type="button" data-langue="en"${LANGUE === 'en' ? ' class="actif"' : ''}>English</button></div><div class="ligne"><button class="plein" data-a="suivant">${t('Commencer')}</button></div>` },
    { n: 'prive', carte: () => `<div class="ac-cadenas" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></div><h2>${t('Ici, tout reste à toi.')}</h2><p>${t('Ce que tu écris, tes humeurs, tes photos et ta voix restent sur ce téléphone. Pas de compte, pas de serveur.')}</p><p>${t('Personne d’autre ne peut lire ton journal. Pas même nous.')}</p><div class="ligne"><button class="plein" data-a="suivant">${t('D’accord')}</button></div>` },
    { n: 'lueur', delai: 1700, carte: () => retour && ctx.nom() ? null : `<h2>${t('Salut, je suis ta lueur !')}</h2><p>${t('Je vais t’accompagner et grandir avec toi. Comment veux-tu m’appeler ?')}</p><input id="ac-nom" maxlength="18" autocomplete="off" placeholder="${t('Un prénom')}" value="${echap(ctx.nom())}" aria-label="${t('Un prénom')}"><div class="ligne"><button class="plein" data-a="nommer">${t('C’est mon nom')}</button><button data-a="suivant">${t('Plus tard')}</button></div>` },
    // ── la première note ──
    { n: 'plus', ecrit: 1, cible: () => $('nouveau'), dire: () => [retour ? t('Écrivons ta journée d’aujourd’hui. Touche <b>+</b>.') : ctx.nom() ? t('Enchantée, {nom} ! Écrivons ta première journée. Touche <b>+</b>.', { nom: echap(ctx.nom()) }) : t('Écrivons ta première journée. Touche <b>+</b>.')], si: () => !$('ecrire').hidden },
    { n: 'humeur', ecrit: 1, cible: () => $('humeurs'), dire: () => [t('Choisis l’humeur qui colle à ta journée.'), t('Elle donnera sa couleur à ton étoile.')], si: () => humeurTouchee },   // une humeur peut être déjà cochée : on attend un vrai toucher
    { n: 'activites', ecrit: 1, attendre: 1600, cible: () => $('activites'), dire: () => [t('Coche ce que tu as fait aujourd’hui.'), t('Ça m’aidera à voir ce qui te fait du bien.')], bouton: () => t('Rien de tout ça'), si: () => passe || !!$('activites').querySelector('[aria-pressed="true"]') },
    { n: 'page', ecrit: 1, cible: () => ed(), dire: () => [t('Touche la page pour écrire.'), tactile ? t('Une barre d’outils apparaît au-dessus du clavier.') : ''], si: () => document.activeElement === ed() },
    { n: 'h1', ecrit: 1, cible: () => barreBtn('1') || menuBtn('1') || ed(), dire: () => [tactile ? t('Touche <b>H1</b> : cette ligne devient le <b>titre</b> de ta note, écrit en grand.') : t('Tape <b>/</b> puis choisis <b>Titre 1</b> : cette ligne devient le <b>titre</b> de ta note.'), AIDE_OUTILS()], si: () => !!titre() },
    { n: 'titre', ecrit: 1, etat: () => titreOk(), cible: () => titreOk() ? (barreBtn('separateur') || menuBtn('separateur') || ed()) : ed(),
      dire: () => titreOk() ? [tactile ? t('Beau titre ! Touche <b>—</b> pour le séparer du reste de ta note.') : t('Beau titre ! Tape <b>/</b> au début d’une ligne puis <b>Séparateur</b>.'), t('Le séparateur trace un trait fin entre deux parties.')]
        : [t('Écris ton titre : juste le nom de ta journée, en quelques mots.'), t('Par exemple : Premier jour.')], si: () => titreOk() && separe() },
    { n: 'corps', ecrit: 1, etat: () => corpsLong(), cible: () => ed(), dire: () => [t('Sous le trait, c’est le <b>contenu</b> de ta note. Raconte un peu ta journée.'), corpsLong() ? t('Tu peux continuer, ou passer à la suite.') : t('Pas besoin d’en écrire beaucoup.')],
      bouton: () => corpsLong() ? t('C’est bon') : '', si: () => passe },
    { n: 'nom', ecrit: 1, cible: () => ed(), dire: () => [t('Pour finir, ajoute quelqu’un avec un <b>@</b> devant son prénom, ou un lieu avec un <b>#</b>.'), t('Exemple : avec @Léa, au #parc. Le mot change de couleur.')], si: () => nomFini('@') || nomFini('#') },
    { n: 'cristal', ecrit: 1, cible: () => valider(), dire: () => [(nomFini('@') ? t('Doré : c’est une personne.') : t('Bleu : c’est un lieu.')) + ' ' + t('Parfait. Touche <b>Cristalliser</b> pour garder ta journée.'), tactile ? t('Clavier ouvert, c’est le ✓ de la barre.') : ''], si: () => false },
    // ── l'étoile, puis le menu ──
    { n: 'etoile', carte: () => retour && !repetition ? `<h2>${t('Et voilà ton étoile du jour !')}</h2><p>${t('Sa couleur, c’est ton humeur. Chaque semaine prend la forme d’une vraie constellation.')}</p><div class="ligne"><button class="plein" data-a="suivant">${t('Continuer')}</button></div>` : repetition ? `<h2>${t('Et voilà, ta journée deviendrait une étoile.')}</h2><p>${t('C’était une répétition : cette note d’essai n’a pas été gardée, ton journal n’a pas bougé.')}</p><p>${t('Sa couleur, c’est ton humeur. Chaque semaine prend la forme d’une vraie constellation.')}</p><div class="ligne"><button class="plein" data-a="suivant">${t('Continuer')}</button></div>` : `<h2>${t('Regarde, ta première étoile !')}</h2><p>${t('Sa couleur, c’est ton humeur. Chaque jour où tu écris, j’en allume une nouvelle, et chaque semaine prend la forme d’une vraie constellation.')}</p><p>${t('Tu gagnes aussi de la poussière d’étoiles ✦. Elle s’échange dans la boutique.')}</p><div class="ligne"><button class="plein" data-a="suivant">${t('Continuer')}</button></div>` },
    { n: 'menu', voirMenu: 1, cible: () => $('btn-palette'), dire: () => [t('Tout le reste est rangé dans le menu. Touche <b>☰</b>.')], si: () => !$('menu').hidden },
    { n: 'suivi', voirMenu: 1, cible: () => ligne('suivi') || $('btn-palette'), dire: () => [t('Ta semaine, ton journal à relire, ta lueur, les réglages : tout est ici. Commençons par le <b>Suivi</b>.')], si: () => !$('analyse').hidden },
    { n: 'suivi-vu', voirMenu: 1, bas: 1, cible: () => $('analyse').querySelector('.p-corps') || $('analyse'), dire: () => [t('Ici, tu vois ton humeur jour après jour, et je te dis ce qui te fait du bien.'), t('Plus tu écris, plus c’est précis.')], bouton: () => t('Suivant'), si: () => passe },
    { n: 'boutique', voirMenu: 1, entree: () => ctx.ouvrirMenu(), cible: () => ligne('boutique') || $('btn-palette'), dire: () => [t('Et la <b>Boutique</b> : ta poussière d’étoiles ✦ s’y échange. Touche-la.')], si: () => !$('boutique').hidden },
    { n: 'onglets', cible: () => document.querySelector('#boutique .bq-onglets'), dire: () => [t('Il y a des objets pour moi, dans <b>Ta lueur</b>, et d’autres pour décorer ton ciel, dans <b>Ton ciel</b>.'), t('On regarde les miens d’abord.')], bouton: () => t('Suivant'), si: () => passe },
    { n: 'essai', bas: 1, cible: () => $('bq-corps'), dire: () => [t('Touche un objet pour l’<b>essayer</b> sur moi, même s’il est trop cher.')], si: () => achete || visible(document.querySelector('#boutique .bq-essai')) },
    { n: 'achat', cible: () => document.querySelector('#boutique .bq-essai') || $('bq-corps'), dire: () => [t('Ça me va bien, non ? <b>Acheter</b> le garde, <b>Retirer</b> l’enlève.'), t('Chaque jour où tu écris, tu gagnes de la poussière.')], bouton: () => t('Suivant'), si: () => passe || achete },
    { n: 'rappel', entree: () => ctx.fermerBoutique(), carte: () => `<h2>${t('Un petit rappel ?')}</h2><p>${t('Je peux te faire signe chaque jour, à l’heure de ton choix, pour qu’on écrive ta journée ensemble.')}</p><label class="ac-heure">${t('Chaque jour à')} <input id="ac-heure" type="time" value="21:00" aria-label="${t('Heure du rappel')}"></label><div class="ligne"><button class="plein" data-a="rappel">${t('Activer le rappel')}</button><button data-a="suivant">${t('Non merci')}</button></div>` },
    { n: 'appli', carte: () => (matchMedia('(display-mode: standalone)').matches || navigator.standalone) ? null   // déjà ouverte comme une appli
      : `<h2>${t('Comme une appli.')}</h2><p>${t('Mets-moi sur ton écran d’accueil : je m’ouvrirai en plein écran, sans la barre du navigateur, avec plus de place pour écrire.')}</p><p class="ac-astuce" id="ac-astuce" hidden></p><div class="ligne"><button class="plein" data-a="installer">${t('Ajouter à l’écran d’accueil')}</button><button data-a="suivant">${t('Plus tard')}</button></div>` },
    { n: 'fin', carte: () => `<h2>${t('Ton univers commence ici.')}</h2><p>${t('Reviens demain, on allumera une nouvelle étoile. Touche-moi quand tu veux : j’adore jouer.')}</p><p>${t('Pour tout savoir sur l’écriture : Menu › Réglages › Guide de l’écriture.')}</p><div class="ligne"><button class="plein" data-a="finir">${t('C’est parti')}</button></div>` },
  ];
  const idx = n => ETAPES.findIndex(e => e.n === n), E = () => ETAPES[etape];

  function carte(html) {
    carteEl.classList.add('cache');
    setTimeout(() => { carteEl.innerHTML = html || ''; carteEl.classList.toggle('cache', !html); }, 260);
  }
  // la bulle de la lueur : sa phrase, et parfois un bouton (« C'est bon », « Suivant », « Plus tard »)
  function rendreBulle() {
    const e = E(); if (!e || e.carte) { bulle.hidden = true; rendu = ''; return; }
    const [txt, aide] = e.dire(), lib = e.bouton ? e.bouton() : '';
    const html = `<span>${txt}</span>${aide ? `<small>${aide}</small>` : ''}${lib ? `<button type="button" class="plein" data-a="passe">${lib}</button>` : ''}`;
    if (html !== rendu) { rendu = html; bulle.innerHTML = html; }
    bulle.classList.toggle('touchable', !!lib); bulle.hidden = false;
  }
  function cible() {
    const e = E(); if (!e || e.carte) return null;
    let c = e.cible();
    if (c && c.closest('#ecrire') && $('ecrire').hidden) c = $('nouveau');   // journal refermé : on montre comment le rouvrir
    return visible(c) ? c : null;
  }
  // le projecteur sur ce qu'il faut toucher, la bulle au-dessus ou en dessous
  function placer() {
    const c = cible(), H = window.visualViewport ? visualViewport.height + visualViewport.offsetTop : innerHeight;
    if (!c) { proj.hidden = true; return; }
    const r = c.getBoundingClientRect(), m = 6;
    Object.assign(proj.style, { left: (r.left - m) + 'px', top: (r.top - m) + 'px', width: (r.width + 2 * m) + 'px', height: (r.height + 2 * m) + 'px' }); proj.hidden = false;
    if (bulle.hidden) return;
    const z = $('barre-clavier'), barre = z && !z.hidden && z.getClientRects().length, bas = barre ? Math.min(H, z.getBoundingClientRect().top) : H;   // jamais sur la barre du clavier
    bulle.classList.toggle('compacte', !!barre);   // clavier ouvert : la phrase seule, pour laisser voir le texte
    const h = bulle.offsetHeight || 80;
    let y;
    if (c === ed()) {   // on écrit : la bulle va du côté opposé au curseur, pour ne jamais cacher ce qu'on tape
      const s = getSelection(), rc = s.rangeCount && ed().contains(s.anchorNode) ? (s.getRangeAt(0).getClientRects()[0] || (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).getBoundingClientRect()) : null;
      const yc = rc ? rc.top + rc.height / 2 : r.top + 40, haut = Math.max(56, r.top);
      y = yc > (haut + bas) / 2 ? haut : bas - h - 10;
    } else { const enHaut = r.top + r.height / 2 > bas * .5; y = E().bas ? bas - h - 24 : enHaut ? r.top - h - 18 : r.bottom + 18; }
    bulle.style.top = Math.max(56, Math.min(bas - h - 10, y)) + 'px';
  }
  function verifier() {
    if (!actif) return; const e = E(); if (!e || e.carte) return;
    if (e.etat) { const s = e.etat(); if (s !== e._etat) { e._etat = s; rendreBulle(); } }   // la phrase suit ce qu'on vient de faire
    if (e.bouton) rendreBulle();
    if (e.si() && !e._part) { const ici = etape; e._part = true; setTimeout(() => { e._part = false; if (etape === ici && actif) aller(ici + 1); }, 450); }
    placer();
  }

  function aller(n) {
    etape = Math.min(n, ETAPES.length - 1); passe = false; const e = E(); n = etape;
    points.replaceChildren(...ETAPES.map((_, i) => { const p = document.createElement('i'); if (i <= n) p.className = 'on'; return p; }));
    passer.hidden = e.n === 'fin';
    document.body.classList.toggle('ac-ecrire', !!e.ecrit); document.body.classList.toggle('ac-menu', !!e.voirMenu || e.n === 'fin'); document.body.classList.toggle('ac-fin', e.n === 'fin');
    if (e.entree) e.entree();
    bulle.hidden = true; rendu = '';
    if (e.carte) {
      proj.hidden = true; if (e.n === 'lueur') ctx.montrerLueur();
      const html = e.carte(); if (html === null) { aller(n + 1); return; }
      if (e.delai) { carte(''); setTimeout(() => { if (etape === n) carte(html); }, e.delai); } else carte(html);
      return;
    }
    carte(''); e._etat = e.etat ? e.etat() : undefined;
    setTimeout(() => { if (etape === n && actif) { rendreBulle(); placer(); } }, 300);   // un petit fondu entre deux phrases
    setTimeout(() => { if (etape === n && actif) verifier(); }, e.attendre || 700);   // geste déjà fait en avance : on continue
  }
  function terminer() {
    actif = false; repetition = false; retour = false; marquerVu(); zone.hidden = true; bulle.hidden = true; proj.hidden = true; clearInterval(minuteur);
    document.body.classList.remove('accueil', 'ac-ecrire', 'ac-menu', 'ac-fin'); ctx.fini();
  }

  carteEl.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (b.dataset.langue) { changer(b.dataset.langue); return; }   // changer de langue recharge la page (le parcours reprend au début)
    if (a === 'suivant') aller(etape + 1);
    if (a === 'nommer') { const v = ($('ac-nom').value || '').trim(); if (v) ctx.renommer(v); aller(etape + 1); }
    if (a === 'finir') terminer();
    if (a === 'rappel') { b.disabled = true; const h = ($('ac-heure').value || '21:00'); Promise.resolve(ctx.activerRappel && ctx.activerRappel(h)).then(r => { if (r && r.message) ctx.toast(r.message); aller(etape + 1); }, () => aller(etape + 1)); }
    if (a === 'installer') {
      if (ctx.peutInstaller && ctx.peutInstaller()) { b.disabled = true; Promise.resolve(ctx.installer()).finally(() => aller(etape + 1)); return; }
      const as = $('ac-astuce'); if (as) { as.innerHTML = ctx.astuceInstall ? ctx.astuceInstall() : ''; as.hidden = false; }
      b.textContent = t('C’est fait'); b.dataset.a = 'suivant';
    }
  });
  carteEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ac-nom') { e.preventDefault(); carteEl.querySelector('[data-a=nommer]').click(); } e.stopPropagation(); });
  bulle.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault(); });   // le bouton de la bulle ne ferme pas le clavier
  bulle.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  $('humeurs').addEventListener('click', e => { if (e.target.closest('button')) humeurTouchee = true; });
  bulle.addEventListener('click', e => { if (e.target.closest('[data-a=passe]')) { passe = true; verifier(); } });
  passer.addEventListener('click', () => {
    if (!$('ecrire').hidden) $('ecrire-fermer').click();
    ctx.fermerBoutique(); ctx.fermerMenu(); $('analyse').hidden = true; ctx.montrerLueur(); aller(idx('fin'));
  });
  ['input', 'click', 'focusin', 'focusout', 'keyup'].forEach(ty => document.addEventListener(ty, () => { if (actif) setTimeout(verifier, 30); }, true));
  addEventListener('resize', () => { if (actif) placer(); });
  if (window.visualViewport) visualViewport.addEventListener('resize', () => { if (actif) placer(); });

  return {
    actif: () => actif,
    etapeNom: () => actif ? E().n : null,   // la lueur se place selon l'étape
    allerA(nom) { if (!actif) this.demarrer(); aller(idx(nom)); },   // pour les tests
    ecrireEnCours: () => actif && !!(E() && E().ecrit),
    repetition: () => actif && repetition,
    revoir() { repetition = true; retour = false; humeurTouchee = false; achete = false; this.demarrer(); },   // depuis Réglages › Aide
    demarrer(o = {}) { if (o.retour) retour = true; actif = true; zone.hidden = false; document.body.classList.add('accueil'); clearInterval(minuteur); minuteur = setInterval(verifier, 400); aller(0); },
    surPlus() {}, surHumeurNote() {}, surTexteNote() {},
    surEcrireFerme() { if (actif) setTimeout(verifier, 600); },
    // la première entrée est gardée : l'étoile naît, puis on la présente
    surEntree(gain) { if (!actif || !E().ecrit) return; bulle.hidden = true; proj.hidden = true; etape = idx('cristal');
      setTimeout(() => { if (gain) ctx.toast(t('+ ✦{n} poussière d’étoiles', { n: gain })); }, 1200); setTimeout(() => aller(idx('etoile')), 2400); },
    surAchat() { if (actif) { achete = true; setTimeout(verifier, 300); } },
  };
}
