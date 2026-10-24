// Sentre: skjermene for sentre (alle land, ett land, en region), siden til ett
// senter, rangeringen av én øvelse (på et senter og i hele Danmark), arket
// Bytt senter og feilene gym-tjenesten viser brukeren.
export default {
  // Ord flere av disse skjermene deler.
  centre: "Senter",
  yourCentre: "senteret ditt",
  weightKg: "{weight} kg",
  noLiftsYet: "Ingen løft ennå",
  searchFailed: "Søket feilet.",
  searchCentresA11y: "Søk etter sentre",

  // Skjermene for sentre: alle land, ett land, en region.
  global: "Globalt",
  title: "Sentre",
  chooseCountry: "Velg land",
  search: "Søk etter et senter",
  // {where} bærer sin egen preposisjon: "på Sjælland".
  searchIn: "Søk etter et senter {where}",
  myGym: "Senteret ditt",
  members: {
    one: "{count} person trener her · du følger {following} av dem",
    other: "{count} personer trener her · du følger {following} av dem",
  },
  allCountries: "Alle land",
  fromLocation: "fra posisjonen din",
  countriesWithLifts: "Land med løft",
  onlyWithLifts: "Bare land med loggførte løft vises.",
  regionsIn: "Regioner {where}",
  gymsIn: "Sentre {where}",
  categories: "Kategorier",
  sortedByActivity: "etter hva som trenes mest her",
  // Et senter som sted, for "ikke på {gym}".
  atGym: "på {gym}",
  // Et sted uten egen frase.
  inPlace: "i {place}",
  // Danmarks fire regioner med preposisjonene sine, til når serveren
  // sender en region uten. Nøklene er gym.region_key.
  regionsWhere: {
    sjaelland: "på Sjælland",
    jylland: "i Jylland",
    fyn: "på Fyn",
    bornholm: "på Bornholm",
  },

  counts: {
    centres: { one: "{value} senter", other: "{value} sentre" },
    lifters: { one: "{value} løfter", other: "{value} løftere" },
  },

  // Alle land: landet du er i, over listen.
  location: {
    title: "Posisjonen din",
    noLifts: "Ingen løft loggført her ennå",
  },

  // Det et nivå sier når det ikke kan vise seg.
  levels: {
    loadFailed: "Kunne ikke laste sentre.",
    unavailableTitle: "Sentre er utilgjengelige",
    notYetTitle: "På vei",
    notYetBody:
      "Kategorier og regioner er ikke satt opp ennå. Du kan fortsatt søke etter et senter og åpne ditt eget.",
    cardsNotYet: "Kategoriene er ikke satt opp ennå.",
    cardsFailed: "Kunne ikke laste kategoriene.",
    noCountries: "Ingen land har loggførte løft ennå.",
    noRegions: "Sentrene her er ikke delt inn i regioner ennå.",
    noGyms: "Ingen sentre {where} ennå.",
  },

  // Søkeresultater, i stedet for nivået.
  results: {
    title: "Resultater",
    count: "{count} funnet",
    noMatchTitle: "Ingen sentre passer",
    noMatchBody: "Prøv kjeden, byen eller en del av navnet på senteret.",
  },

  // Én kategori på et kort: på et nivå og i ett senter.
  card: {
    topRank: "#1",
    topAt: "#1 · {gym}",
    topDetail: "#1 · {detail}",
    // {where} bærer sin egen preposisjon: "#4 på Sjælland".
    rankWhere: "#{rank} {where}",
    rankOf: "#{rank} av {total}",
    notRanked: "ikke på listen ennå",
    empty: "Ingen er på listen ennå.",
    a11yTop: "Nummer 1: {name}, {value}",
    a11yHint: "Åpner hele listen",
  },

  scope: {
    centre: "Senter",
    friends: "Venner",
    centreWithCount: "Senter · {count}",
    friendsWithCount: "Venner · {count}",
  },

  unit: {
    bodyweight: "×KV",
  },

  // Én linje i en rangert liste.
  row: {
    yourCentre: "· senteret ditt",
  },

  // Ett senter: toppbilde, stedet, de fire kategoriene, alle øvelser.
  overview: {
    notFound: "Fant ikke det senteret.",
    loadFailed: "Kunne ikke laste senteret.",
    unavailableTitle: "Senteret er utilgjengelig",
    changeCentre: "Bytt senter",
    yourCentre: "Senteret ditt",
    membersTrainHere: { one: "{count} person trener her", other: "{count} personer trener her" },
    youFollow: "du følger {count} av dem",
    allExercises: "Alle øvelser",
  },

  // Senterets øvelser på siden: søket, seksjonen og "Alle øvelser".
  centreExercises: {
    title: "Øvelser",
    sortedByLifters: "flest løftere først",
    searchPlaceholder: "Søk i øvelsene på dette senteret",
    clearSearch: "Tøm søket",
    resultsTitle: "Øvelser her",
    noMatchTitle: "Ingen øvelser passer",
    noMatchBody: "Dette er øvelsene som løftes på dette senteret. Prøv en del av navnet.",
    searchLoading: "Laster alle øvelsene på dette senteret…",
    searchFailedTitle: "Kunne ikke laste alle øvelsene",
    searchFailedBody: "Søket dekker foreløpig bare de mest løftede.",
    topLine: "#1 {name} {weight} kg",
    yourRank: "#{rank}",
    yourRankA11y: "du er nummer {rank}",
    openHint: "Åpner øvelsens rangering på dette senteret",
    emptyBody: "Fullfør en økt her, så havner løftene dine på listene.",
    allDetail: { one: "{count} øvelse rangert her", other: "{count} øvelser rangert her" },
    allHint: "Åpner rangeringene, med en knapp for hver øvelse",
  },

  // Arket Bytt senter.
  change: {
    body: "Senteret ditt er der du har trent mest de siste 90 dagene, med mindre du velger et her.",
    searchPlaceholder: "Søk blant alle sentre",
    loadFailed: "Kunne ikke laste sentrene dine.",
    saveFailed: "Kunne ikke bytte senter.",
    resultCount: { one: "{count} resultat", other: "{count} resultater" },
    automatic: "Automatisk",
    automaticMeta: "Der du trener mest",
    trainedHere: "Der du har trent",
    emptyBody: "Fullfør en økt på et senter, så dukker det opp her. Eller søk ovenfor.",
    gymMeta: { one: "{chain} · {count} økt", other: "{chain} · {count} økter" },
  },

  // Én øvelse rangert, på et senter eller i hele Danmark.
  exercise: {
    titleFallback: "Øvelse",
    nationalEyebrow: "Alle sentre · Danmark",
    unavailableTitle: "Rangeringen er utilgjengelig",
    loadFailed: "Kunne ikke laste rangeringen.",
    loadMoreFailed: "Kunne ikke laste mer.",
    pickExercise: "Velg en øvelse.",
    empty: {
      noBodyweightTitle: "Ingen kroppsvekt registrert",
      noBodyweightBody:
        "Rangering etter kroppsvekt krever en kroppsvekt på løftet, og det har ingen her registrert.",
      noFriendsTitle: "Ingen av vennene dine løfter her ennå",
      noLiftsBody: "Fullfør en økt med denne øvelsen på senteret, så er det første løftet ditt.",
    },
  },

  // Feil gym-tjenesten kaster; skjermene viser error.message som den er.
  errors: {
    generic: "Noe gikk galt med sentrene.",
    signInToChoose: "Du må være logget inn for å velge et senter.",
  },
};
