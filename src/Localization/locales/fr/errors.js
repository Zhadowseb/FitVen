// Messages levés par les services qui arrivent jusqu'à l'écran.
export default {
  socialPost: {
    signInToUpdatePostSettings: "Tu dois être connecté pour modifier les réglages des publications.",
    signInToUpdateExerciseSettings: "Tu dois être connecté pour modifier les réglages des exercices.",
    exerciseNotSynced: "Cet exercice n'est pas encore synchronisé avec Supabase.",
    signInToEditPosts: "Tu dois être connecté pour modifier les publications de séances.",
    signInToDeletePosts: "Tu dois être connecté pour supprimer les publications de séances.",
    signInToLikePosts: "Tu dois être connecté pour aimer les publications de séances.",
  },
  notifications: {
    functionNotDeployed: "La fonction Edge Supabase « {name} » n'est pas encore déployée.",
    functionFailed: "{name} a échoué ({status}) : {body}",
    projectIdMissing: "Le projectId Expo est absent de la configuration de l'app.",
  },
  auth: {
    functionFailed: "{name} a échoué ({status}) : {body}",
  },
  admin: {
    unknownFeedbackStatus: "Statut de commentaire inconnu : {status}",
  },
  feedback: {
    messageRequired: "Le message de commentaire est obligatoire.",
  },
  music: {
    spotifyAnswered: "Spotify a répondu {status}.",
  },
};
