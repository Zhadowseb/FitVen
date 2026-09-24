// Settings pages: workout types, social posts, music. Keep in step with ../da/settings.js.
export default {
  eyebrow: "Settings",

  workoutTypes: {
    title: "Workout Types",
    availableEyebrow: "AVAILABLE",
    sectionTitle: "Workout types",
    typesCount: "{count} TYPES",
    available: "Available",
    types: {
      strength: {
        title: "Strength Training",
        category: "STRENGTH",
        metrics: "SETS  /  REPS  /  WEIGHT",
      },
      run: {
        title: "Run",
        category: "CARDIO",
        metrics: "DISTANCE  /  PACE  /  TIME",
      },
    },
    exerciseCards: "Exercise cards",
    exerciseCardsSubtitle: "Choose the layout and set details for collapsed exercises",
    cardLayout: "Card layout",
    setSummary: "Set summary",
    preview: "Preview",
    previewExercise: "Bench Press",
    views: {
      cells: "Standard",
      compact: "Compact",
      progressOnly: "Progress only",
    },
    cardLayouts: {
      compact: "Compact layout",
      classic: "Classic layout",
    },
    birthDate: "Birth date",
    birthDateWithAge: "{date}  /  Age {age}",
    setBirthDate: "Set birth date",
    birthDatePickerTitle: "Run birth date",
    maxHeartRate: "Max heart rate",
    maxHeartRateEmpty: "Set birth date or enter manually",
    bpm: "{value} bpm",
    howWorkedOut: "How it is worked out",
    manualValue: "Manual value",
    clearManualValue: "Clear manual value",
    maxBpmPlaceholder: "Max bpm",
    currentBpmPlaceholder: "Current {value} bpm",
    wholeNumberError: "Use a whole number from {min} to {max}.",
    saving: "Saving...",
    sources: {
      auto: {
        title: "Auto",
        detail: "Manual, then calculated, then measured",
      },
      manual: {
        title: "Manual",
        missing: "Enter and save a manual value first",
      },
      calculated: {
        title: "Calculated",
        missing: "Set your birth date first",
        fromAge: "{value} bpm from age",
      },
      measured: {
        title: "Measured",
        missing: "No measured value available",
      },
    },
    errors: {
      signIn: "Sign in to manage Run settings.",
      load: "Could not load Run settings.",
      saveBirthDate: "Could not save birth date.",
      saveMaxHeartRate: "Could not save max heart rate.",
      saveSource: "Could not save max heart rate source.",
    },
  },

  socialPosts: {
    title: "Social posts",
    scopeNote: "Applies to all workouts",
    summariesTitle: "Workout summaries",
    summariesBody: "Current posting behavior for completed workouts.",
    modes: {
      fullInfo: "Full info",
      summaryOnly: "Summary only",
      off: "Off",
    },
    nothingPosted: "Nothing is posted.",
    preview: {
      duration: "48 min",
      benchPress: "Bench Press",
      barbellRow: "Barbell Row",
    },
    visibilityEyebrow: "Visibility",
    visibility: {
      everyone: "Everyone",
      following: "People I follow",
      private: "Only me",
    },
    visibilityNote:
      "Decides who can see your workout summary posts. Only me keeps them out of every other feed.",
    exercisesEyebrow: "Exercises",
    exerciseVisibility: "Exercise visibility",
    exerciseVisibilityBody: "Choose which exercises can appear in top sets and PR badges.",
    errors: {
      load: "Could not load social post settings.",
      save: "Could not save social post settings.",
      saveVisibility: "Could not save post visibility.",
    },
  },

  oneRepMax: {
    eyebrow: "Train",
    title: "1RM Calculator",
    weight: "Weight",
    reps: "Reps",
    weightPlaceholder: "e.g. 100",
    repsPlaceholder: "e.g. 5",
    repsSuffix: "reps",
    resultLabel: "ESTIMATED 1RM",
    roundedNote: "Rounded to the nearest 0.5 kg.",
    calculate: "Calculate estimated 1RM",
    loadsEyebrow: "TRAINING LOADS",
    loadsTitle: "Percent of estimated 1RM",
    aboutTitle: "About the estimate",
    aboutBody:
      "The result uses the same Brzycki formula as your automatic personal records, and takes the same 1-{max} rep range those records are kept over. Beyond that the formula drifts far from what anyone actually lifts. Fatigue, technique and exercise choice change the result too, so treat it as an estimate.",
    reset: "Reset calculator",
    errors: {
      weight: "Enter a weight above 0.",
      reps: "Enter a whole number between 1 and {max}.",
    },
  },
};
