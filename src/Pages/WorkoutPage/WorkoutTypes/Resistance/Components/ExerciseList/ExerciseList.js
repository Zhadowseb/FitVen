// src/Components/ExerciseList/ExerciseList.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  TouchableOpacity,
  View,
  Vibration,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useNavigation } from "@react-navigation/native";

import styles from "./ExerciseListStyle.js";
import { weightliftingService as weightliftingRepository } from "../../../../../../Services";

import ExerciseRow from "./Components/ExerciseRow/ExerciseRow"
import PlusCircled from "../../../../../../Resources/Icons/UI-icons/PlusCircled";
import PickExerciseModal from "./Components/PickExerciseModal";

const ExerciseList = ({
  workout_id,
  refreshing,
  updateUI,
  showCompletedExercises = false,
  expansionAction,
  onReorderDragChange,
}) => {
  const [exercises, setExercises] = useState([]);
  const [expandedExercises, setExpandedExercises] = useState({});
  const [loading, setLoading] = useState(false);
  const [dragState, setDragState] = useState(null);

  const [pickExerciseModal_visible, set_pickExerciseModal_visible] = useState(false);

  const db = useSQLiteContext();
  const navigation = useNavigation();
  const rowLayoutsRef = useRef({});
  const dragContextRef = useRef(null);
  const dragTargetIndexRef = useRef(null);
  const dragOffsetYValueRef = useRef(0);
  const dragOffsetY = useRef(new Animated.Value(0)).current;
  const loadRequestIdRef = useRef(0);
  const draggingExerciseId = dragState?.exerciseId ?? null;

  const visibleExercises = useMemo(
    () =>
      exercises.filter(
        (item) => showCompletedExercises || Number(item.done) !== 1
      ),
    [exercises, showCompletedExercises]
  );

  const moveExercise = (items, fromIndex, toIndex) => {
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);
    return nextItems;
  };

  const mergeVisibleExerciseOrder = (allExercises, nextVisibleExercises) => {
    const visibleExerciseIds = new Set(
      nextVisibleExercises.map((exercise) => exercise.exercise_id)
    );
    let visibleIndex = 0;

    return allExercises.map((exercise) => {
      if (!visibleExerciseIds.has(exercise.exercise_id)) {
        return exercise;
      }

      const nextExercise = nextVisibleExercises[visibleIndex];
      visibleIndex += 1;
      return nextExercise;
    });
  };

  const applyLoadedExercises = useCallback((nextExercises) => {
    setExercises(nextExercises);
    setExpandedExercises((prev) => {
      const nextExpandedExercises = {};

      for (const exercise of nextExercises) {
        nextExpandedExercises[exercise.exercise_id] =
          prev[exercise.exercise_id] ?? false;
      }

      return nextExpandedExercises;
    });
  }, []);

  const shouldRequestHydration = useCallback((nextExercises) => {
    if (nextExercises.length === 0) {
      return true;
    }

    return nextExercises.some((exercise) => {
      const expectedSetCount = Number(exercise.plannedSetCount) || 0;
      const actualSetCount = Number(exercise.setCount) || 0;
      return expectedSetCount > 0 && actualSetCount === 0;
    });
  }, []);

  const loadExercises = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      setLoading(true);

      const localExercises = await weightliftingRepository.getWorkoutExercises(
        db,
        workout_id,
        { ensureHydrated: false }
      );

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      applyLoadedExercises(localExercises);

      if (!shouldRequestHydration(localExercises)) {
        return;
      }

      const hydratedExercises = await weightliftingRepository.getWorkoutExercises(
        db,
        workout_id,
        { ensureHydrated: true }
      );

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      applyLoadedExercises(hydratedExercises);

    } catch (error) {
      console.error("Error loading exercises", error);
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [applyLoadedExercises, db, shouldRequestHydration, workout_id]);

  const normalizeSetCompletion = (completion) => {
    if (typeof completion === "object" && completion !== null) {
      const doneValue = completion.done ? 1 : 0;

      return {
        done: doneValue,
        failed: doneValue === 1 && completion.failed ? 1 : 0,
      };
    }

    return {
      done: completion ? 1 : 0,
      failed: 0,
    };
  };

  const applySetCompletionOptimistic = (setsId, completion) => {
    const { done, failed } = normalizeSetCompletion(completion);

    setExercises((prevExercises) =>
      prevExercises.map((exercise) => {
        let didUpdateSet = false;
        const nextSets = (exercise.sets ?? []).map((set) => {
          if (Number(set.sets_id) !== Number(setsId)) {
            return set;
          }

          didUpdateSet = true;
          return {
            ...set,
            done,
            failed,
          };
        });

        if (!didUpdateSet) {
          return exercise;
        }

        return {
          ...exercise,
          sets: nextSets,
          done:
            nextSets.length > 0 &&
            nextSets.every((set) => Number(set.done) === 1)
              ? 1
              : 0,
        };
      })
    );
  };

  const updateSetDone = async (sets_id, completion) => {
    const { done, failed } = normalizeSetCompletion(completion);

    applySetCompletionOptimistic(sets_id, { done, failed });

    try {
      await weightliftingRepository.updateStrengthSetDone(db, {
        workoutId: workout_id,
        setId: sets_id,
        done,
        failed,
      });

      //Reloades ui
      loadExercises();
      updateUI();

    } catch (error) {
      console.error("updateSetDone failed:", error);
      loadExercises();
    }
  };


  useEffect(() => {
    loadExercises();
  }, [loadExercises, refreshing]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadExercises();
    });

    return unsubscribe;
  }, [loadExercises, navigation]);

  useEffect(() => {
    if (!expansionAction?.type) {
      return;
    }

    setExpandedExercises((prev) => {
      const nextExpandedExercises = { ...prev };

      for (const exercise of exercises) {
        nextExpandedExercises[exercise.exercise_id] =
          expansionAction.type === "expand";
      }

      return nextExpandedExercises;
    });
  }, [expansionAction]);

  const toggleExpanded = (exerciseId) => {
    setExpandedExercises((prev) => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  const handleExerciseLayout = (exerciseId, event) => {
    const { y, height } = event.nativeEvent.layout;
    rowLayoutsRef.current[exerciseId] = { y, height };
  };

  const getTargetIndexForDrag = (dragContext, dy) => {
    const currentCenterY = dragContext.startCenterY + dy;
    let targetIndex = 0;

    for (const exercise of dragContext.baseVisibleExercises) {
      if (exercise.exercise_id === dragContext.exerciseId) {
        continue;
      }

      const rowLayout = dragContext.layoutsById[exercise.exercise_id];

      if (!rowLayout) {
        continue;
      }

      if (currentCenterY > rowLayout.y + rowLayout.height / 2) {
        targetIndex += 1;
      }
    }

    return Math.max(
      0,
      Math.min(dragContext.baseVisibleExercises.length - 1, targetIndex)
    );
  };

  const getFinalTopForTargetIndex = (dragContext, targetIndex) => {
    const activeLayout = dragContext.layoutsById[dragContext.exerciseId];

    if (!activeLayout || targetIndex === dragContext.startIndex) {
      return activeLayout?.y ?? 0;
    }

    const targetExercise = dragContext.baseVisibleExercises[targetIndex];
    const targetLayout = targetExercise
      ? dragContext.layoutsById[targetExercise.exercise_id]
      : null;

    if (!targetLayout) {
      return activeLayout.y;
    }

    if (targetIndex > dragContext.startIndex) {
      return targetLayout.y + targetLayout.height - dragContext.activeHeight;
    }

    return targetLayout.y;
  };

  const finishDrag = useCallback(() => {
    dragContextRef.current = null;
    dragTargetIndexRef.current = null;
    dragOffsetYValueRef.current = 0;
    dragOffsetY.setValue(0);
    setDragState(null);
    onReorderDragChange?.(false);
  }, [dragOffsetY, onReorderDragChange]);

  const handleDragStart = useCallback(
    (exerciseId) => {
      const startIndex = visibleExercises.findIndex(
        (exercise) => exercise.exercise_id === exerciseId
      );
      const rowLayout = rowLayoutsRef.current[exerciseId];

      if (startIndex < 0 || visibleExercises.length < 2 || !rowLayout) {
        return false;
      }

      const layoutsById = {};
      for (const exercise of visibleExercises) {
        layoutsById[exercise.exercise_id] =
          rowLayoutsRef.current[exercise.exercise_id];
      }

      dragContextRef.current = {
        exerciseId,
        startIndex,
        targetIndex: startIndex,
        activeHeight: rowLayout.height,
        startCenterY: rowLayout.y + rowLayout.height / 2,
        baseExercises: exercises,
        baseVisibleExercises: visibleExercises,
        layoutsById,
      };
      dragTargetIndexRef.current = startIndex;
      dragOffsetY.stopAnimation();
      dragOffsetY.setValue(0);
      dragOffsetYValueRef.current = 0;
      setDragState({
        exerciseId,
        startIndex,
        targetIndex: startIndex,
        activeHeight: rowLayout.height,
        isSettling: false,
      });
      onReorderDragChange?.(true);
      Vibration.vibrate(12);
      return true;
    },
    [dragOffsetY, exercises, onReorderDragChange, visibleExercises]
  );

  const handleDragMove = useCallback((dy) => {
    const dragContext = dragContextRef.current;

    if (!dragContext) {
      return;
    }

    dragOffsetYValueRef.current = dy;
    dragOffsetY.setValue(dy);

    const targetIndex = getTargetIndexForDrag(dragContext, dy);
    if (targetIndex === dragTargetIndexRef.current) {
      return;
    }

    dragTargetIndexRef.current = targetIndex;
    dragContextRef.current = {
      ...dragContext,
      targetIndex,
    };
    setDragState((prev) =>
      prev
        ? {
            ...prev,
            targetIndex,
          }
        : prev
    );
  }, [dragOffsetY]);

  const handleDragEnd = useCallback(async () => {
    const dragContext = dragContextRef.current;

    if (!dragContext) {
      return;
    }

    const targetIndex = dragTargetIndexRef.current ?? dragContext.startIndex;
    const nextVisibleExercises = moveExercise(
      dragContext.baseVisibleExercises,
      dragContext.startIndex,
      targetIndex
    );
    const nextExercises = mergeVisibleExerciseOrder(
      dragContext.baseExercises,
      nextVisibleExercises
    );
    const currentTop =
      (dragContext.layoutsById[dragContext.exerciseId]?.y ?? 0) +
      dragOffsetYValueRef.current;
    const finalTop = getFinalTopForTargetIndex(dragContext, targetIndex);
    const finalOffset = currentTop - finalTop;
    const didReorder = targetIndex !== dragContext.startIndex;

    setDragState({
      exerciseId: dragContext.exerciseId,
      startIndex: targetIndex,
      targetIndex,
      activeHeight: dragContext.activeHeight,
      isSettling: true,
    });
    dragOffsetY.setValue(finalOffset);

    if (didReorder) {
      setExercises(nextExercises);
    }

    Animated.timing(dragOffsetY, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      finishDrag();
    });

    if (!didReorder) {
      return;
    }

    const nextExerciseIds = nextExercises
      .map((exercise) => Number(exercise?.exercise_id))
      .filter((exerciseId) => Number.isFinite(exerciseId));

    if (nextExerciseIds.length !== nextExercises.length) {
      console.error("Exercise reorder failed: invalid exercise id payload", {
        exerciseIds: nextExercises.map((exercise) => exercise?.exercise_id),
      });
      loadExercises();
      return;
    }

    try {
      await weightliftingRepository.reorderWorkoutExercises(db, {
        workoutId: workout_id,
        exerciseIds: nextExerciseIds,
      });
      updateUI?.();
    } catch (error) {
      console.error("Exercise reorder failed:", error);
      loadExercises();
    }
  }, [db, dragOffsetY, finishDrag, updateUI, workout_id]);

  const getDragWrapperStyle = (exerciseId) => {
    if (!dragState) {
      return null;
    }

    if (dragState.exerciseId === exerciseId) {
      return {
        transform: [
          { translateY: dragOffsetY },
          { scale: dragState.isSettling ? 1 : 1.02 },
        ],
      };
    }

    if (dragState.isSettling) {
      return null;
    }

    const exerciseIndex = visibleExercises.findIndex(
      (exercise) => exercise.exercise_id === exerciseId
    );

    if (exerciseIndex < 0) {
      return null;
    }

    const { startIndex, targetIndex, activeHeight } = dragState;

    if (targetIndex > startIndex) {
      if (exerciseIndex > startIndex && exerciseIndex <= targetIndex) {
        return { transform: [{ translateY: -activeHeight }] };
      }
    }

    if (targetIndex < startIndex) {
      if (exerciseIndex >= targetIndex && exerciseIndex < startIndex) {
        return { transform: [{ translateY: activeHeight }] };
      }
    }

    return null;
  };

  const renderItem = (item) => (
    <Animated.View
      key={item.exercise_id}
      onLayout={(event) => handleExerciseLayout(item.exercise_id, event)}
      style={[
        styles.dragWrapper,
        draggingExerciseId === item.exercise_id && styles.dragWrapperActive,
        getDragWrapperStyle(item.exercise_id),
      ]}
    >

      <ExerciseRow 
        exercise={item}
        isExpanded={Boolean(expandedExercises[item.exercise_id])}
        onToggleExpanded={() => toggleExpanded(item.exercise_id)}
        updateUI={updateUI}
        onToggleSet={updateSetDone}
        refreshing={refreshing}
        isDragging={draggingExerciseId === item.exercise_id}
        onDragStart={() => handleDragStart(item.exercise_id)}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      />
    </Animated.View>
  );

  return (
    <>
    <View>
      {visibleExercises.map((item) => renderItem(item))}
    </View>

    <View style={{alignItems: "center", paddingTop: 30}}>

      <TouchableOpacity
        onPress={ () => {
          set_pickExerciseModal_visible(true);
        }}>
        <PlusCircled
          width={30}
          height={30} />
      </TouchableOpacity>
    </View>

    <PickExerciseModal
      visible={pickExerciseModal_visible}
      workout_id={workout_id}
      onClose={() => set_pickExerciseModal_visible(false)}
      onSubmit={loadExercises}
    />
    </>
  );
};

export default ExerciseList;
