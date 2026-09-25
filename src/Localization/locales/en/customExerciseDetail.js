// One shared exercise (screen 1b), and reporting it. Keep in step with ../da/customExerciseDetail.js.
// The words every screen about a shared exercise uses - the tags, "{n} users",
// "You", "your centre", "No video" - live in customExercises.
export default {
  // The toast on the screen you went back to.
  added: "{name} added to your exercises",
  menu: {
    open: "More options",
    report: "Report the exercise",
  },
  video: {
    play: "Play the video",
    pause: "Pause the video",
    unavailable: "The video can't be played right now",
    needsUpdate: "Update the app to play the video",
  },
  owner: {
    madeOn: "Made it on {date}",
    profile: "Profile",
    openProfile: "Open {name}'s profile",
    someone: "A FitVen user",
  },
  stats: {
    users: "Using it",
    gymUsers: "In your centre",
    noGym: "No centre",
    noGymLabel: "In your centre: you haven't picked a centre",
    typical: "Typical",
    unknown: "not known yet",
  },
  steps: {
    title: "How it's done",
    step: "Step {number}: {text}",
  },
  distribution: {
    title: "What others lift",
    typicalWeightReps: {
      one: "typically {weight} kg for {reps} rep",
      other: "typically {weight} kg for {reps} reps",
    },
    typicalWeight: "typically {weight} kg",
    typicalReps: { one: "typically {reps} rep", other: "typically {reps} reps" },
    rangeUnder: "under {to} kg",
    rangeOver: "{from} kg or more",
    rangeBetween: "{from} to {to} kg",
    summary: {
      one: "What others lift: most often {range}, from {sets} logged set.",
      other: "What others lift: most often {range}, from {sets} logged sets.",
    },
  },
  actions: {
    add: "Add to my exercises",
    adding: "Adding…",
    added: "Added",
    edit: "Edit your exercise",
    save: "Save",
    saved: "Saved",
  },
  nameTaken: "You already have an exercise called {name}, so this one can't be added.",
  addFailed: "It couldn't be added. Try again.",
  saveFailed: "That didn't go through. Try again.",
  footnote: "The name, equipment and muscle group are copied to your exercises – not the owner's sets.",
  footnoteMine: "Anyone who adds it gets the name, equipment and muscle group – never your sets.",
  unavailable: {
    title: "This exercise is no longer available",
    body: "It may have been removed, or it isn't shared any more.",
  },
  error: {
    title: "The exercise couldn't be loaded",
    body: "Something went wrong on the way. Try again in a moment.",
  },
  offline: {
    title: "You're offline",
    body: "Connect to the internet to see this exercise.",
  },
  report: {
    title: "Report the exercise",
    message:
      "Tell us what's wrong. Reports are read by the developer, and the owner is never told who sent one.",
    reasons: {
      wrong: "Wrong or misleading",
      offensive: "Offensive",
      duplicate: "A duplicate",
      other: "Something else",
    },
    notePlaceholder: "Anything else we should know? (optional)",
    send: "Send report",
    thanks: "Thanks – we'll take a look at it.",
    failed: "The report couldn't be sent. Try again.",
  },
};
