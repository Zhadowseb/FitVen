// Lo que dice el servicio de ejercicios cuando falla compartir, añadir o denunciar.
export default {
  // Lo lanza src/Services/exerciseService.js y se muestra como error.message.
  errors: {
    offline: "Estás sin conexión. Inténtalo de nuevo cuando tengas conexión.",
    signedOut: "Inicia sesión para compartir y añadir ejercicios.",
    notAvailable: "Los ejercicios compartidos aún no están disponibles. Inténtalo más tarde.",
    notFound: "Este ejercicio no está en este teléfono.",
    exerciseGone: "Este ejercicio ya no está compartido.",
    copyCannotBeShared: "Es una copia del ejercicio de otra persona, así que no se puede compartir.",
    nameTaken: "Ya tienes un ejercicio con este nombre.",
    blockedTerms:
      "Algo del nombre, la descripción o los pasos no se puede compartir. Cambia la redacción e inténtalo de nuevo.",
    videoTooLong: "El clip puede durar como máximo {seconds} segundos.",
    videoTooLarge: "El clip puede pesar como máximo {megabytes} MB.",
    uploadFailed: "No se pudo subir el clip. Inténtalo de nuevo.",
    generic: "Algo salió mal. Inténtalo de nuevo.",
  },
};
