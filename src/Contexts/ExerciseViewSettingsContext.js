import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const COLLAPSED_EXERCISE_VIEWS = ["cells", "compact", "progressOnly"];
export const COLLAPSED_EXERCISE_CARD_LAYOUTS = ["compact", "classic"];

const VIEW_STORAGE_KEY = "fitapp.collapsedExerciseView";
const CARD_LAYOUT_STORAGE_KEY = "fitapp.collapsedExerciseCardLayout";

const ExerciseViewSettingsContext = createContext({
  collapsedExerciseView: "cells",
  setCollapsedExerciseView: async () => {},
  collapsedExerciseCardLayout: "compact",
  setCollapsedExerciseCardLayout: async () => {},
});

function normalizeView(value) {
  return COLLAPSED_EXERCISE_VIEWS.includes(value) ? value : "cells";
}

function normalizeCardLayout(value) {
  return COLLAPSED_EXERCISE_CARD_LAYOUTS.includes(value) ? value : "compact";
}

export function ExerciseViewSettingsProvider({ children }) {
  const [collapsedExerciseView, setViewState] = useState("cells");
  const [collapsedExerciseCardLayout, setCardLayoutState] = useState("compact");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      AsyncStorage.getItem(VIEW_STORAGE_KEY),
      AsyncStorage.getItem(CARD_LAYOUT_STORAGE_KEY),
    ])
      .then(([view, cardLayout]) => {
        if (!mounted) return;

        setViewState(normalizeView(view));
        setCardLayoutState(normalizeCardLayout(cardLayout));
      })
      .catch((error) =>
        console.error("Failed to load exercise card settings:", error)
      );
    return () => { mounted = false; };
  }, []);

  const setCollapsedExerciseView = useCallback(async (value) => {
    const next = normalizeView(value);
    setViewState(next);
    try {
      await AsyncStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch (error) {
      console.error("Failed to save exercise card setting:", error);
    }
  }, []);

  const setCollapsedExerciseCardLayout = useCallback(async (value) => {
    const next = normalizeCardLayout(value);
    setCardLayoutState(next);

    try {
      await AsyncStorage.setItem(CARD_LAYOUT_STORAGE_KEY, next);
    } catch (error) {
      console.error("Failed to save exercise card layout:", error);
    }
  }, []);

  const value = useMemo(
    () => ({
      collapsedExerciseView,
      setCollapsedExerciseView,
      collapsedExerciseCardLayout,
      setCollapsedExerciseCardLayout,
    }),
    [
      collapsedExerciseView,
      setCollapsedExerciseView,
      collapsedExerciseCardLayout,
      setCollapsedExerciseCardLayout,
    ]
  );
  return <ExerciseViewSettingsContext.Provider value={value}>{children}</ExerciseViewSettingsContext.Provider>;
}

export function useExerciseViewSettings() {
  return useContext(ExerciseViewSettingsContext);
}
