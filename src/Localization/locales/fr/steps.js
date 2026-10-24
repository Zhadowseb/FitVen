// Pas : la carte de l'accueil, la page Pas et les zones.
export default {
  title: "Pas",
  eyebrow: "Activité",
  noData: "Aucun pas sur cette période pour l'instant.",
  ownCountNote: "Comptés par FitVen sur ce téléphone. Une app de santé ou une montre donne des chiffres plus précis et un historique plus long.",
  // L'endroit où le comptage du téléphone lui-même est lu.
  healthApp: {
    ios: "Santé",
    android: "Health Connect",
  },
  // Une zone n'est jamais indiquée par sa seule couleur ; voici les noms.
  zones: {
    inactive: "Inactif",
    moving: "En mouvement",
    active: "Actif",
    sweetSpot: "Zone idéale",
    bonus: "Bonus",
  },
  watchWalks: {
    title: "Marches depuis ta montre",
    subtitle: "Quand une marche lancée sur ta montre ou dans une app de santé est trouvée, FitVen te demande si tu veux l'ajouter.",
    switch: "Lire les marches depuis Health Connect",
    found: "Marches trouvées : {count}.",
    none: "Aucune nouvelle marche pour l'instant. FitVen regarde quand tu ouvres l'app.",
    denied: "Health Connect n'a pas donné à FitVen l'accès aux marches. Tu peux changer cela dans Health Connect.",
  },
  access: {
    ask: "Vois tes pas quotidiens à côté de tes séances.",
    askButton: "Autoriser",
    blocked: "FitVen doit pouvoir lire tes pas dans {app}.",
    openApp: "Ouvrir {app}",
    blockedSensor: "FitVen a besoin d'une autorisation pour compter tes pas. Autorise l'activité physique dans les réglages de l'app.",
    openSettings: "Ouvrir les réglages",
    unavailable: "Installe {app} pour voir tes pas à côté de tes séances.",
    whyHealthConnect: "Pourquoi Health Connect, et comment le configurer →",
    getApp: "Obtenir {app}",
  },
  card: {
    steps: "pas",
    a11y: "Pas aujourd'hui : {total} pas. Zone {zone}. Ouvrir les pas",
    a11yWithTraining:
      "Pas aujourd'hui : {walked} à la marche plus {training} via l'entraînement, {total} au total. Zone {zone}. Ouvrir les pas",
  },
  periods: {
    day: "Jour",
    week: "Semaine",
    month: "Mois",
  },
  hero: {
    today: "Aujourd'hui · {range}",
    dailyAverage: "Moyenne quotidienne · {range}",
    activeSteps: "pas actifs",
    walked: "{count} à la marche",
    fromTraining: "{count} via l'entraînement",
  },
  chart: {
    today: "Aujourd'hui",
    walking: "Marche",
    training: "Entraînement en pas",
    target: "{zone} {steps}",
    summary: {
      day: "Pas actifs par jour sur la dernière semaine : la marche en vert, l'entraînement converti en pas en orange. Aujourd'hui {average}, zone {zone}.",
      week: "Pas actifs par jour cette semaine : la marche en vert, l'entraînement converti en pas en orange. {sweet} jours sur {days} ont atteint la zone idéale. Moyenne {average}, zone {zone}.",
      month:
        "Moyenne de pas actifs par jour, par semaine ce mois-ci : la marche en vert, l'entraînement converti en pas en orange. {sweet} jours sur {days} ont atteint la zone idéale. Moyenne {average}, zone {zone}.",
    },
  },
  tiles: {
    total: "Total",
    totalWithTraining: "dont {count} via l'entraînement",
    sweetSpotDays: "Jours en zone idéale",
    ofDays: "{count} sur {total}",
    sweetSpotRule: "{steps} ou plus",
    bestDay: "Meilleur jour",
    bestDetail: "{weekday} · {workout}",
    distance: "Distance",
    km: "km",
    walkedDistance: "à pied",
  },
  sources: {
    title: "D'où vient ton activité",
    period: {
      day: "Aujourd'hui",
      week: "Cette semaine",
      month: "Ce mois-ci",
    },
    walks: "Marches",
    everyday: "Au quotidien",
    training: "Entraînement",
    a11y: "{walks} % viennent des marches enregistrées, {everyday} % de l'activité quotidienne, {training} % de l'entraînement",
  },
  trainingCounts: {
    title: "L'entraînement compte aussi",
    subtitle: "Les séances sont ajoutées en équivalents pas",
    switch: "Compter l'entraînement en pas",
    minutes: "{minutes} min de force",
    empty: "Aucune séance de force sur cette période.",
  },
  target: {
    label: "Ton objectif",
    change: "Modifier",
    title: "Ton objectif",
    from: "{steps}+",
  },
};
