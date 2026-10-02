// Les dates qui comptent : anniversaires, départs, rendez-vous… Une date peut revenir chaque année (annuelle) ou être unique.
// Elle est marquée dans le ciel (une petite couronne dorée autour de l'étoile du jour) et la petite lueur la fête.
const CLE = 'constellation.dates.v1';

export function charger() { try { const l = JSON.parse(localStorage.getItem(CLE)); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
export function sauver(l) { try { localStorage.setItem(CLE, JSON.stringify(l)); } catch (e) {} }

const mmjj = cle => cle.slice(5);
export const pourJour = (liste, cle) => liste.filter(d => d.annuelle ? mmjj(d.jour) === mmjj(cle) && cle >= d.jour : d.jour === cle);

// toutes les dates concernées pour une plage d'années : [{ cle, titre, annuelle, id, depuis }]
export function occurrences(liste, y0, y1) {
  const r = [];
  for (const d of liste) {
    const [y, m, j] = d.jour.split('-');
    if (!d.annuelle) { r.push({ ...d, cle: d.jour, depuis: 0 }); continue; }
    for (let a = Math.max(+y, y0); a <= y1; a++) r.push({ ...d, cle: a + '-' + m + '-' + j, depuis: a - +y });
  }
  return r;
}

// la prochaine occurrence (aujourd'hui compris) à partir d'une clé de jour
export function prochaine(liste, cle) {
  let best = null;
  for (const o of occurrences(liste, +cle.slice(0, 4), +cle.slice(0, 4) + 1)) if (o.cle >= cle && (!best || o.cle < best.cle)) best = o;
  return best;
}
