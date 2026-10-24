// Skritt: kortet på Hjem, Skritt-siden og sonene.
export default {
  title: "Skritt",
  eyebrow: "Aktivitet",
  noData: "Ingen skritt i denne perioden ennå.",
  ownCountNote: "Telt av FitVen på denne telefonen. En helseapp eller en klokke gir mer nøyaktige tall og lengre historikk.",
  // Der telefonens egen telling leses.
  healthApp: {
    ios: "Helse",
    android: "Health Connect",
  },
  // En sone fortelles aldri av fargen alene; dette er navnene.
  zones: {
    inactive: "Inaktiv",
    moving: "I bevegelse",
    active: "Aktiv",
    sweetSpot: "Optimal",
    bonus: "Bonus",
  },
  watchWalks: {
    title: "Gåturer fra klokken din",
    subtitle: "Når en gåtur du startet på klokken eller i en helseapp blir funnet, spør FitVen om du vil legge den til.",
    switch: "Les gåturer fra Health Connect",
    found: "Gåturer funnet: {count}.",
    none: "Ingen nye gåturer akkurat nå. FitVen ser etter når du åpner appen.",
    denied: "Health Connect ga ikke FitVen tilgang til gåturer. Du kan endre det i Health Connect.",
  },
  access: {
    ask: "Se de daglige skrittene dine ved siden av øktene.",
    askButton: "Tillat",
    blocked: "FitVen må kunne lese skrittene dine i {app}.",
    openApp: "Åpne {app}",
    blockedSensor: "FitVen trenger tillatelse til å telle skrittene dine. Tillat Fysisk aktivitet i appens innstillinger.",
    openSettings: "Åpne innstillinger",
    unavailable: "Installer {app} for å se skrittene dine ved siden av øktene.",
    whyHealthConnect: "Hvorfor Health Connect, og hvordan du setter det opp →",
    getApp: "Hent {app}",
  },
  card: {
    steps: "skritt",
    a11y: "Skritt i dag: {total} skritt. Sone: {zone}. Åpne skritt",
    a11yWithTraining:
      "Skritt i dag: {walked} gått pluss {training} fra trening, {total} totalt. Sone: {zone}. Åpne skritt",
  },
  periods: {
    day: "Dag",
    week: "Uke",
    month: "Måned",
  },
  hero: {
    today: "I dag · {range}",
    dailyAverage: "Daglig snitt · {range}",
    activeSteps: "aktive skritt",
    walked: "{count} gått",
    fromTraining: "{count} fra trening",
  },
  chart: {
    today: "I dag",
    walking: "Gåing",
    training: "Trening som skritt",
    target: "{zone} {steps}",
    summary: {
      day: "Aktive skritt per dag den siste uken: gåing i grønt, trening omregnet til skritt i oransje. I dag {average}, sone: {zone}.",
      week: "Aktive skritt per dag denne uken: gåing i grønt, trening omregnet til skritt i oransje. {sweet} av {days} dager nådde den optimale sonen. Snitt {average}, sone: {zone}.",
      month:
        "Gjennomsnittlige aktive skritt per dag, per uke denne måneden: gåing i grønt, trening omregnet til skritt i oransje. {sweet} av {days} dager nådde den optimale sonen. Snitt {average}, sone: {zone}.",
    },
  },
  tiles: {
    total: "Totalt",
    totalWithTraining: "inkl. {count} fra trening",
    sweetSpotDays: "Optimale dager",
    ofDays: "{count} av {total}",
    sweetSpotRule: "{steps} eller flere",
    bestDay: "Beste dag",
    bestDetail: "{weekday} · {workout}",
    distance: "Distanse",
    km: "km",
    walkedDistance: "gått",
  },
  sources: {
    title: "Hvor aktiviteten din kom fra",
    period: {
      day: "I dag",
      week: "Denne uken",
      month: "Denne måneden",
    },
    walks: "Gåturer",
    everyday: "Hverdag",
    training: "Trening",
    a11y: "{walks} prosent fra loggførte gåturer, {everyday} prosent fra hverdagsaktivitet, {training} prosent fra trening",
  },
  trainingCounts: {
    title: "Trening teller også",
    subtitle: "Økter legges til som skrittekvivalenter",
    switch: "Tell trening som skritt",
    minutes: "{minutes} min styrke",
    empty: "Ingen styrkeøkter i denne perioden.",
  },
  target: {
    label: "Målet ditt",
    change: "Endre",
    title: "Målet ditt",
    from: "{steps}+",
  },
};
