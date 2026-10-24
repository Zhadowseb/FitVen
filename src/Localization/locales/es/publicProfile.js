// El perfil de otra persona -la página a la que llegas desde un nombre- y el tuyo
// visto como lo ven otros.
export default {
  menu: {
    open: "Opciones del perfil",
    share: "Compartir perfil",
  },
  following: "Siguiendo",
  share: {
    action: "Compartir",
    // No hay perfil en la web al que enlazar, así que el mensaje lleva el nombre de
    // usuario, que es lo que lo encuentra en la búsqueda.
    message: "{name} en FitVen (@{username})",
  },
  // Después del nombre del gimnasio, cuando también es el gimnasio de quien mira.
  yourCentre: "· tu gimnasio",
  // La indicación en un nombre o una foto que abre el perfil de alguien.
  opensProfile: "Abre su perfil",
  stats: {
    followers: "Seguidores",
    following: "Siguiendo",
    workouts: "Entrenamientos",
  },
  records: {
    title: "Récords",
    rankAt: "N.º {rank} en {gym}",
    rank: "N.º {rank} en el gimnasio",
    notRanked: "Sin clasificar",
  },
  activity: {
    title: "Actividad",
    perWeek: { one: "entrenamiento por semana", other: "entrenamientos por semana" },
    footnote: "{count} semanas · última semana resaltada",
    // Se lee en lugar de las barras, que no llevan números propios.
    barsLabel: "Entrenamientos por semana en las últimas {count} semanas, de la más antigua a la más reciente: {weeks}",
  },
  posts: {
    title: "Publicaciones",
    seeAll: "Ver las {count}",
    openPost: "Abrir la publicación {title}",
    untitled: "Entrenamiento",
    failed: "No se pudieron cargar las publicaciones.",
  },
  preview: {
    title: "Cómo te ven los demás",
    banner: "Vista previa. Así ve tu perfil alguien que no te sigue.",
  },
  // No encontrado y bloqueado se leen igual, a propósito.
  unavailable: {
    title: "Este perfil no está disponible",
    body: "Puede que se haya eliminado o que no se pueda abrir ahora mismo.",
  },
  error: {
    title: "No se pudo cargar el perfil",
    body: "Comprueba tu conexión e inténtalo de nuevo.",
  },
  // La lista completa tras "Ver todas".
  userPosts: {
    eyebrow: "Publicaciones de",
    fallbackTitle: "Publicaciones",
    emptyTitle: "No hay publicaciones que mostrar",
    emptyBody: "Cuando publique un entrenamiento que puedas ver, aparecerá aquí.",
    failed: "No se pudieron cargar las publicaciones. Inténtalo de nuevo en un momento.",
  },
};
