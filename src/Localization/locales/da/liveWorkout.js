// Keep in step with ../en/liveWorkout.js.
//
// The card on the lock screen during a strength workout. It is drawn natively
// and never translates anything itself, so every word it shows is here -
// including the templates it fills in: {set}, {name}, {n}, {total},
// {duration}, {done} and {time} are replaced on the phone, as they stand.
export default {
  complete: "Sæt færdigt",
  skip: "Spring over",
  prev: "Forrige",
  next: "Næste",
  nowEyebrow: "NUVÆRENDE SÆT",
  nextEyebrow: "NÆSTE SÆT",
  pause: "PAUSE",
  sets: "SÆT",
  exercise: "ØVELSE",
  nextSet: "Næste: {set}",
  nextExercise: "Næste: {name}",
  setOf: "sæt {n} af {total}",
  setOfTitle: "Sæt {n} af {total}",
  setShort: "sæt {n}/{total}",
  of: "af {duration}",
  setsCount: "{done}/{total} sæt",
  restClock: "Pause · {time}",
  restSub: "pause",
  allDone: "Alle sæt er færdige",
  noSets: "Ingen sæt endnu",
  // The weight buttons on Android's open card: "2,5 kg" beside a − and a +.
  weightStep: "{step} {unit}",
  a11yWeightMinus: "Træk {step} {unit} fra sættet",
  a11yWeightPlus: "Læg {step} {unit} til sættet",
  // The Android notification channels, as the phone's settings list them.
  channelName: "Træning i gang",
  restChannelName: "Pause slut",
  restFinishedTitle: "Pausen er slut",
  restFinishedBody: "Tid til næste sæt.",
};
