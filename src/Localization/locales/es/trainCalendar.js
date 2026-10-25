// El bloque de calendario de la pestaña Entrenar: la semana pasada y esta semana.
//
// El resto del bloque reutiliza los textos del propio calendario: calendar.title,
// calendar.workoutsHeading y home.weekdays para la fila de días.
export default {
  // La línea bajo "Calendario". Con un programa activo la semana se cuenta frente a lo
  // planificado; sin él, solo lo que se hizo.
  subtitle: {
    program: {
      zero: "Nada planificado esta semana",
      one: "{done} de {count} entrenamiento esta semana",
      other: "{done} de {count} entrenamientos esta semana",
    },
    split: {
      one: "{count} entrenamiento esta semana",
      other: "{count} entrenamientos esta semana",
    },
  },
};
