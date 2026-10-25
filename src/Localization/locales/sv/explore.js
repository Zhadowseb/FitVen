// The Explore tab: the front page, its search and the ways in.
export default {
  title: "Utforska",
  searchPlaceholder: "Sök gym och personer",
  tiles: {
    gyms: "Gym",
    gymsSub: "Hitta ditt gym",
    gymsCount: { one: "{value} i Danmark", other: "{value} i Danmark" },
    programs: "Program",
    programsCount: { one: "{value} att välja mellan", other: "{value} att välja mellan" },
    exercises: "Övningar",
    exercisesCount: { one: "{value} från användare", other: "{value} från användare" },
    // While the count is unknown, and while nothing has been shared.
    exercisesSub: "Skapade av användare",
    exercisesFirst: "Dela den första",
    records: "Rekord",
    recordsSub: "Danmarks topp 100",
  },
  programs: {
    title: "Program",
    emptyTitle: "Inga program att välja mellan än",
    emptyBody: "Handplockade program finns här att följa precis som de är.",
  },
  customExercises: {
    title: "Egenskapade övningar",
    emptyTitle: "Inga delade övningar än",
    emptyBody: "När folk delar övningar de har skapat kan du hitta dem här och lägga till dem bland dina egna.",
  },
  sections: {
    yourGym: "Ditt gym",
    change: "Byt",
    customExercises: "Nya övningar från andra",
    all: "Alla",
    allCount: { one: "Öppna biblioteket", other: "Alla {value}" },
    allExercisesA11y: {
      one: "Öppna biblioteket med {value} övning",
      other: "Visa alla {value} övningar",
    },
    centerPosts: "Inlägg från gym",
  },
  centerPostLabel: "{name}: {title}, på {gym}",
  centerPosts: {
    eyebrow: "Inlägg från",
    fallbackTitle: "Ett gym",
    emptyTitle: "Inga inlägg från det här gymmet än",
    emptyBody: "När personer du kan se lägger upp ett pass som gjorts här visas det här.",
    failed: "Inläggen kunde inte laddas. Försök igen om en stund.",
  },
  yourGym: {
    newRecords: { one: "{value} nytt rekord", other: "{value} nya rekord" },
    noNewRecords: "Inga nya rekord sedan ditt senaste besök",
    latestLabel: "Senaste rekord: {name}, {exercise}, {weight} kg",
    pick: "Välj ditt gym",
    pickDetail: "Se dess rekord och vilka som tränar där",
  },
  search: {
    hint: {
      all: "Skriv minst två bokstäver för att söka efter gym och personer.",
      gyms: "Skriv minst två bokstäver för att söka efter gym.",
      people: "Skriv minst två bokstäver för att söka efter personer.",
    },
    placeholder: {
      all: "Sök gym och personer",
      gyms: "Sök gym",
      people: "Sök personer",
    },
    scope: {
      all: "Båda",
      gyms: "Gym",
      people: "Personer",
    },
    failed: "Sökningen gick inte igenom. Försök igen om en stund.",
    nothing: "Hittade inget för ”{query}”.",
    clear: "Rensa sökningen",
    gyms: "Gym",
    people: "Personer",
    following: "Du följer dem",
    allPeople: "Se alla och följ",
    // Gyms chosen, nothing typed yet: your gym, the ones you have
    // trained in, and the busiest in your gym's region ({where} brings
    // its preposition).
    suggestions: {
      yours: "Ditt gym",
      trainedIn: "Där du har tränat",
      workouts: { one: "{count} pass", other: "{count} pass" },
      busiestIn: "Mest aktiva {where}",
      busiest: "Mest aktiva gym",
    },
  },
};
