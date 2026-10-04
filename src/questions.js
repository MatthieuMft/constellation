// v70 : l'écriture, deux aides (demande de Matthieu, validées le 4 oct. 2026).
// 1. MODELES : « Un coup de pouce ? » dans l'éditeur. Au plus 3 modèles, qui suivent l'humeur choisie juste avant
//    (jamais « Ce qui pèse » un jour de joie), plus « Lettre à moi dans un an » tous les jours.
// 2. QUESTIONS : 100 questions écrites à la main. Quand on bloque une vingtaine de secondes, la lueur en pose une,
//    choisie par sens (empreinte lexicale locale d'embed.js, sans internet) d'après ce qui est déjà écrit, sinon d'après l'humeur.
//    m : humeurs où la question a sa place ('*' = toutes) ; k : mots qui aident à la rapprocher du texte ; suite : seulement quand du texte existe.
import { EN } from './langue.js';
import { legere, cos } from './embed.js';

const LETTRE = { id: 'lettre', fr: ['Lettre à moi dans un an', '### À moi, dans un an\n'], en: ['A letter to me in a year', '### To me, a year from now\n'] };
const PAR_HUMEUR = {
  joie: [{ id: 'belles', fr: ['3 belles choses', '### Trois belles choses aujourd’hui\n- '], en: ['3 good things', '### Three good things today\n- '] },
    { id: 'meilleur', fr: ['Le meilleur moment', '### Le meilleur moment\nLe meilleur moment de ma journée, c’était '], en: ['The best moment', '### The best moment\nThe best moment of my day was '] }],
  elan: [{ id: 'demain', fr: ['Ce que je veux faire demain', '### Demain\nDemain, je veux '], en: ['What I want to do tomorrow', '### Tomorrow\nTomorrow, I want to '] },
    { id: 'elan', fr: ['Ce qui me donne de l’élan', '### Ce qui me donne de l’élan\n- '], en: ['What gives me momentum', '### What gives me momentum\n- '] }],
  calme: [{ id: 'simple', fr: ['Un moment simple', '### Un moment simple\n'], en: ['A simple moment', '### A simple moment\n'] },
    { id: 'remarque', fr: ['Ce que j’ai remarqué', '### Ce que j’ai remarqué aujourd’hui\n- '], en: ['What I noticed', '### What I noticed today\n- '] }],
  melancolie: [{ id: 'pese', fr: ['Ce qui pèse', '### Ce qui pèse\n'], en: ['What weighs on me', '### What weighs on me\n'] },
    { id: 'aide', fr: ['Une petite chose qui a aidé', '### Une petite chose qui a aidé\n'], en: ['One small thing that helped', '### One small thing that helped\n'] }],
  tempete: [{ id: 'sac', fr: ['Vider mon sac', '### Vider mon sac\n'], en: ['Getting it off my chest', '### Getting it off my chest\n'] },
    { id: 'besoin', fr: ['Ce qui m’aiderait', '### Ce qui m’aiderait\n- '], en: ['What would help me', '### What would help me\n- '] }],
};
export function modeles(humeur) {
  const l = (PAR_HUMEUR[humeur] || PAR_HUMEUR.calme).concat([LETTRE]).slice(0, 3);
  return l.map(m => { const [nom, texte] = EN ? m.en : m.fr; return { id: m.id, nom, texte }; });
}

