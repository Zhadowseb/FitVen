// Centres: the Centres screens (all countries, a country, a region), one
// centre's page, one exercise's ranking (in a centre and across Denmark), the
// Change centre sheet and the gym service's user-facing errors. Keep in step
// with ../da/gyms.js.
export default {
  // Words several of these screens share.
  centre: "Centre",
  yourCentre: "your centre",
  weightKg: "{weight} kg",
  noLiftsYet: "No lifts yet",
  searchFailed: "Search failed.",
  searchCentresA11y: "Search centres",

  // The Centres screens: all countries, a country, a region.
  global: "Global",
  title: "Centres",
  chooseCountry: "Choose country",
  search: "Search for a centre",
  // {where} carries its preposition: "on Zealand".
  searchIn: "Search for a centre {where}",
  myGym: "Your centre",
  members: {
    one: "{count} person trains here · you follow {following} of them",
    other: "{count} people train here · you follow {following} of them",
  },
  allCountries: "All countries",
  fromLocation: "from your location",
  countriesWithLifts: "Countries with lifts",
  onlyWithLifts: "Only countries with logged lifts are shown.",
  regionsIn: "Regions {where}",
  gymsIn: "Centres {where}",
  categories: "Categories",
  sortedByActivity: "by what's trained most here",
  // A centre as a place, for "not at {gym}".
  atGym: "at {gym}",
  // A place with no phrase of its own.
  inPlace: "in {place}",
  // Denmark's four regions with their prepositions, for when the server
  // sends a region without one. Keys are gym.region_key.
  regionsWhere: {
    sjaelland: "on Zealand",
    jylland: "in Jutland",
    fyn: "on Funen",
    bornholm: "on Bornholm",
  },

  counts: {
    centres: { one: "{value} centre", other: "{value} centres" },
    lifters: { one: "{value} lifter", other: "{value} lifters" },
  },

  // All countries: the country you are in, above the list.
  location: {
    title: "Your location",
    noLifts: "No lifts logged here yet",
  },

  // What a level says when it cannot show itself.
  levels: {
    loadFailed: "Could not load centres.",
    unavailableTitle: "Centres unavailable",
    notYetTitle: "On its way",
    notYetBody:
      "Categories and regions aren't set up yet. You can still search for a centre and open your own.",
    cardsNotYet: "Categories aren't set up yet.",
    cardsFailed: "Could not load the categories.",
    noCountries: "No country has logged lifts yet.",
    noRegions: "The centres here aren't split into regions yet.",
    noGyms: "No centres {where} yet.",
  },

  // Search results, in place of the level.
  results: {
    title: "Results",
    count: "{count} found",
    noMatchTitle: "No centres match",
    noMatchBody: "Try the chain, the city or part of the centre's name.",
  },

  // One category on a card: on a level and in one centre.
  card: {
    topRank: "#1",
    topAt: "#1 · {gym}",
    topDetail: "#1 · {detail}",
    // {where} carries its preposition: "#4 on Zealand".
    rankWhere: "#{rank} {where}",
    rankOf: "#{rank} of {total}",
    notRanked: "not on the list yet",
    empty: "Nobody is on the list yet.",
    a11yTop: "Number 1: {name}, {value}",
    a11yHint: "Opens the whole list",
  },

  scope: {
    centre: "Centre",
    friends: "Friends",
    centreWithCount: "Centre · {count}",
    friendsWithCount: "Friends · {count}",
  },

  unit: {
    bodyweight: "×BW",
  },

  // One line of a ranked list.
  row: {
    yourCentre: "· your centre",
  },

  // One centre: hero, its place, the four categories, every exercise.
  overview: {
    notFound: "That centre could not be found.",
    loadFailed: "Could not load the centre.",
    unavailableTitle: "Centre unavailable",
    changeCentre: "Change centre",
    yourCentre: "Your centre",
    membersTrainHere: { one: "{count} person trains here", other: "{count} people train here" },
    youFollow: "you follow {count} of them",
    allExercises: "All exercises",
  },

  // The centre's exercises on its page: the search, the section and "All exercises".
  centreExercises: {
    title: "Exercises",
    sortedByLifters: "most lifters first",
    searchPlaceholder: "Search this centre's exercises",
    clearSearch: "Clear the search",
    resultsTitle: "Exercises here",
    noMatchTitle: "No exercises match",
    noMatchBody: "These are the exercises lifted at this centre. Try part of the name.",
    searchLoading: "Loading every exercise at this centre…",
    searchFailedTitle: "Could not load every exercise",
    searchFailedBody: "The search only covers the most lifted ones for now.",
    topLine: "#1 {name} {weight} kg",
    yourRank: "#{rank}",
    yourRankA11y: "you are number {rank}",
    openHint: "Opens the exercise's ranking at this centre",
    emptyBody: "Finish a workout here and your lifts go on the lists.",
    allDetail: { one: "{count} exercise ranked here", other: "{count} exercises ranked here" },
    allHint: "Opens the rankings, with a button for each exercise",
  },

  // The Change centre sheet.
  change: {
    body: "Your centre is where you have trained most in the last 90 days, unless you pick one here.",
    searchPlaceholder: "Search every centre",
    loadFailed: "Could not load your centres.",
    saveFailed: "Could not change your centre.",
    resultCount: { one: "{count} result", other: "{count} results" },
    automatic: "Automatic",
    automaticMeta: "Where you train most",
    trainedHere: "Where you have trained",
    emptyBody: "Finish a workout inside a centre and it shows up here. Or search above.",
    gymMeta: { one: "{chain} · {count} workout", other: "{chain} · {count} workouts" },
  },

  // One exercise ranked, in a centre or across Denmark.
  exercise: {
    titleFallback: "Exercise",
    nationalEyebrow: "All centres · Denmark",
    unavailableTitle: "Ranking unavailable",
    loadFailed: "Could not load the ranking.",
    loadMoreFailed: "Could not load more.",
    pickExercise: "Pick an exercise.",
    empty: {
      noBodyweightTitle: "No bodyweight on record",
      noBodyweightBody:
        "Ranking by bodyweight needs a bodyweight on the lift, which nobody here has recorded.",
      noFriendsTitle: "None of your friends lift here yet",
      noLiftsBody: "Finish a workout with this exercise inside the centre and the first lift is yours.",
    },
  },

  // Errors the gym service throws; screens show error.message as it is.
  errors: {
    generic: "Something went wrong with centres.",
    signInToChoose: "You need to be signed in to choose a centre.",
  },
};
