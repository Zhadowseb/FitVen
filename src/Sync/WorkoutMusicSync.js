import { AppState } from "react-native";
import { useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { useAuth } from "../Contexts/AuthContext";
import { musicService } from "../Services";

// The now-playing poller. Every 30 s while the app is in the foreground and
// somebody is signed in, it asks the connected music provider what is on and
// - when a workout is running and sharing is switched on - writes it to
// workout_music for the Friends activity tiles. It is not a cloud sync in the
// SetSync sense (nothing local is reconciled) and so does not go through the
// sync queue; it is here because this folder is where headless work that
// App.js mounts lives, and the table in AGENTS.md says what runs.
export default function WorkoutMusicSync() {
  const db = useSQLiteContext();
  const { user, isAuthenticated, isAuthLoading } = useAuth();
  const isPollingRef = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user?.id) {
      return undefined;
    }

    const poll = async () => {
      if (isPollingRef.current) {
        return;
      }

      isPollingRef.current = true;

      try {
        await musicService.pollWorkoutMusic(db, { user });
      } catch (error) {
        console.warn("Workout music poll failed:", error);
      } finally {
        isPollingRef.current = false;
      }
    };

    const start = () => {
      stop();
      poll();
      intervalRef.current = setInterval(poll, musicService.NOW_PLAYING_POLL_MS);
    };

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (AppState.currentState === "active" || AppState.currentState == null) {
      start();
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [db, isAuthenticated, isAuthLoading, user]);

  return null;
}
