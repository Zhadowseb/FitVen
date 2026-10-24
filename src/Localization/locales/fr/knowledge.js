// Connaissances : la liste sous Explorer, la page d'un article, le lien « Lire les études »
// et la carte Connaissances sur Explorer. Les textes des articles eux-mêmes se trouvent avec
// eux dans src/Resources/Knowledge.
export default {
  title: "Connaissances",
  eyebrow: "Explorer",
  searchLabel: "Rechercher dans les connaissances",
  searchPlaceholder: "Chercher un sujet d'entraînement",
  noResults: "Aucun article ne correspond à ta recherche.",
  articles: "Articles",
  featured: "À la une · {category}",
  new: "Nouveau",
  read: "Lire",
  minRead: "{minutes} min de lecture",
  sourceCount: {
    one: "{count} source",
    other: "{count} sources",
  },
  written: "Rédigé le {date}",
  sourceRef: "source {numbers}",
  categories: {
    all: "Tous",
    steps: "Pas",
    strength: "Force",
    cardio: "Cardio",
    recovery: "Récupération",
    stepsStrength: "Pas et force",
  },
  article: {
    eyebrow: "Connaissances",
    title: "Article",
    inShort: "En bref",
    sources: "Sources",
    aiTitle: "Rédigé avec l'IA.",
    aiBody: "Les sources ont été lues et cet article a été rédigé par une IA. Consulte les sources ci-dessus si tu veux le détail complet.",
    aiFooter: "Rédigé par une IA le {date}. Conseils généraux, pas un avis médical.",
    missing: "Cet article n'est pas disponible.",
  },
  // Toujours « Lire les études » - pas « Lire l'article ».
  scienceLink: {
    label: "Lire les études · {minutes} min",
    a11y: "Lire les études : {title}, {minutes} min de lecture",
  },
  // Un guide pratique, pas une étude.
  guideLink: {
    label: "Guide · {minutes} min",
    a11y: "Guide : {title}, {minutes} min de lecture",
  },
  curve: {
    benefit: "Bénéfice santé",
    a11y: "Courbe du bénéfice santé selon les pas quotidiens : forte hausse jusqu'à 4 000, puis aplatissement après 7 000 à 10 000",
  },
  zoneRange: {
    under: "moins de {max}",
    between: "{min}–{max}",
    from: "{min}+",
  },
  explore: {
    title: "Connaissances",
    new: "Nouveau",
    subtitle: "La science des pas, de la force et de la récupération",
    a11y: "Connaissances : découvre la science des pas, de la force et de la récupération",
  },
};
