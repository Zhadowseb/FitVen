// Kortet på låseskjermen under en styrkeøkt. Det tegnes native og oversetter
// aldri noe selv, så hvert ord det viser står her - også malene det fyller
// inn: {set}, {name}, {n}, {total}, {duration}, {done} og {time} byttes ut på
// telefonen, akkurat som de står.
export default {
  complete: "Sett ferdig",
  // Knappen, med settet den krysser av.
  completeSetOf: "Sett {n} av {total} ferdig",
  // Hvilen etter et sett uten noen skrevet teller opp; bare låseskjermen.
  endRest: "Avslutt hvile",
  skip: "Hopp over",
  prev: "Forrige",
  next: "Neste",
  nowEyebrow: "GJELDENDE SETT",
  nextEyebrow: "NESTE SETT",
  pause: "HVILE",
  sets: "SETT",
  exercise: "ØVELSE",
  nextSet: "Neste: {set}",
  nextExercise: "Neste: {name}",
  setOf: "sett {n} av {total}",
  setOfTitle: "Sett {n} av {total}",
  setShort: "sett {n}/{total}",
  of: "av {duration}",
  setsCount: "{done}/{total} sett",
  restClock: "Hvile · {time}",
  restSub: "hvile",
  allDone: "Alle sett er ferdige",
  allDoneQuestion: "Fullføre økten?",
  finish: "Fullfør",
  noSets: "Ingen sett ennå",
  // Vektknappene på Androids åpne kort: "2,5 kg" ved siden av en − og en +.
  weightStep: "{step} {unit}",
  a11yWeightMinus: "Ta {step} {unit} fra settet",
  a11yWeightPlus: "Legg {step} {unit} til settet",
  // Androids varslingskanaler, slik telefonens innstillinger lister dem.
  channelName: "Økt pågår",
  restChannelName: "Hvilen er over",
  restFinishedTitle: "Hvilen er over",
  restFinishedBody: "På tide med neste sett.",
};
