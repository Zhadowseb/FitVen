// La boîte de réception des notifications et ses réglages.
export default {
  title: "Notifications",
  loading: "Chargement des notifications…",
  unavailable: "Notifications indisponibles",
  signInToView: "Connecte-toi pour voir les notifications.",
  loadFailed: "Impossible de charger les notifications.",
  unread: "Non lues",
  itemLabel: "{title}. {body}",
  hints: {
    openActivity: "Ouvre l'activité du jour",
    openExercise: "Ouvre ton exercice",
    openPost: "Ouvre ta publication",
  },
  // La ligne de la boîte de réception que le serveur écrit quand trois personnes ont signalé
  // un de tes exercices partagés. Le titre et le corps du serveur sont en anglais ; voici
  // ce que la page affiche à la place.
  customExerciseHidden: {
    title: "Ton exercice a été masqué",
    body: "{name} a été signalé par plusieurs personnes et n'apparaît plus dans la bibliothèque. Les copies déjà ajoutées restent.",
  },
  // La ligne de la boîte de réception que le serveur écrit quand quelqu'un aime une de tes publications.
  // {name} est la personne qui a aimé ; le corps est la séance de la publication.
  postLiked: {
    title: "{name} a aimé ta publication",
    bodyFallback: "Ta publication de séance",
    someone: "Quelqu'un",
  },
  emptyTitle: "Tu es à jour",
  emptyBody: "Quand quelqu'un démarre une séance ou aime une de tes publications, tu le verras ici.",
  openSettings: "Ouvrir les réglages de notification",

  settings: {
    eyebrow: "Réglages",
    lockScreenTitle: "Afficher la séance sur l'écran verrouillé",
    lockScreenBody:
      "Pendant ta séance de force, la série, le repos et le temps s'affichent sur l'écran verrouillé et dans la Dynamic Island, avec des boutons pour cocher la série et passer le repos. Un son t'indique quand le repos est terminé.",
    lockScreenUnavailable:
      "Ton téléphone n'affiche pas la carte pour le moment. Sur iPhone, il faut iOS 16.2 ou plus récent, avec les Activités en direct activées pour FitVen dans Réglages.",
    signInToManage: "Connecte-toi pour gérer les réglages de notification.",
    loadFailed: "Impossible de charger les réglages de notification.",
    saveFailed: "Impossible d'enregistrer les réglages de notification.",
    updateSourcesFailed: "Impossible de mettre à jour la liste de notifications personnalisée.",
    // La préférence est enregistrée dans tous les cas ; voici pourquoi l'appareil lui-même
    // peut quand même ne rien recevoir.
    savedPermissionDenied:
      "Enregistré. L'autorisation de notification n'a pas été accordée sur cet appareil.",
    savedBlockedByOwner:
      "Enregistré. Un autre compte est encore connecté aux notifications sur cet appareil, celui-ci ne les recevra donc pas encore. Déconnecte l'autre compte, ou attends une semaine qu'il soit libéré.",
    savedRegistrationFailed:
      "Enregistré. Cet appareil n'a pas pu s'inscrire aux notifications push, il risque donc de ne pas les recevoir pour l'instant.",
    postLikesTitle: "Quand quelqu'un aime ta publication",
    postLikesBody:
      "Reçois une notification quand quelqu'un aime une de tes publications de séance. Une fois par personne et par publication.",
    postLikesUnavailable:
      "Ce réglage n'est pas encore disponible. Les mentions J'aime ne sont pas annoncées tant qu'il ne l'est pas.",
    postLikesSaveFailed: "Impossible d'enregistrer le réglage des mentions J'aime.",
    workoutStartTitle: "Quand une séance démarre",
    workoutStartBody:
      "Choisis qui déclenche une notification en commençant à s'entraîner.",
    modes: {
      none: {
        title: "Aucune notification",
        body: "Aucune notification quand quelqu'un démarre une séance.",
      },
      following: {
        title: "Toutes les personnes que je suis",
        body: "Reçois une notification quand une personne que tu suis démarre une séance.",
      },
      custom: {
        title: "Choisir des personnes précises",
        body: "Seulement les personnes que tu choisis ci-dessous.",
      },
    },
    selectedCount: "SÉLECTION ({count})",
    removeNamed: "Retirer {name}",
    personFallback: "personne",
    nobodySelected: "Personne n'est encore sélectionné. Choisis des personnes dans la liste ci-dessous.",
    searchPlaceholder: "Chercher parmi les personnes que tu suis",
    noMatches: "Aucune personne suivie ne correspond.",
  },

  // Levées par Services/notificationService.js et affichées comme error.message.
  errors: {
    signInToLoadSettings:
      "Tu dois être connecté pour charger les réglages de notification.",
    signInToUpdateSettings:
      "Tu dois être connecté pour modifier les réglages de notification.",
    signInToLoad: "Tu dois être connecté pour charger les notifications.",
  },
};
