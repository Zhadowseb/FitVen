// Keep in step with ../da/liveWorkout.js.
//
// The card on the lock screen during a strength workout. It is drawn natively
// and never translates anything itself, so every word it shows is here -
// including the templates it fills in: {set}, {name}, {n}, {total},
// {duration}, {done} and {time} are replaced on the phone, as they stand.
export default {
  complete: "Set done",
  skip: "Skip",
  prev: "Previous",
  next: "Next",
  nowEyebrow: "CURRENT SET",
  nextEyebrow: "NEXT SET",
  pause: "REST",
  sets: "SETS",
  exercise: "EXERCISE",
  nextSet: "Next: {set}",
  nextExercise: "Next: {name}",
  setOf: "set {n} of {total}",
  setOfTitle: "Set {n} of {total}",
  setShort: "set {n}/{total}",
  of: "of {duration}",
  setsCount: "{done}/{total} sets",
  restClock: "Rest · {time}",
  restSub: "rest",
  allDone: "Every set is done",
  allDoneQuestion: "Finish the workout?",
  finish: "Finish",
  noSets: "No sets yet",
  // The weight buttons on Android's open card: "2.5 kg" beside a − and a +.
  weightStep: "{step} {unit}",
  a11yWeightMinus: "Remove {step} {unit} from set",
  a11yWeightPlus: "Add {step} {unit} to set",
  // The Android notification channels, as the phone's settings list them.
  channelName: "Workout in progress",
  restChannelName: "Rest over",
  restFinishedTitle: "Rest is over",
  restFinishedBody: "Time for the next set.",
};
