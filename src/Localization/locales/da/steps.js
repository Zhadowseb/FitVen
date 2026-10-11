// Skridt: kortet på Home, Skridt-siden og zonerne. Hold den i takt med
// ../en/steps.js. Den danske ordlyd er et forslag og skal gennemlæses.
export default {
  title: "Skridt",
  eyebrow: "Aktivitet",
  noData: "Ingen skridt i perioden endnu.",
  // Hvor telefonens egen optælling læses fra.
  healthApp: {
    ios: "Sundhed",
    android: "Health Connect",
  },
  // En zone fortælles aldrig kun med farven; det her er navnene.
  zones: {
    inactive: "Inaktiv",
    moving: "I bevægelse",
    active: "Aktiv",
    sweetSpot: "Sweet spot",
    bonus: "Bonus",
  },
  access: {
    ask: "Se dine daglige skridt ved siden af dine træninger.",
    askButton: "Tillad",
    blocked: "FitVen skal kunne læse dine skridt i {app}.",
    openApp: "Åbn {app}",
  },
  card: {
    steps: "skridt",
    a11y: "Skridt i dag: {total} skridt. Zonen {zone}. Åbn skridt",
    a11yWithTraining:
      "Skridt i dag: {walked} gået plus {training} fra træning, {total} i alt. Zonen {zone}. Åbn skridt",
  },
  periods: {
    day: "Dag",
    week: "Uge",
    month: "Måned",
  },
  hero: {
    today: "I dag · {range}",
    dailyAverage: "Gennemsnit pr. dag · {range}",
    activeSteps: "aktive skridt",
    walked: "{count} gået",
    fromTraining: "{count} fra træning",
  },
  chart: {
    today: "I dag",
    walking: "Gang",
    training: "Træning som skridt",
    target: "{zone} {steps}",
    summary: {
      day: "Aktive skridt pr. dag den seneste uge: gang i grønt, træning omregnet til skridt i orange. I dag {average}, zonen {zone}.",
      week: "Aktive skridt pr. dag i denne uge: gang i grønt, træning omregnet til skridt i orange. {sweet} af {days} dage nåede sweet spot. Gennemsnit {average}, zonen {zone}.",
      month:
        "Gennemsnitlige aktive skridt pr. dag, pr. uge i denne måned: gang i grønt, træning omregnet til skridt i orange. {sweet} af {days} dage nåede sweet spot. Gennemsnit {average}, zonen {zone}.",
    },
  },
  tiles: {
    total: "I alt",
    totalWithTraining: "heraf {count} fra træning",
    sweetSpotDays: "Sweet spot-dage",
    ofDays: "{count} af {total}",
    sweetSpotRule: "{steps} eller flere",
    bestDay: "Bedste dag",
    bestDetail: "{weekday} · {workout}",
    distance: "Distance",
    km: "km",
    walkedDistance: "gået",
  },
  sources: {
    title: "Hvor din aktivitet kom fra",
    period: {
      day: "I dag",
      week: "Denne uge",
      month: "Denne måned",
    },
    walks: "Gåture",
    everyday: "Hverdag",
    training: "Træning",
    a11y: "{walks} procent fra loggede gåture, {everyday} procent fra hverdagsaktivitet, {training} procent fra træning",
  },
  trainingCounts: {
    title: "Træning tæller også",
    subtitle: "Træninger lægges til som skridtækvivalenter",
    switch: "Tæl træning som skridt",
    minutes: "{minutes} min styrke",
    empty: "Ingen styrketræninger i perioden.",
  },
  target: {
    label: "Dit mål",
    change: "Skift",
    title: "Dit mål",
    from: "{steps}+",
  },
};
