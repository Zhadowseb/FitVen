// Páginas de ajustes: tipos de entrenamiento, publicaciones sociales, música.
export default {
  eyebrow: "Ajustes",

  workoutTypes: {
    title: "Tipos de entrenamiento",
    availableEyebrow: "DISPONIBLES",
    sectionTitle: "Tipos de entrenamiento",
    typesCount: "{count} TIPOS",
    available: "Disponible",
    types: {
      strength: {
        title: "Entrenamiento de fuerza",
        category: "FUERZA",
        metrics: "SERIES  /  REPS  /  PESO",
      },
      run: {
        title: "Carrera",
        category: "CARDIO",
        metrics: "DISTANCIA  /  RITMO  /  TIEMPO",
      },
    },
    exerciseCards: "Tarjetas de ejercicio",
    exerciseCardsSubtitle: "Elige el diseño y los detalles de las series para los ejercicios contraídos",
    cardLayout: "Diseño de tarjeta",
    setSummary: "Resumen de series",
    preview: "Vista previa",
    previewExercise: "Press banca",
    views: {
      cells: "Estándar",
      compact: "Compacta",
      progressOnly: "Solo progreso",
    },
    cardLayouts: {
      compact: "Diseño compacto",
      classic: "Diseño clásico",
    },
    birthDate: "Fecha de nacimiento",
    birthDateWithAge: "{date}  /  Edad {age}",
    setBirthDate: "Indicar fecha de nacimiento",
    birthDatePickerTitle: "Fecha de nacimiento para correr",
    maxHeartRate: "Frecuencia cardíaca máxima",
    maxHeartRateEmpty: "Indica la fecha de nacimiento o introdúcela a mano",
    bpm: "{value} ppm",
    howWorkedOut: "Cómo se calcula",
    manualValue: "Valor manual",
    clearManualValue: "Borrar valor manual",
    maxBpmPlaceholder: "ppm máx.",
    currentBpmPlaceholder: "Actual {value} ppm",
    wholeNumberError: "Usa un número entero de {min} a {max}.",
    saving: "Guardando...",
    sources: {
      auto: {
        title: "Auto",
        detail: "Manual, luego calculado, luego medido",
      },
      manual: {
        title: "Manual",
        missing: "Introduce y guarda primero un valor manual",
      },
      calculated: {
        title: "Calculado",
        missing: "Indica primero tu fecha de nacimiento",
        fromAge: "{value} ppm según la edad",
      },
      measured: {
        title: "Medido",
        missing: "No hay ningún valor medido disponible",
      },
    },
    errors: {
      signIn: "Inicia sesión para gestionar los ajustes de carrera.",
      load: "No se pudieron cargar los ajustes de carrera.",
      saveBirthDate: "No se pudo guardar la fecha de nacimiento.",
      saveMaxHeartRate: "No se pudo guardar la frecuencia cardíaca máxima.",
      saveSource: "No se pudo guardar el origen de la frecuencia cardíaca máxima.",
    },
  },

  socialPosts: {
    title: "Publicaciones sociales",
    scopeNote: "Se aplica a todos los entrenamientos",
    summariesTitle: "Resúmenes de entrenamiento",
    summariesBody: "Comportamiento actual de publicación para los entrenamientos completados.",
    modes: {
      fullInfo: "Info completa",
      summaryOnly: "Solo resumen",
      off: "Desactivado",
    },
    nothingPosted: "No se publica nada.",
    preview: {
      duration: "48 min",
      benchPress: "Press banca",
      barbellRow: "Remo con barra",
    },
    visibilityEyebrow: "Visibilidad",
    visibility: {
      everyone: "Todos",
      following: "Personas a las que sigo",
      private: "Solo yo",
    },
    visibilityNote:
      "Decide quién puede ver tus publicaciones de resumen de entrenamiento. Solo yo las mantiene fuera de cualquier otro feed.",
    exercisesEyebrow: "Ejercicios",
    walksEyebrow: "Caminatas",
    shareWalkRoute: "Compartir la ruta de una caminata",
    shareWalkRouteNote: "El valor por defecto del interruptor Compartir ruta cuando publicas una caminata. El inicio y el final de la ruta siempre se omiten, y la ruta exacta nunca sale de tu teléfono.",
    exerciseVisibility: "Visibilidad de ejercicios",
    exerciseVisibilityBody: "Elige qué ejercicios pueden aparecer en las mejores series y en las insignias de PR.",
    errors: {
      load: "No se pudieron cargar los ajustes de publicaciones sociales.",
      save: "No se pudieron guardar los ajustes de publicaciones sociales.",
      saveVisibility: "No se pudo guardar la visibilidad de las publicaciones.",
    },
  },

  oneRepMax: {
    eyebrow: "Entrenar",
    title: "Calculadora de 1RM",
    weight: "Peso",
    reps: "Reps",
    weightPlaceholder: "p. ej., 100",
    repsPlaceholder: "p. ej., 5",
    repsSuffix: "reps",
    resultLabel: "1RM ESTIMADO",
    roundedNote: "Redondeado a los 0,5 kg más cercanos.",
    calculate: "Calcular 1RM estimado",
    loadsEyebrow: "CARGAS DE ENTRENAMIENTO",
    loadsTitle: "Porcentaje del 1RM estimado",
    aboutTitle: "Sobre la estimación",
    aboutBody:
      "El resultado usa la misma fórmula de Brzycki que tus récords personales automáticos y toma el mismo rango de 1-{max} repeticiones en el que se guardan esos récords. Más allá, la fórmula se aleja mucho de lo que alguien levanta de verdad. La fatiga, la técnica y la elección del ejercicio también cambian el resultado, así que tómalo como una estimación.",
    reset: "Restablecer calculadora",
    errors: {
      weight: "Introduce un peso mayor que 0.",
      reps: "Introduce un número entero entre 1 y {max}.",
    },
  },
};
