// v75 : ce qui me fait du bien (Matthieu). On compare les jours avec et sans une activité cochée, une @personne ou un #lieu :
// sur combien de ces jours l'humeur était « joie » ou « élan ». Un lien n'est dit que s'il est net (3 jours au moins, 25 points d'écart).
// Les liens qui vont vers le gris ne sont dits que pour les activités, jamais pour une personne.
import { t } from './langue.js';
import { nomActivite } from './activites.js';

const BON = new Set(['joie', 'elan']), GRIS = new Set(['melancolie', 'tempete']);

// jours : [{ cle, mood, activites: ['sport'], noms: ['@Léa', '#parc'] }]
export function bienfaits(jours) {
  const ecrits = jours.filter(j => j.mood); if (ecrits.length < 5) return { assez: false, n: ecrits.length, liste: [] };
  const facteurs = new Map();
  for (const j of ecrits) {
    for (const a of j.activites || []) { const c = 'a:' + a; if (!facteurs.has(c)) facteurs.set(c, { type: 'act', k: a, label: nomActivite(a), jours: new Set() }); facteurs.get(c).jours.add(j.cle); }
    for (const x of j.noms || []) { const c = 'n:' + x.toLowerCase(); if (!facteurs.has(c)) facteurs.set(c, { type: x[0] === '@' ? 'personne' : 'lieu', k: x, label: x, jours: new Set() }); facteurs.get(c).jours.add(j.cle); }
  }
  const liste = [];
  for (const f of facteurs.values()) {
    const avec = ecrits.filter(j => f.jours.has(j.cle)), sans = ecrits.filter(j => !f.jours.has(j.cle));
    if (avec.length < 3 || sans.length < 2) continue;
    const bons = avec.filter(j => BON.has(j.mood)).length, gris = avec.filter(j => GRIS.has(j.mood)).length;
    const rB = bons / avec.length - sans.filter(j => BON.has(j.mood)).length / sans.length;
    const rG = gris / avec.length - sans.filter(j => GRIS.has(j.mood)).length / sans.length;
    if (rB >= .25 && bons >= 2) liste.push({ ...f, sens: 1, n: avec.length, b: bons, force: rB * Math.sqrt(avec.length) });
    else if (f.type === 'act' && rG >= .25 && gris >= 2) liste.push({ ...f, sens: -1, n: avec.length, b: gris, force: rG * Math.sqrt(avec.length) * .9 });
  }
  liste.sort((a, b) => b.force - a.force);
  return { assez: true, n: ecrits.length, liste };
}

const qui = f => f.type === 'act' ? t('Les jours avec « {a} »', { a: f.label }) : f.type === 'personne' ? t('Les jours avec {p}', { p: f.label }) : t('Les jours où {p} apparaît', { p: f.label });
export function phrase(f) {
  return f.sens > 0 ? t('{qui}, tu es plus souvent en joie ou plein d’élan ({b} sur {n}).', { qui: qui(f), b: f.b, n: f.n })
    : t('{qui}, ton ciel est plus souvent gris ({b} sur {n}).', { qui: qui(f), b: f.b, n: f.n });
}
// ce que dit la lueur, une seule fois par lien
export function phraseLueur(f) {
  const q = qui(f); return t('J’ai remarqué un truc : {qui}, tu es plus souvent en joie.', { qui: q.charAt(0).toLowerCase() + q.slice(1) });
}
const CLE = 'constellation.bienfaits.v1';
export function aDire(r) {
  let o = { dits: [], dernier: 0 }; try { o = { ...o, ...JSON.parse(localStorage.getItem(CLE)) }; } catch (e) {}
  if (Date.now() - o.dernier < 3 * 864e5) return null;
  return r.liste.find(f => f.sens > 0 && f.n >= 4 && !o.dits.includes(f.type + ':' + f.k.toLowerCase())) || null;
}
export function marquer(f) {
  let o = { dits: [], dernier: 0 }; try { o = { ...o, ...JSON.parse(localStorage.getItem(CLE)) }; } catch (e) {}
  o.dits = [...o.dits, f.type + ':' + f.k.toLowerCase()].slice(-80); o.dernier = Date.now();
  try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {}
}
