import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { programService as programRepository } from "../../../Services";
import {
  ThemedModal,
  ThemedStateBlock,
  ThemedText,
} from "../../ThemedComponents";

const Workout = ({ program_id, visible, close }) => {
  const db = useSQLiteContext();
  const [workouts, set_workouts] = useState([]);
  const [loading, set_Loading] = useState(false);

  useEffect(() => {
    if (!program_id) return;

    const load = async () => {
      try {
        set_Loading(true);
        const rows = await programRepository.getWorkoutOptions(db, program_id);
        set_workouts(rows);
      } catch (e) {
        console.error(e);
      } finally {
        set_Loading(false);
      }
    };

    load();
  }, [program_id]);

  if (loading) return <ThemedStateBlock />;

  if (workouts.length === 0) {
    return <ThemedText>No workouts</ThemedText>;
  }

  return (
    <>
      <ThemedModal
        visible={visible}
        onClose={() => close()}
        title="Pick a Workout">

        {workouts.map(workout => (
          <Pressable
            key={workout.workout_id}
            onPress={() => {
              close();
            }}
            style={{ paddingVertical: 12 }}
          >
            <ThemedText>
              Workout {workout.workout_id}, Date: {workout.date}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedModal>
    </>
    
  );
};

export default Workout;
