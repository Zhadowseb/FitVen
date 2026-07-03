import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";

import BodyMapPreview from "../../../../Resources/Components/BodyMapPreview/BodyMapPreview";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import {
  ThemedButton,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
} from "../../../../Resources/ThemedComponents";
import {
  buildCustomExerciseMuscleMetadata,
  EXERCISE_MUSCLE_GROUPS,
} from "../../../../Utils/exerciseMuscleGroups";
import styles from "./CustomExerciseModalStyle";

const NAME_STEP = 1;
const MUSCLE_STEP = 2;

export default function CustomExerciseModal({ visible, onClose, onCreate }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryColor = theme.primary ?? "#f7742e";
  const cardBorder = theme.cardBorder ?? theme.iconColor;
  const quietText = theme.iconColor ?? theme.text;
  const activeChipText = theme.textInverted ?? "#0E0F12";
  const dangerColor = theme.danger ?? "#ba0000";
  const [step, setStep] = useState(NAME_STEP);
  const [exerciseName, setExerciseName] = useState("");
  const [selectedMuscleKeys, setSelectedMuscleKeys] = useState([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedExerciseName = exerciseName.trim();
  const muscleMetadata = useMemo(
    () => buildCustomExerciseMuscleMetadata(selectedMuscleKeys),
    [selectedMuscleKeys]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStep(NAME_STEP);
    setExerciseName("");
    setSelectedMuscleKeys([]);
    setError("");
    setIsSubmitting(false);
  }, [visible]);

  const handleClose = () => {
    if (!isSubmitting) {
      onClose?.();
    }
  };

  const handleNext = () => {
    if (normalizedExerciseName.length < 2) {
      setError("Exercise name must contain at least 2 characters.");
      return;
    }

    setError("");
    setStep(MUSCLE_STEP);
  };

  const toggleMuscleGroup = (muscleGroupKey) => {
    setError("");
    setSelectedMuscleKeys((currentKeys) =>
      currentKeys.includes(muscleGroupKey)
        ? currentKeys.filter((key) => key !== muscleGroupKey)
        : [...currentKeys, muscleGroupKey]
    );
  };

  const handleCreate = async () => {
    if (selectedMuscleKeys.length === 0 || isSubmitting) {
      setError("Select at least one muscle group.");
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);
      await onCreate?.({
        exerciseName: normalizedExerciseName,
        muscleGroupKeys: selectedMuscleKeys,
      });
      onClose?.();
    } catch (createError) {
      setError(
        createError?.message || "The custom exercise could not be created."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={handleClose}
      title="Add custom exercise"
      dismissOnBackdropPress={!isSubmitting}
      style={styles.modal}
      contentStyle={styles.modalContent}
    >
      <ThemedText style={styles.stepLabel} setColor={primaryColor}>
        STEP {step} OF 2
      </ThemedText>

      {step === NAME_STEP ? (
        <View style={styles.stepContent}>
          <View style={styles.copy}>
            <ThemedTitle type="h3">Name your exercise</ThemedTitle>
            <ThemedText style={styles.description} setColor={quietText}>
              Choose a clear name that you will recognize in workouts and
              history.
            </ThemedText>
          </View>

          <ThemedTextInput
            value={exerciseName}
            onChangeText={(value) => {
              setExerciseName(value);
              setError("");
            }}
            placeholder="Exercise name"
            autoFocus
            autoCapitalize="words"
            maxLength={80}
            returnKeyType="next"
            onSubmitEditing={handleNext}
            error={error}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.muscleStepScroll}
          contentContainerStyle={styles.muscleStepContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.copy}>
            <ThemedTitle type="h3">Select muscle groups</ThemedTitle>
            <ThemedText style={styles.description} setColor={quietText}>
              Choose every muscle group targeted by {normalizedExerciseName}.
            </ThemedText>
          </View>

          <View style={styles.bodyMapRow}>
            <View style={styles.bodyMapFigure}>
              <ThemedText style={styles.bodyMapLabel} setColor={quietText}>
                Front
              </ThemedText>
              <BodyMapPreview
                bodyView="front"
                primaryRegionKeys={
                  muscleMetadata.primary_front_body_map_region_keys
                }
                style={styles.bodyMap}
              />
            </View>
            <View style={styles.bodyMapFigure}>
              <ThemedText style={styles.bodyMapLabel} setColor={quietText}>
                Back
              </ThemedText>
              <BodyMapPreview
                bodyView="back"
                primaryRegionKeys={
                  muscleMetadata.primary_back_body_map_region_keys
                }
                style={styles.bodyMap}
              />
            </View>
          </View>

          <View style={styles.chipGrid}>
            {EXERCISE_MUSCLE_GROUPS.map((muscleGroup) => {
              const isSelected = selectedMuscleKeys.includes(muscleGroup.key);

              return (
                <Pressable
                  key={muscleGroup.key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => toggleMuscleGroup(muscleGroup.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? primaryColor
                        : theme.uiBackground,
                      borderColor: isSelected ? primaryColor : cardBorder,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.chipText}
                    setColor={isSelected ? activeChipText : theme.text}
                  >
                    {muscleGroup.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <ThemedText style={styles.error} setColor={dangerColor}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <ThemedButton
          title={step === NAME_STEP ? "Cancel" : "Back"}
          variant="secondary"
          disabled={isSubmitting}
          onPress={step === NAME_STEP ? handleClose : () => setStep(NAME_STEP)}
          style={styles.action}
        />
        <ThemedButton
          title={
            step === NAME_STEP
              ? "Next"
              : isSubmitting
                ? "Creating..."
                : "Create exercise"
          }
          disabled={
            step === NAME_STEP
              ? normalizedExerciseName.length < 2
              : selectedMuscleKeys.length === 0 || isSubmitting
          }
          onPress={step === NAME_STEP ? handleNext : handleCreate}
          style={styles.action}
        />
      </View>
    </ThemedModal>
  );
}
