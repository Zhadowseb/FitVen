import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";
import { useTranslation } from "@localization";

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
  muscleGroupLabel,
} from "../../../../Utils/exerciseMuscleGroups";
import styles from "./CustomExerciseModalStyle";

const NAME_STEP = 1;
const MUSCLE_STEP = 2;

export default function CustomExerciseModal({ visible, onClose, onCreate }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryColor = theme.primary;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const cardBorder = theme.cardBorder ?? theme.iconColor;
  const quietText = theme.iconColor ?? theme.text;
  const activeChipText = theme.textInverted;
  const dangerColor = theme.danger;
  const nameInputRef = useRef(null);
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
      setError(t("exercises.customModal.nameTooShort"));
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
      setError(t("exercises.customModal.selectPrimary"));
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
        createError?.message || t("exercises.customModal.createFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={handleClose}
      // Focus after the open animation, otherwise the keyboard is up before
      // the modal has measured itself and the lift is computed against a
      // layout that does not exist yet.
      onShow={() => nameInputRef.current?.focus()}
      title={t("exercises.customModal.title")}
      dismissOnBackdropPress={!isSubmitting}
      style={styles.modal}
      contentStyle={styles.modalContent}
    >
      <ThemedText style={styles.stepLabel} setColor={primaryTextColor}>
        {t("exercises.customModal.step", { step, total: 2 })}
      </ThemedText>

      {step === NAME_STEP ? (
        <View style={styles.stepContent}>
          <View style={styles.copy}>
            <ThemedTitle type="h3">
              {t("exercises.customModal.nameTitle")}
            </ThemedTitle>
            <ThemedText style={styles.description} setColor={quietText}>
              {t("exercises.customModal.nameBody")}
            </ThemedText>
          </View>

          <ThemedTextInput
            value={exerciseName}
            onChangeText={(value) => {
              setExerciseName(value);
              setError("");
            }}
            placeholder={t("exercises.customModal.namePlaceholder")}
            innerRef={nameInputRef}
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
            <ThemedTitle type="h3">
              {t("exercises.customModal.musclesTitle")}
            </ThemedTitle>
            <ThemedText style={styles.description} setColor={quietText}>
              {t("exercises.customModal.musclesBody")}
            </ThemedText>
          </View>

          <View style={styles.bodyMapRow}>
            <View style={styles.bodyMapFigure}>
              <ThemedText style={styles.bodyMapLabel} setColor={quietText}>
                {t("exercises.front")}
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
                {t("exercises.back")}
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
                {t("exercises.primary")}
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
                {t("exercises.secondary")}
              </ThemedText>
            </View>
          </View>

          <View style={styles.chipGrid}>
            {EXERCISE_MUSCLE_GROUPS.map((muscleGroup) => {
              const isPrimary = primaryMuscleKeys.includes(muscleGroup.key);
              const isSecondary = secondaryMuscleKeys.includes(
                muscleGroup.key
              );
              const muscleName = muscleGroupLabel(muscleGroup.key, t);

              return (
                <Pressable
                  key={muscleGroup.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isPrimary || isSecondary }}
                  accessibilityLabel={
                    isPrimary
                      ? t("exercises.customModal.primaryMuscleA11y", {
                          muscle: muscleName,
                        })
                      : isSecondary
                        ? t("exercises.customModal.secondaryMuscleA11y", {
                            muscle: muscleName,
                          })
                        : muscleName
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
                    {muscleName}
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
          title={step === NAME_STEP ? t("common.cancel") : t("common.back")}
          variant="secondary"
          disabled={isSubmitting}
          onPress={step === NAME_STEP ? handleClose : () => setStep(NAME_STEP)}
          style={styles.action}
        />
        <ThemedButton
          title={
            step === NAME_STEP
              ? t("common.next")
              : isSubmitting
                ? t("exercises.customModal.creating")
                : t("exercises.customModal.create")
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
