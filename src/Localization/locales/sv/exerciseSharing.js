// What the exercise service says when sharing, adding or reporting fails.
export default {
  // Thrown by src/Services/exerciseService.js and shown as error.message.
  errors: {
    offline: "Du är offline. Försök igen när du har en anslutning.",
    signedOut: "Logga in för att dela och lägga till övningar.",
    notAvailable: "Delade övningar är inte tillgängliga än. Försök igen senare.",
    notFound: "Den här övningen finns inte på den här telefonen.",
    exerciseGone: "Den här övningen delas inte längre.",
    copyCannotBeShared: "Det här är en kopia av någon annans övning, så den kan inte delas.",
    nameTaken: "Du har redan en övning med det här namnet.",
    blockedTerms:
      "Något i namnet, beskrivningen eller stegen kan inte delas. Ändra formuleringen och försök igen.",
    videoTooLong: "Klippet får vara högst {seconds} sekunder långt.",
    videoTooLarge: "Klippet får vara högst {megabytes} MB.",
    uploadFailed: "Klippet kunde inte laddas upp. Försök igen.",
    generic: "Något gick fel. Försök igen.",
  },
};
