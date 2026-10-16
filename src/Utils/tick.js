import { Platform, Vibration } from "react-native";

// One short tick under a finger. Android takes the length; the iPhone ignores
// it and gives its one long buzz for every call, which is not a tick - so there
// it stays silent until the app has a real haptic engine.
export function tick(ms) {
  if (Platform.OS === "ios") {
    return;
  }

  Vibration.vibrate(ms);
}
