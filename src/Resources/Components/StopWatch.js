import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "@react-navigation/native";
import {ThemedText, ThemedButton} from "../ThemedComponents";
import { workoutService as workoutRepository } from "../../Services";

/**
 * WorkoutStopwatchSQLite
 *
 * KRÆVER i Workout-tabellen:
 *  - start_ts INTEGER
 *  - duration_seconds INTEGER
 *
 * start_ts = Date.now() når workout starter
 */
const WorkoutStopwatchSQLite = ({ workout_id, onStop }) => {
  const db = useSQLiteContext();

  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  const startTsRef = useRef(null);
  const intervalRef = useRef(null);

  /* ---------- Core time logic ---------- */

  const computeElapsed = () => {
    if (!startTsRef.current) return;

    const seconds = Math.floor(
      (Date.now() - startTsRef.current) / 1000
    );
    setElapsed(seconds);
  };

  /* ---------- Start / Stop ---------- */

  const start = async () => {
    if (running) return;

    const row = await workoutRepository.getWorkoutStartTimestamp(db, workout_id);

    let startTs = row?.start_ts;

    if (!startTs) {
      startTs = Date.now();
      await workoutRepository.setWorkoutStartTimestamp(db, {
        workoutId: workout_id,
        startTs,
      });
    }

    startTsRef.current = startTs;
    setRunning(true);

    computeElapsed();
    intervalRef.current = setInterval(computeElapsed, 1000);
  };

  const stop = async () => {
    if (!startTsRef.current) return;

    const seconds = Math.floor(
      (Date.now() - startTsRef.current) / 1000
    );

    clearInterval(intervalRef.current);
    intervalRef.current = null;

    await workoutRepository.stopWorkoutStopwatch(db, {
      workoutId: workout_id,
      durationSeconds: seconds,
    });

    startTsRef.current = null;
    setRunning(false);
    setElapsed(seconds);

    onStop?.(seconds);
  };

  /* ---------- Restore timer when screen gets focus ---------- */

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const restore = async () => {
        const row = await workoutRepository.getWorkoutStartTimestamp(
          db,
          workout_id
        );

        if (!row?.start_ts || !active) return;

        startTsRef.current = row.start_ts;
        setRunning(true);

        computeElapsed();
        intervalRef.current = setInterval(computeElapsed, 1000);
      };

      restore();

      return () => {
        active = false;
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      };
    }, [workout_id])
  );

  /* ---------- AppState handling ---------- */

  React.useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && running) {
        computeElapsed();
      }
    });

    return () => sub.remove();
  }, [running]);

  /* ---------- UI ---------- */

  return (
    <View style={styles.container}>
      <ThemedText style={styles.time}>
        {formatDuration(elapsed)}
      </ThemedText>

      {!running ? (
        <ThemedButton
          variant="success"
          title="Start workout"
          onPress={start} />
      ) : (
        <ThemedButton
          variant="danger"
          title="Finish Workout"
          onPress={stop} />
      )}
    </View>
  );
};

/* ---------- Helpers ---------- */

const formatDuration = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${sec
      .toString()
      .padStart(2, "0")}`;
  }
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
  },
  time: {
    fontSize: 30,
    fontWeight: "200",
    marginRight: 30,
  },
});

export default WorkoutStopwatchSQLite;
