// Pasos: la tarjeta de Inicio, la página de Pasos y las zonas.
export default {
  title: "Pasos",
  eyebrow: "Actividad",
  noData: "Aún no hay pasos en este periodo.",
  ownCountNote: "Contados por FitVen en este teléfono. Una app de salud o un reloj dan cifras más exactas y un historial más largo.",
  // Donde se lee el recuento del propio teléfono.
  healthApp: {
    ios: "Salud",
    android: "Health Connect",
  },
  // Una zona nunca se indica solo por su color; estos son los nombres.
  zones: {
    inactive: "Inactivo",
    moving: "En movimiento",
    active: "Activo",
    sweetSpot: "Punto óptimo",
    bonus: "Extra",
  },
  watchWalks: {
    title: "Caminatas de tu reloj",
    subtitle: "Cuando se encuentra una caminata que empezaste en tu reloj o en una app de salud, FitVen te pregunta si quieres añadirla.",
    switch: "Leer caminatas de Health Connect",
    found: "Caminatas encontradas: {count}.",
    none: "No hay caminatas nuevas ahora mismo. FitVen busca cuando abres la app.",
    denied: "Health Connect no dio a FitVen acceso a las caminatas. Puedes cambiarlo en Health Connect.",
  },
  access: {
    ask: "Mira tus pasos diarios junto a tus entrenamientos.",
    askButton: "Permitir",
    blocked: "FitVen necesita leer tus pasos en {app}.",
    openApp: "Abrir {app}",
    blockedSensor: "FitVen necesita permiso para contar tus pasos. Permite Actividad física en los ajustes de la app.",
    openSettings: "Abrir ajustes",
    unavailable: "Instala {app} para ver tus pasos junto a tus entrenamientos.",
    whyHealthConnect: "Por qué Health Connect y cómo configurarlo →",
    getApp: "Obtener {app}",
  },
  card: {
    steps: "pasos",
    a11y: "Pasos hoy: {total} pasos. Zona {zone}. Abrir pasos",
    a11yWithTraining:
      "Pasos hoy: {walked} caminados más {training} del entrenamiento, {total} en total. Zona {zone}. Abrir pasos",
  },
  periods: {
    day: "Día",
    week: "Semana",
    month: "Mes",
  },
  hero: {
    today: "Hoy · {range}",
    dailyAverage: "Media diaria · {range}",
    activeSteps: "pasos activos",
    walked: "{count} caminados",
    fromTraining: "{count} del entrenamiento",
  },
  chart: {
    today: "Hoy",
    walking: "Caminando",
    training: "Entrenamiento como pasos",
    target: "{zone} {steps}",
    summary: {
      day: "Pasos activos por día en la última semana: caminar en verde, entrenamiento convertido en pasos en naranja. Hoy {average}, zona {zone}.",
      week: "Pasos activos por día esta semana: caminar en verde, entrenamiento convertido en pasos en naranja. {sweet} de {days} días llegaron al punto óptimo. Media {average}, zona {zone}.",
      month:
        "Media de pasos activos por día, por semana este mes: caminar en verde, entrenamiento convertido en pasos en naranja. {sweet} de {days} días llegaron al punto óptimo. Media {average}, zona {zone}.",
    },
  },
  tiles: {
    total: "Total",
    totalWithTraining: "incl. {count} del entrenamiento",
    sweetSpotDays: "Días en el punto óptimo",
    ofDays: "{count} de {total}",
    sweetSpotRule: "{steps} o más",
    bestDay: "Mejor día",
    bestDetail: "{weekday} · {workout}",
    distance: "Distancia",
    km: "km",
    walkedDistance: "caminados",
  },
  sources: {
    title: "De dónde vino tu actividad",
    period: {
      day: "Hoy",
      week: "Esta semana",
      month: "Este mes",
    },
    walks: "Caminatas",
    everyday: "Día a día",
    training: "Entrenamiento",
    a11y: "{walks} por ciento de caminatas registradas, {everyday} por ciento de actividad cotidiana, {training} por ciento de entrenamiento",
  },
  trainingCounts: {
    title: "El entrenamiento también cuenta",
    subtitle: "Los entrenamientos se suman como equivalentes en pasos",
    switch: "Contar el entrenamiento como pasos",
    minutes: "{minutes} min de fuerza",
    empty: "No hay entrenamientos de fuerza en este periodo.",
  },
  target: {
    label: "Tu objetivo",
    change: "Cambiar",
    title: "Tu objetivo",
    from: "{steps}+",
  },
};
