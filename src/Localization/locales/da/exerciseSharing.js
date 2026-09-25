// What the exercise service says when sharing, adding or reporting fails. Keep in step with ../en/exerciseSharing.js.
export default {
  errors: {
    offline: "Du er offline. Prøv igen, når du har forbindelse.",
    signedOut: "Log ind for at dele og tilføje øvelser.",
    notAvailable: "Delte øvelser er ikke tilgængelige endnu. Prøv igen senere.",
    notFound: "Øvelsen findes ikke på denne telefon.",
    exerciseGone: "Øvelsen er ikke længere delt.",
    copyCannotBeShared: "Det er en kopi af en andens øvelse, så den kan ikke deles.",
    nameTaken: "Du har allerede en øvelse med det navn.",
    blockedTerms:
      "Noget i navnet, beskrivelsen eller trinene kan ikke deles. Skriv det om, og prøv igen.",
    videoTooLong: "Klippet må højst vare {seconds} sekunder.",
    videoTooLarge: "Klippet må højst fylde {megabytes} MB.",
    uploadFailed: "Klippet kunne ikke uploades. Prøv igen.",
    generic: "Noget gik galt. Prøv igen.",
  },
};
