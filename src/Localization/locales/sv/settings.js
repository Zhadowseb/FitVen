// Settings pages: workout types, social posts, music.
export default {
  eyebrow: "Inställningar",

  workoutTypes: {
    title: "Passtyper",
    availableEyebrow: "TILLGÄNGLIGA",
    sectionTitle: "Passtyper",
    typesCount: "{count} TYPER",
    available: "Tillgängliga",
    types: {
      strength: {
        title: "Styrketräning",
        category: "STYRKA",
        metrics: "SET  /  REPS  /  VIKT",
      },
      run: {
        title: "Löpning",
        category: "KONDITION",
        metrics: "DISTANS  /  TEMPO  /  TID",
      },
    },
    exerciseCards: "Övningskort",
    exerciseCardsSubtitle: "Välj layout och setdetaljer för hopfällda övningar",
    cardLayout: "Kortlayout",
    setSummary: "Setsammanfattning",
    preview: "Förhandsvisning",
    previewExercise: "Bänkpress",
    views: {
      cells: "Standard",
      compact: "Kompakt",
      progressOnly: "Bara framsteg",
    },
    cardLayouts: {
      compact: "Kompakt layout",
      classic: "Klassisk layout",
    },
    birthDate: "Födelsedatum",
    birthDateWithAge: "{date}  /  Ålder {age}",
    setBirthDate: "Ange födelsedatum",
    birthDatePickerTitle: "Födelsedatum för löpning",
    maxHeartRate: "Maxpuls",
    maxHeartRateEmpty: "Ange födelsedatum eller skriv in manuellt",
    bpm: "{value} bpm",
    howWorkedOut: "Så räknas det ut",
    manualValue: "Manuellt värde",
    clearManualValue: "Rensa manuellt värde",
    maxBpmPlaceholder: "Max bpm",
    currentBpmPlaceholder: "Nuvarande {value} bpm",
    wholeNumberError: "Använd ett heltal från {min} till {max}.",
    saving: "Sparar...",
    sources: {
      auto: {
        title: "Auto",
        detail: "Manuellt, sedan beräknat, sedan uppmätt",
      },
      manual: {
        title: "Manuellt",
        missing: "Ange och spara ett manuellt värde först",
      },
      calculated: {
        title: "Beräknat",
        missing: "Ange ditt födelsedatum först",
        fromAge: "{value} bpm utifrån ålder",
      },
      measured: {
        title: "Uppmätt",
        missing: "Inget uppmätt värde finns",
      },
    },
    errors: {
      signIn: "Logga in för att hantera löpinställningar.",
      load: "Löpinställningarna kunde inte laddas.",
      saveBirthDate: "Födelsedatumet kunde inte sparas.",
      saveMaxHeartRate: "Maxpulsen kunde inte sparas.",
      saveSource: "Källan för maxpuls kunde inte sparas.",
    },
  },

  socialPosts: {
    title: "Sociala inlägg",
    scopeNote: "Gäller alla pass",
    summariesTitle: "Passsammanfattningar",
    summariesBody: "Nuvarande inläggsbeteende för genomförda pass.",
    modes: {
      fullInfo: "Full info",
      summaryOnly: "Bara sammanfattning",
      off: "Av",
    },
    nothingPosted: "Inget läggs upp.",
    preview: {
      duration: "48 min",
      benchPress: "Bänkpress",
      barbellRow: "Skivstångsrodd",
    },
    visibilityEyebrow: "Synlighet",
    visibility: {
      everyone: "Alla",
      following: "Personer jag följer",
      private: "Bara jag",
    },
    visibilityNote:
      "Avgör vem som kan se dina passsammanfattningar. Bara jag håller dem borta från alla andras flöden.",
    exercisesEyebrow: "Övningar",
    walksEyebrow: "Promenader",
    shareWalkRoute: "Dela rutten för en promenad",
    shareWalkRouteNote: "Standardvärdet för reglaget Dela rutt när du lägger upp en promenad. Start och slut på rutten utelämnas alltid, och den exakta rutten lämnar aldrig din telefon.",
    exerciseVisibility: "Övningars synlighet",
    exerciseVisibilityBody: "Välj vilka övningar som får visas i toppset och PR-märken.",
    errors: {
      load: "Inställningarna för sociala inlägg kunde inte laddas.",
      save: "Inställningarna för sociala inlägg kunde inte sparas.",
      saveVisibility: "Inläggens synlighet kunde inte sparas.",
    },
  },

  oneRepMax: {
    eyebrow: "Träna",
    title: "1RM-kalkylator",
    weight: "Vikt",
    reps: "Reps",
    weightPlaceholder: "t.ex. 100",
    repsPlaceholder: "t.ex. 5",
    repsSuffix: "reps",
    resultLabel: "BERÄKNAD 1RM",
    roundedNote: "Avrundat till närmaste 0,5 kg.",
    calculate: "Beräkna 1RM",
    loadsEyebrow: "BELASTNINGAR",
    loadsTitle: "Procent av beräknad 1RM",
    aboutTitle: "Om uppskattningen",
    aboutBody:
      "Resultatet använder samma Brzycki-formel som dina automatiska personliga rekord, och samma intervall på 1–{max} reps som dessa rekord förs över. Utanför det avviker formeln långt från vad någon faktiskt lyfter. Trötthet, teknik och övningsval påverkar också resultatet, så se det som en uppskattning.",
    reset: "Återställ kalkylatorn",
    errors: {
      weight: "Ange en vikt över 0.",
      reps: "Ange ett heltal mellan 1 och {max}.",
    },
  },
};
