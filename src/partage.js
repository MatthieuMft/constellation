// v76 : envoyer ma constellation (Matthieu). Une image de la semaine (1080 × 1350, le format des réseaux) :
// la vraie figure, une étoile par jour à la couleur de son humeur, le nom et les dates. Aucun texte du journal.
// Partage du téléphone quand il sait envoyer une image, sinon l'image est téléchargée.
import { t, tn } from './langue.js';

const W = 1080, H = 1350, hex = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#ffe7b0';
function hasard(graine) { let h = 2166136261; for (const c of graine) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

// o : { cle, figure: { e: [[x, y, éclat]], t: [[a, b]] }, nom, periode, jours: [{ etat: 'ecrit' | 'offert' | 'rate', couleur }] × 7 (lundi → dimanche) }
export function dessinerSemaine(o) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = hasard(o.cle);
  const fond = g.createRadialGradient(W * .5, H * .45, 40, W * .5, H * .5, H * .75);
  fond.addColorStop(0, '#1b1838'); fond.addColorStop(.55, '#0b0b1d'); fond.addColorStop(1, '#04040b'); g.fillStyle = fond; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) { g.globalAlpha = .15 + r() * .55; g.fillStyle = r() < .15 ? '#cfd8ff' : '#ffffff'; const s = r() < .93 ? 1 + r() * 1.4 : 2.6; g.beginPath(); g.arc(r() * W, r() * H, s, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // la figure, posée dans un carré au milieu, sans la déformer
  const E = o.figure.e, xs = E.map(p => p[0]), ys = E.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const boite = { x: 150, y: 330, w: 780, h: 700 }, k = Math.min(boite.w / Math.max(.05, x1 - x0), boite.h / Math.max(.05, y1 - y0));
  const P = E.map(([x, y]) => [boite.x + boite.w / 2 + (x - (x0 + x1) / 2) * k, boite.y + boite.h / 2 - (y - (y0 + y1) / 2) * k]);   // y monte, comme dans le ciel de l'appli
  g.strokeStyle = 'rgba(240,232,214,.5)'; g.lineWidth = 2.4; g.lineCap = 'round';
  for (const [a, b] of o.figure.t) { g.beginPath(); g.moveTo(...P[a]); g.lineTo(...P[b]); g.stroke(); }
  const etoile = (x, y, rayon, couleur, halo, alpha = 1) => {
    g.globalAlpha = alpha;
    const h = g.createRadialGradient(x, y, 0, x, y, rayon * halo); h.addColorStop(0, couleur); h.addColorStop(.25, couleur + '99'); h.addColorStop(1, couleur + '00');
    g.fillStyle = h; g.beginPath(); g.arc(x, y, rayon * halo, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, rayon * .55, 0, 7); g.fill(); g.globalAlpha = 1;
  };
  P.forEach(([x, y], i) => {
    if (i >= 7) { etoile(x, y, 5, '#e6e9ff', 3, .75); return; }
    const j = o.jours[i] || { etat: 'rate' };
    if (j.etat === 'ecrit') etoile(x, y, 13 + (E[i][2] || .8) * 6, hex(j.couleur), 5.5);
    else if (j.etat === 'offert') etoile(x, y, 10, '#e6e9ff', 4, .85);
    else etoile(x, y, 7, '#ffffff', 3, .35);
  });
  // le texte (jamais celui du journal)
  g.textAlign = 'center'; g.fillStyle = '#f1ece4';
  g.font = '500 26px ui-monospace, Menlo, monospace'; g.globalAlpha = .7; espace(g, t('MA SEMAINE'), W / 2, 130, 6);
  g.globalAlpha = 1; g.font = 'italic 84px Georgia, "Times New Roman", serif'; ajuster(g, o.nom, W / 2, 225, W - 160, 84);
  g.globalAlpha = .75; g.font = 'italic 34px Georgia, serif'; g.fillText(o.periode, W / 2, 278);
  const n = o.jours.filter(j => j.etat === 'ecrit').length;
  g.globalAlpha = .85; g.font = '34px Georgia, serif'; g.fillText(tn(n, '{n} jour écrit', '{n} jours écrits'), W / 2, 1130);
  // une pastille par jour, à la couleur de son humeur
  o.jours.forEach((j, i) => { const x = W / 2 + (i - 3) * 46, y = 1185; g.globalAlpha = j.etat === 'rate' ? .35 : 1; g.beginPath(); g.arc(x, y, 11, 0, 7);
    if (j.etat === 'ecrit') { g.fillStyle = hex(j.couleur); g.fill(); } else if (j.etat === 'offert') { g.fillStyle = '#e6e9ff'; g.fill(); } else { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke(); } });
  g.globalAlpha = .5; g.font = '500 22px ui-monospace, Menlo, monospace'; g.fillStyle = '#f1ece4'; espace(g, 'CONSTELLATION', W / 2, 1290, 8);
  g.globalAlpha = 1; return c;
}
function espace(g, txt, x, y, pas) { const l = [...txt], w = l.reduce((s, ch) => s + g.measureText(ch).width + pas, -pas); let cx = x - w / 2; g.textAlign = 'left'; for (const ch of l) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + pas; } g.textAlign = 'center'; }
function ajuster(g, txt, x, y, max, taille) { let s = taille; while (s > 40 && g.measureText(txt).width > max) { s -= 4; g.font = 'italic ' + s + 'px Georgia, "Times New Roman", serif'; } g.fillText(txt, x, y); }

export async function envoyer(canvas, nomFichier, titre) {
  const blob = await new Promise(ok => canvas.toBlob(ok, 'image/png')); if (!blob) return 'erreur';
  const fichier = new File([blob], nomFichier, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [fichier] })) { await navigator.share({ files: [fichier], title: titre }); return 'partage'; } }
  catch (e) { if (e && e.name === 'AbortError') return 'annule'; }
  const a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = nomFichier; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return 'telecharge';
}
