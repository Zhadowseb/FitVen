// La bandeja de notificaciones y sus ajustes.
export default {
  title: "Notificaciones",
  loading: "Cargando notificaciones...",
  unavailable: "Notificaciones no disponibles",
  signInToView: "Inicia sesión para ver las notificaciones.",
  loadFailed: "No se pudieron cargar las notificaciones.",
  unread: "Sin leer",
  itemLabel: "{title}. {body}",
  hints: {
    openActivity: "Abre la actividad de hoy",
    openExercise: "Abre tu ejercicio",
    openPost: "Abre tu publicación",
  },
  // La fila de la bandeja que escribe el servidor cuando tres personas han denunciado
  // uno de tus ejercicios compartidos. El título y el cuerpo del servidor están en
  // inglés; esto es lo que muestra la página en su lugar.
  customExerciseHidden: {
    title: "Tu ejercicio se ocultó",
    body: "{name} fue denunciado por varias personas y ya no aparece en la biblioteca. Las copias que ya se añadieron se quedan.",
  },
  // La fila de la bandeja que escribe el servidor cuando alguien da me gusta a una de
  // tus publicaciones. {name} es quien dio me gusta; el cuerpo es el entrenamiento de la publicación.
  postLiked: {
    title: "A {name} le gustó tu publicación",
    bodyFallback: "Tu publicación de entrenamiento",
    someone: "Alguien",
  },
  emptyTitle: "Estás al día",
  emptyBody: "Cuando alguien empiece un entrenamiento o dé me gusta a una de tus publicaciones, lo verás aquí.",
  openSettings: "Abrir los ajustes de notificaciones",

  settings: {
    eyebrow: "Ajustes",
    lockScreenTitle: "Mostrar el entrenamiento en la pantalla de bloqueo",
    lockScreenBody:
      "Mientras entrenas fuerza, la serie, el descanso y el tiempo aparecen en la pantalla de bloqueo y en la Dynamic Island, con botones para marcar la serie como hecha y omitir el descanso. Un sonido te avisa cuando termina el descanso.",
    lockScreenUnavailable:
      "Tu teléfono no muestra la tarjeta ahora mismo. En iPhone necesita iOS 16.2 o posterior, con las Actividades en vivo activadas para FitVen en Ajustes.",
    signInToManage: "Inicia sesión para gestionar los ajustes de notificaciones.",
    loadFailed: "No se pudieron cargar los ajustes de notificaciones.",
    saveFailed: "No se pudieron guardar los ajustes de notificaciones.",
    updateSourcesFailed: "No se pudo actualizar la lista personalizada de notificaciones.",
    // La preferencia se guarda de todos modos; esto explica por qué el propio
    // dispositivo puede seguir sin recibir nada.
    savedPermissionDenied:
      "Guardado. No se concedió el permiso de notificaciones en este dispositivo.",
    savedBlockedByOwner:
      "Guardado. Otra cuenta sigue con la sesión iniciada en las notificaciones de este dispositivo, así que esta aún no las recibirá. Cierra la sesión de la otra cuenta o espera una semana a que se libere.",
    savedRegistrationFailed:
      "Guardado. Este dispositivo no pudo registrarse para las notificaciones push, así que puede que aún no las reciba.",
    postLikesTitle: "Cuando a alguien le gusta tu publicación",
    postLikesBody:
      "Recibe una notificación cuando a alguien le guste una de tus publicaciones de entrenamiento. Una vez por persona y publicación.",
    postLikesUnavailable:
      "Este ajuste aún no está disponible. Los me gusta no se avisan hasta que lo esté.",
    postLikesSaveFailed: "No se pudo guardar el ajuste de me gusta.",
    workoutStartTitle: "Cuando empieza un entrenamiento",
    workoutStartBody:
      "Elige quién activa una notificación cuando empieza a entrenar.",
    modes: {
      none: {
        title: "Sin notificaciones",
        body: "Sin notificaciones cuando alguien empieza un entrenamiento.",
      },
      following: {
        title: "Todos a quienes sigo",
        body: "Recibe un aviso cuando cualquier usuario que sigues empiece un entrenamiento.",
      },
      custom: {
        title: "Elegir personas concretas",
        body: "Solo las personas que elijas abajo.",
      },
    },
    selectedCount: "SELECCIONADOS ({count})",
    removeNamed: "Quitar a {name}",
    personFallback: "persona",
    nobodySelected: "Aún no hay nadie seleccionado. Elige personas de la lista de abajo.",
    searchPlaceholder: "Buscar entre las personas que sigues",
    noMatches: "Ninguna persona seguida coincide.",
  },

  // Lo lanza Services/notificationService.js y se muestra como error.message.
  errors: {
    signInToLoadSettings:
      "Tienes que iniciar sesión para cargar los ajustes de notificaciones.",
    signInToUpdateSettings:
      "Tienes que iniciar sesión para actualizar los ajustes de notificaciones.",
    signInToLoad: "Tienes que iniciar sesión para cargar las notificaciones.",
  },
};
