// Ta planète maison (v43, idée de Matthieu) : au milieu des semaines du mois en cours, un petit astre de lumière qui grandit avec
// tes mots. Au début, juste une lueur ; à force d'écrire, une planète se forme dedans (style doux, comme les planètes de la boutique),
// grossit, puis se couvre de nuages, de cerisiers, de maisonnettes. Plus tard : en zoomant assez près, on y entrera (page 3D détaillée).
// Rien n'est enregistré à part le dernier palier atteint (clé 'constellation.maison.v1'), pour fêter chaque palier une seule fois.
//
// API : const maison = creerMaison({ scene })
//   maison.regler({ mots, centre, clair })   mots : nombre de mots écrits (hors exemples) ; centre : Vector3 (centre du mois en cours)
//   maison.update(dt, anim)                  à chaque image
//   maison.palierFranchi() → bool            vrai une fois quand un nouveau palier est atteint (pour un message) ; maison.pulser()
//   compterMots(items)                        le nombre de mots des entrées (texte sans balises, exemples exclus)
import * as THREE from 'three';
import { construire, liberer, tourner } from './planetes.js';

const CLE = 'constellation.maison.v1';
export const PALIERS = [30, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000, 60000];
const lisse = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

export function compterMots(items) {
  let n = 0;
  for (const e of items) { if (e.sample) continue; const t = String(e.texte || '').replace(/<[^>]*>/g, ' ').replace(/[#*_>`~\-]+/g, ' ').trim(); if (t) n += t.split(/\s+/).length; }
  return n;
}
// ce que la planète porte selon les mots (planetes.js : effective n'est pas utilisé, tout est offert par l'écriture)
const planeteDe = mots => ({ id: 'maison', type: 'solide', palette: 'astra', graine: 3, couleurs: {},
  nuages: mots >= 2000, arbres: mots >= 4000 ? 'cerisier' : null, maisons: mots >= 8000, anneaux: mots >= 30000 ? 'fin' : null, double: false });
// rayon (unités du monde ; anneau des semaines : 27) et formation de la planète (0 : lueur seule, 1 : planète faite)
const rayonDe = mots => .8 + 2.9 * Math.min(1.25, Math.log10(1 + mots / 40) / 2.6);
const formationDe = mots => lisse(60, 1500, mots);

function texLueur() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.12, '#fff6dcee'); g.addColorStop(.35, '#ffe2a855'); g.addColorStop(.7, '#ffd08a14'); g.addColorStop(1, '#ffd08a00');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// le ciel est éclairé plus fort que l'étude (bloom) : on retient la lumière de la planète, comme pour les planètes du décor
function retenir(groupe, k) {
  groupe.traverse(o => { if (!o.material) return; for (const m of [].concat(o.material)) {
    if (m.isShaderMaterial && !m.userData.retenu) { m.userData.retenu = true; m.uniforms.uExpo = { value: k };
      m.fragmentShader = 'uniform float uExpo;\n' + m.fragmentShader.replace('#include <colorspace_fragment>', 'gl_FragColor.rgb *= uExpo;\n#include <colorspace_fragment>'); }
    else if (m.isMeshBasicMaterial) m.color.multiplyScalar(k);
  } });
}

export function creerMaison({ scene }) {
  const groupe = new THREE.Group(); groupe.name = 'maison'; scene.add(groupe);
  const lueur = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLueur(), color: '#ffe6b0', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .9 }));
  lueur.renderOrder = 4; groupe.add(lueur);
  const coeur = new THREE.Sprite(new THREE.SpriteMaterial({ map: lueur.material.map, color: '#ffffff', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  coeur.renderOrder = 5; groupe.add(coeur);
  let planete = null, cleP = '', mots = 0, r = .8, rVise = .8, f = 0, fVise = 0, t = 0, pulse = 0, clair = false, nouveau = false, premier = true;
  const lirePalier = () => { try { return +(JSON.parse(localStorage.getItem(CLE)) || {}).palier || 0; } catch (e) { return 0; } };
  const ecrirePalier = p => { try { localStorage.setItem(CLE, JSON.stringify({ palier: p })); } catch (e) {} };

  function batir() {
    const p = planeteDe(mots), cle = JSON.stringify(p); if (cle === cleP) return; cleP = cle;
    if (planete) { groupe.remove(planete); liberer(planete); }
    const { groupe: g } = construire(p, { detail: 48 });
    g.remove(g.children[g.children.length - 1]);                      // sans le halo de l'étude : la lueur fait ce travail ici
    retenir(g, .42); planete = g; groupe.add(g);
  }
  return {
    groupe,
    regler({ mots: m = mots, centre, clair: c } = {}) {
      mots = m; rVise = rayonDe(mots); fVise = formationDe(mots);
      if (premier) { r = rVise; f = fVise; premier = false; }
      if (centre) groupe.position.copy(centre);
      if (c != null && c !== clair) { clair = c; for (const s of [lueur, coeur]) { s.material.blending = clair ? THREE.NormalBlending : THREE.AdditiveBlending; s.material.needsUpdate = true; } lueur.material.color.set(clair ? '#e8b878' : '#ffe6b0'); }
      if (fVise > .01) batir();
      const palier = PALIERS.filter(x => mots >= x).length, avant = lirePalier();
      if (palier > avant) { if (avant || palier > 1) nouveau = true; ecrirePalier(palier); }   // le tout premier palier passe sans bruit
    },
    palierFranchi() { const v = nouveau; nouveau = false; return v; },
    pulser() { pulse = 1; },
    update(dt, anim = 1) {
      t += dt; r += (rVise - r) * Math.min(1, dt * .8); f += (fVise - f) * Math.min(1, dt * .8); pulse = Math.max(0, pulse - dt * .5);
      const respire = 1 + Math.sin(t * 1.3) * .05 * (1 - f) + pulse * .25;
      // la lueur : grande et vive au début, puis un halo autour de la planète qui s'est formée
      lueur.scale.setScalar(r * (5.5 - 2.9 * f) * respire); lueur.material.opacity = (clair ? .35 : .85) * (1 - .78 * f) + pulse * .3;
      coeur.scale.setScalar(r * (1.6 - .9 * f) * respire); coeur.material.opacity = (1 - f) * (clair ? .6 : 1);
      if (planete) {
        planete.visible = f > .02; planete.scale.setScalar(r * (.35 + .65 * f));
        tourner(planete, t * anim * .6);
      }
    },
  };
}
