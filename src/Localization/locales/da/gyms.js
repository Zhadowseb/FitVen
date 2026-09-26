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

  status: {
    verified: "Video bekræftet · {count}",
    pending: "Video venter · {count}/{required}",
    noVideo: "Ingen video",
    rejected: "Afvist {count}",
  },

  row: {
    yourCentre: "· dit center",
    reviewA11y: "Se videoen af dette løft",
  },

  overview: {
    notFound: "Centeret blev ikke fundet.",
    loadFailed: "Centeret kunne ikke hentes.",
    unavailableTitle: "Centeret er ikke tilgængeligt",
    changeCentre: "Skift center",
    yourCentre: "Dit center",
    membersTrainHere: { one: "{count} træner her", other: "{count} træner her" },
    youFollow: "du følger {count} af dem",
    reviewQueue: {
      one: "{count} løft venter på gennemsyn",
      other: "{count} løft venter på gennemsyn",
    },
    reviewHint: "Se videoen, og godkend eller afvis den.",
    allExercises: "Alle øvelser",
    allExercisesDetail: {
      zero: "Bænk, squat og dødløft",
      one: "Bænk, squat, dødløft og {count} mere",
      other: "Bænk, squat, dødløft og {count} mere",
    },
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
    nationalNote: "På tværs af centre kræver løftet en godkendt video.",
    unavailableTitle: "Ranglisten er ikke tilgængelig",
    loadFailed: "Ranglisten kunne ikke hentes.",
    loadMoreFailed: "Kunne ikke hente flere.",
    pickExercise: "Vælg en øvelse.",
    legend:
      "Video bekræftet: tre medlemmer af centeret har godkendt videoen. Video venter: en video er vedhæftet og venter på stemmer. Ingen video: løftet tæller i centeret, men ikke på tværs af Danmark.",
    empty: {
      noBodyweightTitle: "Ingen kropsvægt registreret",
      noBodyweightBody:
        "Rangering efter kropsvægt kræver en kropsvægt på løftet, og det har ingen her registreret.",
      noFriendsTitle: "Ingen af dine venner løfter her endnu",
      noVerifiedTitle: "Ingen bekræftede løft endnu",
      noVerifiedBody: "Vedhæft en video til et løft, og få tre medlemmer af dit center til at godkende det.",
      noLiftsBody: "Gennemfør en træning med denne øvelse i centeret, så er det første løft dit.",
    },
    pinned: {
      pendingTitle: "Ikke rangeret · din video venter på stemmer",
      noVideoTitle: "Ikke rangeret · dit løft mangler video",
      body: "{weight} kg i {gym}",
    },
  },

  video: {
    attachTitle: "Vedhæft video",
    attachBody:
      "Højst {seconds} sekunder. Centerets medlemmer ser den og stemmer; tre godkendelser bekræfter løftet.",
    attachA11y: "Vedhæft en video til dit løft",
    recordNow: "Optag nu",
    recordNowBody: "Åbn kameraet.",
    chooseLibrary: "Vælg fra biblioteket",
    chooseLibraryBody: "En video, du allerede har.",
    confirmTitle: "Brug denne video?",
    confirmBody: "Den erstatter en eventuel video på løftet og nulstiller stemmerne.",
    confirmBodyWithDuration: {
      one: "{count} sekund. Den erstatter en eventuel video på løftet og nulstiller stemmerne.",
      other: "{count} sekunder. Den erstatter en eventuel video på løftet og nulstiller stemmerne.",
    },
    use: "Brug",
    cameraPermission: "Der skal gives adgang til kameraet for at optage en video.",
    libraryPermission: "Der skal gives adgang til fotobiblioteket for at vælge en video.",
    pickerFailed: "Videovælgeren kunne ikke åbnes.",
    attached: "Video vedhæftet. Centerets medlemmer kan nu bekræfte den.",
    attachedNotified: {
      one: "Video vedhæftet. {count} medlem er blevet bedt om at bekræfte den.",
      other: "Video vedhæftet. {count} medlemmer er blevet bedt om at bekræfte den.",
    },
    attachFailed: "Videoen kunne ikke vedhæftes.",
  },

  review: {
    eyebrow: "BEKRÆFT REKORD",
    queueTitle: "Løft til gennemsyn",
    title: "{exercise} · {weight} kg",
    counter: "{index} af {total}",
    loadFailed: "Løftene til gennemsyn kunne ikke hentes.",
    voteFailed: "Din stemme kunne ikke registreres.",
    allSeen: "Tak, du har set alle",
    emptyTitle: "Intet venter på gennemsyn",
    emptyBody: "Når nogen i centeret vedhæfter en video til et løft, vises det her.",
    playVideo: "Afspil video",
    pauseVideo: "Sæt videoen på pause",
    videoUnavailable: "Videoen er ikke tilgængelig",
    videoNeedsBuild: "Afspilning af video kræver 2.0-udviklingsbuildet",
    fromPrevious: "Fra {previous} kg · +{gain} kg",
    becomesRank: "bliver #{rank} i centeret",
    approvedCount: "{count} godkendt",
    rejectedCount: "· {count} afvist",
    toGo: "mangler {count}",
    ownLiftWaiting: {
      one: "Dit løft venter på {count} godkendelse mere.",
      other: "Dit løft venter på {count} godkendelser mere.",
    },
    cannotVote: "Kun folk der har trænet i centeret de sidste 90 dage kan stemme.",
    whyReject: "Hvorfor afvise?",
    reject: "Afvis",
    approve: "Godkend løftet",
    rules:
      "{approvals} godkendelser fra andre medlemmer bekræfter et løft. {rejections} afvisninger fjerner det fra ranglisten. Du kan ikke stemme på dine egne løft.",
  },

  rejectReasons: {
    depth: "Ikke dybt nok",
    lockout: "Ingen lockout",
    assist: "Hjulpet eller spottet",
    weight: "Vægten passer ikke",
    other: "Andet",
  },

  errors: {
    generic: "Noget gik galt med centrene.",
    signInToChoose: "Du skal være logget ind for at vælge et center.",
    signInToVote: "Du skal være logget ind for at stemme.",
    signInToAttach: "Du skal være logget ind for at vedhæfte en video.",
    pickVideoFirst: "Vælg en video først.",
    videoTooLong: "Hold videoen under {seconds} sekunder.",
    videoTooLarge: "Videoen må højst være 50 MB.",
    videoUnreadable: "Den valgte video kunne ikke læses.",
    videoEmpty: "Den valgte video var tom.",
  },
};
