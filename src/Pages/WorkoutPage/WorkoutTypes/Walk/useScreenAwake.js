import { useEffect } from "react";

// expo-keep-awake looks its native module up the moment it is imported, and a
// development client built before it was declared may not have it: required
// here, a missing module costs the hold, not the screen (the same way
// useWorkoutKeepAwake next to Resistance does it).
let keepAwake = null;
try {
  keepAwake = require("expo-keep-awake");
} catch (error) {
  console.warn("Keeping the screen on is not in this build:", error);
}

// Its own tag, so it lets go of only its own hold.
const KEEP_AWAKE_TAG = "fitven-walk-lock";

/**
 * Holds the screen on while `active`. The walk's touch lock uses it: a locked
 * phone that dims is a walk nobody can watch.
 */
export function useScreenAwake(active) {
  useEffect(() => {
    if (!active || !keepAwake) {
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
  }, [active]);
}
