// Meldinger kastet av tjenestene som når skjermen.
export default {
  socialPost: {
    signInToUpdatePostSettings: "Du må være logget inn for å oppdatere innstillingene for sosiale innlegg.",
    signInToUpdateExerciseSettings: "Du må være logget inn for å oppdatere øvelsesinnstillingene.",
    exerciseNotSynced: "Denne øvelsen er ikke synkronisert til Supabase ennå.",
    signInToEditPosts: "Du må være logget inn for å redigere øktinnlegg.",
    signInToDeletePosts: "Du må være logget inn for å slette øktinnlegg.",
    signInToLikePosts: "Du må være logget inn for å like øktinnlegg.",
  },
  notifications: {
    functionNotDeployed: 'Supabase Edge Function «{name}» er ikke utgitt ennå.',
    functionFailed: "{name} feilet ({status}): {body}",
    projectIdMissing: "Expo projectId mangler i appkonfigurasjonen.",
  },
  auth: {
    functionFailed: "{name} feilet ({status}): {body}",
  },
  admin: {
    unknownFeedbackStatus: "Ukjent tilbakemeldingsstatus: {status}",
  },
  feedback: {
    messageRequired: "Tilbakemeldingen må ha en melding.",
  },
  music: {
    spotifyAnswered: "Spotify svarte {status}.",
  },
};
