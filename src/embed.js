// Mesurer la proximité de sens entre deux textes.
// Mode « léger » : empreinte lexicale locale (instantanée, sans téléchargement).
// Mode « profond » : petit modèle multilingue exécuté dans le navigateur (transformers.js).
import { t } from './langue.js';
const DIM = 384;

export const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const STOP = new Set(('le la les un une des de du et en a au aux ce ces que qui quoi dans sur pour par avec sans je tu il elle nous vous ils elles ' +
  'me te se mon ma mes ton ta tes son sa ses est suis ai ont ete etre avoir pas plus ne mais ou donc car comme tres tout tous cette cet ' +
  'fait faire avait etait sont aux entre aussi encore toujours jamais rien tellement trop bien meme depuis apres avant quand ' +
  'the and for with but not you your are was were has had have this that these those from they them their there then than what when who how all any can its into our out too very just been being would could should will shall').split(' '));

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function add(v, key, w) { const h = hash(key); v[h % DIM] += ((h >>> 16) & 1 ? 1 : -1) * w; }

export function legere(texte) {
  const v = new Float32Array(DIM);
  const mots = norm(texte).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
  for (const w of mots) {
    add(v, 'w:' + w, 1);
    if (w.length > 5) add(v, 's:' + w.slice(0, 5), .8);
    for (let i = 0; i + 3 <= w.length; i++) add(v, 't:' + w.slice(i, i + 3), .22);
  }
  return unit(v);
}

function unit(v) { let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; for (let i = 0; i < v.length; i++) v[i] /= n; return v; }

export const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

let extracteur = null;
export async function chargerProfond(onStatut) {
  if (extracteur) return extracteur;
  onStatut && onStatut(t('Chargement du modèle…'));
  const { pipeline, env } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
  env.allowLocalModels = false;
  extracteur = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', {
    dtype: 'q8',
    progress_callback: p => { if (p.status === 'progress' && onStatut) onStatut(t('Modèle {p} %', { p: Math.round(p.progress || 0) })); },
  });
  return extracteur;
}
export async function profonde(texte) {
  const out = await extracteur(texte, { pooling: 'mean', normalize: true });
  return Float32Array.from(out.data);
}
