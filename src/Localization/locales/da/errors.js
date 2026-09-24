// Beskeder fra services, der ender på skærmen. Holdes i trit med ../en/errors.js.
export default {
  socialPost: {
    signInToUpdatePostSettings: "Du skal være logget ind for at ændre indstillinger for opslag.",
    signInToUpdateExerciseSettings: "Du skal være logget ind for at ændre indstillinger for øvelser.",
    exerciseNotSynced: "Øvelsen er ikke synkroniseret til Supabase endnu.",
    signInToEditPosts: "Du skal være logget ind for at redigere træningsopslag.",
    signInToDeletePosts: "Du skal være logget ind for at slette træningsopslag.",
    signInToLikePosts: "Du skal være logget ind for at like træningsopslag.",
  },
  notifications: {
    functionNotDeployed: 'Supabase Edge Function "{name}" er ikke udrullet endnu.',
    functionFailed: "{name} fejlede ({status}): {body}",
    projectIdMissing: "Expo projectId mangler i app-konfigurationen.",
  },
  auth: {
    functionFailed: "{name} fejlede ({status}): {body}",
  },
  admin: {
    unknownFeedbackStatus: "Ukendt feedbackstatus: {status}",
  },
  feedback: {
    messageRequired: "Skriv en besked først.",
  },
  music: {
    spotifyAnswered: "Spotify svarede {status}.",
  },
};