const J = ['joie'], C = ['calme'], E = ['elan'], M = ['melancolie'], T = ['tempete'], P = ['joie', 'elan'], N = ['melancolie', 'tempete'], A = ['*'];
const Q = [
  // la journée
  [A, 'Quel moment de ta journée aimerais-tu garder ?', 'Which moment of your day would you like to keep?'],
  [A, 'Qu’est-ce qui t’a fait sourire aujourd’hui ?', 'What made you smile today?', 'sourire rire drole'],
  [A, 'Qu’as-tu appris aujourd’hui, même tout petit ?', 'What did you learn today, even something tiny?', 'appris apprendre decouvert'],
  [A, 'Avec qui as-tu passé le plus de temps aujourd’hui ?', 'Who did you spend the most time with today?'],
  [A, 'Qu’est-ce qui t’a surpris aujourd’hui ?', 'What surprised you today?', 'surprise inattendu'],
  [A, 'Quel bruit, quelle odeur ou quelle image te reste de ta journée ?', 'What sound, smell or image stays with you from today?'],
  [A, 'Qu’as-tu mangé de bon aujourd’hui ?', 'What did you eat that was good today?', 'manger repas dejeuner diner restaurant cuisine cafe crepes'],
  [C, 'Où étais-tu au moment le plus calme de ta journée ?', 'Where were you at the calmest moment of your day?'],
  [A, 'Qu’est-ce que tu as fait juste pour toi aujourd’hui ?', 'What did you do just for yourself today?'],
  [A, 'Si ta journée était une couleur, laquelle serait-ce ?', 'If your day were a colour, which one would it be?'],
  [A, 'Quelle petite chose a bien marché aujourd’hui ?', 'What small thing went well today?'],
  [A, 'Qu’est-ce qui t’a pris le plus d’énergie aujourd’hui ?', 'What took the most energy out of you today?', 'fatigue epuise energie'],
  [A, 'Qu’aurais-tu aimé faire de plus aujourd’hui ?', 'What would you have liked to do more of today?'],
  [A, 'Quelle conversation te reste en tête ?', 'Which conversation is still on your mind?', 'parle discute conversation appel telephone'],
  [A, 'Quel a été le premier moment agréable de ta journée ?', 'What was the first nice moment of your day?', 'matin reveil'],
  [A, 'Qu’est-ce que tu as vu dehors aujourd’hui ?', 'What did you see outside today?', 'dehors rue balade marche'],
  [A, 'À quel moment de la journée étais-tu le plus à l’aise ?', 'At what moment of the day were you most at ease?'],
  // les personnes
  [A, 'Qui aimerais-tu remercier aujourd’hui, et pour quoi ?', 'Who would you like to thank today, and for what?', 'merci remercier aide'],
  [A, 'À qui as-tu pensé aujourd’hui ?', 'Who did you think about today?', 'pense manque'],
  [A, 'Qu’est-ce qu’une personne t’a dit aujourd’hui qui te reste en tête ?', 'What did someone tell you today that stayed with you?', 'dit parole conseil'],
  [P, 'Qui t’a fait rire dernièrement ?', 'Who made you laugh lately?', 'rire drole blague ami amis'],
  [A, 'Y a-t-il quelqu’un à qui tu aimerais écrire ?', 'Is there someone you’d like to write to?', 'manque loin message'],
  [A, 'Qu’est-ce que tu admires chez une personne proche de toi ?', 'What do you admire in someone close to you?', 'ami amie famille maman papa frere soeur'],
  [A, 'Avec qui aimerais-tu passer ta prochaine soirée ?', 'Who would you like to spend your next evening with?', 'soiree soir sortie'],
  [A, 'Quel souvenir partages-tu avec quelqu’un que tu as vu aujourd’hui ?', 'What memory do you share with someone you saw today?', 'souvenir ami amie retrouvailles'],
  [A, 'Qui t’a donné un coup de main récemment ?', 'Who gave you a hand recently?', 'aide aider service'],
  [A, 'De qui as-tu eu des nouvelles aujourd’hui ?', 'Who did you hear from today?', 'message appel nouvelles telephone'],
  // les lieux
  [A, 'Dans quel endroit te sentais-tu bien aujourd’hui ?', 'Where did you feel good today?', 'endroit lieu maison parc'],
  [A, 'Quel lieu aimerais-tu revoir bientôt ?', 'Which place would you like to see again soon?', 'voyage vacances lieu ville mer montagne'],
  [C, 'Décris l’endroit où tu es en train d’écrire.', 'Describe the place where you are writing right now.'],
  [P, 'Où aimerais-tu te réveiller demain ?', 'Where would you like to wake up tomorrow?', 'voyage vacances reve'],
  [A, 'Quel chemin as-tu pris aujourd’hui ?', 'Which way did you go today?', 'trajet route train bus metro velo voiture marche'],
  // la joie
  [P, 'Qu’est-ce que tu as réussi aujourd’hui ?', 'What did you pull off today?', 'reussi reussite gagne fini termine'],
  [J, 'Quelle bonne nouvelle as-tu reçue récemment ?', 'What good news did you get recently?', 'nouvelle bonne genial super'],
  [P, 'Qu’est-ce qui t’a donné de l’énergie aujourd’hui ?', 'What gave you energy today?', 'energie motivation sport'],
  [J, 'Quel moment voudrais-tu revivre ?', 'Which moment would you like to live again?', 'genial super magique'],
  [J, 'Qu’est-ce qui t’a fait rire aux éclats ?', 'What made you burst out laughing?', 'rire rigole drole'],
  [J, 'Quel compliment aimerais-tu te faire ce soir ?', 'What compliment would you like to give yourself tonight?'],
  [J, 'Qu’est-ce qui rendait ce moment si bon ?', 'What made that moment so good?', 'bien bon super genial adore'],
  [J, 'Comment as-tu fêté ça ?', 'How did you celebrate?', 'fete anniversaire celebrer'],
  // les jours lourds
  [N, 'Qu’est-ce qui pèse le plus en ce moment ?', 'What weighs on you the most right now?', 'triste lourd difficile dur stress'],
  [N, 'De quoi aurais-tu besoin ce soir ?', 'What would you need tonight?', 'besoin fatigue seul'],
  [N, 'Qu’est-ce qui t’a fait du bien, malgré tout ?', 'What did you good, despite everything?'],
  [N, 'Qu’est-ce que tu dirais à un ami qui vit la même chose ?', 'What would you tell a friend going through the same thing?'],
  [N, 'Qu’est-ce qui pourrait rendre demain un peu plus doux ?', 'What could make tomorrow a little gentler?', 'demain'],
  [M, 'Qui pourrait t’écouter, si tu en as envie ?', 'Who could listen to you, if you feel like it?', 'seul solitude parler'],
  [N, 'Qu’est-ce que tu as le droit de laisser de côté aujourd’hui ?', 'What are you allowed to set aside today?', 'trop travail stress'],
  [M, 'Qu’est-ce qui te manque en ce moment ?', 'What do you miss right now?', 'manque loin absent'],
  [M, 'Quelle petite chose pourrait te réconforter ce soir ?', 'What small thing could comfort you tonight?', 'triste pleure'],
  [M, 'Si tu pouvais poser ce poids quelque part, où le poserais-tu ?', 'If you could put this weight down somewhere, where would it be?', 'lourd poids'],
  // la tempête
  [T, 'Qu’est-ce qui t’agace le plus en ce moment ?', 'What annoys you the most right now?', 'colere enerve agace'],
  [T, 'Qu’est-ce que tu n’as pas pu dire aujourd’hui ? Écris-le ici.', 'What couldn’t you say today? Write it here.', 'dispute colere'],
  [T, 'Qu’est-ce qui dépend de toi, et qu’est-ce qui n’en dépend pas ?', 'What is up to you, and what isn’t?', 'stress probleme'],
  [T, 'Comment pourrais-tu relâcher la pression ce soir ?', 'How could you let off some pressure tonight?', 'stress pression'],
  [T, 'Qu’est-ce qui te calmerait, là, maintenant ?', 'What would calm you down right now?', 'colere stress'],
  [T, 'Dans une semaine, est-ce que ça comptera encore ?', 'In a week, will this still matter?'],
  [T, 'Qu’est-ce que cette colère essaie de te dire ?', 'What is this anger trying to tell you?', 'colere'],
  // le calme
  [C, 'Qu’est-ce qui était doux aujourd’hui ?', 'What was gentle today?', 'doux calme tranquille'],
  [C, 'Quel moment de silence as-tu eu aujourd’hui ?', 'What moment of silence did you have today?'],
  [C, 'Comment est le ciel ce soir ?', 'What does the sky look like tonight?', 'ciel nuit etoiles lune'],
  [C, 'Qu’est-ce que tu entends autour de toi, là ?', 'What can you hear around you right now?'],
  [C, 'Quel petit rituel t’a fait du bien aujourd’hui ?', 'What little ritual did you good today?', 'the cafe bain lecture'],
  [C, 'Qu’est-ce qui t’apaise le plus ces jours-ci ?', 'What soothes you the most these days?'],
  // l'élan et les projets
  [E, 'Qu’est-ce que tu as envie de faire demain ?', 'What do you feel like doing tomorrow?', 'demain envie'],
  [E, 'Quel petit pas peux-tu faire demain vers un projet qui te tient à cœur ?', 'What small step can you take tomorrow toward a project you care about?', 'projet objectif'],
  [P, 'Qu’est-ce qui t’enthousiasme en ce moment ?', 'What excites you right now?', 'hate envie projet'],
  [E, 'Quelle idée t’est venue aujourd’hui ?', 'What idea came to you today?', 'idee creer projet'],
  [P, 'Qu’est-ce que tu attends avec impatience cette semaine ?', 'What are you looking forward to this week?', 'hate bientot semaine'],
  [E, 'Qu’est-ce que tu aimerais apprendre ?', 'What would you like to learn?', 'apprendre cours'],
  [A, 'Si tu avais une journée libre demain, que ferais-tu ?', 'If you had a free day tomorrow, what would you do?'],
  [E, 'Quel rêve aimerais-tu commencer à réaliser cette année ?', 'Which dream would you like to start making real this year?', 'reve projet'],
  // le travail, les études
  [A, 'Qu’est-ce qui s’est bien passé au travail ou en cours aujourd’hui ?', 'What went well at work or in class today?', 'travail boulot bureau collegue reunion cours ecole etudes examen client projet'],
  [A, 'Quelle tâche as-tu enfin terminée ?', 'Which task did you finally finish?', 'travail fini termine tache'],
  [A, 'Qu’est-ce qui t’a demandé le plus d’effort aujourd’hui ?', 'What took the most effort today?', 'travail difficile effort'],
  [A, 'Qu’est-ce que tu ferais différemment demain ?', 'What would you do differently tomorrow?', 'travail erreur rate'],
  // le corps
  [A, 'Comment va ton corps ce soir ?', 'How is your body feeling tonight?', 'fatigue mal dos tete malade'],
  [A, 'As-tu bien dormi la nuit dernière ?', 'Did you sleep well last night?', 'dormi sommeil nuit fatigue reveil'],
  [A, 'As-tu bougé aujourd’hui ? Comment c’était ?', 'Did you move today? How was it?', 'sport course marche velo piscine salle'],
  [A, 'As-tu pris un moment pour souffler aujourd’hui ?', 'Did you take a moment to breathe today?', 'pause repos'],
  // la nature, le ciel
  [A, 'Qu’as-tu remarqué dans la nature aujourd’hui ?', 'What did you notice in nature today?', 'nature arbre foret parc fleurs oiseaux mer'],
  [A, 'Quel temps faisait-il aujourd’hui, et est-ce que ça a joué sur ton humeur ?', 'What was the weather like today, and did it affect your mood?', 'pluie soleil neige orage froid chaud'],
  [A, 'As-tu levé les yeux vers le ciel aujourd’hui ?', 'Did you look up at the sky today?', 'ciel nuages etoiles lune'],
  [C, 'Quel son, quelle odeur ou quelle lumière voudrais-tu garder de cette journée ?', 'What sound, smell or light from today would you like to keep?', 'odeur son musique lumiere couleur'],
  // la culture, la création
  [A, 'Qu’as-tu lu, écouté ou regardé de bien récemment ?', 'What good thing have you read, heard or watched lately?', 'livre film serie musique podcast lecture'],
  [A, 'Quelle chanson irait bien avec ta journée ?', 'Which song would go well with your day?', 'musique chanson'],
  [E, 'Qu’as-tu créé ou fabriqué récemment ?', 'What have you made or created lately?', 'dessin creation cuisine bricolage ecrire'],
  [A, 'Quelle phrase te trotte dans la tête ?', 'Which sentence keeps running through your head?'],
  // toi
  [A, 'Qu’est-ce que tu as compris sur toi récemment ?', 'What have you understood about yourself lately?'],
  [A, 'Quelles sont trois choses qui méritent un merci aujourd’hui ?', 'What are three things that deserve a thank-you today?', 'merci gratitude'],
  [A, 'Qu’est-ce que tu veux te rappeler dans un an ?', 'What do you want to remember a year from now?'],
  [A, 'Qu’est-ce qui a changé chez toi cette année ?', 'What has changed in you this year?'],
  [A, 'Quelle habitude aimerais-tu garder ?', 'Which habit would you like to keep?', 'habitude routine'],
  [N, 'Qu’est-ce que tu te pardonnes aujourd’hui ?', 'What do you forgive yourself for today?', 'erreur rate faute'],
  [A, 'Qu’est-ce qui compte vraiment pour toi en ce moment ?', 'What really matters to you right now?'],
  [A, 'Quelle question aimerais-tu qu’on te pose ?', 'What question would you like someone to ask you?'],
  [A, 'Si tu écrivais à toi enfant, que lui dirais-tu ?', 'If you wrote to yourself as a child, what would you say?', 'enfance enfant'],
  // pour continuer ce qu'on a commencé
  [A, 'Et ensuite, que s’est-il passé ?', 'And then, what happened?', '', 1],
  [A, 'Pourquoi ce moment compte-t-il pour toi ?', 'Why does this moment matter to you?', '', 1],
  [A, 'Qu’est-ce que tu ressentais à ce moment-là ?', 'What were you feeling at that moment?', '', 1],
  [A, 'Qu’aimerais-tu dire à cette personne ?', 'What would you like to say to this person?', 'ami amie maman papa frere soeur', 1],
];
export const QUESTIONS = Q.map(([m, fr, en, k = '', suite = 0], i) => ({ id: i, m, fr, en, k, suite: !!suite }));

