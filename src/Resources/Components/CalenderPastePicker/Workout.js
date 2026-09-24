import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { programService } from "../../../Services";
import {
  ThemedModal,
  ThemedStateBlock,
  ThemedText,
} from "../../ThemedComponents";
import { useTranslation } from "@localization";

const Workout = ({ program_id, visible, close }) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const [workouts, set_workouts] = useState([]);
  const [loading, set_Loading] = useState(false);

  useEffect(() => {
    if (!program_id) return;

    const load = async () => {
      try {
        set_Loading(true);
        const rows = await programService.getWorkoutOptions(db, program_id);
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
    return <ThemedText>{t("programs.picker.noWorkouts")}</ThemedText>;
  }

  return (
    <>
      <ThemedModal
        visible={visible}
        onClose={() => close()}
        title={t("programs.picker.pickWorkout")}>

        {workouts.map(workout => (
          <Pressable
            key={workout.workout_id}
            onPress={() => {
              close();
            }}
            style={{ paddingVertical: 12 }}
          >
            <ThemedText>
              {t("programs.picker.workoutOption", {
                id: workout.workout_id,
                date: workout.date,
              })}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedModal>
    </>
    
  );
};

export default Workout;
