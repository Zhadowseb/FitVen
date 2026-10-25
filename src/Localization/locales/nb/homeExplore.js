// Hjems "Fra Utforsk"-rad: en rad med kort fra Utforsk - senteret ditt, nye
// øvelser, innlegg fra sentre, Danmarks sterkeste - og inngangene for
// den som ikke har noen av dem ennå. Navnet på biblioteket er
// explore.customExercises.title og "{n} brukere" er customExercises.users.
export default {
  title: "Fra Utforsk",
  open: "Åpne",
  openA11y: "Åpne Utforsk",
  loadingA11y: "Laster kort fra Utforsk",
  // Det en skjermleser sier for et kort: "Senteret ditt: 3 nye rekorder, Anna, for 2 t siden".
  cardA11y: "{kicker}: {title}, {meta}",
  cardA11yShort: "{kicker}: {title}",
  // En rekord: "Benkpress · 120 kg".
  liftTitle: "{exercise} · {weight} kg",
  // Linjen over hver tittel: hva slags kort det er.
  kickers: {
    gymRecords: "Senteret ditt",
    exercise: "Ny øvelse",
    centrePost: "Innlegg",
    strongest: "Danmarks sterkeste",
    findGym: "Sentre",
    customExercises: "Øvelser",
  },
  gymRecords: {
    newRecords: { one: "{value} ny rekord", other: "{value} nye rekorder" },
    seeRecords: "Se rekordene til senteret",
  },
  findGym: {
    title: "Finn senteret ditt",
    meta: "Rekorder og innlegg fra der du trener",
  },
  customExercises: {
    meta: "Del en av dine egne",
  },
};
