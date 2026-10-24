// Profile -> Settings -> Music, and the music service's user-facing errors.
export default {
  settings: {
    eyebrow: "Inställningar",
    title: "Musik",
    note: "Din Spotify-inloggning stannar på den här telefonen. Bara låt- och artistnamn lämnar den, och bara medan ett pass pågår.",
    couldNotLoad: "Musikinställningarna kunde inte laddas.",
  },
  status: {
    checking: "Kontrollerar…",
    connectedAs: "Ansluten som {name}",
    connected: "Ansluten",
    notConnected: "Inte ansluten",
    notAvailable: "Inte tillgängligt i den här versionen",
  },
  connect: "Anslut",
  disconnect: "Koppla från",
  connection: {
    connectedAs: "Ansluten till Spotify som {name}.",
    connected: "Ansluten till Spotify.",
    couldNotConnect: "Det gick inte att ansluta Spotify.",
    disconnected: "Spotify är frånkopplat. Inget mer delas.",
    couldNotDisconnect: "Det gick inte att koppla från Spotify.",
  },
  shareWithFriends: {
    title: "Dela musik med vänner",
    body: "Personer du följer tillbaka ser låten som spelas medan du tränar, och den senaste efteråt. Avstängt tar bort det som delats.",
    signInToShare: "Logga in för att dela musik.",
    turnedOn: "Följare ser nu vad som spelas medan du tränar.",
    turnedOff: "Delningen är avstängd och det som delats har tagits bort.",
    couldNotChange: "Det gick inte att ändra musikdelningen.",
  },
  errors: {
    notInBuild:
      "Den här versionen av appen innehåller inte de moduler som Spotify behöver. Installera utvecklingsversionen 2.0.",
    signInToChangeSharing: "Du måste vara inloggad för att ändra musikdelningen.",
    failed: "Musiken misslyckades.",
  },
};
