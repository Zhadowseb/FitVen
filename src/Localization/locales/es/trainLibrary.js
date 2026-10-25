// Los mosaicos de la biblioteca de la pestaña Entrenar, Tu forma y las herramientas.
export default {
  // Los cuatro mosaicos de la cuadrícula.
  workouts: "Entrenamientos",
  records: "Récords",
  exercises: "Ejercicios",
  programs: "Programas",
  // Junto al número de programas; se omite cuando no hay ninguno activo.
  activePrograms: { one: "{count} activo", other: "{count} activos" },

  // "Tu forma". El número de la racha se dibuja aparte, más grande, así que las
  // palabras de al lado no llevan número.
  form: {
    weeksInRow: { one: "semana seguida", other: "semanas seguidas" },
    threshold: {
      one: "con al menos {count} entrenamiento",
      other: "con al menos {count} entrenamientos",
    },
    perWeek: "por semana",
  },

  tools: {
    oneRepMax: "Calculadora de 1RM",
    sickDays: "Días enfermo",
    thisYear: "este año",
    // La herramienta de 1RM sin ninguna serie desde la que estimar.
    noLifts: { one: "Sin levantamientos en {count} día", other: "Sin levantamientos en {count} días" },
  },

  // Lo que lee un lector de pantalla para cada mosaico.
  a11y: {
    workouts: "Entrenamientos: {total} en total, {week} esta semana",
    records: "Récords: {total} en total, {week} esta semana",
    exercises: "Ejercicios: {count} en el catálogo",
    programs: "Programas: {count} en total, {active}",
    form: "Tu forma: {streak} {weeks}, {threshold}, {average} por semana",
    oneRepMax: "Calculadora de 1RM: {value} kg estimados a partir de {exercise}, {weight} kg durante {reps}",
    oneRepMaxEmpty: "Calculadora de 1RM: {detail}",
    sickDays: "Días enfermo: {count} este año",
  },
};
