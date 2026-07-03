import { AppState } from "react-native";
import { useEffect, useRef } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { useAuth } from "../Contexts/AuthContext";
import { programService } from "../Services";
import { enqueueSync } from "./syncQueue";

export default function SetSync() {
  const db = useSQLiteContext();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const isSyncingRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);

  const isRetryableSyncError = (error) => {
    const message = String(error?.message ?? error ?? "");

    return (
      message.includes("Network request failed") ||
      message.includes("Failed to fetch") ||
      message.includes("NetworkError")
    );
  };

  const runSync = async () => {
    if (isAuthLoading || !isAuthenticated || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      await enqueueSync(() =>
        programService.pushDirtyStrengthHierarchyWithCloud(db)
      );
      retryCountRef.current = 0;
    } catch (error) {
      console.warn("Set cloud push failed:", error);

      if (isRetryableSyncError(error) && retryCountRef.current < 3) {
        retryCountRef.current += 1;

        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }

        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          void runSync();
        }, 1500 * retryCountRef.current);
      }
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

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return null;
}
