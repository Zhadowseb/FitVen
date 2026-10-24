// One shared exercise, and reporting it. The words every screen about a shared
// exercise uses live in customExercises.
export default {
  // The toast on the screen you went back to.
  added: "{name} lades till i dina övningar",
  menu: {
    open: "Fler alternativ",
    report: "Rapportera övningen",
  },
  video: {
    play: "Spela upp videon",
    pause: "Pausa videon",
    unavailable: "Videon kan inte spelas just nu",
    needsUpdate: "Uppdatera appen för att spela videon",
  },
  owner: {
    madeOn: "Skapad den {date}",
    profile: "Profil",
    openProfile: "Öppna {name}s profil",
    someone: "En FitVen-användare",
  },
  stats: {
    users: "Använder den",
    gymUsers: "På ditt gym",
    noGym: "Inget gym",
    noGymLabel: "På ditt gym: du har inte valt något gym",
    typical: "Typiskt",
    unknown: "inte känt än",
  },
  steps: {
    title: "Så här utförs den",
    step: "Steg {number}: {text}",
  },
  distribution: {
    title: "Vad andra lyfter",
    typicalWeightReps: {
      one: "typiskt {weight} kg i {reps} rep",
      other: "typiskt {weight} kg i {reps} reps",
    },
    typicalWeight: "typiskt {weight} kg",
    typicalReps: { one: "typiskt {reps} rep", other: "typiskt {reps} reps" },
    rangeUnder: "under {to} kg",
    rangeOver: "{from} kg eller mer",
    rangeBetween: "{from} till {to} kg",
    summary: {
      one: "Vad andra lyfter: oftast {range}, från {sets} loggat set.",
      other: "Vad andra lyfter: oftast {range}, från {sets} loggade set.",
    },
  },
  actions: {
    add: "Lägg till i mina övningar",
    adding: "Lägger till…",
    added: "Tillagd",
    edit: "Redigera din övning",
    save: "Spara",
    saved: "Sparad",
  },
  nameTaken: "Du har redan en övning som heter {name}, så den här kan inte läggas till.",
  addFailed: "Den kunde inte läggas till. Försök igen.",
  saveFailed: "Det gick inte igenom. Försök igen.",
  footnote: "Namn, utrustning och muskelgrupp kopieras till dina övningar – inte ägarens set.",
  footnoteMine: "Den som lägger till den får namn, utrustning och muskelgrupp – aldrig dina set.",
  unavailable: {
    title: "Den här övningen är inte längre tillgänglig",
    body: "Den kan ha tagits bort, eller så delas den inte längre.",
  },
  error: {
    title: "Övningen kunde inte laddas",
    body: "Något gick fel på vägen. Försök igen om en stund.",
  },
  offline: {
    title: "Du är offline",
    body: "Anslut till internet för att se den här övningen.",
  },
  report: {
    title: "Rapportera övningen",
    message:
      "Berätta vad som är fel. Rapporter läses av utvecklaren, och ägaren får aldrig veta vem som skickade en.",
    reasons: {
      wrong: "Felaktig eller vilseledande",
      offensive: "Stötande",
      duplicate: "En dubblett",
      other: "Något annat",
    },
    notePlaceholder: "Är det något mer vi bör veta? (valfritt)",
    send: "Skicka rapport",
    thanks: "Tack – vi tittar på det.",
    failed: "Rapporten kunde inte skickas. Försök igen.",
  },
};
