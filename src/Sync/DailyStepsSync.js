import { AppState } from "react-native";
import { useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { useAuth } from "@contexts/AuthContext";
import { dailyStepsService } from "@services";
import { PRIVACY_POLICY_VERSION } from "@resources/Legal/privacyPolicy";

// The one number a day keeps. On launch and on every return to the foreground
// it reads the phone's sources for the last few days into Daily_Steps (so a
// day is kept even if the Steps page is never opened), then meets the cloud:
// the days a new phone has not seen come back, and what this phone has goes up.
//
// Signed in only, and the upload waits for the privacy policy this build
// carries to have been accepted - the service asks. Not through the sync queue,
// for the reason WorkoutMusicSync and AppOpenSync are not: it reconciles
// nothing the workout hierarchy depends on and writes one cloud table of its
// own, so there is no parent-first order for it to break.
//
// At most once every five minutes, so a quick turn between apps does not read
// the health app each time.
const MIN_INTERVAL_MS = 5 * 60 * 1000;

export default function DailyStepsSync() {
  const db = useSQLiteContext();
  const { user, isAuthenticated, isAuthLoading } = useAuth();
  const userId = user?.id ?? null;
  const isRunningRef = useRef(false);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !userId) {
      return undefined;
    }

    const run = async () => {
      if (isRunningRef.current || Date.now() - lastRunRef.current < MIN_INTERVAL_MS) {
        return;
      }

      isRunningRef.current = true;

      try {
        await dailyStepsService.refreshRecentDailySteps(db);
        await dailyStepsService.syncDailyStepsWithCloud(db, {
          userId,
          policyVersion: PRIVACY_POLICY_VERSION,
        });
        lastRunRef.current = Date.now();
      } catch (error) {
        // Offline, or refused: the days are on the phone and the next return to
        // the foreground tries again.
        console.warn("Daily steps sync failed:", error);
      } finally {
        isRunningRef.current = false;
      }
    };

    run();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        run();
      }
    });

    return () => subscription.remove();
  }, [db, isAuthenticated, isAuthLoading, userId]);

  return null;
}
