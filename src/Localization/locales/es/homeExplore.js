// El carrusel "De Explorar" de Inicio: una fila de tarjetas de Explorar -tu
// gimnasio, ejercicios nuevos, publicaciones de gimnasios, los más fuertes de
// Dinamarca- y las formas de entrar para quien aún no tiene nada de eso. El nombre
// de la biblioteca es explore.customExercises.title y "{n} usuarios" es
// customExercises.users.
export default {
  title: "De Explorar",
  open: "Abrir",
  openA11y: "Abrir Explorar",
  loadingA11y: "Cargando tarjetas de Explorar",
  // Lo que lee un lector de pantalla para una tarjeta: "Tu gimnasio: 3 récords nuevos, Anna, hace 2 h".
  cardA11y: "{kicker}: {title}, {meta}",
  cardA11yShort: "{kicker}: {title}",
  // Un récord: "Press banca · 120 kg".
  liftTitle: "{exercise} · {weight} kg",
  // La línea sobre cada título: qué tipo de tarjeta es.
  kickers: {
    gymRecords: "Tu gimnasio",
    exercise: "Ejercicio nuevo",
    centrePost: "Publicación",
    strongest: "Los más fuertes de Dinamarca",
    findGym: "Gimnasios",
    customExercises: "Ejercicios",
  },
  gymRecords: {
    newRecords: { one: "{value} récord nuevo", other: "{value} récords nuevos" },
    seeRecords: "Ver los récords del gimnasio",
  },
  findGym: {
    title: "Encuentra tu gimnasio",
    meta: "Récords y publicaciones de donde entrenas",
  },
  customExercises: {
    meta: "Comparte uno propio",
  },
};
