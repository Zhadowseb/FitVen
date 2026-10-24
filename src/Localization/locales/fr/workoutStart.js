// La feuille de démarrage de séance derrière le bouton central de navigation : les tuiles de
// démarrage à zéro, le raccourci de la séance prévue aujourd'hui et la liste de séances à refaire.
export default {
  title: "NOUVELLE SÉANCE",
  titleForDate: "Que fais-tu le {date} ?",
  closeSheet: "Fermer le lanceur de séance",
  workoutCalendar: "Calendrier des séances",
  ready: "Prête",
  recent: "Récentes",
  suggested: "SUGGÉRÉES",
  timesCount: "{count}x",
  types: {
    resistance: "Musculation",
    run: "Course",
    walk: "Marche",
    workout: "Séance",
  },
  planned: {
    promptSingleToday: "Tu as une séance prévue aujourd'hui.",
    promptSingleOnDay: "Tu as une séance prévue ce jour-là.",
    promptMultipleToday: "Tu as plusieurs séances prévues aujourd'hui.",
    promptMultipleOnDay: "Tu as plusieurs séances prévues ce jour-là.",
    eyebrowToday: "PRÉVUE AUJOURD'HUI",
    eyebrow: "PRÉVUE",
    workoutsPlanned: {
      one: "{count} séance prévue",
      other: "{count} séances prévues",
    },
    countReady: "Prêtes : {count}",
    detailWithExercises: {
      one: "{programName} - {count} exercice",
      other: "{programName} - {count} exercices",
    },
    detailReady: "{programName} - Prête",
  },
  usual: {
    title: "TES SÉANCES HABITUELLES",
    manage: "Gérer",
    loading: "Recherche de tes séances habituelles…",
    empty: "Fais une séance deux fois pour la voir ici.",
  },
  repeat: {
    title: "REFAIRE UNE SÉANCE",
    loading: "Chargement des séances récentes…",
    loadingMore: "Chargement d'autres séances…",
    empty: "Fais une séance deux fois pour la voir ici.",
    showExercises: "Afficher les exercices de {title}",
    hideExercises: "Masquer les exercices de {title}",
    noExercises: "Aucun exercice dans cette séance.",
  },
};
