import { AppState } from "react-native";
import { useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { useAuth } from "../Contexts/AuthContext";
import { programService } from "../Services";
import { enqueueSync } from "./syncQueue";

export default function MicrocycleSync() {
  const db = useSQLiteContext();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const isSyncingRef = useRef(false);

  const runSync = async () => {
    if (isAuthLoading || !isAuthenticated || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      await enqueueSync(() => programService.syncMicrocyclesWithCloud(db));
    } catch (error) {
      console.error("Microcycle cloud sync failed:", error);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    runSync();
  }, [db, isAuthenticated, isAuthLoading]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        runSync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [db, isAuthenticated, isAuthLoading]);

  return null;
}
