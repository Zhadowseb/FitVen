// Homes "Fra Udforsk"-række: kort fra Udforsk - dit center, nye øvelser,
// opslag fra centre, Danmarks stærkeste - og vejene ind for den, der ikke har
// noget af det endnu. Bibliotekets navn er explore.customExercises.title, og
// "{n} bruger" er customExercises.users. Holdes i trit med ../en/homeExplore.js.
export default {
  title: "Fra Udforsk",
  open: "Åbn",
  openA11y: "Åbn Udforsk",
  loadingA11y: "Henter kort fra Udforsk",
  // Det, en skærmlæser siger for et kort: "Dit center: 3 nye rekorder, Anna, 2 t siden".
  cardA11y: "{kicker}: {title}, {meta}",
  cardA11yShort: "{kicker}: {title}",
  // En rekord: "Bænkpres · 120 kg".
  liftTitle: "{exercise} · {weight} kg",
  // Linjen over hver titel: hvad slags kort det er.
  kickers: {
    gymRecords: "Dit center",
    exercise: "Ny øvelse",
    centrePost: "Opslag",
    strongest: "Danmarks stærkeste",
    findGym: "Centre",
    customExercises: "Øvelser",
  },
  gymRecords: {
    newRecords: { one: "{value} ny rekord", other: "{value} nye rekorder" },
    seeRecords: "Se centrets rekorder",
  },
  findGym: {
    title: "Find dit center",
    meta: "Rekorder og opslag, hvor du træner",
  },
  customExercises: {
    meta: "Del en af dine egne",
  },
};
