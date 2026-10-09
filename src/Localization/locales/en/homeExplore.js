// Home's "From Explore" rail: a row of cards from Explore - your centre, new
// exercises, posts from centres, Denmark's strongest - and the ways in for
// somebody who has none of those yet. The library's name is
// explore.customExercises.title and "{n} users" is customExercises.users.
// Keep in step with ../da/homeExplore.js.
export default {
  title: "From Explore",
  open: "Open",
  openA11y: "Open Explore",
  loadingA11y: "Loading cards from Explore",
  // What a screen reader says for a card: "Your centre: 3 new records, Anna, 2h ago".
  cardA11y: "{kicker}: {title}, {meta}",
  cardA11yShort: "{kicker}: {title}",
  // A record: "Bench press · 120 kg".
  liftTitle: "{exercise} · {weight} kg",
  // The line above each title: what kind of card it is.
  kickers: {
    gymRecords: "Your centre",
    exercise: "New exercise",
    centrePost: "Post",
    strongest: "Denmark's strongest",
    findGym: "Centres",
    customExercises: "Exercises",
  },
  gymRecords: {
    newRecords: { one: "{value} new record", other: "{value} new records" },
    seeRecords: "See the centre's records",
  },
  findGym: {
    title: "Find your centre",
    meta: "Records and posts where you train",
  },
  customExercises: {
    meta: "Share one of your own",
  },
};
