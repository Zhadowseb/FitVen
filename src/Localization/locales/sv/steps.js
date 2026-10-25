// Steps: the card on Home, the Steps page and the zones.
export default {
  title: "Steg",
  eyebrow: "Aktivitet",
  noData: "Inga steg under den här perioden än.",
  ownCountNote: "Räknas av FitVen på den här telefonen. En hälsoapp eller en klocka ger mer exakta siffror och en längre historik.",
  // Where the phone's own count is read.
  healthApp: {
    ios: "Hälsa",
    android: "Health Connect",
  },
  // A zone is never told by its colour alone; these are the names.
  zones: {
    inactive: "Inaktiv",
    moving: "Rörlig",
    active: "Aktiv",
    sweetSpot: "Sweet spot",
    bonus: "Bonus",
  },
  watchWalks: {
    title: "Promenader från din klocka",
    subtitle: "När en promenad som du startade på klockan eller i en hälsoapp hittas frågar FitVen om du vill lägga till den.",
    switch: "Läs promenader från Health Connect",
    found: "Promenader hittade: {count}.",
    none: "Inga nya promenader just nu. FitVen letar när du öppnar appen.",
    denied: "Health Connect gav inte FitVen åtkomst till promenader. Du kan ändra det i Health Connect.",
  },
  access: {
    ask: "Se dina dagliga steg bredvid dina pass.",
    askButton: "Tillåt",
    blocked: "FitVen behöver läsa dina steg i {app}.",
    openApp: "Öppna {app}",
    blockedSensor: "FitVen behöver tillstånd för att räkna dina steg. Tillåt Fysisk aktivitet i appens inställningar.",
    openSettings: "Öppna inställningar",
    unavailable: "Installera {app} för att se dina steg bredvid dina pass.",
    whyHealthConnect: "Varför Health Connect, och hur du ställer in det →",
    getApp: "Hämta {app}",
  },
  card: {
    steps: "steg",
    a11y: "Steg idag: {total} steg. Zonen {zone}. Öppna steg",
    a11yWithTraining:
      "Steg idag: {walked} promenerade plus {training} från träning, {total} totalt. Zonen {zone}. Öppna steg",
  },
  periods: {
    day: "Dag",
    week: "Vecka",
    month: "Månad",
  },
  hero: {
    today: "Idag · {range}",
    dailyAverage: "Dagligt snitt · {range}",
    activeSteps: "aktiva steg",
    walked: "{count} promenerade",
    fromTraining: "{count} från träning",
  },
  chart: {
    today: "Idag",
    walking: "Promenader",
    training: "Träning som steg",
    target: "{zone} {steps}",
    summary: {
      day: "Aktiva steg per dag den senaste veckan: promenader i grönt, träning omräknad till steg i orange. Idag {average}, zonen {zone}.",
      week: "Aktiva steg per dag den här veckan: promenader i grönt, träning omräknad till steg i orange. {sweet} av {days} dagar nådde sweet spot. Snitt {average}, zonen {zone}.",
      month:
        "Genomsnittliga aktiva steg per dag, per vecka den här månaden: promenader i grönt, träning omräknad till steg i orange. {sweet} av {days} dagar nådde sweet spot. Snitt {average}, zonen {zone}.",
    },
  },
  tiles: {
    total: "Totalt",
    totalWithTraining: "inkl. {count} från träning",
    sweetSpotDays: "Sweet spot-dagar",
    ofDays: "{count} av {total}",
    sweetSpotRule: "{steps} eller mer",
    bestDay: "Bästa dag",
    bestDetail: "{weekday} · {workout}",
    distance: "Distans",
    km: "km",
    walkedDistance: "promenerat",
  },
  sources: {
    title: "Varifrån din aktivitet kom",
    period: {
      day: "Idag",
      week: "Den här veckan",
      month: "Den här månaden",
    },
    walks: "Promenader",
    everyday: "Vardag",
    training: "Träning",
    a11y: "{walks} procent från loggade promenader, {everyday} procent från vardagsaktivitet, {training} procent från träning",
  },
  trainingCounts: {
    title: "Träning räknas också",
    subtitle: "Pass läggs till som stegekvivalenter",
    switch: "Räkna träning som steg",
    minutes: "{minutes} min styrka",
    empty: "Inga styrkepass under den här perioden.",
  },
  target: {
    label: "Ditt mål",
    change: "Ändra",
    title: "Ditt mål",
    from: "{steps}+",
  },
};
