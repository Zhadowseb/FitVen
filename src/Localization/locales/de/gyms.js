// Gyms: die Gym-Screens (alle Länder, ein Land, eine Region), die Seite eines Gyms, das Ranking einer Übung, das Blatt zum Gym-Wechsel und die Fehlermeldungen des Gym-Service.
export default {
  centre: "Gym",
  yourCentre: "dein Gym",
  weightKg: "{weight} kg",
  noLiftsYet: "Noch keine Lifts",
  searchFailed: "Suche fehlgeschlagen.",
  searchCentresA11y: "Gyms suchen",

  global: "Weltweit",
  title: "Gyms",
  chooseCountry: "Land wählen",
  search: "Gym suchen",
  searchIn: "Gym suchen {where}",
  myGym: "Dein Gym",
  members: {
    one: "{count} Person trainiert hier · du folgst {following} davon",
    other: "{count} Personen trainieren hier · du folgst {following} davon",
  },
  allCountries: "Alle Länder",
  fromLocation: "von deinem Standort",
  countriesWithLifts: "Länder mit Lifts",
  onlyWithLifts: "Es werden nur Länder mit geloggten Lifts angezeigt.",
  regionsIn: "Regionen {where}",
  gymsIn: "Gyms {where}",
  categories: "Kategorien",
  sortedByActivity: "nach dem, was hier am meisten trainiert wird",
  atGym: "bei {gym}",
  inPlace: "in {place}",
  regionsWhere: {
    sjaelland: "auf Seeland",
    jylland: "in Jütland",
    fyn: "auf Fünen",
    bornholm: "auf Bornholm",
  },

  counts: {
    centres: { one: "{value} Gym", other: "{value} Gyms" },
    lifters: { one: "{value} Lifter", other: "{value} Lifter" },
  },

  location: {
    title: "Dein Standort",
    noLifts: "Hier wurden noch keine Lifts geloggt",
  },

  levels: {
    loadFailed: "Gyms konnten nicht geladen werden.",
    unavailableTitle: "Gyms nicht verfügbar",
    notYetTitle: "Kommt bald",
    notYetBody:
      "Kategorien und Regionen sind noch nicht eingerichtet. Du kannst aber weiterhin nach einem Gym suchen und dein eigenes öffnen.",
    cardsNotYet: "Kategorien sind noch nicht eingerichtet.",
    cardsFailed: "Die Kategorien konnten nicht geladen werden.",
    noCountries: "Noch kein Land hat geloggte Lifts.",
    noRegions: "Die Gyms hier sind noch nicht in Regionen aufgeteilt.",
    noGyms: "Noch keine Gyms {where}.",
  },

  results: {
    title: "Ergebnisse",
    count: "{count} gefunden",
    noMatchTitle: "Kein Gym passt",
    noMatchBody: "Probiere die Kette, die Stadt oder einen Teil des Gym-Namens.",
  },

  card: {
    topRank: "#1",
    topAt: "#1 · {gym}",
    topDetail: "#1 · {detail}",
    rankWhere: "#{rank} {where}",
    rankOf: "#{rank} von {total}",
    notRanked: "noch nicht in der Liste",
    empty: "Noch niemand ist in der Liste.",
    a11yTop: "Platz 1: {name}, {value}",
    a11yHint: "Öffnet die ganze Liste",
  },

  scope: {
    centre: "Gym",
    friends: "Freunde",
    centreWithCount: "Gym · {count}",
    friendsWithCount: "Freunde · {count}",
  },

  unit: {
    bodyweight: "×KG",
  },

  row: {
    yourCentre: "· dein Gym",
  },

  overview: {
    notFound: "Dieses Gym wurde nicht gefunden.",
    loadFailed: "Das Gym konnte nicht geladen werden.",
    unavailableTitle: "Gym nicht verfügbar",
    changeCentre: "Gym wechseln",
    yourCentre: "Dein Gym",
    membersTrainHere: { one: "{count} Person trainiert hier", other: "{count} Personen trainieren hier" },
    youFollow: "du folgst {count} davon",
    allExercises: "Alle Übungen",
  },

  centreExercises: {
    title: "Übungen",
    sortedByLifters: "meiste Lifter zuerst",
    searchPlaceholder: "Übungen dieses Gyms suchen",
    clearSearch: "Suche löschen",
    resultsTitle: "Übungen hier",
    noMatchTitle: "Keine Übung passt",
    noMatchBody: "Das sind die Übungen, die in diesem Gym gemacht werden. Probiere einen Teil des Namens.",
    searchLoading: "Alle Übungen dieses Gyms werden geladen…",
    searchFailedTitle: "Nicht alle Übungen konnten geladen werden",
    searchFailedBody: "Die Suche umfasst vorerst nur die am häufigsten gemachten.",
    topLine: "#1 {name} {weight} kg",
    yourRank: "#{rank}",
    yourRankA11y: "du bist Platz {rank}",
    openHint: "Öffnet das Ranking der Übung in diesem Gym",
    emptyBody: "Schließe hier ein Workout ab, und deine Lifts kommen in die Listen.",
    allDetail: { one: "{count} Übung hier gerankt", other: "{count} Übungen hier gerankt" },
    allHint: "Öffnet die Rankings, mit einem Button für jede Übung",
  },

  change: {
    body: "Dein Gym ist dort, wo du in den letzten 90 Tagen am meisten trainiert hast, es sei denn, du wählst hier eines aus.",
    searchPlaceholder: "Alle Gyms durchsuchen",
    loadFailed: "Deine Gyms konnten nicht geladen werden.",
    saveFailed: "Dein Gym konnte nicht geändert werden.",
    resultCount: { one: "{count} Ergebnis", other: "{count} Ergebnisse" },
    automatic: "Automatisch",
    automaticMeta: "Wo du am meisten trainierst",
    trainedHere: "Wo du trainiert hast",
    emptyBody: "Schließe ein Workout in einem Gym ab, dann erscheint es hier. Oder suche oben.",
    gymMeta: { one: "{chain} · {count} Workout", other: "{chain} · {count} Workouts" },
  },

  exercise: {
    titleFallback: "Übung",
    nationalEyebrow: "Alle Gyms · Dänemark",
    unavailableTitle: "Ranking nicht verfügbar",
    loadFailed: "Das Ranking konnte nicht geladen werden.",
    loadMoreFailed: "Mehr konnte nicht geladen werden.",
    pickExercise: "Wähle eine Übung.",
    empty: {
      noBodyweightTitle: "Kein Körpergewicht erfasst",
      noBodyweightBody:
        "Für das Ranking nach Körpergewicht braucht der Lift ein Körpergewicht, das hier noch niemand erfasst hat.",
      noFriendsTitle: "Noch keiner deiner Freunde hebt hier",
      noLiftsBody: "Schließe in diesem Gym ein Workout mit dieser Übung ab, und der erste Lift gehört dir.",
    },
  },

  errors: {
    generic: "Bei den Gyms ist etwas schiefgelaufen.",
    signInToChoose: "Du musst angemeldet sein, um ein Gym zu wählen.",
  },
};
