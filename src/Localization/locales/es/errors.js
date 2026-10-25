// Mensajes lanzados por los servicios que llegan a la pantalla.
export default {
  socialPost: {
    signInToUpdatePostSettings: "Tienes que iniciar sesión para actualizar los ajustes de las publicaciones sociales.",
    signInToUpdateExerciseSettings: "Tienes que iniciar sesión para actualizar los ajustes de ejercicios.",
    exerciseNotSynced: "Este ejercicio aún no se ha sincronizado con Supabase.",
    signInToEditPosts: "Tienes que iniciar sesión para editar publicaciones de entrenamiento.",
    signInToDeletePosts: "Tienes que iniciar sesión para eliminar publicaciones de entrenamiento.",
    signInToLikePosts: "Tienes que iniciar sesión para dar me gusta a publicaciones de entrenamiento.",
  },
  notifications: {
    functionNotDeployed: 'La Edge Function de Supabase "{name}" aún no está desplegada.',
    functionFailed: "{name} falló ({status}): {body}",
    projectIdMissing: "Falta el projectId de Expo en la configuración de la app.",
  },
  auth: {
    functionFailed: "{name} falló ({status}): {body}",
  },
  admin: {
    unknownFeedbackStatus: "Estado de comentarios desconocido: {status}",
  },
  feedback: {
    messageRequired: "El mensaje de comentarios es obligatorio.",
  },
  music: {
    spotifyAnswered: "Spotify respondió {status}.",
  },
};
