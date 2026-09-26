import { AppState, Platform } from "react-native";
import { useEffect, useRef } from "react";

import { useAuth } from "@contexts/AuthContext";
import { appOpenService, feedbackService } from "@services";
import { PRIVACY_POLICY_VERSION } from "@resources/Legal/privacyPolicy";

// When the app was last opened, on which platform and in which version, on
// your own profile_private row - what the developer overview counts active
// users and versions in use from.
//
// Signed in only, on launch and on every return to the foreground. The
// service does the rest: at most one write an hour per user on this phone,
// remembered across launches, and none until the privacy policy this build
// carries has been accepted.
//
// Not through the sync queue, for the same reason as WorkoutMusicSync: it
// reconciles nothing local and writes one cloud row of its own, so there is no
// parent-first order for it to break, and no reason to wait behind a workout
// sync to send it.
export default function AppOpenSync() {
  const { user, isAuthenticated, isAuthLoading } = useAuth();
  const userId = user?.id ?? null;
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !userId) {
      return undefined;
    }

    const record = async () => {
      // Launch and the first "active" arrive close together; one is enough.
      if (isRecordingRef.current) {
        return;
      }

      isRecordingRef.current = true;

      try {
        await appOpenService.recordAppOpen({
          userId,
          platform: Platform.OS,
          // The string a bug report carries, so the two can be read together.
          appVersion: feedbackService.getAppVersion(),
          privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        });
      } catch {
        // Offline or refused. Silent on purpose: the next return to the
        // foreground tries again.
      } finally {
        isRecordingRef.current = false;
      }
    };

    record();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        record();
      }
    });

    return () => subscription.remove();
  }, [isAuthLoading, isAuthenticated, userId]);

  return null;
}
