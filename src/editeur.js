// Éditeur du journal (v22), comme dans Notion : ce qu'on voit est ce qu'on obtient. Un titre s'affiche en grand, une citation
// avec son filet, une liste avec ses puces ; aucun « # » ni « > » visible. Le texte enregistré reste le même texte brut qu'avant
// (« # », « ## », « - », « 1. », « > », « --- » en début de ligne) : rien ne change pour les entrées déjà écrites ni pour la lecture.
//
// API : const ed = creerEditeur(div, ta)
//   div : le <div contenteditable> affiché ; ta : le <textarea> caché qui reste la source de vérité pour le reste du site.
//   ta.value = '…' recharge l'éditeur ; chaque frappe recopie le texte dans ta et y déclenche « input » (compteur, brouillon, mascotte).
//   ta.focus() / ta.blur() agissent sur l'éditeur.
//   ed.poser(k)            le bloc du curseur devient k (1 à 4, puce, num, citation, texte) ; reposer le même revient au texte ; 'separateur' insère une ligne
//   ed.surSlash(f)         f() quand on tape « / » au début d'un bloc vide ; ed.retirerSlash() efface ce « / » avant de poser un bloc
//   ed.element             le div
//   ed.motCourant()        v61 : le @nom ou #lieu en train d'être tapé juste avant le curseur → { k: '@' | '#', debut } | null
//   ed.completer(nom)      v61 : remplace ce mot par nom (avec son @ ou son #) suivi d'une espace
const PREFIXE = { 1: '# ', 2: '## ', 3: '### ', 4: '#### ', puce: '- ', citation: '> ' };
const RACCOURCIS = [[/^####\s$/, '4'], [/^###\s$/, '3'], [/^##\s$/, '2'], [/^#\s$/, '1'], [/^[-*•]\s$/, 'puce'], [/^1[.)]\s$/, 'num'], [/^>\s$/, 'citation']];
const LISTES = new Set(['puce', 'num']);

export function creerEditeur(div, ta) {
  div.contentEditable = 'true'; div.setAttribute('role', 'textbox'); div.setAttribute('aria-multiline', 'true'); div.spellcheck = true;
  let surSlash = null, interne = false;
  const bloc = (type = 'p', texte = '') => {
    const b = document.createElement(type === 'hr' ? 'hr' : 'div'); b.dataset.b = type;
    if (type === 'hr') { b.contentEditable = 'false'; return b; }
    b.textContent = texte; if (!texte) b.append(document.createElement('br')); return b;
  };
  const texteDe = b => (b.textContent || '').replace(/ /g, ' ');

  // ── texte brut ⇄ blocs ──
  function versTexte() {
    let n = 0; const lignes = [];
    for (const b of div.children) {
      const ty = b.dataset.b || 'p', tx = texteDe(b);
      if (ty === 'hr') { lignes.push('---'); n = 0; continue; }
      if (ty === 'num') { n++; lignes.push(n + '. ' + tx); continue; }
      n = 0; lignes.push((PREFIXE[ty] || '') + tx);
    }
    return lignes.join('\n').replace(/\n+$/, '');
  }
  function depuisTexte(v) {
    div.replaceChildren();
    for (const l of String(v || '').split('\n')) {
      let m;
      if (/^ *(-{3,}|—+) *$/.test(l)) div.append(bloc('hr'));
      else if ((m = l.match(/^(#{1,4}) (.*)$/))) div.append(bloc(String(m[1].length), m[2]));
      else if ((m = l.match(/^[-•*] (.*)$/))) div.append(bloc('puce', m[1]));
      else if ((m = l.match(/^\d+\. (.*)$/))) div.append(bloc('num', m[1]));
      else if ((m = l.match(/^> ?(.*)$/))) div.append(bloc('citation', m[1]));
      else div.append(bloc('p', l));
    }
    if (!div.children.length || div.lastElementChild.dataset.b === 'hr') div.append(bloc());
    majVide(); if (typeof surligner === 'function') surligner();
  }
  const majVide = () => div.classList.toggle('vide', div.children.length === 1 && !texteDe(div.firstElementChild) && div.firstElementChild.dataset.b === 'p');

  // le textarea caché suit l'éditeur ; écrire dans ta.value recharge l'éditeur
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  Object.defineProperty(ta, 'value', { configurable: true, get() { return proto.get.call(ta); }, set(v) { proto.set.call(ta, v); if (!interne) depuisTexte(v); } });
  ta.focus = () => { div.focus(); placerFin(); };
  ta.blur = () => div.blur();
  function synchroniser(type = 'insertText') {
    interne = true; proto.set.call(ta, versTexte()); interne = false; majVide();
    ta.dispatchEvent(new InputEvent('input', { inputType: type, bubbles: true }));
  }

  // ── curseur ──
  function blocCourant() {
    const s = getSelection(); if (!s.rangeCount) return null;
    let n = s.anchorNode; if (n === div) return div.children[Math.min(s.anchorOffset, div.children.length - 1)] || null;
    while (n && n.parentNode !== div) n = n.parentNode;
    return n && n.parentNode === div ? n : null;
  }
  function placer(b, fin = true) {
    const r = document.createRange(); r.selectNodeContents(b); r.collapse(!fin);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function placerFin() { const b = div.lastElementChild; if (b && b.dataset.b !== 'hr') placer(b); }
  function auDebut(b) {
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false;
    const r = document.createRange(); r.selectNodeContents(b); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length === 0;
  }
  function changerType(b, type) {
    const n = bloc(type, texteDe(b)); b.replaceWith(n); placer(n); return n;
  }

  // ── frappe ──
  div.addEventListener('beforeinput', e => {
    if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
      if (e.inputType === 'insertLineBreak') return;                     // Maj+Entrée : retour à la ligne dans le même bloc
      e.preventDefault();
      const b = blocCourant() || div.lastElementChild, ty = b.dataset.b || 'p';
      if (LISTES.has(ty) && !texteDe(b)) { changerType(b, 'p'); synchroniser('insertParagraph'); return; }   // Entrée sur une puce vide : on sort de la liste
      const s = getSelection(), r = s.getRangeAt(0); r.deleteContents();
      const reste = document.createRange(); reste.selectNodeContents(b); reste.setStart(r.endContainer, r.endOffset);
      const suite = reste.extractContents().textContent;
      if (!texteDe(b)) b.replaceChildren(document.createElement('br'));
      const n = bloc(LISTES.has(ty) ? ty : 'p', suite); b.after(n); placer(n, false); synchroniser('insertParagraph');
      return;
    }
    if (e.inputType === 'deleteContentBackward') {
      const b = blocCourant(); if (!b || !auDebut(b)) return;
      const ty = b.dataset.b || 'p';
      if (ty !== 'p') { e.preventDefault(); placer(changerType(b, 'p'), false); synchroniser('deleteContentBackward'); return; }   // effacer au début d'un titre ou d'une puce : il redevient du texte
      const prec = b.previousElementSibling;
      if (prec && prec.dataset.b === 'hr') { e.preventDefault(); prec.remove(); synchroniser('deleteContentBackward'); }
    }
  });
  div.addEventListener('input', e => {
    // un bloc perdu par le navigateur (tout sélectionné puis effacé) : on remet un paragraphe
    if (!div.children.length) { div.append(bloc()); placer(div.firstElementChild); }
    for (const n of [...div.childNodes]) if (n.nodeType === 3) { const p = bloc('p', n.textContent); n.replaceWith(p); placer(p); }
    const b = blocCourant();
    if (b && (b.dataset.b || 'p') === 'p') {
      const tx = texteDe(b);
      for (const [re, ty] of RACCOURCIS) if (re.test(tx)) { b.textContent = ''; const n = changerType(b, ty); n.replaceChildren(document.createElement('br')); placer(n); synchroniser(); return; }
      if (/^(-{3}|—)$/.test(tx)) { const hr = bloc('hr'), p = bloc(); b.replaceWith(hr); hr.after(p); placer(p); synchroniser(); return; }
      if (tx === '/' && e.data === '/' && surSlash) { synchroniser(e.inputType); surSlash(); return; }
    }
    synchroniser(e.inputType);
  });
  div.addEventListener('paste', e => {                                  // coller : du texte seulement
    e.preventDefault(); const tx = (e.clipboardData || window.clipboardData).getData('text/plain'); if (!tx) return;
    document.execCommand('insertText', false, tx.replace(/\r\n?/g, '\n'));
  });

  function poser(k) {
    let b = blocCourant(); if (!b || b.dataset.b === 'hr') b = div.lastElementChild;
    if (k === 'separateur') { const hr = bloc('hr'), p = bloc(); if (texteDe(b)) { b.after(hr); hr.after(p); } else { b.before(hr); p.remove(); placer(b); synchroniser(); return; } placer(p); synchroniser(); return; }
    const voulu = k === 'texte' ? 'p' : String(k), actuel = b.dataset.b || 'p';
    const n = changerType(b, actuel === voulu ? 'p' : voulu); div.focus(); placer(n); synchroniser();
  }
  function retirerSlash() {
    const b = blocCourant() || div.lastElementChild; if (!b) return;
    const tx = texteDe(b); if (tx.endsWith('/')) { b.textContent = tx.slice(0, -1); if (!b.textContent) b.append(document.createElement('br')); placer(b); synchroniser('deleteContentBackward'); }
  }

  // ── v61 : @personnes et #lieux en couleur pendant qu'on tape (surlignage CSS, sans toucher au texte : le clavier
  // d'Android et le curseur ne sont jamais dérangés). Navigateur trop ancien : rien ne change.
  const RE_COULEUR = /(^|[^\p{L}\d_])([@#])([\p{L}\d_-]{1,30})/gu, peutSurligner = !!(window.CSS && CSS.highlights && window.Highlight);
  function surligner() {
    if (!peutSurligner) return;
    const P = [], L = [], w = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) for (const m of n.data.matchAll(RE_COULEUR)) {
      const r = new Range(), a = m.index + m[1].length; r.setStart(n, a); r.setEnd(n, a + 1 + m[3].length); (m[2] === '@' ? P : L).push(r);
    }
    CSS.highlights.set('ed-personne', new Highlight(...P)); CSS.highlights.set('ed-lieu', new Highlight(...L));
  }
  div.addEventListener('input', surligner); ta.addEventListener('input', surligner);
  function motCourant() {
    const s = getSelection(); if (!s.rangeCount || !s.isCollapsed || !div.contains(s.anchorNode) || s.anchorNode.nodeType !== 3) return null;
    const avant = s.anchorNode.data.slice(0, s.anchorOffset), m = avant.match(/(^|[^\p{L}\d_])([@#])([\p{L}\d_-]{0,30})$/u);
    return m ? { k: m[2], debut: m[3], node: s.anchorNode, de: s.anchorOffset - m[3].length - 1, a: s.anchorOffset } : null;
  }
  function completer(nom) {
    const m = motCourant(); if (!m) return false;
    const r = document.createRange(); r.setStart(m.node, m.de); r.setEnd(m.node, m.a); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    if (!document.execCommand('insertText', false, nom + ' ')) { r.deleteContents(); const t = document.createTextNode(nom + ' '); r.insertNode(t); placer(t, true); synchroniser(); }
    return true;
  }

  depuisTexte(ta.value); surligner();
  return { element: div, poser, motCourant, completer, retirerSlash, surSlash: f => { surSlash = f; }, actualiser: () => { depuisTexte(ta.value); surligner(); } };
}
