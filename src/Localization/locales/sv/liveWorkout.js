// The card on the lock screen during a strength workout. It is drawn natively
// and never translates anything itself, so every word it shows is here -
// including the templates it fills in: {set}, {name}, {n}, {total},
// {duration}, {done} and {time} are replaced on the phone, as they stand.
export default {
  complete: "Set klart",
  // The button, with the set it ticks off.
  completeSetOf: "Set {n} av {total} klart",
  // The rest after a set with none written counts up; lock screen only.
  endRest: "Avsluta vilan",
  skip: "Hoppa över",
  prev: "Föregående",
  next: "Nästa",
  nowEyebrow: "AKTUELLT SET",
  nextEyebrow: "NÄSTA SET",
  pause: "VILA",
  sets: "SET",
  exercise: "ÖVNING",
  nextSet: "Nästa: {set}",
  nextExercise: "Nästa: {name}",
  setOf: "set {n} av {total}",
  setOfTitle: "Set {n} av {total}",
  setShort: "set {n}/{total}",
  of: "av {duration}",
  setsCount: "{done}/{total} set",
  restClock: "Vila · {time}",
  restSub: "vila",
  allDone: "Alla set är klara",
  allDoneQuestion: "Avsluta passet?",
  finish: "Avsluta",
  noSets: "Inga set än",
  // The weight buttons on Android's open card: "2.5 kg" beside a − and a +.
  weightStep: "{step} {unit}",
  a11yWeightMinus: "Ta bort {step} {unit} från setet",
  a11yWeightPlus: "Lägg till {step} {unit} i setet",
  // The Android notification channels, as the phone's settings list them.
  channelName: "Pass pågår",
  restChannelName: "Vilan är slut",
  restFinishedTitle: "Vilan är slut",
  restFinishedBody: "Dags för nästa set.",
};
