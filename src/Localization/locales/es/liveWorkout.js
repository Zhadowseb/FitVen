// La tarjeta de la pantalla de bloqueo durante un entrenamiento de fuerza. Se dibuja
// de forma nativa y nunca traduce nada por sí misma, así que cada palabra que muestra
// está aquí, incluidas las plantillas que rellena: {set}, {name}, {n}, {total},
// {duration}, {done} y {time} se sustituyen en el teléfono, tal como están.
export default {
  complete: "Serie hecha",
  // El botón, con la serie que marca como hecha.
  completeSetOf: "Serie {n} de {total} hecha",
  // El descanso tras una serie sin descanso escrito cuenta hacia arriba; solo en la pantalla de bloqueo.
  endRest: "Terminar descanso",
  skip: "Omitir",
  prev: "Anterior",
  next: "Siguiente",
  nowEyebrow: "SERIE ACTUAL",
  nextEyebrow: "SIGUIENTE SERIE",
  pause: "DESCANSO",
  sets: "SERIES",
  exercise: "EJERCICIO",
  nextSet: "Siguiente: {set}",
  nextExercise: "Siguiente: {name}",
  setOf: "serie {n} de {total}",
  setOfTitle: "Serie {n} de {total}",
  setShort: "serie {n}/{total}",
  of: "de {duration}",
  setsCount: "{done}/{total} series",
  restClock: "Descanso · {time}",
  restSub: "descanso",
  allDone: "Todas las series están hechas",
  allDoneQuestion: "¿Terminar el entrenamiento?",
  finish: "Terminar",
  noSets: "Aún no hay series",
  // Los botones de peso en la tarjeta abierta de Android: "2,5 kg" junto a un − y un +.
  weightStep: "{step} {unit}",
  a11yWeightMinus: "Quitar {step} {unit} de la serie",
  a11yWeightPlus: "Añadir {step} {unit} a la serie",
  // Los canales de notificación de Android, tal como los lista el teléfono en los ajustes.
  channelName: "Entrenamiento en curso",
  restChannelName: "Descanso terminado",
  restFinishedTitle: "El descanso ha terminado",
  restFinishedBody: "Es hora de la siguiente serie.",
};
