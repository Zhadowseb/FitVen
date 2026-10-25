// Un ejercicio compartido (pantalla 1b) y cómo denunciarlo.
// Las palabras que usan todas las pantallas sobre un ejercicio compartido -las etiquetas,
// "{n} usuarios", "Tú", "tu gimnasio", "Sin video"- están en customExercises.
export default {
  // El aviso en la pantalla a la que volviste.
  added: "{name} añadido a tus ejercicios",
  menu: {
    open: "Más opciones",
    report: "Denunciar el ejercicio",
  },
  video: {
    play: "Reproducir el video",
    pause: "Pausar el video",
    unavailable: "El video no se puede reproducir ahora mismo",
    needsUpdate: "Actualiza la app para reproducir el video",
  },
  owner: {
    madeOn: "Lo creó el {date}",
    profile: "Perfil",
    openProfile: "Abrir el perfil de {name}",
    someone: "Un usuario de FitVen",
  },
  stats: {
    users: "Lo usan",
    gymUsers: "En tu gimnasio",
    noGym: "Sin gimnasio",
    noGymLabel: "En tu gimnasio: no has elegido gimnasio",
    typical: "Habitual",
    unknown: "aún no se sabe",
  },
  steps: {
    title: "Cómo se hace",
    step: "Paso {number}: {text}",
  },
  distribution: {
    title: "Lo que levantan otros",
    typicalWeightReps: {
      one: "normalmente {weight} kg durante {reps} rep",
      other: "normalmente {weight} kg durante {reps} reps",
    },
    typicalWeight: "normalmente {weight} kg",
    typicalReps: { one: "normalmente {reps} rep", other: "normalmente {reps} reps" },
    rangeUnder: "menos de {to} kg",
    rangeOver: "{from} kg o más",
    rangeBetween: "de {from} a {to} kg",
    summary: {
      one: "Lo que levantan otros: lo más habitual es {range}, a partir de {sets} serie registrada.",
      other: "Lo que levantan otros: lo más habitual es {range}, a partir de {sets} series registradas.",
    },
  },
  actions: {
    add: "Añadir a mis ejercicios",
    adding: "Añadiendo…",
    added: "Añadido",
    edit: "Editar tu ejercicio",
    save: "Guardar",
    saved: "Guardado",
  },
  nameTaken: "Ya tienes un ejercicio llamado {name}, así que este no se puede añadir.",
  addFailed: "No se pudo añadir. Inténtalo de nuevo.",
  saveFailed: "No se pudo completar. Inténtalo de nuevo.",
  footnote: "Se copian a tus ejercicios el nombre, el equipamiento y el grupo muscular, no las series del creador.",
  footnoteMine: "Quien lo añada recibe el nombre, el equipamiento y el grupo muscular, nunca tus series.",
  unavailable: {
    title: "Este ejercicio ya no está disponible",
    body: "Puede que se haya eliminado o que ya no esté compartido.",
  },
  error: {
    title: "No se pudo cargar el ejercicio",
    body: "Algo salió mal por el camino. Inténtalo de nuevo en un momento.",
  },
  offline: {
    title: "Estás sin conexión",
    body: "Conéctate a internet para ver este ejercicio.",
  },
  report: {
    title: "Denunciar el ejercicio",
    message:
      "Cuéntanos qué pasa. Las denuncias las lee el desarrollador y al creador nunca se le dice quién la envió.",
    reasons: {
      wrong: "Incorrecto o engañoso",
      offensive: "Ofensivo",
      duplicate: "Duplicado",
      other: "Otro motivo",
    },
    notePlaceholder: "¿Algo más que debamos saber? (opcional)",
    send: "Enviar denuncia",
    thanks: "Gracias, le echaremos un vistazo.",
    failed: "No se pudo enviar la denuncia. Inténtalo de nuevo.",
  },
};
