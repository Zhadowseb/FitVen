// La pestaña Explorar: la portada, su búsqueda y las formas de entrar.
export default {
  title: "Explorar",
  searchPlaceholder: "Buscar gimnasios y personas",
  tiles: {
    gyms: "Gimnasios",
    gymsSub: "Encuentra tu gimnasio",
    gymsCount: { one: "{value} en Dinamarca", other: "{value} en Dinamarca" },
    programs: "Programas",
    programsCount: { one: "{value} para elegir", other: "{value} para elegir" },
    exercises: "Ejercicios",
    exercisesCount: { one: "{value} de usuarios", other: "{value} de usuarios" },
    // Mientras no se sabe el número, y mientras no se ha compartido nada.
    exercisesSub: "Creados por usuarios",
    exercisesFirst: "Comparte el primero",
    records: "Récords",
    recordsSub: "El top 100 de Dinamarca",
  },
  programs: {
    title: "Programas",
    emptyTitle: "Aún no hay programas para elegir",
    emptyBody: "Aquí habrá programas seleccionados a mano para seguirlos tal cual.",
  },
  customExercises: {
    title: "Ejercicios creados por usuarios",
    emptyTitle: "Aún no hay ejercicios compartidos",
    emptyBody: "Cuando la gente comparta los ejercicios que ha creado, podrás encontrarlos y añadirlos a los tuyos aquí.",
  },
  sections: {
    yourGym: "Tu gimnasio",
    change: "Cambiar",
    customExercises: "Ejercicios nuevos de otros",
    all: "Todos",
    allCount: { one: "Abrir la biblioteca", other: "Todos ({value})" },
    allExercisesA11y: {
      one: "Abrir la biblioteca con {value} ejercicio",
      other: "Ver los {value} ejercicios",
    },
    centerPosts: "Publicaciones de gimnasios",
  },
  centerPostLabel: "{name}: {title}, en {gym}",
  centerPosts: {
    eyebrow: "Publicaciones de",
    fallbackTitle: "Un gimnasio",
    emptyTitle: "Este gimnasio aún no tiene publicaciones",
    emptyBody: "Cuando alguien que puedes ver publique un entrenamiento hecho aquí, aparecerá aquí.",
    failed: "No se pudieron cargar las publicaciones. Inténtalo de nuevo en un momento.",
  },
  yourGym: {
    newRecords: { one: "{value} récord nuevo", other: "{value} récords nuevos" },
    noNewRecords: "Ningún récord nuevo desde tu última visita",
    latestLabel: "Último récord: {name}, {exercise}, {weight} kg",
    pick: "Elige tu gimnasio",
    pickDetail: "Mira sus récords y quién entrena allí",
  },
  search: {
    hint: {
      all: "Escribe al menos dos letras para buscar gimnasios y personas.",
      gyms: "Escribe al menos dos letras para buscar gimnasios.",
      people: "Escribe al menos dos letras para buscar personas.",
    },
    placeholder: {
      all: "Buscar gimnasios y personas",
      gyms: "Buscar gimnasios",
      people: "Buscar personas",
    },
    scope: {
      all: "Ambos",
      gyms: "Gimnasios",
      people: "Personas",
    },
    failed: "La búsqueda no se completó. Inténtalo de nuevo en un momento.",
    nothing: "No se encontró nada para «{query}».",
    clear: "Borrar la búsqueda",
    gyms: "Gimnasios",
    people: "Personas",
    following: "Los sigues",
    allPeople: "Ver a todos y seguir",
    // Gimnasios elegidos, nada escrito aún: tu gimnasio, aquellos en los que has
    // entrenado y los más concurridos de la región de tu gimnasio ({where} trae
    // su preposición).
    suggestions: {
      yours: "Tu gimnasio",
      trainedIn: "Donde has entrenado",
      workouts: { one: "{count} entrenamiento", other: "{count} entrenamientos" },
      busiestIn: "Más concurridos {where}",
      busiest: "Gimnasios más concurridos",
    },
  },
};
