// v71 : « Et alors ? » (Matthieu : « c'est incroyable »). Quand une note parlait de quelque chose de prévu
// (demain, ce soir, ce week-end, samedi prochain…), la lueur demande une fois, le bon jour, comment ça s'est passé.
// Elle ne relit jamais le texte : elle dit seulement quand c'était, et avec qui (@prénom de la même phrase).
// Rien n'est ajouté au journal : les plans sont retrouvés dans les notes à chaque fois ; seuls les plans déjà demandés sont gardés.
import { EN } from './langue.js';
import { dateDeCle, cleJour } from './store.js';

const CLE = 'constellation.etalors.v1';
const lire = () => { try { return JSON.parse(localStorage.getItem(CLE)) || { faits: [] }; } catch (e) { return { faits: [] }; } };
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const JOURS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const FUTUR = /(?:^|[^\p{L}])(?:je vais|j['’]vais|on va|il va|elle va|nous allons|ils vont|elles vont|rdv|rendez-vous|entretien|examen|ira|iras|irai|irons|iront|on part|je pars|\p{L}{2,}(?:rai|ras|ra|rons|ront)|will|going to|i['’]ll|we['’]ll|appointment|interview)(?![\p{L}])/iu;
const decale = (cle, n) => { const d = dateDeCle(cle); return cleJour(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)); };
const ecart = (a, b) => Math.round((dateDeCle(b) - dateDeCle(a)) / 864e5);

// les plans d'une note : [{ id, ecrit, ech, sorte: 'jour' | 'soir' | 'we', noms }]
export function plans(item) {
  const jour = item.jour, wd = dateDeCle(jour).getDay(), h = new Date(item.date || 0).getHours(), l = [];
  for (const phrase of (item.texte || '').split(/[.!?…\n]+/)) {
    const p = phrase.toLowerCase(), noms = [...phrase.matchAll(/@([\p{L}\d_-]{2,30})/gu)].map(m => m[1]);
    const ajouter = (n, sorte) => { if (n >= 1 && n <= 8) l.push({ ecrit: jour, ech: decale(jour, n), sorte, noms }); };
    if (/apr[eè]s[- ]demain|day after tomorrow/.test(p)) ajouter(2, 'jour');
    else if (/(?:^|[^\p{L}])(?:demain|tomorrow)(?![\p{L}])/u.test(p)) ajouter(1, 'jour');
    if (/(?:^|[^\p{L}])(?:ce soir|cette nuit|tonight)(?![\p{L}])/u.test(p) && h < 18) ajouter(1, 'soir');
    if (/ce week-?end|this weekend/.test(p) && wd >= 1 && wd <= 5) ajouter(7 - wd + 1, 'we');   // le lundi d'après
    for (let w = 0; w < 7; w++) {
      const re = new RegExp('(?:^|[^\\p{L}])(?:' + JOURS_FR[w] + '|' + JOURS_EN[w] + ')(?![\\p{L}])(?!\\s+(?:dernier|pass[ée]|last))', 'u');
      if (!re.test(p)) continue;
      const prochain = /prochain|next/.test(p); if (!prochain && !FUTUR.test(p)) continue;
      let n = (w - wd + 7) % 7; if (n === 0) { if (!prochain) continue; n = 7; }
      ajouter(n, 'jour');
    }
  }
  const vus = new Set(); return l.filter(x => { x.id = x.ecrit + '|' + x.ech + '|' + x.sorte; if (vus.has(x.id)) return false; vus.add(x.id); return true; });
}

// le plan à demander aujourd'hui (le jour J, ou jusqu'à 2 jours après), jamais deux fois
export function aDemander(items, auj) {
  const faits = new Set(lire().faits), l = [];
  for (const i of items) {
    if (i.sample || i.type !== 'journal' || !i.texte || i.jour >= auj || ecart(i.jour, auj) > 10) continue;
    for (const p of plans(i)) { const e = ecart(p.ech, auj); if (e >= 0 && e <= 2 && !faits.has(p.id)) l.push(p); }
  }
  l.sort((a, b) => (b.ech > a.ech) - (b.ech < a.ech) || b.noms.length - a.noms.length);
  return l[0] ? { ...l[0], phrase: phrase(l[0], auj) } : null;
}
export function marquer(id) { const o = lire(); o.faits = [...o.faits.filter(x => x !== id), id].slice(-60); try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} }

const choix = l => l[Math.floor(Math.random() * l.length)];
function phrase(p, auj) {
  const dE = ecart(p.ecrit, auj), dJ = ecart(p.ech, auj), wE = dateDeCle(p.ecrit).getDay(), wJ = dateDeCle(p.ech).getDay();
  const liste = n => n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + (EN ? ' and ' : ' et ') + n.at(-1);
  if (EN) {
    const quand = dE === 1 ? 'Yesterday' : dE === 2 ? 'The day before yesterday' : 'On ' + JOURS_EN[wE][0].toUpperCase() + JOURS_EN[wE].slice(1);
    const quoi = p.sorte === 'soir' ? 'your evening' : p.sorte === 'we' ? 'your weekend' : dJ === 0 ? 'today' : dJ === 1 ? 'yesterday' : JOURS_EN[wJ][0].toUpperCase() + JOURS_EN[wJ].slice(1);
    return quand + ', you mentioned ' + quoi + (p.noms.length ? ' with ' + liste(p.noms) : '') + '. ' + choix(['So, how did it go?', 'So? Tell me.', 'And then, how was it?']);
  }
  const quand = dE === 1 ? 'Hier' : dE === 2 ? 'Avant-hier' : JOURS_FR[wE][0].toUpperCase() + JOURS_FR[wE].slice(1);
  const quoi = p.sorte === 'soir' ? 'de ta soirée' : p.sorte === 'we' ? 'de ton week-end' : dJ === 0 ? 'd’aujourd’hui' : dJ === 1 ? 'd’hier' : 'de ' + JOURS_FR[wJ];
  return quand + ', tu parlais ' + quoi + (p.noms.length ? ' avec ' + liste(p.noms) : '') + '. ' + choix(['Et alors, comment c’était ?', 'Alors, ça s’est passé comment ?', 'Et alors ? Raconte-moi.']);
}
