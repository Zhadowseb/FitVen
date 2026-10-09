// Keep in step with ../en/gyms.js.
export default {
  centre: "Center",
  yourCentre: "dit center",
  weightKg: "{weight} kg",
  noLiftsYet: "Ingen løft endnu",
  searchFailed: "Søgningen mislykkedes.",
  searchCentresA11y: "Søg centre",

  // Centre-skærmene: alle lande, et land, et område.
  global: "Globalt",
  title: "Centre",
  chooseCountry: "Vælg land",
  search: "Søg efter et center",
  // {where} har forholdsordet med: "på Sjælland".
  searchIn: "Søg efter et center {where}",
  myGym: "Dit center",
  members: {
    one: "{count} træner her · du følger {following} af dem",
    other: "{count} træner her · du følger {following} af dem",
  },
  allCountries: "Alle lande",
  fromLocation: "valgt ud fra din lokation",
  countriesWithLifts: "Lande med løft",
  onlyWithLifts: "Kun lande, hvor der er registreret løft, er med.",
  regionsIn: "Områder {where}",
  gymsIn: "Centre {where}",
  categories: "Kategorier",
  sortedByActivity: "efter hvad der trænes mest her",
  atGym: "i {gym}",
  inPlace: "i {place}",
  // Danmarks fire landsdele med forholdsord, til når serveren sender et
  // område uden. Nøglerne er gym.region_key.
  regionsWhere: {
    sjaelland: "på Sjælland",
    jylland: "i Jylland",
    fyn: "på Fyn",
    bornholm: "på Bornholm",
  },

  counts: {
    centres: { one: "{value} center", other: "{value} centre" },
    lifters: { one: "{value} løfter", other: "{value} løftere" },
  },

  location: {
    title: "Din lokation",
    noLifts: "Ingen løft registreret her endnu",
  },

  levels: {
    loadFailed: "Centrene kunne ikke hentes.",
    unavailableTitle: "Centrene er ikke tilgængelige",
    notYetTitle: "På vej",
    notYetBody:
      "Kategorier og områder er ikke sat op endnu. Du kan stadig søge efter et center og åbne dit eget.",
    cardsNotYet: "Kategorierne er ikke sat op endnu.",
    cardsFailed: "Kategorierne kunne ikke hentes.",
    noCountries: "Intet land har registreret løft endnu.",
    noRegions: "Centrene her er ikke delt op i områder endnu.",
    noGyms: "Ingen centre {where} endnu.",
  },

  results: {
    title: "Resultater",
    count: "{count} fundet",
    noMatchTitle: "Ingen centre matcher",
    noMatchBody: "Prøv kæden, byen eller en del af centerets navn.",
  },

  card: {
    topRank: "#1",
    topAt: "#1 · {gym}",
    topDetail: "#1 · {detail}",
    rankWhere: "#{rank} {where}",
    rankOf: "#{rank} af {total}",
    notRanked: "ikke på listen endnu",
    empty: "Ingen er på listen endnu.",
    a11yTop: "Nummer 1: {name}, {value}",
    a11yHint: "Åbner hele listen",
  },

  scope: {
    centre: "Center",
    friends: "Venner",
    centreWithCount: "Center · {count}",
    friendsWithCount: "Venner · {count}",
  },

  unit: {
    bodyweight: "×KV",
  },

  row: {
    yourCentre: "· dit center",
  },

  overview: {
    notFound: "Centeret blev ikke fundet.",
    loadFailed: "Centeret kunne ikke hentes.",
    unavailableTitle: "Centeret er ikke tilgængeligt",
    changeCentre: "Skift center",
    yourCentre: "Dit center",
    membersTrainHere: { one: "{count} træner her", other: "{count} træner her" },
    youFollow: "du følger {count} af dem",
    allExercises: "Alle øvelser",
  },

  // Centrets øvelser på centrets side: søgningen, sektionen og "Alle øvelser".
  centreExercises: {
    title: "Øvelser",
    sortedByLifters: "flest løftere først",
    searchPlaceholder: "Søg efter en øvelse i centret",
    clearSearch: "Ryd søgningen",
    resultsTitle: "Øvelser her",
    noMatchTitle: "Ingen øvelser matcher",
    noMatchBody: "Her er de øvelser, der er løftet i centret. Prøv en del af navnet.",
    searchLoading: "Henter alle centrets øvelser…",
    searchFailedTitle: "Kunne ikke hente alle øvelser",
    searchFailedBody: "Søgningen dækker kun de mest løftede lige nu.",
    topLine: "#1 {name} {weight} kg",
    yourRank: "#{rank}",
    yourRankA11y: "du er nummer {rank}",
    openHint: "Åbner øvelsens rangliste i centret",
    emptyBody: "Gennemfør en træning her, så kommer dine løft på listerne.",
    allDetail: { one: "{count} øvelse med rangliste her", other: "{count} øvelser med rangliste her" },
    allHint: "Åbner ranglisterne, med en knap for hver øvelse",
  },

  change: {
    body: "Dit center er der, hvor du har trænet mest de sidste 90 dage, medmindre du vælger et her.",
    searchPlaceholder: "Søg i alle centre",
    loadFailed: "Dine centre kunne ikke hentes.",
    saveFailed: "Dit center kunne ikke skiftes.",
    resultCount: { one: "{count} resultat", other: "{count} resultater" },
    automatic: "Automatisk",
    automaticMeta: "Hvor du træner mest",
    trainedHere: "Hvor du har trænet",
    emptyBody: "Gennemfør en træning i et center, så vises det her. Eller søg ovenfor.",
    gymMeta: { one: "{chain} · {count} træning", other: "{chain} · {count} træninger" },
  },

  exercise: {
    titleFallback: "Øvelse",
    nationalEyebrow: "Alle centre · Danmark",
    unavailableTitle: "Ranglisten er ikke tilgængelig",
    loadFailed: "Ranglisten kunne ikke hentes.",
    loadMoreFailed: "Kunne ikke hente flere.",
    pickExercise: "Vælg en øvelse.",
    empty: {
      noBodyweightTitle: "Ingen kropsvægt registreret",
      noBodyweightBody:
        "Rangering efter kropsvægt kræver en kropsvægt på løftet, og det har ingen her registreret.",
      noFriendsTitle: "Ingen af dine venner løfter her endnu",
      noLiftsBody: "Gennemfør en træning med denne øvelse i centeret, så er det første løft dit.",
    },
  },

  errors: {
    generic: "Noget gik galt med centrene.",
    signInToChoose: "Du skal være logget ind for at vælge et center.",
  },
};
