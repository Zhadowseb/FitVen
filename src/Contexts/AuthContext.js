import { AppState } from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../Database/supaBaseClient";
import { clearWorkoutPostStatus } from "../Utils/workoutPostEvents";

const AuthContext = createContext({
  session: null,
  user: null,
  isAuthenticated: false,
  isAuthLoading: true,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (isMounted) {
          setSession(data.session ?? null);
        }
      } catch (error) {
        console.error("Failed to restore auth session:", error);
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession ?? null);
      setIsAuthLoading(false);
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        if (nextAppState === "active") {
          supabase.auth.startAutoRefresh();
          return;
        }

        supabase.auth.stopAutoRefresh();
      }
    );

    if (AppState.currentState === "active") {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  // The background post's status lives in module state, which a sign-out does
  // not end. Left alone, the next account to sign in on this phone would get
  // the bar - the note and "Try again" included - for someone else's workout.
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    clearWorkoutPostStatus();
  }, [userId]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      isAuthLoading,
    }),
    [session, isAuthLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
