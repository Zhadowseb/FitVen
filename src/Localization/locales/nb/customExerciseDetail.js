// Én delt øvelse (skjerm 1b), og det å rapportere den.
// Ordene alle skjermene om en delt øvelse bruker - taggene, "{n} brukere",
// "Du", "senteret ditt", "Ingen video" - ligger i customExercises.
export default {
  // Meldingen på skjermen du gikk tilbake til.
  added: "{name} er lagt til i øvelsene dine",
  menu: {
    open: "Flere valg",
    report: "Rapporter øvelsen",
  },
  video: {
    play: "Spill av videoen",
    pause: "Sett videoen på pause",
    unavailable: "Videoen kan ikke spilles av akkurat nå",
    needsUpdate: "Oppdater appen for å spille av videoen",
  },
  owner: {
    madeOn: "Laget {date}",
    profile: "Profil",
    openProfile: "Åpne profilen til {name}",
    someone: "En FitVen-bruker",
  },
  stats: {
    users: "Bruker den",
    gymUsers: "På senteret ditt",
    noGym: "Ikke noe senter",
    noGymLabel: "På senteret ditt: du har ikke valgt senter",
    typical: "Typisk",
    unknown: "ikke kjent ennå",
  },
  steps: {
    title: "Slik gjør du den",
    step: "Steg {number}: {text}",
  },
  distribution: {
    title: "Hva andre løfter",
    typicalWeightReps: {
      one: "vanligvis {weight} kg på {reps} rep",
      other: "vanligvis {weight} kg på {reps} reps",
    },
    typicalWeight: "vanligvis {weight} kg",
    typicalReps: { one: "vanligvis {reps} rep", other: "vanligvis {reps} reps" },
    rangeUnder: "under {to} kg",
    rangeOver: "{from} kg eller mer",
    rangeBetween: "{from} til {to} kg",
    summary: {
      one: "Hva andre løfter: oftest {range}, fra {sets} loggført sett.",
      other: "Hva andre løfter: oftest {range}, fra {sets} loggførte sett.",
    },
  },
  actions: {
    add: "Legg til i mine øvelser",
    adding: "Legger til…",
    added: "Lagt til",
    edit: "Rediger øvelsen din",
    save: "Lagre",
    saved: "Lagret",
  },
  nameTaken: "Du har allerede en øvelse som heter {name}, så denne kan ikke legges til.",
  addFailed: "Den kunne ikke legges til. Prøv igjen.",
  saveFailed: "Det gikk ikke gjennom. Prøv igjen.",
  footnote: "Navnet, utstyret og muskelgruppen kopieres til øvelsene dine – ikke eierens sett.",
  footnoteMine: "Alle som legger den til, får navnet, utstyret og muskelgruppen – aldri settene dine.",
  unavailable: {
    title: "Denne øvelsen er ikke lenger tilgjengelig",
    body: "Den kan ha blitt fjernet, eller den deles ikke lenger.",
  },
  error: {
    title: "Øvelsen kunne ikke lastes",
    body: "Noe gikk galt på veien. Prøv igjen om litt.",
  },
  offline: {
    title: "Du er frakoblet",
    body: "Koble til internett for å se denne øvelsen.",
  },
  report: {
    title: "Rapporter øvelsen",
    message:
      "Fortell oss hva som er galt. Rapporter leses av utvikleren, og eieren får aldri vite hvem som sendte dem.",
    reasons: {
      wrong: "Feil eller misvisende",
      offensive: "Støtende",
      duplicate: "En kopi",
      other: "Noe annet",
    },
    notePlaceholder: "Er det noe mer vi bør vite? (valgfritt)",
    send: "Send rapport",
    thanks: "Takk – vi tar en titt på den.",
    failed: "Rapporten kunne ikke sendes. Prøv igjen.",
  },
};
