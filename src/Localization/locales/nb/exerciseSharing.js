// Det øvelsestjenesten sier når deling, tillegging eller rapportering feiler.
export default {
  // Kastet av src/Services/exerciseService.js og vist som error.message.
  errors: {
    offline: "Du er frakoblet. Prøv igjen når du har tilkobling.",
    signedOut: "Logg inn for å dele og legge til øvelser.",
    notAvailable: "Delte øvelser er ikke tilgjengelige ennå. Prøv igjen senere.",
    notFound: "Denne øvelsen finnes ikke på denne telefonen.",
    exerciseGone: "Denne øvelsen deles ikke lenger.",
    copyCannotBeShared: "Dette er en kopi av en annens øvelse, så den kan ikke deles.",
    nameTaken: "Du har allerede en øvelse med dette navnet.",
    blockedTerms:
      "Noe i navnet, beskrivelsen eller stegene kan ikke deles. Endre ordlyden og prøv igjen.",
    videoTooLong: "Klippet kan være maks {seconds} sekunder langt.",
    videoTooLarge: "Klippet kan være maks {megabytes} MB.",
    uploadFailed: "Klippet kunne ikke lastes opp. Prøv igjen.",
    generic: "Noe gikk galt. Prøv igjen.",
  },
};
