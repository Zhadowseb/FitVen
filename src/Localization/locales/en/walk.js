// The walk workout: the live screen with the map, the clock, the stats and the
// cadence. Keep in step with ../da/walk.js.
export default {
  eyebrow: "Workout",
  title: "Walk",
  options: "Walk options",
  autoPause: "Auto pause",
  autoPaused: "Auto paused",
  time: "Time",
  clockLabel: "Walk time {time}",
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  finish: "Finish",
  finishHint: "Finishes the walk",
  lock: "Lock",
  lockHint: "Locks the screen so it ignores touches",
  startedAt: "Start {time}",
  stats: {
    distance: "Distance",
    pace: "Pace /{unit}",
    now: "Now {pace}",
    steps: "Steps",
    stepsTotal: "total",
  },
  cadence: {
    title: "Cadence",
    unit: "steps/min",
    perDistance: "Per {unit}",
    perDistanceUnit: "steps/{unit}",
    figureLabel: "A figure walking in place at your cadence",
  },
  units: {
    km: "km",
  },
  map: {
    label: "Route map of your walk so far",
    waitingForFix: "Finding your position…",
    noRoute: "No route was recorded for this walk.",
    notStarted: "The route is drawn here once the walk has started.",
    denied: "FitVen needs your location to draw the route and measure the distance.",
    blocked:
      "Location is switched off for FitVen. Turn it on in Settings to draw the route and measure the distance.",
    allow: "Allow location",
    openSettings: "Open Settings",
  },
  lockScreen: {
    title: "Screen locked",
    message: "Touches are ignored while you walk.",
    unlock: "Hold to unlock",
    unlockHint: "Unlocks the screen",
    unlockAction: "Unlock",
  },
  finishDialog: {
    title: "Finish walk?",
    message: "This will mark the walk as complete.",
    confirm: "Finish",
  },
  finished: {
    title: "Walk finished",
    summary: "{duration} · {distance} · {steps}",
    summaryNoDistance: "{duration} · {steps}",
    summaryNoSteps: "{duration} · {distance}",
    summaryTimeOnly: "{duration}",
    steps: {
      one: "{count} step",
      other: "{count} steps",
    },
  },
  errors: {
    finishFailedTitle: "Could not finish the walk",
    finishFailedMessage: "Nothing was lost. Try again in a moment.",
  },
};
