import React, { useState, useEffect } from "react";
import { ScrollView, Pressable } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { weightliftingService as weightliftingRepository } from "../../../../../../../Services";

import {
  ThemedModal,
  ThemedText,
  ThemedView
} from "../../../../../../../Resources/ThemedComponents";

const PickExerciseModal = ({ visible, onClose, workout_id, onSubmit }) => {

  const db = useSQLiteContext();

  const [exercises, setExercises] = useState([]);

  useEffect(() => {
    if (visible) {
      loadExercises();
    }
  }, [visible]);

  const loadExercises = async () => {
    try {

      const rows = await weightliftingRepository.getExerciseStorage(db);

      setExercises(rows);

    } catch (error) {
      console.error("Error loading exercises", error);
    }
  };

  const handleSelect = async (exercise_name) => {

    try {
      await weightliftingRepository.addExerciseToWorkout(db, {
        workoutId: workout_id,
        exerciseName: exercise_name,
      });

      onSubmit?.();
      onClose();

    } catch (error) {
      console.error(error);
    }
  };

  return (
    <ThemedModal
      title="Add exercise"
      visible={visible}
      onClose={onClose}
    >

      <ScrollView>

        {exercises.map((item, index) => (
          <Pressable
            key={index}
            onPress={() => handleSelect(item.exercise_name)}
            style={{
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: "#434242"
            }}
          >
            <ThemedText>
              {item.exercise_name}
            </ThemedText>

          </Pressable>
        ))}

      </ScrollView>

    </ThemedModal>
  );
};

export default PickExerciseModal;
