// Home's "From Explore" rail: a row of cards from Explore - your gym, new
// exercises, posts from gyms, Denmark's strongest - and the ways in for
// somebody who has none of those yet.
export default {
  title: "Från Utforska",
  open: "Öppna",
  openA11y: "Öppna Utforska",
  loadingA11y: "Laddar kort från Utforska",
  // What a screen reader says for a card: "Ditt gym: 3 nya rekord, Anna, för 2 h sedan".
  cardA11y: "{kicker}: {title}, {meta}",
  cardA11yShort: "{kicker}: {title}",
  // A record: "Bänkpress · 120 kg".
  liftTitle: "{exercise} · {weight} kg",
  // The line above each title: what kind of card it is.
  kickers: {
    gymRecords: "Ditt gym",
    exercise: "Ny övning",
    centrePost: "Inlägg",
    strongest: "Danmarks starkaste",
    findGym: "Gym",
    customExercises: "Övningar",
  },
  gymRecords: {
    newRecords: { one: "{value} nytt rekord", other: "{value} nya rekord" },
    seeRecords: "Se gymmets rekord",
  },
  findGym: {
    title: "Hitta ditt gym",
    meta: "Rekord och inlägg där du tränar",
  },
  customExercises: {
    meta: "Dela en av dina egna",
  },
};
