import { StatusBar } from "expo-status-bar";
import {
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "@localization";

import ExerciseLibraryList from "../ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList";
import CustomExerciseModal from "./Components/CustomExerciseModal/CustomExerciseModal";
import styles from "./ExerciseCatalogPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Plus from "../../Resources/Icons/UI-icons/Plus";
import {
  ThemedConfirmModal,
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { weightliftingService } from "../../Services";
import {
  addedThisVisitCount,
  createPickerSession,
  pickerNameKey,
  planToggle,
  wasAddedThisVisit,
  wasAlreadyThere,
  withAdded,
  withRemovedExisting,
  withUndone,
} from "../../Utils/exercisePickerSession";

const ExerciseCatalogPage = ({ route }) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectingExerciseName, setSelectingExerciseName] = useState(null);
  const [isCustomExerciseModalVisible, setIsCustomExerciseModalVisible] =
    useState(false);
  // This visit: what the workout held when the picker opened, and what the
  // + has added and taken out since (Utils/exercisePickerSession). A ref as
  // well as state, so a handler still running reads the newest.
  const [session, setSession] = useState(() => createPickerSession([]));
  const sessionRef = useRef(session);
  const [isSessionReady, setIsSessionReady] = useState(false);
  // An exercise that was in the workout before the picker opened, waiting for
  // "Remove" to be confirmed: { name, exerciseIds, count }.
  const [removeRequest, setRemoveRequest] = useState(null);
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const workoutPicker = route?.params?.workoutPicker ?? null;
  // Which list the picker opens on. The workout screen has a button for the
  // whole catalog and one for what was used recently, and they land here.
  const initialFilter = route?.params?.initialFilter ?? null;
  const workoutPickerId = Number(workoutPicker?.workoutId);
  const isWorkoutPicker =
    Number.isFinite(workoutPickerId) && workoutPickerId > 0;
  const workoutTargetLabel =
    workoutPicker?.workoutName ??
    workoutPicker?.name ??
    workoutPicker?.title ??
    workoutPicker?.workoutTitle ??
    t("exercises.workoutFallback");

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((prev) => prev + 1);
    }, [])
  );

  const commitSession = useCallback((next) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  // The snapshot, once, as the picker opens - not on every focus: the muscle
  // modal or a new custom exercise does not end the visit. Until it is in, the
  // + waits, or an exercise already in the workout would be added twice.
  useEffect(() => {
    if (!isWorkoutPicker) {
      return undefined;
    }

    let cancelled = false;

    weightliftingService
      .getWorkoutExerciseEntries(db, workoutPickerId)
      .then((entries) => {
        if (!cancelled) {
          commitSession(createPickerSession(entries));
        }
      })
      .catch((error) => {
        console.error("Could not read the workout's exercises for the picker:", error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsSessionReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [commitSession, db, isWorkoutPicker, workoutPickerId]);

  const addedExerciseNames = useMemo(
    () => (isWorkoutPicker ? [...session.added.keys()] : []),
    [isWorkoutPicker, session]
  );
  const existingExerciseNames = useMemo(
    () =>
      isWorkoutPicker
        ? [...session.snapshot.keys()].filter((name) => wasAlreadyThere(session, name))
        : [],
    [isWorkoutPicker, session]
  );
  const addedCount = addedThisVisitCount(session);

  // SPM-2: the sheet used to close after the first exercise, so a workout with
  // six exercises meant six trips through the catalog with a fresh search each
  // time - on a list whose every row carries its own + button, which says the
  // opposite. It stays open, counts what has been added and leaves when the
  // user says so.
  //
  // The + adds, and pressed again takes out. It used to add another copy of
  // the same exercise on every press, while the row already said "added" - so
  // a second press meant to take it back out seemed to do nothing, and put a
  // duplicate in the workout. Now an exercise added on this visit comes out
  // at once; one that was in the workout before the picker opened may have
  // sets logged, and is asked about first.
  // The newest copy of an exercise that this visit put in: never one that was
  // in the snapshot, so a fallback can never take out an exercise from before.
  const findAddedExerciseId = useCallback(
    async (exerciseName) => {
      const key = pickerNameKey(exerciseName);
      const before = new Set(sessionRef.current.snapshot.get(key) ?? []);
      const entries = await weightliftingService.getWorkoutExerciseEntries(db, workoutPickerId);
      const ids = entries
        .filter((entry) => pickerNameKey(entry.exerciseName) === key && !before.has(entry.exerciseId))
        .map((entry) => entry.exerciseId);

      return ids.length > 0 ? Math.max(...ids) : null;
    },
    [db, workoutPickerId]
  );

  const addExercise = useCallback(
    async (exerciseName) => {
      const result = await weightliftingService.addExerciseToWorkout(db, {
        workoutId: workoutPickerId,
        exerciseName,
      });
      const returnedId = Number(result?.exerciseId);

      // Should not happen, but an add the + cannot take back out again is
      // the bug this replaced: find the copy it just made.
      const exerciseId =
        Number.isInteger(returnedId) && returnedId > 0
          ? returnedId
          : await findAddedExerciseId(exerciseName);

      commitSession(withAdded(sessionRef.current, exerciseName, exerciseId));
    },
    [commitSession, db, findAddedExerciseId, workoutPickerId]
  );

  const handleToggleExercise = useCallback(
    async (exercise) => {
      if (!isWorkoutPicker || selectingExerciseName || !isSessionReady) {
        return;
      }

      const exerciseName = exercise?.exercise_name;

      if (!exerciseName) {
        return;
      }

      const plan = planToggle(sessionRef.current, exerciseName);

      if (plan.action === "removeExisting") {
        setRemoveRequest({ name: exerciseName, exerciseIds: plan.exerciseIds, count: plan.count });
        return;
      }

      if (plan.action === "none") {
        return;
      }

      try {
        setSelectingExerciseName(exerciseName);

        if (plan.action === "undo") {
          const exerciseId =
            Number.isInteger(plan.exerciseId) && plan.exerciseId > 0
              ? plan.exerciseId
              : await findAddedExerciseId(exerciseName);

          if (exerciseId !== null) {
            await weightliftingService.deleteExercise(db, exerciseId);
          }

          commitSession(withUndone(sessionRef.current, exerciseName));
        } else {
          await addExercise(exerciseName);
        }
      } catch (error) {
        console.error("Failed to change the workout from the picker:", error);

        if (plan.action === "undo") {
          Alert.alert(
            t("exercises.catalog.removeFailedTitle"),
            t("exercises.catalog.removeFailedBody")
          );
        } else {
          Alert.alert(
            t("exercises.catalog.addFailedTitle"),
            t("exercises.catalog.addFailedBody")
          );
        }
      } finally {
        setSelectingExerciseName(null);
      }
    },
    [
      addExercise,
      commitSession,
      db,
      findAddedExerciseId,
      isSessionReady,
      isWorkoutPicker,
      selectingExerciseName,
      t,
    ]
  );

  const confirmRemoveExisting = useCallback(async () => {
    const request = removeRequest;

    setRemoveRequest(null);

    if (!request) {
      return;
    }

    try {
      setSelectingExerciseName(request.name);

      for (const exerciseId of request.exerciseIds) {
        await weightliftingService.deleteExercise(db, exerciseId);
      }

      commitSession(withRemovedExisting(sessionRef.current, request.name));
    } catch (error) {
      console.error("Failed to remove an exercise from the workout:", error);
      Alert.alert(
        t("exercises.catalog.removeFailedTitle"),
        t("exercises.catalog.removeFailedBody")
      );
    } finally {
      setSelectingExerciseName(null);
    }
  }, [commitSession, db, removeRequest, t]);

  const handleCreateCustomExercise = useCallback(
    async ({ exerciseName, muscleGroupKeys }) => {
      const exercise = await weightliftingService.createCustomExercise(db, {
        exerciseName,
        muscleGroupKeys,
      });

      setRefreshKey((currentKey) => currentKey + 1);

      // A new exercise cannot be in the workout yet, so this is always an add.
      if (
        isWorkoutPicker &&
        exercise?.exercise_name &&
        !wasAddedThisVisit(sessionRef.current, exercise.exercise_name)
      ) {
        await handleToggleExercise(exercise);
      }
    },
    [db, handleToggleExercise, isWorkoutPicker]
  );

  const exerciseList = (
    <ExerciseLibraryList
      refreshKey={refreshKey}
      mode={isWorkoutPicker ? "workout-picker" : "catalog"}
      onToggleExercise={isWorkoutPicker ? handleToggleExercise : undefined}
      onAddCustomExercise={() => setIsCustomExerciseModalVisible(true)}
      selectingExerciseName={selectingExerciseName}
      addedExerciseNames={addedExerciseNames}
      existingExerciseNames={existingExerciseNames}
      isPickerReady={isSessionReady}
      workoutPicker={workoutPicker}
      initialFilter={initialFilter}
    />
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View
          style={[
            styles.headerTitleGroup,
            isWorkoutPicker ? styles.headerTitleGroupWithAction : null,
          ]}
        >
          {isWorkoutPicker ? (
            <ThemedText
              style={styles.headerEyebrow}
              setColor={primaryTextColor}
              numberOfLines={1}
            >
              {t("exercises.addTo", { name: workoutTargetLabel })}
            </ThemedText>
          ) : null}

          <ThemedTitle
            type="pageTitle"
            style={styles.headerTitle}
            numberOfLines={1}
          >
            {isWorkoutPicker
              ? t("exercises.addExercise")
              : t("exercises.catalog.title")}
          </ThemedTitle>
        </View>

        {/* The way out, and the count of what has gone in so far. Without it
            an open sheet gives no sign that anything was added. */}
        {isWorkoutPicker ? (
          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel={
              addedCount > 0
                ? t("exercises.catalog.doneA11y", {
                    count: addedCount,
                  })
                : t("common.done")
            }
            onPress={() => navigation.goBack()}
            style={[
              styles.headerAction,
              styles.headerDoneAction,
              {
                backgroundColor: theme.uiBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText
              style={styles.headerDoneText}
              setColor={primaryTextColor}
              numberOfLines={1}
            >
              {addedCount > 0
                ? t("exercises.catalog.doneCount", {
                    count: addedCount,
                  })
                : t("common.done")}
            </ThemedText>
          </TouchableOpacity>
        ) : null}

        {/* Making your own exercise is a rare thing to do, and it had a
            full-width button in the middle of the list saying otherwise. */}
        {!isWorkoutPicker ? (
          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel={t("exercises.catalog.addCustomA11y")}
            onPress={() => setIsCustomExerciseModalVisible(true)}
            style={[
              styles.headerAction,
              { backgroundColor: theme.uiBackground, borderColor: theme.border },
            ]}
          >
            <Plus width={19} height={19} color={theme.text} thickness={2.1} />
          </TouchableOpacity>
        ) : null}
      </ThemedHeader>

      {/*
        The picker scrolls its own list. A list inside a ScrollView is handed
        unlimited height and so renders every row, which is the whole reason
        the picker was slow. The catalog keeps the page scroll - its list is a
        fixed-height window with the rest of the card above it, so it cannot
        own the scrolling without moving the card around it.

        This stays a ScrollView. Making it a FlatList carrying the page in its
        header silences React Native's "VirtualizedLists should never be nested
        inside plain ScrollViews" warning, but it also stops the catalog's own
        list from scrolling: nested inside another VirtualizedList, the inner
        list hands its scrolling to the parent and then sits frozen on its
        first ten rows. Verified on a device. The warning is dev-only
        (`VirtualizedList.js`, inside `if (__DEV__)`) and is a false alarm
        here, because `styles.listScroll` gives the inner list a fixed height
        and therefore a real viewport to virtualize against.
      */}
      {isWorkoutPicker ? (
        <View style={[styles.content, styles.scrollContent]}>{exerciseList}</View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {exerciseList}
        </ScrollView>
      )}

      <CustomExerciseModal
        visible={isCustomExerciseModalVisible}
        onClose={() => setIsCustomExerciseModalVisible(false)}
        onCreate={handleCreateCustomExercise}
      />

      {/* Only for an exercise that was in the workout before the picker
          opened: it may have sets. One added on this visit comes out without
          a question. */}
      <ThemedConfirmModal
        visible={Boolean(removeRequest)}
        title={t("exercises.catalog.removeExistingTitle", {
          name: removeRequest?.name ?? "",
        })}
        message={t("exercises.catalog.removeExistingMessage", {
          count: removeRequest?.count ?? 1,
        })}
        confirmLabel={t("exercises.catalog.removeExistingConfirm")}
        cancelLabel={t("exercises.catalog.removeExistingCancel")}
        tone="danger"
        onConfirm={confirmRemoveExisting}
        onClose={() => setRemoveRequest(null)}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default ExerciseCatalogPage;
