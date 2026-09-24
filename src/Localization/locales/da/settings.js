// Indstillingssider: træningstyper, opslag, musik. Holdes i trit med ../en/settings.js.
export default {
  eyebrow: "Indstillinger",

  workoutTypes: {
    title: "Træningstyper",
    availableEyebrow: "TILGÆNGELIGE",
    sectionTitle: "Træningstyper",
    typesCount: "{count} TYPER",
    available: "Tilgængelig",
    types: {
      strength: {
        title: "Styrketræning",
        category: "STYRKE",
        metrics: "SÆT  /  REPS  /  VÆGT",
      },
      run: {
        title: "Løb",
        category: "KONDITION",
        metrics: "DISTANCE  /  TEMPO  /  TID",
      },
    },
    exerciseCards: "Øvelseskort",
    exerciseCardsSubtitle: "Vælg layout og sætdetaljer for sammenklappede øvelser",
    cardLayout: "Kortlayout",
    setSummary: "Sætoversigt",
    preview: "Forhåndsvisning",
    previewExercise: "Bænkpres",
    views: {
      cells: "Standard",
      compact: "Kompakt",
      progressOnly: "Kun fremskridt",
    },
    cardLayouts: {
      compact: "Kompakt layout",
      classic: "Klassisk layout",
    },
    birthDate: "Fødselsdato",
    birthDateWithAge: "{date}  /  Alder {age}",
    setBirthDate: "Angiv fødselsdato",
    birthDatePickerTitle: "Fødselsdato til løb",
    maxHeartRate: "Maks. puls",
    maxHeartRateEmpty: "Angiv fødselsdato, eller indtast den selv",
    bpm: "{value} bpm",
    howWorkedOut: "Sådan findes den",
    manualValue: "Manuel værdi",
    clearManualValue: "Ryd manuel værdi",
    maxBpmPlaceholder: "Maks. bpm",
    currentBpmPlaceholder: "Nu {value} bpm",
    wholeNumberError: "Brug et helt tal fra {min} til {max}.",
    saving: "Gemmer...",
    sources: {
      auto: {
        title: "Auto",
        detail: "Manuel, så beregnet, så målt",
      },
      manual: {
        title: "Manuel",
        missing: "Indtast og gem en manuel værdi først",
      },
      calculated: {
        title: "Beregnet",
        missing: "Angiv din fødselsdato først",
        fromAge: "{value} bpm ud fra alder",
      },
      measured: {
        title: "Målt",
        missing: "Ingen målt værdi endnu",
      },
    },
    errors: {
      signIn: "Log ind for at styre indstillinger for løb.",
      load: "Kunne ikke hente indstillinger for løb.",
      saveBirthDate: "Kunne ikke gemme fødselsdatoen.",
      saveMaxHeartRate: "Kunne ikke gemme maks. puls.",
      saveSource: "Kunne ikke gemme kilden til maks. puls.",
    },
  },

  socialPosts: {
    title: "Opslag",
    scopeNote: "Gælder alle træninger",
    summariesTitle: "Træningsopsummeringer",
    summariesBody: "Hvad der bliver delt, når du gennemfører en træning.",
    modes: {
      fullInfo: "Alle detaljer",
      summaryOnly: "Kun opsummering",
      off: "Fra",
    },
    nothingPosted: "Der bliver ikke delt noget.",
    preview: {
      duration: "48 min",
      benchPress: "Bænkpres",
      barbellRow: "Roning med stang",
    },
    visibilityEyebrow: "Synlighed",
    visibility: {
      everyone: "Alle",
      following: "Folk jeg følger",
      private: "Kun mig",
    },
    visibilityNote:
      "Bestemmer, hvem der kan se dine træningsopslag. Kun mig holder dem ude af alle andres feeds.",
    exercisesEyebrow: "Øvelser",
    exerciseVisibility: "Synlige øvelser",
    exerciseVisibilityBody: "Vælg, hvilke øvelser der kan vises i topsæt og PR-mærker.",
    errors: {
      load: "Kunne ikke hente indstillinger for opslag.",
      save: "Kunne ikke gemme indstillinger for opslag.",
      saveVisibility: "Kunne ikke gemme opslagets synlighed.",
    },
  },

  oneRepMax: {
    eyebrow: "Træn",
    title: "1RM-beregner",
    weight: "Vægt",
    reps: "Reps",
    weightPlaceholder: "fx 100",
    repsPlaceholder: "fx 5",
    repsSuffix: "reps",
    resultLabel: "ANSLÅET 1RM",
    roundedNote: "Afrundet til nærmeste 0,5 kg.",
    calculate: "Beregn anslået 1RM",
    loadsEyebrow: "TRÆNINGSBELASTNING",
    loadsTitle: "Procent af anslået 1RM",
    aboutTitle: "Om beregningen",
    aboutBody:
      "Resultatet bruger den samme Brzycki-formel som dine automatiske personlige rekorder og det samme interval på 1-{max} reps, som rekorderne gælder for. Ud over det rammer formlen langt fra, hvad nogen faktisk løfter. Træthed, teknik og valg af øvelse påvirker også resultatet, så se det som et skøn.",
    reset: "Nulstil beregner",
    errors: {
      weight: "Indtast en vægt over 0.",
      reps: "Indtast et helt tal mellem 1 og {max}.",
    },
  },
};
