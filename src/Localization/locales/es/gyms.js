// Gimnasios: las pantallas de gimnasios (todos los países, un país, una región), la
// página de un gimnasio, la clasificación de un ejercicio (en un gimnasio y en toda
// Dinamarca), la hoja de cambiar de gimnasio y los errores del servicio de gimnasios.
export default {
  // Palabras que comparten varias de estas pantallas.
  centre: "Gimnasio",
  yourCentre: "tu gimnasio",
  weightKg: "{weight} kg",
  noLiftsYet: "Aún no hay levantamientos",
  searchFailed: "La búsqueda falló.",
  searchCentresA11y: "Buscar gimnasios",

  // Las pantallas de gimnasios: todos los países, un país, una región.
  global: "Global",
  title: "Gimnasios",
  chooseCountry: "Elegir país",
  search: "Buscar un gimnasio",
  // {where} trae su preposición: "en Selandia".
  searchIn: "Buscar un gimnasio {where}",
  myGym: "Tu gimnasio",
  members: {
    one: "{count} persona entrena aquí · sigues a {following} de ellas",
    other: "{count} personas entrenan aquí · sigues a {following} de ellas",
  },
  allCountries: "Todos los países",
  fromLocation: "desde tu ubicación",
  countriesWithLifts: "Países con levantamientos",
  onlyWithLifts: "Solo se muestran los países con levantamientos registrados.",
  regionsIn: "Regiones {where}",
  gymsIn: "Gimnasios {where}",
  categories: "Categorías",
  sortedByActivity: "por lo que más se entrena aquí",
  // Un gimnasio como lugar, para "no en {gym}".
  atGym: "en {gym}",
  // Un lugar sin frase propia.
  inPlace: "en {place}",
  // Las cuatro regiones de Dinamarca con sus preposiciones, para cuando el servidor
  // envía una región sin ella. Las claves son gym.region_key.
  regionsWhere: {
    sjaelland: "en Selandia",
    jylland: "en Jutlandia",
    fyn: "en Fionia",
    bornholm: "en Bornholm",
  },

  counts: {
    centres: { one: "{value} gimnasio", other: "{value} gimnasios" },
    lifters: { one: "{value} levantador", other: "{value} levantadores" },
  },

  // Todos los países: el país en el que estás, sobre la lista.
  location: {
    title: "Tu ubicación",
    noLifts: "Aún no hay levantamientos registrados aquí",
  },

  // Lo que dice un nivel cuando no puede mostrarse.
  levels: {
    loadFailed: "No se pudieron cargar los gimnasios.",
    unavailableTitle: "Gimnasios no disponibles",
    notYetTitle: "En camino",
    notYetBody:
      "Las categorías y las regiones aún no están configuradas. Aun así puedes buscar un gimnasio y abrir el tuyo.",
    cardsNotYet: "Las categorías aún no están configuradas.",
    cardsFailed: "No se pudieron cargar las categorías.",
    noCountries: "Ningún país tiene aún levantamientos registrados.",
    noRegions: "Los gimnasios de aquí aún no están divididos en regiones.",
    noGyms: "Aún no hay gimnasios {where}.",
  },

  // Resultados de búsqueda, en lugar del nivel.
  results: {
    title: "Resultados",
    count: "{count} encontrados",
    noMatchTitle: "Ningún gimnasio coincide",
    noMatchBody: "Prueba con la cadena, la ciudad o parte del nombre del gimnasio.",
  },

  // Una categoría en una tarjeta: en un nivel y en un gimnasio.
  card: {
    topRank: "N.º 1",
    topAt: "N.º 1 · {gym}",
    topDetail: "N.º 1 · {detail}",
    // {where} trae su preposición: "N.º 4 en Selandia".
    rankWhere: "N.º {rank} {where}",
    rankOf: "N.º {rank} de {total}",
    notRanked: "aún no está en la lista",
    empty: "Todavía no hay nadie en la lista.",
    a11yTop: "Número 1: {name}, {value}",
    a11yHint: "Abre la lista completa",
  },

  scope: {
    centre: "Gimnasio",
    friends: "Amigos",
    centreWithCount: "Gimnasio · {count}",
    friendsWithCount: "Amigos · {count}",
  },

  unit: {
    bodyweight: "×PC",
  },

  // Una línea de una lista clasificada.
  row: {
    yourCentre: "· tu gimnasio",
  },

  // Un gimnasio: portada, su lugar, las cuatro categorías, cada ejercicio.
  overview: {
    notFound: "No se encontró ese gimnasio.",
    loadFailed: "No se pudo cargar el gimnasio.",
    unavailableTitle: "Gimnasio no disponible",
    changeCentre: "Cambiar de gimnasio",
    yourCentre: "Tu gimnasio",
    membersTrainHere: { one: "{count} persona entrena aquí", other: "{count} personas entrenan aquí" },
    youFollow: "sigues a {count} de ellas",
    allExercises: "Todos los ejercicios",
  },

  // Los ejercicios del gimnasio en su página: la búsqueda, la sección y "Todos los ejercicios".
  centreExercises: {
    title: "Ejercicios",
    sortedByLifters: "primero los que más gente levanta",
    searchPlaceholder: "Buscar entre los ejercicios de este gimnasio",
    clearSearch: "Borrar la búsqueda",
    resultsTitle: "Ejercicios de aquí",
    noMatchTitle: "Ningún ejercicio coincide",
    noMatchBody: "Estos son los ejercicios que se levantan en este gimnasio. Prueba con parte del nombre.",
    searchLoading: "Cargando todos los ejercicios de este gimnasio…",
    searchFailedTitle: "No se pudieron cargar todos los ejercicios",
    searchFailedBody: "Por ahora la búsqueda solo cubre los más levantados.",
    topLine: "N.º 1 {name} {weight} kg",
    yourRank: "N.º {rank}",
    yourRankA11y: "eres el número {rank}",
    openHint: "Abre la clasificación del ejercicio en este gimnasio",
    emptyBody: "Termina un entrenamiento aquí y tus levantamientos entrarán en las listas.",
    allDetail: { one: "{count} ejercicio clasificado aquí", other: "{count} ejercicios clasificados aquí" },
    allHint: "Abre las clasificaciones, con un botón para cada ejercicio",
  },

  // La hoja de cambiar de gimnasio.
  change: {
    body: "Tu gimnasio es donde más has entrenado en los últimos 90 días, salvo que elijas uno aquí.",
    searchPlaceholder: "Buscar entre todos los gimnasios",
    loadFailed: "No se pudieron cargar tus gimnasios.",
    saveFailed: "No se pudo cambiar tu gimnasio.",
    resultCount: { one: "{count} resultado", other: "{count} resultados" },
    automatic: "Automático",
    automaticMeta: "Donde más entrenas",
    trainedHere: "Donde has entrenado",
    emptyBody: "Termina un entrenamiento en un gimnasio y aparecerá aquí. O busca arriba.",
    gymMeta: { one: "{chain} · {count} entrenamiento", other: "{chain} · {count} entrenamientos" },
  },

  // Un ejercicio clasificado, en un gimnasio o en toda Dinamarca.
  exercise: {
    titleFallback: "Ejercicio",
    nationalEyebrow: "Todos los gimnasios · Dinamarca",
    unavailableTitle: "Clasificación no disponible",
    loadFailed: "No se pudo cargar la clasificación.",
    loadMoreFailed: "No se pudo cargar más.",
    pickExercise: "Elige un ejercicio.",
    empty: {
      noBodyweightTitle: "Sin peso corporal registrado",
      noBodyweightBody:
        "Clasificar por peso corporal requiere un peso corporal en el levantamiento, y nadie de aquí lo ha registrado.",
      noFriendsTitle: "Ninguno de tus amigos levanta aquí todavía",
      noLiftsBody: "Termina un entrenamiento con este ejercicio en el gimnasio y el primer levantamiento será tuyo.",
    },
  },

  // Errores que lanza el servicio de gimnasios; las pantallas muestran error.message tal cual.
  errors: {
    generic: "Algo salió mal con los gimnasios.",
    signInToChoose: "Tienes que iniciar sesión para elegir un gimnasio.",
  },
};
