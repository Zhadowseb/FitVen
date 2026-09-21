// Profile -> Settings -> Music, and the music service's user-facing errors.
// Keep in step with ../da/music.js.
export default {
  settings: {
    eyebrow: "Settings",
    title: "Music",
    note: "Your Spotify login stays on this phone. Only track and artist names leave it, and only while a workout is running.",
    couldNotLoad: "Could not load music settings.",
  },
  status: {
    checking: "Checking…",
    connectedAs: "Connected as {name}",
    connected: "Connected",
    notConnected: "Not connected",
    notAvailable: "Not available in this build",
  },
  connect: "Connect",
  disconnect: "Disconnect",
  connection: {
    connectedAs: "Connected to Spotify as {name}.",
    connected: "Connected to Spotify.",
    couldNotConnect: "Could not connect Spotify.",
    disconnected: "Spotify disconnected. Nothing more is shared.",
    couldNotDisconnect: "Could not disconnect Spotify.",
  },
  shareWithFriends: {
    title: "Share music with friends",
    body: "People you follow back see the track that is playing while you train, and the last one after. Off removes what was shared.",
    signInToShare: "Sign in to share music.",
    turnedOn: "Followers now see what is playing while you train.",
    turnedOff: "Sharing is off and what was shared has been removed.",
    couldNotChange: "Could not change music sharing.",
  },
  errors: {
    notInBuild:
      "This build of the app does not include the modules Spotify needs. Install the 2.0 development build.",
    signInToChangeSharing: "You need to be signed in to change music sharing.",
    failed: "Music failed.",
  },
};
