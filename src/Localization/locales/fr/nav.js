// La barre de navigation du bas : libellés des onglets, bouton central, et les alertes
// que peut lever le flux de séance rapide qui se trouve derrière.
export default {
  tabs: {
    home: "ACCUEIL",
    train: "SÉANCES",
    feed: "Fil",
    explore: "EXPLORER",
    profile: "PROFIL",
  },
  centerButton: {
    activeRestTimer: "Minuteur de repos actif {time}",
    activeWorkoutTimer: "Minuteur de séance actif {time}",
    pausedWorkoutTimer: "Séance en pause {time}",
    startWorkout: "Démarrer la séance {workout}",
    createWorkout: "Créer une séance",
  },
  quickWorkout: {
    createFailedTitle: "Impossible de créer la séance",
    copyFailedTitle: "Impossible de copier la séance",
    pleaseTryAgain: "Réessaie.",
    programDayNotFound: "Le jour de programme sélectionné est introuvable.",
    recentCopyFailed: "La séance récente n'a pas pu être copiée.",
  },
};
