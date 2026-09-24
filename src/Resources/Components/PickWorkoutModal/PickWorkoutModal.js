import { ScrollView, TouchableOpacity, useColorScheme } from "react-native";

import styles from "./PickWorkoutModalStyle";
import { Colors } from "../../GlobalStyling/colors";
import { ThemedModal, ThemedText } from "../../ThemedComponents";
import { useTranslation } from "@localization";

const PickWorkoutModal = ({ workouts = [], visible, onClose, onSubmit }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();

  return (
    <ThemedModal visible={visible} title={t("workout.pick.title")} onClose={onClose}>
      <ScrollView>
        {workouts.map((item) => (
          <TouchableOpacity
            key={item.workout_id}
            style={styles.row}
            onPress={() => {
              onSubmit?.(item);
              onClose();
            }}
          >
            <ThemedText
              setColor={item.done === 1 ? theme.secondary : undefined}
            >
              {t("workout.pick.workoutNumber", { id: item.workout_id })}
            </ThemedText>

            <ThemedText>{item.label}</ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedModal>
  );
};

export default PickWorkoutModal;
