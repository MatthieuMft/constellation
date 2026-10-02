// Lecture du journal : constellations nommées, météo intérieure, bilan du mois, chemin d'une idée.
// Tout est calculé localement, sans modèle distant.
import { norm, STOP } from './embed.js';
import { t, tn, LOC } from './langue.js';

export const VALENCE = { joie: 1, elan: .6, calme: .3, melancolie: -.5, tempete: -1 };
const v = e => VALENCE[e.mood] ?? 0;

const jetons = t => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  .map(o => ({ o, n: norm(o) })).filter(({ n }) => n.length > 3 && !STOP.has(n) && !PLUS.has(n) && !/^\d+$/.test(n));
const PLUS = new Set('cela ceci chez dont leur leurs lui moi toi soit sous vers ainsi alors pendant deja puis enfin parce pourquoi jour jours toute toutes autre autres peut peux veux voir vois etais sera serai ete fois chose choses moment vraiment peu plus moins encore pense pensee ' +
  'about again also always back before being could day days even ever every feel felt from going have just know like little made make many more much never next only other over really said same some still than that their them then there these they thing things think this those through time today very want well were what when where which while will with would your yours'.split(' '));
const racine = n => n.slice(0, 5);

// Mots qui reviennent dans la cible sans être partout : (fréquence dans la cible) × (rareté dans le reste).
export function motsDistinctifs(textes, cibles, k = 3, minDocs = 2) {
  const N = textes.length, df = new Map();
  const parDoc = textes.map(t => new Set(jetons(t).map(({ n }) => racine(n))));
  parDoc.forEach(s => s.forEach(c => df.set(c, (df.get(c) || 0) + 1)));
  const tf = new Map(), formes = new Map();
  cibles.forEach(i => {
    jetons(textes[i]).forEach(({ o, n }) => { const c = racine(n); if (!formes.has(c)) formes.set(c, new Map()); const f = formes.get(c); f.set(o, (f.get(o) || 0) + 1); });
    parDoc[i].forEach(c => tf.set(c, (tf.get(c) || 0) + 1));
  });
  const m = Math.min(minDocs, cibles.length);
  return [...tf].filter(([, t]) => t >= m)
    .map(([c, t]) => ({ c, score: Math.pow(t, 1.5) * Math.log((N + 1) / (df.get(c) + .5)) }))
    .sort((a, b) => b.score - a.score).slice(0, k)
    .map(x => [...formes.get(x.c)].sort((a, b) => b[1] - a[1])[0][0]);
}

// Regroupement hiérarchique (liaison moyenne) : on fusionne tant que les groupes se ressemblent assez.
export function grouper(S) {
  const n = S.length; if (n < 3) return [];
  const paires = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) paires.push(S[i][j]);
  paires.sort((a, b) => a - b);
  const seuil = Math.max(.05, paires[Math.floor(paires.length * .8)] * .85), maxTaille = Math.max(4, Math.floor(n * .45));
  const g = Array.from({ length: n }, (_, i) => ({ membres: [i], vivant: true }));
  const D = S.map(l => Float64Array.from(l));
  while (true) {
    let best = -1, a = -1, b = -1;
    for (let i = 0; i < n; i++) if (g[i].vivant) for (let j = i + 1; j < n; j++) if (g[j].vivant && D[i][j] > best && g[i].membres.length + g[j].membres.length <= maxTaille) { best = D[i][j]; a = i; b = j; }
    if (best < seuil) break;
    const na = g[a].membres.length, nb = g[b].membres.length;
    for (let k = 0; k < n; k++) if (g[k].vivant && k !== a && k !== b) { D[a][k] = D[k][a] = (na * D[a][k] + nb * D[b][k]) / (na + nb); }
    g[a].membres.push(...g[b].membres); g[b].vivant = false;
  }
  return g.filter(x => x.vivant && x.membres.length >= 2).map(x => x.membres);
}

export function nommerGroupes(entries, S) {
  const textes = entries.map(e => e.text);
  return grouper(S).map(idx => {
    const mots = motsDistinctifs(textes, idx, 2);
    if (!mots.length) return null;
    const titre = mots.map((m, i) => i === 0 ? m[0].toUpperCase() + m.slice(1) : m).join(' · ');
    return { ids: idx.map(i => entries[i].id), titre };
  }).filter(Boolean);
}

// Chemin d'une idée : de proche en proche, sans repasser par une pensée déjà visitée.
export function cheminDe(S, depart, pas = 8) {
  const vus = new Set([depart]), chemin = [depart]; let cur = depart;
  while (chemin.length < pas) {
    let best = -1, bj = -1;
    for (let j = 0; j < S.length; j++) if (!vus.has(j) && S[cur][j] > best) { best = S[cur][j]; bj = j; }
    if (bj < 0 || best < .03) break;
    chemin.push(bj); vus.add(bj); cur = bj;
  }
  return chemin;
}

