// The start-workout sheet behind the centre nav button: the fresh-start tiles,
// the planned-today shortcut and the repeat-a-workout list. Keep in step with
// ../da/workoutStart.js.
export default {
  title: "START NEW WORKOUT",
  titleForDate: "What are you doing on {date}?",
  closeSheet: "Close workout starter",
  workoutCalendar: "Workout calendar",
  ready: "Ready",
  recent: "Recent",
  suggested: "SUGGESTED",
  timesCount: "{count}x",
  types: {
    resistance: "Resistance",
    run: "Run",
    walk: "Walk",
    workout: "Workout",
  },
  planned: {
    promptSingleToday: "You have a workout planned today.",
    promptSingleOnDay: "You have a workout planned on this day.",
    promptMultipleToday: "You have multiple workouts planned today.",
    promptMultipleOnDay: "You have multiple workouts planned on this day.",
    eyebrowToday: "PLANNED TODAY",
    eyebrow: "PLANNED",
    workoutsPlanned: {
      one: "{count} workout planned",
      other: "{count} workouts planned",
    },
    countReady: "{count} ready",
    detailWithExercises: {
      one: "{programName} - {count} exercise",
      other: "{programName} - {count} exercises",
    },
    detailReady: "{programName} - Ready",
  },
  usual: {
    title: "YOUR USUAL WORKOUTS",
    manage: "Manage",
    loading: "Finding usual workouts...",
    empty: "Repeat a workout twice to see it here.",
  },
  repeat: {
    title: "REPEAT A WORKOUT",
    loading: "Loading recent workouts...",
    loadingMore: "Loading more workouts...",
    empty: "Repeat a workout twice to see it here.",
    showExercises: "Show exercises in {title}",
    hideExercises: "Hide exercises in {title}",
    noExercises: "No exercises on this workout.",
  },
};
