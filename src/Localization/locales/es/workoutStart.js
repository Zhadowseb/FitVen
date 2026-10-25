// La hoja de empezar entrenamiento detrás del botón central de navegación: los
// mosaicos de empezar de cero, el atajo de lo planificado para hoy y la lista de
// entrenamientos para repetir.
export default {
  title: "EMPEZAR ENTRENAMIENTO NUEVO",
  titleForDate: "¿Qué haces el {date}?",
  closeSheet: "Cerrar el iniciador de entrenamientos",
  workoutCalendar: "Calendario de entrenamientos",
  ready: "Listo",
  recent: "Recientes",
  suggested: "SUGERIDOS",
  timesCount: "{count}x",
  types: {
    resistance: "Fuerza",
    run: "Carrera",
    walk: "Caminata",
    workout: "Entrenamiento",
  },
  planned: {
    promptSingleToday: "Tienes un entrenamiento planificado para hoy.",
    promptSingleOnDay: "Tienes un entrenamiento planificado para este día.",
    promptMultipleToday: "Tienes varios entrenamientos planificados para hoy.",
    promptMultipleOnDay: "Tienes varios entrenamientos planificados para este día.",
    eyebrowToday: "PLANIFICADO PARA HOY",
    eyebrow: "PLANIFICADO",
    workoutsPlanned: {
      one: "{count} entrenamiento planificado",
      other: "{count} entrenamientos planificados",
    },
    countReady: "{count} listos",
    detailWithExercises: {
      one: "{programName} - {count} ejercicio",
      other: "{programName} - {count} ejercicios",
    },
    detailReady: "{programName} - Listo",
  },
  usual: {
    title: "TUS ENTRENAMIENTOS HABITUALES",
    manage: "Gestionar",
    loading: "Buscando entrenamientos habituales...",
    empty: "Repite un entrenamiento dos veces para verlo aquí.",
  },
  repeat: {
    title: "REPETIR UN ENTRENAMIENTO",
    loading: "Cargando entrenamientos recientes...",
    loadingMore: "Cargando más entrenamientos...",
    empty: "Repite un entrenamiento dos veces para verlo aquí.",
    showExercises: "Mostrar ejercicios de {title}",
    hideExercises: "Ocultar ejercicios de {title}",
    noExercises: "Este entrenamiento no tiene ejercicios.",
  },
};
