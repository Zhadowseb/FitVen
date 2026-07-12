import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";

import BodyMapPreview from "../../../../Resources/Components/BodyMapPreview/BodyMapPreview";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
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
  const [primaryMuscleKeys, setPrimaryMuscleKeys] = useState([]);
  const [secondaryMuscleKeys, setSecondaryMuscleKeys] = useState([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const normalizedExerciseName = exerciseName.trim();
  const muscleMetadata = useMemo(
    () =>
      buildCustomExerciseMuscleMetadata({
        primary: primaryMuscleKeys,
        secondary: secondaryMuscleKeys,
      }),
    [primaryMuscleKeys, secondaryMuscleKeys]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStep(NAME_STEP);
    setExerciseName("");
    setPrimaryMuscleKeys([]);
    setSecondaryMuscleKeys([]);
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

  // Tap cycle per muscle group: none -> primary -> secondary -> none.
  const cycleMuscleGroup = (muscleGroupKey) => {
    setError("");

    if (primaryMuscleKeys.includes(muscleGroupKey)) {
      setPrimaryMuscleKeys((currentKeys) =>
        currentKeys.filter((key) => key !== muscleGroupKey)
      );
      setSecondaryMuscleKeys((currentKeys) => [...currentKeys, muscleGroupKey]);
      return;
    }

    if (secondaryMuscleKeys.includes(muscleGroupKey)) {
      setSecondaryMuscleKeys((currentKeys) =>
        currentKeys.filter((key) => key !== muscleGroupKey)
      );
      return;
    }

    setPrimaryMuscleKeys((currentKeys) => [...currentKeys, muscleGroupKey]);
  };

  const handleCreate = async () => {
    if (primaryMuscleKeys.length === 0 || isSubmitting) {
      setError("Select at least one primary muscle group.");
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);
      await onCreate?.({
        exerciseName: normalizedExerciseName,
        muscleGroupKeys: {
          primary: primaryMuscleKeys,
          secondary: secondaryMuscleKeys,
        },
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
              Tap once for a primary muscle, twice for a secondary — tap again
              to remove it.
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
                secondaryRegionKeys={
                  muscleMetadata.secondary_front_body_map_region_keys
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
                secondaryRegionKeys={
                  muscleMetadata.secondary_back_body_map_region_keys
                }
                style={styles.bodyMap}
              />
            </View>
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: primaryColor }]}
              />
              <ThemedText style={styles.legendText} setColor={quietText}>
                Primary
              </ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor: withAlpha(primaryColor, 0.16),
                    borderWidth: 1,
                    borderColor: primaryColor,
                  },
                ]}
              />
              <ThemedText style={styles.legendText} setColor={quietText}>
                Secondary
              </ThemedText>
            </View>
          </View>

          <View style={styles.chipGrid}>
            {EXERCISE_MUSCLE_GROUPS.map((muscleGroup) => {
              const isPrimary = primaryMuscleKeys.includes(muscleGroup.key);
              const isSecondary = secondaryMuscleKeys.includes(
                muscleGroup.key
              );

              return (
                <Pressable
                  key={muscleGroup.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isPrimary || isSecondary }}
                  accessibilityLabel={
                    isPrimary
                      ? `${muscleGroup.label}, primary muscle`
                      : isSecondary
                        ? `${muscleGroup.label}, secondary muscle`
                        : muscleGroup.label
                  }
                  onPress={() => cycleMuscleGroup(muscleGroup.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isPrimary
                        ? primaryColor
                        : isSecondary
                          ? withAlpha(primaryColor, 0.16)
                          : theme.uiBackground,
                      borderColor:
                        isPrimary || isSecondary ? primaryColor : cardBorder,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.chipText}
                    setColor={
                      isPrimary
                        ? activeChipText
                        : isSecondary
                          ? primaryColor
                          : theme.text
                    }
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
              : primaryMuscleKeys.length === 0 || isSubmitting
          }
          onPress={step === NAME_STEP ? handleNext : handleCreate}
          style={styles.action}
        />
      </View>
    </ThemedModal>
  );
}
