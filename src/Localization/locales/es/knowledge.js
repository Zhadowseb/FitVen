// Conocimiento: la lista en Explorar, la página del artículo, el enlace "Lee la
// ciencia" y la tarjeta de Conocimiento en Explorar. Los textos de los propios
// artículos están en src/Resources/Knowledge.
export default {
  title: "Conocimiento",
  eyebrow: "Explorar",
  searchLabel: "Buscar en Conocimiento",
  searchPlaceholder: "Buscar temas de entrenamiento",
  noResults: "Ningún artículo coincide con tu búsqueda.",
  articles: "Artículos",
  featured: "Destacado · {category}",
  new: "Nuevo",
  read: "Leer",
  minRead: "{minutes} min de lectura",
  sourceCount: {
    one: "{count} fuente",
    other: "{count} fuentes",
  },
  written: "Escrito el {date}",
  sourceRef: "fuente {numbers}",
  categories: {
    all: "Todos",
    steps: "Pasos",
    strength: "Fuerza",
    cardio: "Cardio",
    recovery: "Recuperación",
    stepsStrength: "Pasos y fuerza",
  },
  article: {
    eyebrow: "Conocimiento",
    title: "Artículo",
    inShort: "En resumen",
    sources: "Fuentes",
    aiTitle: "Escrito con IA.",
    aiBody: "Las fuentes las leyó y este artículo lo escribió una IA. Consulta las fuentes de arriba si quieres todo el detalle.",
    aiFooter: "Escrito por una IA el {date}. Orientación general, no consejo médico.",
    missing: "Este artículo no está disponible.",
  },
  // Siempre "Lee la ciencia", no "Lee el artículo".
  scienceLink: {
    label: "Lee la ciencia · {minutes} min",
    a11y: "Lee la ciencia: {title}, {minutes} min de lectura",
  },
  // Una guía práctica, no un estudio.
  guideLink: {
    label: "Guía · {minutes} min",
    a11y: "Guía: {title}, {minutes} min de lectura",
  },
  curve: {
    benefit: "Beneficio para la salud",
    a11y: "Curva del beneficio para la salud según los pasos diarios: sube con fuerza hasta 4.000 y se aplana después de 7.000 a 10.000",
  },
  zoneRange: {
    under: "menos de {max}",
    between: "{min}–{max}",
    from: "{min}+",
  },
  explore: {
    title: "Conocimiento",
    new: "Nuevo",
    subtitle: "La ciencia detrás de los pasos, la fuerza y la recuperación",
    a11y: "Conocimiento: aprende la ciencia detrás de los pasos, la fuerza y la recuperación",
  },
};
