// Las cuatro categorías en las que se clasifican los gimnasios y las palabras
// que comparten todas las pantallas sobre ellas: nombres, filtros, unidades.
export default {
  names: {
    flid: "Constancia",
    powerlifting: "Powerlifting",
    fremgang: "Progreso",
    calisthenics: "Calistenia",
  },
  descriptions: {
    flid: "Más entrenamientos · {period}",
    powerlifting: "Press banca + sentadilla + peso muerto · levantamiento más pesado",
    fremgang: "Mayor subida en los últimos 30 días",
    calisthenics: "Dominadas × 3 + fondos × 2 + flexiones",
  },
  gender: {
    all: "Todos",
    men: "Hombres",
    women: "Mujeres",
  },
  ageGroups: {
    all: "Todas las edades",
    u23: "Menos de 23",
    age23to39: "23–39",
    age40plus: "40+",
  },
  periods: {
    week: "Semana",
    month: "Mes",
    year: "Año",
  },
  flidTabs: {
    workouts: "Entrenamientos",
    streak: "Semanas seguidas",
  },
  units: {
    workouts: { one: "entrenamiento", other: "entrenamientos" },
    weeks: { one: "semana", other: "semanas" },
    kg: "kg",
    percent: "%",
    points: { one: "punto", other: "puntos" },
  },
  weightClasses: {
    all: "Todos los pesos",
  },
  notIn: "no {where}",
  notInFilter: "No estás en {filter}. Elige Todos para ver tu posición.",
  countries: {
    DK: "Dinamarca",
  },
  // "en Dinamarca" - para "no {where}" y "Buscar un gimnasio {where}".
  countriesWhere: {
    DK: "en Dinamarca",
  },

  // La página de la categoría (5a-5d). Los números de las reglas ({count},
  // {days}, {sets}, {reps}, {activeDays} y los factores) vienen de
  // Utils/gymCategories.js.
  page: {
    allCountries: "Todos los países",
    gymFallback: "El gimnasio",
    friends: "Amigos",
  },
  // Bajo el título: cómo se cuenta la categoría.
  explanations: {
    flidWorkouts: "Cada entrenamiento terminado del periodo, de cualquier tipo.",
    flidStreak:
      "Semanas seguidas con al menos {count} entrenamientos terminados, de lunes a domingo. Esta semana cuenta cuando llega a {count}. Una semana de enfermedad corta la racha.",
    powerlifting:
      "El peso más alto que has levantado en press banca, sentadilla y peso muerto, sumados. Una serie cuenta para cada número de repeticiones menor: 90 kg × 3 también son 90 kg para 1. Un levantamiento que falta cuenta como 0.",
    fremgang:
      "Mayor subida del 1RM estimado en los últimos {days} días frente a los {days} anteriores, con series de 1–{reps} repeticiones. Al menos {sets} series en ambos periodos.",
    calisthenics:
      "Más repeticiones en una serie sin peso añadido, por dificultad: dominadas × {pullups}, fondos × {dips}, flexiones × {pushups}. Se suman.",
  },
  empty: {
    title: "Todavía no hay nadie en la lista",
    friendsTitle: "Nadie a quien sigues está aún en la lista",
    members: "Participa todo el que ha entrenado en un gimnasio de aquí en los últimos {activeDays} días.",
    membersGym: "Participa todo el que ha entrenado aquí en los últimos {activeDays} días.",
    flidWorkouts: "Cuenta cada entrenamiento terminado del periodo.",
    flidStreak: "Una semana cuenta cuando tiene al menos {count} entrenamientos terminados.",
    powerlifting: "Una serie de press banca, sentadilla o peso muerto te da un total.",
    fremgang: "Hacen falta al menos {sets} series del mismo ejercicio en los dos periodos de {days} días.",
    calisthenics: "Una serie de dominadas, fondos o flexiones sin peso añadido suma puntos.",
  },
  errors: {
    title: "No se pudo cargar la lista",
    body: "Comprueba tu conexión e inténtalo de nuevo.",
    refreshFailed: "No se pudo actualizar la lista.",
  },
  unavailable: {
    title: "Aún no disponible",
    body: "Las clasificaciones por categoría aún no están activadas. Vuelve más tarde.",
  },
  // Tu propia fila, abajo del todo.
  me: {
    gap: "{gap} para el n.º {rank}",
    tied: "A la par con el n.º {rank}",
    leading: "Vas en cabeza",
    homeGymRank: "N.º {rank} en tu gimnasio",
    notOnListTitle: "No estás en esta lista",
    noValueTitle: "Todavía no estás en la lista",
    notOnListBody: "Cuenta a quienes han entrenado en un gimnasio de aquí en los últimos {activeDays} días.",
    notOnListBodyGym: "Cuenta a quienes han entrenado aquí en los últimos {activeDays} días.",
  },
  // La línea bajo un nombre: en la lista, y bajo el n.º 1 en la tarjeta de un gimnasio.
  rows: {
    streak: { one: "{count} semana seguida", other: "{count} semanas seguidas" },
    last: "entrenó {when}",
    powerlifting: "B {bench} · S {squat} · PM {deadlift}",
    fremgang: "{lift} {before} → {now} kg",
    calisthenics: "Dom {pullups} · Fon {dips} · Flex {pushups}",
  },
  // "Tu progreso" y "Tus puntos".
  personal: {
    progress: "Tu progreso",
    progressEmpty:
      "Haz al menos {sets} series del mismo ejercicio en los últimos {days} días y en los {days} anteriores, y tu progreso aparecerá aquí.",
    points: "Tus puntos",
    pullups: "Dom",
    dips: "Fon",
    pushups: "Flex",
    formula: "× {factor} = {points}",
    factor: "× {factor}",
  },
  filters: {
    period: "Periodo",
    age: "Edad",
    ageHint: "Según el año de nacimiento de tu perfil. Sin él, solo estás en Todas las edades.",
    weightClass: "Categoría de peso",
    weightClassStatic: "Todavía no se puede indicar el peso corporal, así que todos están en Todos los pesos.",
  },
  // Los tres botones de powerlifting abajo - y el levantamiento en el que fue una subida de Progreso.
  lifts: {
    title: "Cada levantamiento por separado",
    bench: "Press banca",
    squat: "Sentadilla",
    deadlift: "Peso muerto",
    gymHint: "Abre la lista del gimnasio para el levantamiento",
    nationalHint: "Abre la lista nacional para el levantamiento",
  },
};
