// Einstellungsseiten: Workout-Arten, Social-Posts, Musik.
export default {
  eyebrow: "Einstellungen",

  workoutTypes: {
    title: "Workout-Arten",
    availableEyebrow: "VERFÜGBAR",
    sectionTitle: "Workout-Arten",
    typesCount: "{count} ARTEN",
    available: "Verfügbar",
    types: {
      strength: {
        title: "Krafttraining",
        category: "KRAFT",
        metrics: "SÄTZE  /  WDH.  /  GEWICHT",
      },
      run: {
        title: "Lauf",
        category: "AUSDAUER",
        metrics: "DISTANZ  /  PACE  /  ZEIT",
      },
    },
    exerciseCards: "Übungskarten",
    exerciseCardsSubtitle: "Wähle das Layout und die Satzdetails für eingeklappte Übungen",
    cardLayout: "Kartenlayout",
    setSummary: "Satzübersicht",
    preview: "Vorschau",
    previewExercise: "Bankdrücken",
    views: {
      cells: "Standard",
      compact: "Kompakt",
      progressOnly: "Nur Fortschritt",
    },
    cardLayouts: {
      compact: "Kompaktes Layout",
      classic: "Klassisches Layout",
    },
    birthDate: "Geburtsdatum",
    birthDateWithAge: "{date}  /  Alter {age}",
    setBirthDate: "Geburtsdatum festlegen",
    birthDatePickerTitle: "Geburtsdatum",
    maxHeartRate: "Maximale Herzfrequenz",
    maxHeartRateEmpty: "Geburtsdatum festlegen oder manuell eingeben",
    bpm: "{value} bpm",
    howWorkedOut: "So wird sie ermittelt",
    manualValue: "Manueller Wert",
    clearManualValue: "Manuellen Wert löschen",
    maxBpmPlaceholder: "Max. bpm",
    currentBpmPlaceholder: "Aktuell {value} bpm",
    wholeNumberError: "Nutze eine ganze Zahl von {min} bis {max}.",
    saving: "Wird gespeichert...",
    sources: {
      auto: {
        title: "Auto",
        detail: "Erst manuell, dann berechnet, dann gemessen",
      },
      manual: {
        title: "Manuell",
        missing: "Gib zuerst einen manuellen Wert ein und speichere ihn",
      },
      calculated: {
        title: "Berechnet",
        missing: "Lege zuerst dein Geburtsdatum fest",
        fromAge: "{value} bpm aus dem Alter",
      },
      measured: {
        title: "Gemessen",
        missing: "Kein gemessener Wert verfügbar",
      },
    },
    errors: {
      signIn: "Melde dich an, um die Lauf-Einstellungen zu verwalten.",
      load: "Lauf-Einstellungen konnten nicht geladen werden.",
      saveBirthDate: "Geburtsdatum konnte nicht gespeichert werden.",
      saveMaxHeartRate: "Maximale Herzfrequenz konnte nicht gespeichert werden.",
      saveSource: "Quelle der maximalen Herzfrequenz konnte nicht gespeichert werden.",
    },
  },

  socialPosts: {
    title: "Social-Posts",
    scopeNote: "Gilt für alle Workouts",
    summariesTitle: "Workout-Zusammenfassungen",
    summariesBody: "Aktuelles Postverhalten für abgeschlossene Workouts.",
    modes: {
      fullInfo: "Alle Infos",
      summaryOnly: "Nur Zusammenfassung",
      off: "Aus",
    },
    nothingPosted: "Es wird nichts gepostet.",
    preview: {
      duration: "48 Min.",
      benchPress: "Bankdrücken",
      barbellRow: "Langhantelrudern",
    },
    visibilityEyebrow: "Sichtbarkeit",
    visibility: {
      everyone: "Alle",
      following: "Personen, denen ich folge",
      private: "Nur ich",
    },
    visibilityNote:
      "Legt fest, wer deine Workout-Zusammenfassungen sehen kann. „Nur ich“ hält sie aus allen anderen Feeds heraus.",
    exercisesEyebrow: "Übungen",
    walksEyebrow: "Spaziergänge",
    shareWalkRoute: "Route eines Spaziergangs teilen",
    shareWalkRouteNote: "Die Voreinstellung für den Schalter „Route teilen“, wenn du einen Spaziergang postest. Start und Ende der Route werden immer ausgelassen, und die genaue Route verlässt nie dein Handy.",
    exerciseVisibility: "Sichtbarkeit von Übungen",
    exerciseVisibilityBody: "Wähle, welche Übungen in Top-Sätzen und PR-Abzeichen erscheinen dürfen.",
    errors: {
      load: "Einstellungen für Social-Posts konnten nicht geladen werden.",
      save: "Einstellungen für Social-Posts konnten nicht gespeichert werden.",
      saveVisibility: "Beitragssichtbarkeit konnte nicht gespeichert werden.",
    },
  },

  oneRepMax: {
    eyebrow: "Training",
    title: "1RM-Rechner",
    weight: "Gewicht",
    reps: "Wdh.",
    weightPlaceholder: "z. B. 100",
    repsPlaceholder: "z. B. 5",
    repsSuffix: "Wdh.",
    resultLabel: "GESCHÄTZTES 1RM",
    roundedNote: "Auf die nächsten 0,5 kg gerundet.",
    calculate: "Geschätztes 1RM berechnen",
    loadsEyebrow: "TRAININGSLASTEN",
    loadsTitle: "Prozent des geschätzten 1RM",
    aboutTitle: "Zur Schätzung",
    aboutBody:
      "Das Ergebnis nutzt dieselbe Brzycki-Formel wie deine automatischen persönlichen Rekorde und gilt für denselben Bereich von 1–{max} Wdh., über den diese Rekorde geführt werden. Darüber hinaus entfernt sich die Formel weit von dem, was tatsächlich gehoben wird. Auch Ermüdung, Technik und Übungswahl verändern das Ergebnis, sieh es also als Schätzung.",
    reset: "Rechner zurücksetzen",
    errors: {
      weight: "Gib ein Gewicht über 0 ein.",
      reps: "Gib eine ganze Zahl zwischen 1 und {max} ein.",
    },
  },
};
