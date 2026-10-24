// The notification inbox and its settings.
export default {
  title: "Aviseringar",
  loading: "Laddar aviseringar...",
  unavailable: "Aviseringar är inte tillgängliga",
  signInToView: "Logga in för att se aviseringar.",
  loadFailed: "Aviseringarna kunde inte laddas.",
  unread: "Olästa",
  itemLabel: "{title}. {body}",
  hints: {
    openActivity: "Öppnar dagens aktivitet",
    openExercise: "Öppnar din övning",
    openPost: "Öppnar ditt inlägg",
  },
  // The inbox row the server writes when three people have reported one of
  // your shared exercises. The server's title and body are English; these are
  // what the page shows instead.
  customExerciseHidden: {
    title: "Din övning har dolts",
    body: "{name} rapporterades av flera personer och visas inte längre i biblioteket. Kopior som folk redan har lagt till finns kvar.",
  },
  // The inbox row the server writes when somebody likes one of your posts.
  // {name} is the person who liked it; the body is the post's workout.
  postLiked: {
    title: "{name} gillade ditt inlägg",
    bodyFallback: "Ditt passinlägg",
    someone: "Någon",
  },
  emptyTitle: "Du är ikapp",
  emptyBody: "När någon startar ett pass eller gillar ett av dina inlägg ser du det här.",
  openSettings: "Öppna aviseringsinställningar",

  settings: {
    eyebrow: "Inställningar",
    lockScreenTitle: "Visa passet på låsskärmen",
    lockScreenBody:
      "Medan du tränar styrka finns setet, vilan och tiden på låsskärmen och i Dynamic Island, med knappar för att bocka av setet och hoppa över vilan. Ett ljud talar om när vilan är slut.",
    lockScreenUnavailable:
      "Din telefon visar inte kortet just nu. På iPhone krävs iOS 16.2 eller senare, med Live Activities påslaget för FitVen i Inställningar.",
    signInToManage: "Logga in för att hantera aviseringsinställningar.",
    loadFailed: "Aviseringsinställningarna kunde inte laddas.",
    saveFailed: "Aviseringsinställningarna kunde inte sparas.",
    updateSourcesFailed: "Den egna aviseringslistan kunde inte uppdateras.",
    // The preference is stored either way; these say why the device itself
    // may still not receive anything.
    savedPermissionDenied:
      "Sparat. Tillstånd för aviseringar har inte beviljats på den här enheten.",
    savedBlockedByOwner:
      "Sparat. Ett annat konto är fortfarande inloggat för aviseringar på den här enheten, så det här kontot får dem inte än. Logga ut från det andra kontot, eller vänta en vecka tills det släpps.",
    savedRegistrationFailed:
      "Sparat. Den här enheten kunde inte registreras för pushaviseringar, så den kanske inte får dem än.",
    postLikesTitle: "När någon gillar ditt inlägg",
    postLikesBody:
      "Få en avisering när någon gillar ett av dina passinlägg. En gång per person och inlägg.",
    postLikesUnavailable:
      "Den här inställningen är inte tillgänglig än. Gillamarkeringar aviseras inte förrän den är det.",
    postLikesSaveFailed: "Inställningen för gillamarkeringar kunde inte sparas.",
    workoutStartTitle: "När ett pass startar",
    workoutStartBody:
      "Välj vem som utlöser en avisering när de börjar träna.",
    modes: {
      none: {
        title: "Inga aviseringar",
        body: "Inga aviseringar när någon startar ett pass.",
      },
      following: {
        title: "Alla jag följer",
        body: "Få en avisering när någon du följer startar ett pass.",
      },
      custom: {
        title: "Välj specifika personer",
        body: "Bara de personer du väljer nedan.",
      },
    },
    selectedCount: "VALDA ({count})",
    removeNamed: "Ta bort {name}",
    personFallback: "person",
    nobodySelected: "Ingen vald än. Välj personer i listan nedan.",
    searchPlaceholder: "Sök bland personer du följer",
    noMatches: "Inga personer du följer matchade.",
  },

  // Thrown by Services/notificationService.js and shown as error.message.
  errors: {
    signInToLoadSettings:
      "Du måste vara inloggad för att ladda aviseringsinställningar.",
    signInToUpdateSettings:
      "Du måste vara inloggad för att ändra aviseringsinställningar.",
    signInToLoad: "Du måste vara inloggad för att ladda aviseringar.",
  },
};
