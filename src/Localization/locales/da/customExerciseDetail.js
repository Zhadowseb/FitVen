// Én delt øvelse (skærm 1b), og at rapportere den. Hold i trit med
// ../en/customExerciseDetail.js. Ordene alle skærme om en delt øvelse bruger -
// mærkaterne, "{n} bruger", "Dig", "dit center", "Ingen video" - ligger i
// customExercises.
export default {
  // Toasten på den skærm, man kom tilbage til.
  added: "{name} er tilføjet til dine øvelser",
  menu: {
    open: "Flere muligheder",
    report: "Rapportér øvelsen",
  },
  video: {
    play: "Afspil videoen",
    pause: "Sæt videoen på pause",
    unavailable: "Videoen kan ikke afspilles lige nu",
    needsUpdate: "Opdater appen for at se videoen",
  },
  owner: {
    madeOn: "Lavede den {date}",
    profile: "Profil",
    openProfile: "Åbn profilen for {name}",
    someone: "En FitVen-bruger",
  },
  stats: {
    users: "Bruger den",
    gymUsers: "I dit center",
    noGym: "Intet center",
    noGymLabel: "I dit center: du har ikke valgt et center",
    typical: "Typisk",
    unknown: "ikke kendt endnu",
  },
  steps: {
    title: "Sådan laves den",
    step: "Trin {number}: {text}",
  },
  distribution: {
    title: "Hvad andre løfter",
    typicalWeightReps: {
      one: "typisk {weight} kg til {reps} gentagelse",
      other: "typisk {weight} kg til {reps} gentagelser",
    },
    typicalWeight: "typisk {weight} kg",
    typicalReps: { one: "typisk {reps} gentagelse", other: "typisk {reps} gentagelser" },
    rangeUnder: "under {to} kg",
    rangeOver: "{from} kg eller mere",
    rangeBetween: "{from} til {to} kg",
    summary: {
      one: "Hvad andre løfter: oftest {range}, ud fra {sets} logget sæt.",
      other: "Hvad andre løfter: oftest {range}, ud fra {sets} loggede sæt.",
    },
  },
  actions: {
    add: "Tilføj til mine øvelser",
    adding: "Tilføjer…",
    added: "Tilføjet",
    edit: "Rediger din øvelse",
    save: "Gem",
    saved: "Gemt",
  },
  nameTaken: "Du har allerede en øvelse, der hedder {name}, så den her kan ikke tilføjes.",
  addFailed: "Den kunne ikke tilføjes. Prøv igen.",
  saveFailed: "Det gik ikke igennem. Prøv igen.",
  footnote: "Navn, udstyr og muskelgruppe kopieres til dine øvelser – ikke ejerens sæt.",
  footnoteMine: "Den, der tilføjer den, får navn, udstyr og muskelgruppe – aldrig dine sæt.",
  unavailable: {
    title: "Øvelsen er ikke længere tilgængelig",
    body: "Den kan være fjernet, eller også deles den ikke længere.",
  },
  error: {
    title: "Øvelsen kunne ikke hentes",
    body: "Noget gik galt undervejs. Prøv igen om lidt.",
  },
  offline: {
    title: "Du er offline",
    body: "Opret forbindelse til internettet for at se øvelsen.",
  },
  report: {
    title: "Rapportér øvelsen",
    message:
      "Fortæl os, hvad der er galt. Rapporter læses af udvikleren, og ejeren får aldrig at vide, hvem der har sendt en.",
    reasons: {
      wrong: "Forkert eller misvisende",
      offensive: "Stødende",
      duplicate: "Dublet",
      other: "Andet",
    },
    notePlaceholder: "Er der andet, vi bør vide? (valgfrit)",
    send: "Send rapport",
    thanks: "Tak – vi kigger på den.",
    failed: "Rapporten kunne ikke sendes. Prøv igen.",
  },
};
