// Perfil -> Ajustes -> Música, y los errores del servicio de música que ve el usuario.
export default {
  settings: {
    eyebrow: "Ajustes",
    title: "Música",
    note: "Tu inicio de sesión de Spotify se queda en este teléfono. Solo salen los nombres de canciones y artistas, y solo mientras corre un entrenamiento.",
    couldNotLoad: "No se pudieron cargar los ajustes de música.",
  },
  status: {
    checking: "Comprobando…",
    connectedAs: "Conectado como {name}",
    connected: "Conectado",
    notConnected: "No conectado",
    notAvailable: "No disponible en esta versión",
  },
  connect: "Conectar",
  disconnect: "Desconectar",
  connection: {
    connectedAs: "Conectado a Spotify como {name}.",
    connected: "Conectado a Spotify.",
    couldNotConnect: "No se pudo conectar Spotify.",
    disconnected: "Spotify desconectado. Ya no se comparte nada más.",
    couldNotDisconnect: "No se pudo desconectar Spotify.",
  },
  shareWithFriends: {
    title: "Compartir música con amigos",
    body: "Las personas a las que sigues y que te siguen ven la canción que suena mientras entrenas, y la última después. Si lo desactivas, se elimina lo que se compartió.",
    signInToShare: "Inicia sesión para compartir música.",
    turnedOn: "Ahora tus seguidores ven lo que suena mientras entrenas.",
    turnedOff: "Se dejó de compartir y se eliminó lo que se había compartido.",
    couldNotChange: "No se pudo cambiar el uso compartido de música.",
  },
  errors: {
    notInBuild:
      "Esta versión de la app no incluye los módulos que necesita Spotify. Instala la versión de desarrollo 2.0.",
    signInToChangeSharing: "Tienes que iniciar sesión para cambiar el uso compartido de música.",
    failed: "La música falló.",
  },
};
