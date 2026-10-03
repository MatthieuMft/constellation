// v34 : ajouter Constellation à l'écran d'accueil. Quand le navigateur le permet (Chrome, Edge…), un seul geste suffit ;
// sinon (Brave, Samsung Internet, Firefox, iPhone…), on dit exactement où toucher, selon le navigateur.
import { t } from './langue.js';

export const dejaInstallee = () => matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;

export function astuceInstall() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return t('Touche <b>Partager</b> (le carré avec une flèche), puis <b>« Sur l’écran d’accueil »</b>.');
  if (navigator.brave) return t('Dans Brave, ouvre le menu <b>⋮</b> (en bas ou en haut à droite), puis <b>« Ajouter à l’écran d’accueil »</b> ou <b>« Installer l’application »</b>.');
  if (/SamsungBrowser/i.test(ua)) return t('Touche le menu <b>≡</b> en bas à droite, puis <b>« Ajouter page à »</b> › <b>« Écran d’accueil »</b>.');
  if (/firefox|fxios/i.test(ua)) return t('Touche le menu <b>⋮</b>, puis <b>« Installer »</b> ou <b>« Ajouter à l’écran d’accueil »</b>.');
  return t('Touche le menu <b>⋮</b> du navigateur, puis <b>« Ajouter à l’écran d’accueil »</b> ou <b>« Installer l’application »</b>.');
}