// ─── Météo intérieure ───
const debutJour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export function meteo(entries, jours, maintenant = new Date()) {
  const fin = debutJour(maintenant), out = [];
  for (let i = jours - 1; i >= 0; i--) {
    const d0 = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - i), d1 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1);
    const du = entries.filter(e => e.date >= d0 && e.date < d1);
    const humeurs = {}; du.forEach(e => humeurs[e.mood] = (humeurs[e.mood] || 0) + 1);
    const dominante = Object.entries(humeurs).sort((a, b) => b[1] - a[1])[0];
    out.push({ date: d0, n: du.length, valeur: du.length ? du.reduce((s, e) => s + v(e), 0) / du.length : null, humeurs, dominante: dominante ? dominante[0] : null });
  }
  return out;
}
export function resumeMeteo(jours) {
  const ecrits = jours.filter(j => j.n);
  if (!ecrits.length) return t('Aucune pensée sur cette période : le ciel est vide.');
  const moy = ecrits.reduce((s, j) => s + j.valeur, 0) / ecrits.length;
  const eclaircies = ecrits.filter(j => j.valeur >= .5).length, orages = ecrits.filter(j => j.valeur <= -.5).length;
  const ciel = t(moy > .35 ? 'plutôt dégagé' : moy > -.1 ? 'variable' : moy > -.4 ? 'nuageux' : 'orageux');
  return t('Ciel {ciel}. {a}, {b}, {c} sur {n}.', { ciel, a: tn(eclaircies, '{n} éclaircie', '{n} éclaircies'), b: tn(orages, '{n} orage', '{n} orages'), c: tn(ecrits.length, '{n} jour écrit', '{n} jours écrits'), n: jours.length });
}

// ─── Bilan mensuel ───
const ADJ = { joie: t('lumineux'), elan: t('porté par l’élan'), calme: t('calme'), melancolie: t('voilé de mélancolie'), tempete: t('agité') };
const NOM = { joie: t('joie'), elan: t('élan'), calme: t('calme'), melancolie: t('mélancolie'), tempete: t('tempête') };
export function bilanMois(entries, annee, mois) {
  const tous = entries.map(e => e.text);
  const duMois = entries.map((e, i) => ({ e, i })).filter(({ e }) => { const d = new Date(e.date); return d.getFullYear() === annee && d.getMonth() === mois; })
    .sort((a, b) => a.e.date - b.e.date);
  const titre = new Date(annee, mois, 1).toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
  if (!duMois.length) return { titre, n: 0, phrases: [t('Aucune pensée ce mois-ci.')], ids: [] };
  const n = duMois.length, jours = new Set(duMois.map(({ e }) => new Date(e.date).toDateString())).size;
  const cpt = {}; duMois.forEach(({ e }) => cpt[e.mood] = (cpt[e.mood] || 0) + 1);
  const tri = Object.entries(cpt).sort((a, b) => b[1] - a[1]);
  const phrases = [t('{a} sur {b}.', { a: tn(n, '{n} pensée', '{n} pensées'), b: tn(jours, '{n} jour', '{n} jours') }),
    t('Le ciel a été surtout {adj} ({liste}).', { adj: ADJ[tri[0][0]], liste: tri.slice(0, 3).map(([k, c]) => NOM[k] + ' ×' + c).join(', ') })];
  if (n >= 4) {
    const m = Math.floor(n / 2), moy = a => a.reduce((s, { e }) => s + v(e), 0) / a.length, d = moy(duMois.slice(m)) - moy(duMois.slice(0, m));
    phrases.push(t(d > .25 ? 'La seconde moitié du mois s’éclaircit.' : d < -.25 ? 'La seconde moitié du mois s’assombrit.' : 'Le mois est resté d’une humeur stable.'));
  }
  const mots = motsDistinctifs(tous, duMois.map(({ i }) => i), 3, n > 2 ? 2 : 1);
  if (mots.length) phrases.push(t('Reviennent souvent : {mots}.', { mots: mots.join(', ') }));
  const clair = duMois.reduce((a, b) => v(b.e) > v(a.e) ? b : a);
  phrases.push(t('Le jour le plus lumineux : {d}.', { d: new Date(clair.e.date).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' }) }));
  return { titre, n, jours, phrases, ids: duMois.map(({ e }) => e.id), lumineux: clair.e.id };
}
