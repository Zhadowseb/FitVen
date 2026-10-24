// Ánimos: las respuestas rápidas a "¡X ha empezado un entrenamiento!".
export default {
  // Las tres respuestas fijas. Lo que se guarda son sus ids (good_workout,
  // lets_go, crush_it); las palabras se muestran en el idioma de quien lee.
  presets: {
    goodWorkout: "💪 ¡Buen entreno!",
    letsGo: "🔥 ¡Vamos!",
    crushIt: "👏 ¡Con todo!",
  },
  writeMessage: "Escribe un mensaje…",
  send: "Enviar",
  placeholder: "Di algo bonito",
  // La fila de la bandeja para un ánimo recibido. {name} es quien lo envía.
  title: "{name} te ha animado",
  someone: "Alguien",
  customBody: "💬 {message}",
  youCheered: "Has animado",
  youCheeredWith: "Has animado · {text}",
  sent: "Ánimo enviado",
  // La notificación local cuando un ánimo enviado desde una notificación no
  // llegó. Se muestra una vez y no se reintenta.
  sendFailed: "No se pudo enviar tu ánimo",
  rowLabel: "Animar a {name}",
  messageLabel: "Tu mensaje",
  settingTitle: "Cuando alguien te anima",
  settingBody:
    "Recibe una notificación cuando un amigo te anima durante un entrenamiento. Si lo desactivas, tus amigos tampoco tendrán botones de respuesta en las notificaciones de tus entrenamientos.",
  settingUnavailable:
    "Este ajuste aún no está disponible. Los ánimos no se avisan hasta que lo esté.",
  settingSaveFailed: "No se pudo guardar el ajuste de ánimos.",
};
