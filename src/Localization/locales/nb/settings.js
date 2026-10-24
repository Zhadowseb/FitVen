// Innstillingssider: økttyper, sosiale innlegg, musikk.
export default {
  eyebrow: "Innstillinger",

  workoutTypes: {
    title: "Økttyper",
    availableEyebrow: "TILGJENGELIG",
    sectionTitle: "Økttyper",
    typesCount: "{count} TYPER",
    available: "Tilgjengelig",
    types: {
      strength: {
        title: "Styrketrening",
        category: "STYRKE",
        metrics: "SETT  /  REPS  /  VEKT",
      },
      run: {
        title: "Løping",
        category: "KONDISJON",
        metrics: "DISTANSE  /  TEMPO  /  TID",
      },
    },
    exerciseCards: "Øvelseskort",
    exerciseCardsSubtitle: "Velg oppsettet og detaljene for sett på sammenfoldede øvelser",
    cardLayout: "Kortoppsett",
    setSummary: "Settsammendrag",
    preview: "Forhåndsvisning",
    previewExercise: "Benkpress",
    views: {
      cells: "Standard",
      compact: "Kompakt",
      progressOnly: "Bare fremdrift",
    },
    cardLayouts: {
      compact: "Kompakt oppsett",
      classic: "Klassisk oppsett",
    },
    birthDate: "Fødselsdato",
    birthDateWithAge: "{date}  /  Alder {age}",
    setBirthDate: "Sett fødselsdato",
    birthDatePickerTitle: "Fødselsdato",
    maxHeartRate: "Makspuls",
    maxHeartRateEmpty: "Sett fødselsdato eller skriv inn manuelt",
    bpm: "{value} bpm",
    howWorkedOut: "Hvordan den regnes ut",
    manualValue: "Manuell verdi",
    clearManualValue: "Fjern manuell verdi",
    maxBpmPlaceholder: "Maks bpm",
    currentBpmPlaceholder: "Nå {value} bpm",
    wholeNumberError: "Bruk et helt tall fra {min} til {max}.",
    saving: "Lagrer...",
    sources: {
      auto: {
        title: "Auto",
        detail: "Manuell, så beregnet, så målt",
      },
      manual: {
        title: "Manuell",
        missing: "Skriv inn og lagre en manuell verdi først",
      },
      calculated: {
        title: "Beregnet",
        missing: "Sett fødselsdatoen din først",
        fromAge: "{value} bpm fra alder",
      },
      measured: {
        title: "Målt",
        missing: "Ingen målt verdi tilgjengelig",
      },
    },
    errors: {
      signIn: "Logg inn for å administrere løpeinnstillingene.",
      load: "Kunne ikke laste løpeinnstillingene.",
      saveBirthDate: "Kunne ikke lagre fødselsdatoen.",
      saveMaxHeartRate: "Kunne ikke lagre makspulsen.",
      saveSource: "Kunne ikke lagre kilden til makspulsen.",
    },
  },

  socialPosts: {
    title: "Sosiale innlegg",
    scopeNote: "Gjelder alle økter",
    summariesTitle: "Øktsammendrag",
    summariesBody: "Gjeldende oppførsel for innlegg om fullførte økter.",
    modes: {
      fullInfo: "All info",
      summaryOnly: "Bare sammendrag",
      off: "Av",
    },
    nothingPosted: "Ingenting legges ut.",
    preview: {
      duration: "48 min",
      benchPress: "Benkpress",
      barbellRow: "Stangroing",
    },
    visibilityEyebrow: "Synlighet",
    visibility: {
      everyone: "Alle",
      following: "Folk jeg følger",
      private: "Bare meg",
    },
    visibilityNote:
      "Bestemmer hvem som kan se øktsammendragene dine. Bare meg holder dem utenfor alle andre feeder.",
    exercisesEyebrow: "Øvelser",
    walksEyebrow: "Gåturer",
    shareWalkRoute: "Del ruten til en gåtur",
    shareWalkRouteNote: "Standardvalget for bryteren Del rute når du legger ut en gåtur. Starten og slutten av ruten utelates alltid, og den nøyaktige ruten forlater aldri telefonen din.",
    exerciseVisibility: "Synlighet for øvelser",
    exerciseVisibilityBody: "Velg hvilke øvelser som kan vises i toppsett og PR-merker.",
    errors: {
      load: "Kunne ikke laste innstillingene for sosiale innlegg.",
      save: "Kunne ikke lagre innstillingene for sosiale innlegg.",
      saveVisibility: "Kunne ikke lagre synligheten til innlegg.",
    },
  },

  oneRepMax: {
    eyebrow: "Trening",
    title: "1RM-kalkulator",
    weight: "Vekt",
    reps: "Reps",
    weightPlaceholder: "f.eks. 100",
    repsPlaceholder: "f.eks. 5",
    repsSuffix: "reps",
    resultLabel: "ESTIMERT 1RM",
    roundedNote: "Avrundet til nærmeste 0,5 kg.",
    calculate: "Beregn estimert 1RM",
    loadsEyebrow: "TRENINGSBELASTNING",
    loadsTitle: "Prosent av estimert 1RM",
    aboutTitle: "Om estimatet",
    aboutBody:
      "Resultatet bruker samme Brzycki-formel som de automatiske personlige rekordene dine, og tar samme område på 1–{max} reps som disse rekordene føres over. Utover det glir formelen langt bort fra det noen faktisk løfter. Tretthet, teknikk og øvelsesvalg påvirker også resultatet, så se på det som et estimat.",
    reset: "Nullstill kalkulatoren",
    errors: {
      weight: "Skriv inn en vekt over 0.",
      reps: "Skriv inn et helt tall mellom 1 og {max}.",
    },
  },
};
