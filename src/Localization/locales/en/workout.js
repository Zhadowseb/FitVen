// The strength workout's exercise card: its history and note panels, and the
// set type sheet behind a set's badge. Keep in step with ../da/workout.js.
export default {
  history: {
    title: "History",
    lastTimes: {
      one: "Last time",
      other: "Last {count} times",
    },
    close: "Close history",
    loading: "Loading history",
    couldNotLoad: "Could not load previous sets.",
    empty: "No completed sets for this exercise yet.",
    // Follows the number, which is drawn in its own colour.
    setsTotal: {
      one: "set total",
      other: "sets total",
    },
    records: "Records and progress",
    openRecords: "Open records for {name}",
  },
  note: {
    title: "Note",
    done: "Done",
    placeholder: "Add note",
    edit: "Edit note",
    lastTime: "Last time",
  },
  setType: {
    overline: "Set {label} · {exercise}",
    title: "Type",
    delete: "Delete",
    deleteSet: "Delete set {label}",
    badge: "Set {label}. Hold to change its type",
    types: {
      warmup: {
        title: "Warm-up",
        detail: "Not counted in volume or records",
      },
      working: {
        title: "Working set",
        detail: "Counts toward volume and records",
      },
      drop: {
        title: "Drop set",
        detail: "Lighter, straight after the set above. No records",
      },
      amrap: {
        title: "AMRAP",
        detail: "As many reps as possible",
      },
    },
    amrapTarget: "Target reps",
    amrapTargetDetail: "Shown beside the reps, as 9/6+",
    amrapTargetPlaceholder: "e.g. 6",
    note: "Note",
    notePlaceholder: "Add note",
    deleted: "Set {label} deleted",
    undo: "Undo",
    warmupCount: {
      one: "{count} warm-up",
      other: "{count} warm-ups",
    },
    foldWarmups: "Fold the warm-ups",
    warmupsFolded: {
      one: "{count} warm-up. Tap to show",
      other: "{count} warm-ups. Tap to show",
    },
  },
};
