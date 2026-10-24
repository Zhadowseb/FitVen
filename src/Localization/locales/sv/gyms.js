// Gym: the gym screens (all countries, a country, a region), one gym's page,
// one exercise's ranking (in a gym and across Denmark), the Change gym sheet
// and the gym service's user-facing errors.
export default {
  // Words several of these screens share.
  centre: "Gym",
  yourCentre: "ditt gym",
  weightKg: "{weight} kg",
  noLiftsYet: "Inga lyft än",
  searchFailed: "Sökningen misslyckades.",
  searchCentresA11y: "Sök gym",

  // The gym screens: all countries, a country, a region.
  global: "Globalt",
  title: "Gym",
  chooseCountry: "Välj land",
  search: "Sök efter ett gym",
  // {where} carries its preposition: "på Själland".
  searchIn: "Sök efter ett gym {where}",
  myGym: "Ditt gym",
  members: {
    one: "{count} person tränar här · du följer {following} av dem",
    other: "{count} personer tränar här · du följer {following} av dem",
  },
  allCountries: "Alla länder",
  fromLocation: "utifrån din plats",
  countriesWithLifts: "Länder med lyft",
  onlyWithLifts: "Bara länder med loggade lyft visas.",
  regionsIn: "Regioner {where}",
  gymsIn: "Gym {where}",
  categories: "Kategorier",
  sortedByActivity: "efter vad som tränas mest här",
  // A gym as a place, for "not at {gym}".
  atGym: "på {gym}",
  // A place with no phrase of its own.
  inPlace: "i {place}",
  // Denmark's four regions with their prepositions, for when the server
  // sends a region without one. Keys are gym.region_key.
  regionsWhere: {
    sjaelland: "på Själland",
    jylland: "i Jylland",
    fyn: "på Fyn",
    bornholm: "på Bornholm",
  },

  counts: {
    centres: { one: "{value} gym", other: "{value} gym" },
    lifters: { one: "{value} lyftare", other: "{value} lyftare" },
  },

  // All countries: the country you are in, above the list.
  location: {
    title: "Din plats",
    noLifts: "Inga lyft loggade här än",
  },

  // What a level says when it cannot show itself.
  levels: {
    loadFailed: "Gymmen kunde inte laddas.",
    unavailableTitle: "Gym är inte tillgängliga",
    notYetTitle: "På väg",
    notYetBody:
      "Kategorier och regioner är inte på plats än. Du kan fortfarande söka efter ett gym och öppna ditt eget.",
    cardsNotYet: "Kategorierna är inte på plats än.",
    cardsFailed: "Kategorierna kunde inte laddas.",
    noCountries: "Inget land har loggade lyft än.",
    noRegions: "Gymmen här är inte uppdelade i regioner än.",
    noGyms: "Inga gym {where} än.",
  },

  // Search results, in place of the level.
  results: {
    title: "Resultat",
    count: "{count} hittades",
    noMatchTitle: "Inga gym matchar",
    noMatchBody: "Prova kedjan, staden eller en del av gymmets namn.",
  },

  // One category on a card: on a level and in one gym.
  card: {
    topRank: "#1",
    topAt: "#1 · {gym}",
    topDetail: "#1 · {detail}",
    // {where} carries its preposition: "#4 på Själland".
    rankWhere: "#{rank} {where}",
    rankOf: "#{rank} av {total}",
    notRanked: "inte på listan än",
    empty: "Ingen är på listan än.",
    a11yTop: "Nummer 1: {name}, {value}",
    a11yHint: "Öppnar hela listan",
  },

  scope: {
    centre: "Gym",
    friends: "Vänner",
    centreWithCount: "Gym · {count}",
    friendsWithCount: "Vänner · {count}",
  },

  unit: {
    bodyweight: "×BW",
  },

  // One line of a ranked list.
  row: {
    yourCentre: "· ditt gym",
  },

  // One gym: hero, its place, the four categories, every exercise.
  overview: {
    notFound: "Gymmet hittades inte.",
    loadFailed: "Gymmet kunde inte laddas.",
    unavailableTitle: "Gymmet är inte tillgängligt",
    changeCentre: "Byt gym",
    yourCentre: "Ditt gym",
    membersTrainHere: { one: "{count} person tränar här", other: "{count} personer tränar här" },
    youFollow: "du följer {count} av dem",
    allExercises: "Alla övningar",
  },

  // The gym's exercises on its page: the search, the section and "All exercises".
  centreExercises: {
    title: "Övningar",
    sortedByLifters: "flest lyftare först",
    searchPlaceholder: "Sök bland gymmets övningar",
    clearSearch: "Rensa sökningen",
    resultsTitle: "Övningar här",
    noMatchTitle: "Inga övningar matchar",
    noMatchBody: "Det här är övningarna som lyfts på det här gymmet. Prova en del av namnet.",
    searchLoading: "Laddar alla övningar på det här gymmet…",
    searchFailedTitle: "Alla övningar kunde inte laddas",
    searchFailedBody: "Sökningen omfattar bara de mest lyfta för tillfället.",
    topLine: "#1 {name} {weight} kg",
    yourRank: "#{rank}",
    yourRankA11y: "du är nummer {rank}",
    openHint: "Öppnar övningens ranking på det här gymmet",
    emptyBody: "Avsluta ett pass här så hamnar dina lyft på listorna.",
    allDetail: { one: "{count} övning rankad här", other: "{count} övningar rankade här" },
    allHint: "Öppnar rankingen, med en knapp för varje övning",
  },

  // The Change gym sheet.
  change: {
    body: "Ditt gym är där du har tränat mest de senaste 90 dagarna, om du inte väljer ett här.",
    searchPlaceholder: "Sök bland alla gym",
    loadFailed: "Dina gym kunde inte laddas.",
    saveFailed: "Ditt gym kunde inte ändras.",
    resultCount: { one: "{count} resultat", other: "{count} resultat" },
    automatic: "Automatiskt",
    automaticMeta: "Där du tränar mest",
    trainedHere: "Där du har tränat",
    emptyBody: "Avsluta ett pass på ett gym så visas det här. Eller sök ovan.",
    gymMeta: { one: "{chain} · {count} pass", other: "{chain} · {count} pass" },
  },

  // One exercise ranked, in a gym or across Denmark.
  exercise: {
    titleFallback: "Övning",
    nationalEyebrow: "Alla gym · Danmark",
    unavailableTitle: "Rankingen är inte tillgänglig",
    loadFailed: "Rankingen kunde inte laddas.",
    loadMoreFailed: "Kunde inte ladda fler.",
    pickExercise: "Välj en övning.",
    empty: {
      noBodyweightTitle: "Ingen kroppsvikt registrerad",
      noBodyweightBody:
        "Ranking efter kroppsvikt kräver en kroppsvikt på lyftet, och ingen här har registrerat någon.",
      noFriendsTitle: "Ingen av dina vänner lyfter här än",
      noLiftsBody: "Avsluta ett pass med den här övningen på gymmet så är det första lyftet ditt.",
    },
  },

  // Errors the gym service throws; screens show error.message as it is.
  errors: {
    generic: "Något gick fel med gymmen.",
    signInToChoose: "Du måste vara inloggad för att välja ett gym.",
  },
};
