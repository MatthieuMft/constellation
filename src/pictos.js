// v52 : les pictogrammes du menu et des réglages. Trait fin comme les icônes d'activités (v48), avec une touche céleste :
// une petite étoile pleine (✦) dans chacun. Taille 20, couleur héritée (currentColor).
const S = d => `<svg class="picto" viewBox="0 0 22 22" aria-hidden="true">${d}</svg>`;
const etoile = (x, y, r = 1.6) => `<path class="plein" d="M${x} ${y - r * 1.6}l${r * .45} ${r * 1.15} ${r * 1.15} ${r * .45}-${r * 1.15} ${r * .45}-${r * .45} ${r * 1.15}-${r * .45}-${r * 1.15}-${r * 1.15}-${r * .45} ${r * 1.15}-${r * .45}z"/>`;
export const PICTOS = {
  semaine: S('<path d="M4.8 14.8l3-6.2 M9.2 8.2l2.6 3 M13.6 10.7l3-4.4"/><circle cx="4.2" cy="16" r="1.3"/><circle cx="8.4" cy="7.4" r="1.3"/><circle cx="12.6" cy="12" r="1.3"/>' + etoile(17.4, 5.2, 1.8) + '<path d="M3 19.5h16" opacity=".5"/>'),
  carnet: S('<path d="M11 6.5c-1.8-1.3-4-1.7-7-1.6V16c3-.1 5.2.3 7 1.6 1.8-1.3 4-1.7 7-1.6V4.9c-3-.1-5.2.3-7 1.6z M11 6.5v11"/>' + etoile(15, 9.6, 1.2)),
  lueur: S('<circle cx="10.5" cy="12" r="6"/><path d="M8.4 11.2v.9 M12.6 11.2v.9 M9.2 14.2c.8.6 1.8.6 2.6 0"/>' + etoile(17.6, 4.4, 1.5)),
  ciel: S('<path d="M15 15.5A6.5 6.5 0 0 1 7.5 8a6.5 6.5 0 1 0 7.5 7.5z"/>' + etoile(16.2, 5.2, 1.7) + etoile(12.2, 3.6, .9)),
  boutique: S('<path d="M4.5 8.5h13l-1.2 10H5.7z M8 8.5V7a3 3 0 0 1 6 0v1.5"/>' + etoile(11, 13.4, 1.6)),
  suivi: S('<path d="M3 15c2.2 0 2.6-5.5 4.8-5.5S10.6 17 12.8 17s2.6-9.5 6.2-9.5"/>' + etoile(17.2, 4, 1.3)),
  reglages: S('<path d="M3.5 7h15 M3.5 15h15"/><circle cx="8" cy="7" r="2.1" class="fond"/><circle cx="14" cy="15" r="2.1" class="fond"/>' + etoile(18.2, 3.2, .9)),
  rappel: S('<path d="M6 15.5V10a5 5 0 0 1 10 0v5.5l1.5 1.5h-13z M9.3 19a1.8 1.8 0 0 0 3.4 0"/>' + etoile(17.5, 4, 1.2)),
  son: S('<path d="M8.5 16V6l9-1.8V14 M8.5 16a2.2 2.2 0 1 1-2.2-2.2A2.2 2.2 0 0 1 8.5 16z M17.5 14a2.2 2.2 0 1 1-2.2-2.2 2.2 2.2 0 0 1 2.2 2.2z"/>'),
  langue: S('<circle cx="11" cy="11" r="7.5"/><path d="M3.5 11h15 M11 3.5c2.2 2.2 3 4.7 3 7.5s-.8 5.3-3 7.5c-2.2-2.2-3-4.7-3-7.5s.8-5.3 3-7.5z"/>'),
  mouvement: S('<ellipse cx="11" cy="11" rx="8" ry="3.6" transform="rotate(-24 11 11)"/><circle cx="11" cy="11" r="2.4"/>' + etoile(17.6, 6, 1.1)),
  verrou: S('<path d="M5.5 10h11v8.5h-11z M8 10V7.5a3 3 0 0 1 6 0V10"/>' + etoile(11, 14.2, 1.1)),
  donnees: S('<path d="M4 6.5h14v11H4z M4 10h14 M9 13.5h4"/>'),
  aide: S('<circle cx="11" cy="11" r="7.5"/><path d="M8.8 8.8a2.2 2.2 0 1 1 3 2c-.6.3-.8.8-.8 1.5 M11 14.8v.2"/>'),
  souvenir: S('<path d="M4 11a7 7 0 1 0 2-4.9 M4 4.5v3.2h3.2 M11 7.5V11l2.5 1.8"/>'),
  recherche: S('<circle cx="9.5" cy="9.5" r="5.5"/><path d="M13.6 13.6l4.4 4.4"/>'),   // v74
  partage: S('<circle cx="6" cy="11" r="2"/><circle cx="16" cy="5.5" r="2"/><circle cx="16" cy="16.5" r="2"/><path d="M7.8 10l6.4-3.5 M7.8 12l6.4 3.5"/>'),   // v76
  nom: S('<path d="M5 17l2.6-.6 9-9a1.5 1.5 0 0 0-2-2l-9 9z M13.4 6.6l2 2"/>' + etoile(17.6, 15.4, 1.2)),
  bilan: S('<path d="M4 18V11 M9 18V7 M14 18v-5 M19 18V9" />' + etoile(9, 3.6, 1.1)),
  noms: S('<path d="M4 6h14 M4 11h9 M4 16h11"/>'),
};
