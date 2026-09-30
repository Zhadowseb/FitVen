// Keep in step with ../en/notifications.js.
export default {
  title: "Notifikationer",
  loading: "Indlæser notifikationer...",
  unavailable: "Notifikationer ikke tilgængelige",
  signInToView: "Log ind for at se notifikationer.",
  loadFailed: "Kunne ikke indlæse notifikationer.",
  unread: "Ulæst",
  itemLabel: "{title}. {body}",
  hints: {
    openVerification: "Åbner centrets løft, der venter på gennemsyn",
    openActivity: "Åbner dagens aktivitet",
    openExercise: "Åbner din øvelse",
    openPost: "Åbner dit opslag",
  },
  customExerciseHidden: {
    title: "Din øvelse er skjult",
    body: "{name} er blevet anmeldt af flere og vises ikke længere i biblioteket. Kopier, som andre allerede har tilføjet, bliver liggende.",
  },
  postLiked: {
    title: "{name} synes godt om dit opslag",
    bodyFallback: "Dit træningsopslag",
    someone: "Nogen",
  },
  emptyTitle: "Du er helt opdateret",
  emptyBody:
    "Her ser du, når nogen starter en træning eller synes godt om et af dine opslag.",
  openSettings: "Åbn notifikationsindstillinger",

  settings: {
    eyebrow: "Indstillinger",
    lockScreenTitle: "Vis træning på låseskærmen",
    lockScreenBody:
      "Mens du træner styrke, står sættet, pausen og tiden på låseskærmen og i Dynamic Island, med knapper til at krydse sættet af og springe pausen over. En lyd siger til, når pausen er slut.",
    lockScreenUnavailable:
      "Din telefon viser ikke kortet lige nu. På iPhone kræver det iOS 16.2 eller nyere, og at Live Activities er slået til for FitVen i Indstillinger.",
    signInToManage: "Log ind for at administrere notifikationsindstillinger.",
    loadFailed: "Kunne ikke indlæse notifikationsindstillinger.",
    saveFailed: "Kunne ikke gemme notifikationsindstillinger.",
    updateSourcesFailed:
      "Kunne ikke opdatere den tilpassede notifikationsliste.",
    savedPermissionDenied:
      "Gemt. Der blev ikke givet tilladelse til notifikationer på denne enhed.",
    savedBlockedByOwner:
      "Gemt. En anden konto er stadig logget ind til notifikationer på denne enhed, så denne konto modtager dem ikke endnu. Log ud af den anden konto, eller vent en uge på, at den frigives.",
    savedRegistrationFailed:
      "Gemt. Denne enhed kunne ikke registreres til push-notifikationer, så den modtager dem måske ikke endnu.",
    postLikesTitle: "Når nogen synes godt om dit opslag",
    postLikesBody:
      "Få besked, når nogen synes godt om et af dine træningsopslag. Én gang pr. person pr. opslag.",
    postLikesUnavailable:
      "Indstillingen er ikke klar endnu. Indtil da får du ikke besked om synes godt om.",
    postLikesSaveFailed: "Kunne ikke gemme indstillingen for synes godt om.",
    workoutStartTitle: "Når en træning starter",
    workoutStartBody:
      "Vælg, hvem der udløser en notifikation, når de begynder at træne.",
    modes: {
      none: {
        title: "Ingen notifikationer",
        body: "Ingen notifikationer, når nogen starter en træning.",
      },
      following: {
        title: "Alle jeg følger",
        body: "Få besked, når en bruger, du følger, starter en træning.",
      },
      custom: {
        title: "Vælg bestemte personer",
        body: "Kun de personer, du vælger nedenfor.",
      },
    },
    selectedCount: "VALGT ({count})",
    removeNamed: "Fjern {name}",
    personFallback: "person",
    nobodySelected: "Ingen valgt endnu. Vælg personer fra listen nedenfor.",
    searchPlaceholder: "Søg blandt dem, du følger",
    noMatches: "Ingen af dem, du følger, matchede.",
  },

  errors: {
    signInToLoadSettings:
      "Du skal være logget ind for at indlæse notifikationsindstillinger.",
    signInToUpdateSettings:
      "Du skal være logget ind for at opdatere notifikationsindstillinger.",
    signInToLoad: "Du skal være logget ind for at indlæse notifikationer.",
  },
};
