// Meldungen der Services, die den Screen erreichen.
export default {
  socialPost: {
    signInToUpdatePostSettings: "Du musst angemeldet sein, um die Einstellungen für Social-Posts zu ändern.",
    signInToUpdateExerciseSettings: "Du musst angemeldet sein, um die Übungseinstellungen zu ändern.",
    exerciseNotSynced: "Diese Übung wurde noch nicht mit Supabase synchronisiert.",
    signInToEditPosts: "Du musst angemeldet sein, um Workout-Beiträge zu bearbeiten.",
    signInToDeletePosts: "Du musst angemeldet sein, um Workout-Beiträge zu löschen.",
    signInToLikePosts: "Du musst angemeldet sein, um Workout-Beiträge zu liken.",
  },
  notifications: {
    functionNotDeployed: "Die Supabase Edge Function „{name}“ ist noch nicht bereitgestellt.",
    functionFailed: "{name} fehlgeschlagen ({status}): {body}",
    projectIdMissing: "In der App-Konfiguration fehlt die Expo-projectId.",
  },
  auth: {
    functionFailed: "{name} fehlgeschlagen ({status}): {body}",
  },
  admin: {
    unknownFeedbackStatus: "Unbekannter Feedback-Status: {status}",
  },
  feedback: {
    messageRequired: "Eine Feedback-Nachricht ist erforderlich.",
  },
  music: {
    spotifyAnswered: "Spotify hat mit {status} geantwortet.",
  },
};
