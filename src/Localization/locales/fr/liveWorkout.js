//
// La carte de l'écran verrouillé pendant une séance de force. Elle est dessinée en natif
// et ne traduit rien elle-même, donc chaque mot qu'elle affiche est ici -
// y compris les modèles qu'elle remplit : {set}, {name}, {n}, {total},
// {duration}, {done} et {time} sont remplacés sur le téléphone, tels quels.
export default {
  complete: "Série faite",
  // Le bouton, avec la série qu'il coche.
  completeSetOf: "Série {n} sur {total} faite",
  // Le repos après une série sans durée écrite compte en avançant ; écran verrouillé uniquement.
  endRest: "Fin du repos",
  skip: "Passer",
  prev: "Précédent",
  next: "Suivant",
  nowEyebrow: "SÉRIE EN COURS",
  nextEyebrow: "SÉRIE SUIVANTE",
  pause: "REPOS",
  sets: "SÉRIES",
  exercise: "EXERCICE",
  nextSet: "Suivant : {set}",
  nextExercise: "Suivant : {name}",
  setOf: "série {n} sur {total}",
  setOfTitle: "Série {n} sur {total}",
  setShort: "série {n}/{total}",
  of: "sur {duration}",
  setsCount: "{done}/{total} séries",
  restClock: "Repos · {time}",
  restSub: "repos",
  allDone: "Toutes les séries sont faites",
  allDoneQuestion: "Terminer la séance ?",
  finish: "Terminer",
  noSets: "Pas encore de série",
  // Les boutons de poids sur la carte ouverte d'Android : « 2,5 kg » entre un − et un +.
  weightStep: "{step} {unit}",
  a11yWeightMinus: "Retirer {step} {unit} de la série",
  a11yWeightPlus: "Ajouter {step} {unit} à la série",
  // Les canaux de notification Android, tels que les réglages du téléphone les listent.
  channelName: "Séance en cours",
  restChannelName: "Repos terminé",
  restFinishedTitle: "Le repos est terminé",
  restFinishedBody: "C'est l'heure de la prochaine série.",
};
