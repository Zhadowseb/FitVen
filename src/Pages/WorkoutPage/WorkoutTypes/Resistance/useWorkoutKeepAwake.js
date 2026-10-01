import { useCallback, useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";

import { keepAwakeService } from "@services";

// expo-keep-awake looks its native module up the moment it is imported, and a
// development client built before it was declared may not have it: required
// here, a missing module costs the toggle, not the workout screen.
let keepAwake = null;
try {
  keepAwake = require("expo-keep-awake");
} catch (error) {
  console.warn("Keeping the screen on is not in this build:", error);
}

// Its own tag, so it lets go of only its own hold - the dev tools keep the
// screen on with the default tag in a development build.
const KEEP_AWAKE_TAG = "fitven-strength-workout";

// "Hold skærmen vågen" in a strength workout's header. The screen stays on
// while the choice is on, the workout runs, and this screen is the one in
// front: a pause, a finish, a restart, leaving the workout or turning the
// choice off lets it go again. A screen pushed over this one keeps it mounted,
// which is why this listens to focus and not only to unmounting.
//
// Without the native module the choice is still remembered, and the screen
// just turns off as it always did.
export function useWorkoutKeepAwake({ isRunning, isDone }) {
  const isFocused = useIsFocused();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let isActive = true;

    keepAwakeService.getKeepAwakeEnabled().then((stored) => {
      if (isActive) {
        setEnabled(stored);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  const shouldKeepAwake = enabled && isRunning && !isDone && isFocused;

  useEffect(() => {
    if (!shouldKeepAwake || !keepAwake) {
      return undefined;
    }

    Promise.resolve()
      .then(() => keepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG))
      .catch((error) => {
        console.warn("Could not keep the screen on:", error);
      });

    return () => {
      Promise.resolve()
        .then(() => keepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG))
        .catch((error) => {
          console.warn("Could not let the screen turn off:", error);
        });
    };
  }, [shouldKeepAwake]);

  const toggle = useCallback(() => {
    const next = !enabled;

    setEnabled(next);
    void keepAwakeService.setKeepAwakeEnabled(next);
  }, [enabled]);

  return { keepAwakeEnabled: enabled, toggleKeepAwake: toggle };
}
