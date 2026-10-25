// Varselinnboksen og innstillingene for den.
export default {
  title: "Varsler",
  loading: "Laster varsler...",
  unavailable: "Varsler er utilgjengelige",
  signInToView: "Logg inn for å se varsler.",
  loadFailed: "Kunne ikke laste varsler.",
  unread: "Uleste",
  itemLabel: "{title}. {body}",
  hints: {
    openActivity: "Åpner dagens aktivitet",
    openExercise: "Åpner øvelsen din",
    openPost: "Åpner innlegget ditt",
  },
  // Innboksraden serveren skriver når tre personer har rapportert en av dine
  // delte øvelser. Serverens tittel og tekst er engelsk; disse er
  // det siden viser i stedet.
  customExerciseHidden: {
    title: "Øvelsen din ble skjult",
    body: "{name} ble rapportert av flere og vises ikke lenger i biblioteket. Kopier folk allerede har lagt til, blir.",
  },
  // Innboksraden serveren skriver når noen liker et av innleggene dine.
  // {name} er den som likte det; teksten er øvelsen i innlegget.
  postLiked: {
    title: "{name} likte innlegget ditt",
    bodyFallback: "Øktinnlegget ditt",
    someone: "Noen",
  },
  emptyTitle: "Du er oppdatert",
  emptyBody: "Når noen starter en økt eller liker et av innleggene dine, ser du det her.",
  openSettings: "Åpne varselinnstillinger",

  settings: {
    eyebrow: "Innstillinger",
    lockScreenTitle: "Vis økten på låseskjermen",
    lockScreenBody:
      "Mens du trener styrke, vises settet, hvilen og tiden på låseskjermen og i Dynamic Island, med knapper for å krysse av settet og hoppe over hvilen. En lyd forteller når hvilen er over.",
    lockScreenUnavailable:
      "Telefonen din viser ikke kortet akkurat nå. På iPhone krever det iOS 16.2 eller nyere, med Live Activities slått på for FitVen i Innstillinger.",
    signInToManage: "Logg inn for å administrere varselinnstillingene.",
    loadFailed: "Kunne ikke laste varselinnstillingene.",
    saveFailed: "Kunne ikke lagre varselinnstillingene.",
    updateSourcesFailed: "Kunne ikke oppdatere den egendefinerte varselslisten.",
    // Valget lagres uansett; disse sier hvorfor selve enheten likevel kanskje
    // ikke mottar noe.
    savedPermissionDenied:
      "Lagret. Varseltillatelse ble ikke gitt på denne enheten.",
    savedBlockedByOwner:
      "Lagret. En annen konto er fortsatt logget inn på varsler på denne enheten, så denne mottar dem ikke ennå. Logg ut av den andre kontoen, eller vent en uke til den slippes.",
    savedRegistrationFailed:
      "Lagret. Denne enheten kunne ikke registreres for pushvarsler, så den mottar dem kanskje ikke ennå.",
    postLikesTitle: "Når noen liker innlegget ditt",
    postLikesBody:
      "Få et varsel når noen liker et av øktinnleggene dine. Én gang per person per innlegg.",
    postLikesUnavailable:
      "Denne innstillingen er ikke tilgjengelig ennå. Likes varsles ikke før den er det.",
    postLikesSaveFailed: "Kunne ikke lagre innstillingen for likes.",
    workoutStartTitle: "Når en økt starter",
    workoutStartBody:
      "Velg hvem som utløser et varsel når de begynner å trene.",
    modes: {
      none: {
        title: "Ingen varsler",
        body: "Ingen varsler når noen starter en økt.",
      },
      following: {
        title: "Alle jeg følger",
        body: "Få varsel når en bruker du følger, starter en økt.",
      },
      custom: {
        title: "Velg bestemte personer",
        body: "Bare personene du velger nedenfor.",
      },
    },
    selectedCount: "VALGT ({count})",
    removeNamed: "Fjern {name}",
    personFallback: "person",
    nobodySelected: "Ingen valgt ennå. Velg folk fra listen nedenfor.",
    searchPlaceholder: "Søk blant folk du følger",
    noMatches: "Ingen av de du følger, passet.",
  },

  // Kastet av Services/notificationService.js og vist som error.message.
  errors: {
    signInToLoadSettings:
      "Du må være logget inn for å laste varselinnstillingene.",
    signInToUpdateSettings:
      "Du må være logget inn for å oppdatere varselinnstillingene.",
    signInToLoad: "Du må være logget inn for å laste varsler.",
  },
};
