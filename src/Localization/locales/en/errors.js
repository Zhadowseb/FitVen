// Messages thrown by the services that reach the screen. Keep in step with ../da/errors.js.
export default {
  socialPost: {
    signInToUpdatePostSettings: "You need to be signed in to update social post settings.",
    signInToUpdateExerciseSettings: "You need to be signed in to update exercise settings.",
    exerciseNotSynced: "This exercise has not synced to Supabase yet.",
    signInToEditPosts: "You need to be signed in to edit workout posts.",
    signInToDeletePosts: "You need to be signed in to delete workout posts.",
    signInToLikePosts: "You need to be signed in to like workout posts.",
  },
  notifications: {
    functionNotDeployed: 'Supabase Edge Function "{name}" is not deployed yet.',
    functionFailed: "{name} failed ({status}): {body}",
    projectIdMissing: "Expo projectId is missing from app config.",
  },
  auth: {
    functionFailed: "{name} failed ({status}): {body}",
  },
  admin: {
    unknownFeedbackStatus: "Unknown feedback status: {status}",
  },
  feedback: {
    messageRequired: "Feedback message is required.",
  },
  music: {
    spotifyAnswered: "Spotify answered {status}.",
  },
};
