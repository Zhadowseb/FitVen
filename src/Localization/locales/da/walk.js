// Gåturen: den levende skærm med kort, ur, tal og skridttempo. Hold den i takt
// med ../en/walk.js. Den danske ordlyd er et forslag og skal gennemlæses.
export default {
  eyebrow: "Træning",
  title: "Gåtur",
  options: "Valg for gåturen",
  autoPause: "Autopause",
  autoPaused: "Sat på pause automatisk",
  time: "Tid",
  clockLabel: "Tid på turen {time}",
  start: "Start",
  pause: "Pause",
  resume: "Fortsæt",
  finish: "Afslut",
  finishHint: "Afslutter gåturen",
  lock: "Lås",
  lockHint: "Låser skærmen, så den ignorerer berøring",
  startedAt: "Start {time}",
  stats: {
    distance: "Distance",
    pace: "Tempo /{unit}",
    now: "Nu {pace}",
    steps: "Skridt",
    stepsTotal: "i alt",
  },
  cadence: {
    title: "Skridttempo",
    unit: "skridt/min",
    perDistance: "Pr. {unit}",
    perDistanceUnit: "skridt/{unit}",
    figureLabel: "En figur, der går på stedet i dit skridttempo",
  },
  units: {
    km: "km",
  },
  map: {
    label: "Kort over din rute indtil nu",
    waitingForFix: "Finder din position…",
    noRoute: "Der blev ikke optaget en rute for denne gåtur.",
    notStarted: "Ruten tegnes her, når turen er startet.",
    denied: "FitVen skal bruge din placering for at tegne ruten og måle distancen.",
    blocked:
      "Placering er slået fra for FitVen. Slå den til i Indstillinger for at tegne ruten og måle distancen.",
    allow: "Tillad placering",
    openSettings: "Åbn Indstillinger",
  },
  lockScreen: {
    title: "Skærmen er låst",
    message: "Berøring ignoreres, mens du går.",
    unlock: "Hold for at låse op",
    unlockHint: "Låser skærmen op",
    unlockAction: "Lås op",
  },
  finishDialog: {
    title: "Afslut gåturen?",
    message: "Det markerer gåturen som færdig.",
    confirm: "Afslut",
  },
  finished: {
    title: "Gåturen er færdig",
    summary: "{duration} · {distance} · {steps}",
    summaryNoDistance: "{duration} · {steps}",
    summaryNoSteps: "{duration} · {distance}",
    summaryTimeOnly: "{duration}",
    steps: {
      one: "{count} skridt",
      other: "{count} skridt",
    },
  },
  errors: {
    finishFailedTitle: "Kunne ikke afslutte gåturen",
    finishFailedMessage: "Intet gik tabt. Prøv igen om lidt.",
  },
};
