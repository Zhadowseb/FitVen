import { AppState } from "react-native";
import { useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { useAuth } from "@contexts/AuthContext";
import { gymService } from "@services";
import { enqueueSync } from "./syncQueue";

// Finishing a workout matches it to a centre and sends its best sets to that
// centre's leaderboard, but both need a position and a network, and a
// basement gym reliably has neither. This picks up what the finish could not:
// on every launch and every return to the foreground it looks over the last
// week's finished workouts, matches the ones that recorded coordinates but no
// centre, and re-sends lifts that may never have arrived.
//
// It goes through the shared sync queue because it writes local workout rows
// that the workout sync then uploads, and those two must not interleave.
export default function GymMatchSync() {
  const db = useSQLiteContext();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return undefined;
    }

    const run = async () => {
      if (isRunningRef.current) {
        return;
      }

      isRunningRef.current = true;

      try {
        await enqueueSync(() => gymService.retryMissingGymMatches(db));
      } catch (error) {
        console.warn("Centre match retry failed:", error);
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
  }, [db, isAuthenticated, isAuthLoading]);

  return null;
}