const CLE = 'constellation.questions.v1';
const vus = () => { try { return JSON.parse(localStorage.getItem(CLE)) || []; } catch (e) { return []; } };
let vecs = null;
// une question qui colle : par le sens si du texte existe, sinon selon l'humeur ; jamais une des 40 dernières posées
export function questionPour(texte, humeur) {
  const deja = new Set(vus()), brut = (texte || '').trim(), okHumeur = q => q.m.includes('*') || q.m.includes(humeur);
  let l = QUESTIONS.filter(q => !deja.has(q.id) && (brut ? true : !q.suite) && okHumeur(q));
  if (!l.length) l = QUESTIONS.filter(q => !q.suite && okHumeur(q));
  let choisie;
  if (brut.length > 12) {
    if (!vecs) vecs = QUESTIONS.map(q => legere(q.fr + ' ' + q.k));
    const v = legere(brut), notes = l.map(q => ({ q, s: cos(v, vecs[q.id]) + (q.m.includes(humeur) ? .04 : 0) + (q.suite ? .03 : 0) + Math.random() * .03 })).sort((a, b) => b.s - a.s);
    choisie = notes[0].s > .08 ? notes[0].q : (l.filter(q => q.suite)[Math.floor(Math.random() * l.filter(q => q.suite).length)] || notes[0].q);
  } else {
    const h = l.filter(q => q.m.includes(humeur)), pool = h.length && Math.random() < .6 ? h : l;
    choisie = pool[Math.floor(Math.random() * pool.length)];
  }
  try { localStorage.setItem(CLE, JSON.stringify([...vus(), choisie.id].slice(-40))); } catch (e) {}
  return EN ? choisie.en : choisie.fr;
}
