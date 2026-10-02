// Placement 3D des pensées : le sens les rapproche, le temps les étage.
import { cos } from './embed.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296; }
function hashId(id) { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function similarites(vecs) {
  const n = vecs.length, S = Array.from({ length: n }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) S[i][j] = S[j][i] = cos(vecs[i], vecs[j]);
  return S;
}

// entries : [{id, date}], S : matrice de similarité, prev : Map id -> [x,y,z]
export function placer(entries, S, prev) {
  const n = entries.length, P = [];
  const t0 = Math.min(...entries.map(e => e.date)), t1 = Math.max(...entries.map(e => e.date), t0 + 1);
  const hauteur = e => ((e.date - t0) / (t1 - t0) - .5) * 14;

  entries.forEach(e => {
    const p = prev && prev.get(e.id);
    if (p) { P.push(p.slice()); return; }
    const r = rng(hashId(e.id)), u = r() * 6.283, c = r() * 2 - 1, s = Math.sqrt(1 - c * c), R = 8 + r() * 8;
    P.push([Math.cos(u) * s * R, hauteur(e), Math.sin(u) * s * R]);
  });

  const F = P.map(() => [0, 0, 0]);
  for (let it = 0; it < 220; it++) {
    for (const f of F) f[0] = f[1] = f[2] = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], dz = P[j][2] - P[i][2];
      const d2 = dx * dx + dy * dy + dz * dz + .05, d = Math.sqrt(d2);
      const s = S[i][j], k = Math.min(1, Math.max(0, s * 3));
      let f = -9 / d2;                                   // répulsion
      if (k > 0) f += (d - (3 + (1 - k) * 7)) * .06 * k; // attraction par le sens
      dx /= d; dy /= d; dz /= d;
      F[i][0] += dx * f; F[i][1] += dy * f; F[i][2] += dz * f;
      F[j][0] -= dx * f; F[j][1] -= dy * f; F[j][2] -= dz * f;
    }
    const pas = .35 * (1 - it / 260);
    for (let i = 0; i < n; i++) {
      F[i][0] -= P[i][0] * .012; F[i][2] -= P[i][2] * .012;                  // gravité douce
      F[i][1] += (hauteur(entries[i]) - P[i][1]) * .03;                       // axe du temps
      for (let k = 0; k < 3; k++) P[i][k] += Math.max(-1, Math.min(1, F[i][k])) * pas;
    }
  }
  return new Map(entries.map((e, i) => [e.id, P[i]]));
}
