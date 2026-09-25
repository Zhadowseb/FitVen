import { AppState } from "react-native";
import { useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { useAuth } from "../Contexts/AuthContext";
import { exerciseService, weightliftingService } from "../Services";
import { enqueueSync } from "./syncQueue";

export default function ExerciseLibrarySync() {
  const db = useSQLiteContext();
  const { isAuthenticated, isAuthLoading, user } = useAuth();
  const userId = user?.id ?? null;
  const isSyncingRef = useRef(false);

  const runSync = async () => {
    if (isAuthLoading || !isAuthenticated || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      try {
        await enqueueSync(() =>
          weightliftingService.syncExerciseLibraryFromCloud(db)
        );
      } catch (error) {
        console.error("Exercise library cloud sync failed:", error);
      }

      // Your own custom exercises, after the catalog: a restored exercise
      // whose name the catalog already uses is skipped, so the catalog has to
      // be in first. Signed in only - the guard above.
      try {
        await enqueueSync(() =>
          exerciseService.syncCustomExercisesWithCloud(db, { userId })
        );
      } catch (error) {
        console.warn("Custom exercise cloud sync failed:", error);
      }
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    runSync();
  }, [db, isAuthenticated, isAuthLoading, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        runSync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [db, isAuthenticated, isAuthLoading, userId]);

  return null;
}
