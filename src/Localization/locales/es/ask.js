// Pregunta a FitVen: el chat con IA sobre tu propio entrenamiento - la barra
// de Inicio, el chat, el consentimiento la primera vez y el interruptor del
// perfil. Mantenlo alineado con ../en/ask.js.
export default {
  title: "Pregunta a FitVen",
  placeholder: "Pregunta sobre tu entrenamiento…",
  openLabel: "Preguntar a FitVen sobre tu entrenamiento",
  badge: "Solo tus datos",
  badgeHint: "Abre una explicación de lo que la IA puede ver",
  badgeSheet: {
    title: "Solo tus datos",
    body: "La IA de FitVen puede leer tus propios entrenamientos, récords, programas y pasos cuando haces una pregunta. No puede ver los datos de otras personas y no cambia nada sin ti.",
  },
  menu: {
    open: "Menú del chat",
    newChat: "Chat nuevo",
  },
  empty: {
    title: "Pregunta lo que quieras sobre tu entrenamiento",
    intro: "FitVen lee tus propios entrenamientos, récords, programas y pasos para responder. Nunca los de otros.",
  },
  suggest: {
    stuck: "¿Por qué está estancado mi {exercise}?",
    stuckAny: "¿Cuál de mis levantamientos está estancado?",
    next: "¿Cómo debería afrontar mi próximo {workout}?",
    today: "¿Qué debería entrenar hoy?",
    month: "¿Cómo fue {month}?",
    recent: "¿Cómo han ido mis últimas semanas?",
    volume: "¿Está equilibrado mi volumen semanal?",
  },
  disclaimer: "La IA puede equivocarse. Orientación general, no un consejo médico.",
  input: {
    label: "Pregunta a FitVen",
    send: "Enviar",
    speak: "Dicta tu pregunta",
  },
  typing: "FitVen está pensando…",
  answered: "FitVen ha respondido",
  chart: {
    a11y: "{title}, {range}. {summary}",
    a11yNoRange: "{title}. {summary}",
  },
  suggestion: {
    eyebrow: "Cambio sugerido · {workout}",
    add: "Añadir al próximo {workout}",
    notNow: "Ahora no",
    group: "Cambio sugerido para {workout}: {text}",
    added: "Añadido a {workout}",
    undo: "Deshacer",
    undone: "Cambio deshecho",
    dismissed: "No añadido",
    line: "{exercise}: {sets}",
    setPart: "{count} × {reps} con {weight} kg",
    noWorkout: "No tienes ningún {workout} planificado próximamente, así que no hay dónde añadirlo.",
    failed: "No se pudo añadir. Inténtalo de nuevo en un momento.",
    undoFailed: "No se pudo deshacer el cambio.",
  },
  sources: {
    line: {
      one: "Basado en {count} entrenamiento · {range}",
      other: "Basado en {count} entrenamientos · {range}",
    },
    lineNoRange: {
      one: "Basado en {count} entrenamiento",
      other: "Basado en {count} entrenamientos",
    },
    see: "Verlos",
    seeHint: "Abre los entrenamientos en los que se basa la respuesta",
  },
  tier: {
    haiku: "Haiku",
    sonnet: "Sonnet",
    opus: "Opus",
    left: {
      one: "{count} restante",
      other: "{count} restantes",
    },
    recommended: "Recomendado",
    a11y: {
      one: "{name}, {count} pregunta restante este mes",
      other: "{name}, {count} preguntas restantes este mes",
    },
    a11yUnknown: "{name}",
    pickerLabel: "Elige el modelo que responderá",
  },
  quota: {
    reached: "Has usado todas tus preguntas de {tier} este mes.",
    reachedAll: "Has usado todas tus preguntas este mes. Empiezan de nuevo el mes que viene.",
    pickAnother: "Pregunta mejor con otro modelo:",
    use: "Usar {tier}",
  },
  error: {
    offline: "Estás sin conexión. Vuelve a preguntar cuando estés conectado.",
    generic: "Algo salió mal. Inténtalo de nuevo.",
    provider: "La IA de FitVen no pudo responder ahora mismo. Inténtalo de nuevo.",
    unavailable: "Pregunta a FitVen no está disponible ahora mismo. Inténtalo más tarde.",
    unauthorized: "Vuelve a iniciar sesión para hacer una pregunta.",
    consent: "Acepta compartir tus datos de entrenamiento para hacer una pregunta.",
  },
  consent: {
    title: "Antes de preguntar",
    intro: "Para responder, la IA de FitVen tiene que leer tus propios datos de entrenamiento.",
    what: {
      title: "Qué se comparte",
      body: "Tu pregunta y los datos de entrenamiento de FitVen que necesita: entrenamientos, récords, programas y pasos.",
    },
    who: {
      title: "Quién los recibe",
      body: "El proveedor de IA que escribe la respuesta. Se usan para responderte, nada más.",
    },
    others: {
      title: "Otras personas",
      body: "No se comparte nada con otros usuarios. Tu chat se queda en este teléfono.",
    },
    change: "Puedes desactivarlo en cualquier momento en tu perfil.",
    continue: "Continuar",
    notNow: "Ahora no",
    failed: "No se pudo guardar tu elección. Comprueba tu conexión e inténtalo de nuevo.",
  },
  settings: {
    title: "Pregunta a FitVen",
    body: "Deja que la IA de FitVen lea tus datos de entrenamiento cuando le haces una pregunta. Si lo desactivas, Pregunta a FitVen desaparece de Inicio.",
    failed: "No se pudo cambiar. Comprueba tu conexión e inténtalo de nuevo.",
  },
};
