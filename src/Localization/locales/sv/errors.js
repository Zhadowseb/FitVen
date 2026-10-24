// Messages thrown by the services that reach the screen.
export default {
  socialPost: {
    signInToUpdatePostSettings: "Du måste vara inloggad för att ändra inställningar för sociala inlägg.",
    signInToUpdateExerciseSettings: "Du måste vara inloggad för att ändra övningsinställningar.",
    exerciseNotSynced: "Den här övningen har inte synkats till Supabase än.",
    signInToEditPosts: "Du måste vara inloggad för att redigera passinlägg.",
    signInToDeletePosts: "Du måste vara inloggad för att ta bort passinlägg.",
    signInToLikePosts: "Du måste vara inloggad för att gilla passinlägg.",
  },
  notifications: {
    functionNotDeployed: 'Supabase Edge Function "{name}" är inte driftsatt än.',
    functionFailed: "{name} misslyckades ({status}): {body}",
    projectIdMissing: "Expo projectId saknas i appkonfigurationen.",
  },
  auth: {
    functionFailed: "{name} misslyckades ({status}): {body}",
  },
  admin: {
    unknownFeedbackStatus: "Okänd feedbackstatus: {status}",
  },
  feedback: {
    messageRequired: "Ett feedbackmeddelande krävs.",
  },
  music: {
    spotifyAnswered: "Spotify svarade {status}.",
  },
};
