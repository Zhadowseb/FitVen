import { useEffect } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { useAuth } from "@contexts/AuthContext";
import { liveWorkoutService } from "@services";

// The running strength workout, to the lock screen: a Live Activity (and the
// Dynamic Island) on iOS, an ongoing notification on Android - and the taps on
// its buttons back into the workout.
//
// Local only: nothing goes to the cloud, and it reads the same database the
// workout screen writes. Everything is in liveWorkoutService; this only hands
// it the signed-in user's database, and takes the card away when that
// database goes - signed out, or another account.
export default function LiveWorkoutSync() {
  const db = useSQLiteContext();
  const { isAuthenticated, isAuthLoading } = useAuth();

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return undefined;
    }

    return liveWorkoutService.startLiveWorkoutController(db);
  }, [db, isAuthenticated, isAuthLoading]);

  return null;
}
