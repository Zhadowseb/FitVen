import { useState } from "react";
import { ScrollView, View, useColorScheme } from "react-native";

import { Colors } from "../../../../../../Resources/GlobalStyling/colors";
import { formatDisplayNumber } from "../../../../../../Utils/numberUtils";
import { getSuggestedProgramBestWeight } from "../../../../../../Utils/oneRepMaxUtils";
import styles from "./AddEstimatedSetStyle";
import ExerciseDropdown from "../../../../../../Resources/Components/ExerciseDropdown/ExerciseDropdown";
import {
  ThemedButton,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
} from "../../../../../../Resources/ThemedComponents";
import { useTranslation } from "@localization";

export default function AddEstimatedSet({
  visible,
  onClose,
  onSubmit,
  programExerciseBestMap = {},
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [estimated_weight, set_estimated_weight] = useState("");
  const [selectedExerciseName, set_selectedExerciseName] = useState("");

  const selectedProgramBest = selectedExerciseName
    ? programExerciseBestMap[selectedExerciseName]
    : null;
  const suggestedWeight = getSuggestedProgramBestWeight(selectedProgramBest);
  const suggestedWeightDisplay =
    suggestedWeight === null
      ? null
      : `${formatDisplayNumber(suggestedWeight)} ${t("common.kg")}`;
  const canSubmit =
    selectedExerciseName.trim() !== "" && estimated_weight.trim() !== "";
  const surfaceColor = theme.uiBackground;
  const borderColor = theme.cardBorder ?? theme.iconColor;
  const badgeBackground = theme.primary;
  const badgeTextColor = theme.cardBackground ?? theme.textInverted;

  const handleClose = () => {
    set_estimated_weight("");
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    onSubmit({
      selectedExerciseName: selectedExerciseName.trim(),
      estimated_weight: estimated_weight.trim(),
    });
    set_estimated_weight("");
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={handleClose}
      title={t("programs.rm.addTitle")}
      style={styles.modal}
      contentStyle={styles.content}
    >
      <View
        style={[
          styles.section,
          {
            backgroundColor: surfaceColor,
            borderColor,
          },
        ]}
      >
        <ThemedText size={12} style={styles.sectionLabel} setColor={theme.text}>
          {t("programs.rm.exercise")}
        </ThemedText>
        <ExerciseDropdown
          selectedExerciseName={selectedExerciseName}
          onChange={set_selectedExerciseName}
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View
          style={[
            styles.section,
            {
              backgroundColor: surfaceColor,
              borderColor,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <ThemedText
              size={12}
              style={styles.sectionLabel}
              setColor={theme.text}
            >
              {t("programs.rm.programBest")}
            </ThemedText>
            {selectedProgramBest?.isEstimated && (
              <View
                style={[
                  styles.estimatedBadge,
                  { backgroundColor: badgeBackground },
                ]}
              >
                <ThemedText
                  size={10}
                  style={styles.estimatedBadgeText}
                  setColor={badgeTextColor}
                >
                  {t("programs.rm.estimatedBadge")}
                </ThemedText>
              </View>
            )}
          </View>

          {selectedProgramBest && suggestedWeightDisplay ? (
            <>
              <ThemedText size={24} style={styles.suggestedWeight}>
                {suggestedWeightDisplay}
              </ThemedText>
              <ThemedText size={12} setColor={theme.quietText}>
                {t("programs.rm.bestSet", { set: selectedProgramBest.setDisplayValue })}
              </ThemedText>
              {selectedProgramBest.performedDate && (
                <ThemedText size={12} setColor={theme.quietText}>
                  {t("programs.rm.achievedOn", { date: selectedProgramBest.performedDate })}
                </ThemedText>
              )}
              <ThemedButton
                title={t("programs.rm.useWeight", { weight: suggestedWeightDisplay })}
                onPress={() => set_estimated_weight(String(suggestedWeight))}
                fullWidth
                style={styles.useBestButton}
              />
            </>
          ) : (
            <ThemedText size={12} setColor={theme.quietText}>
              {t("programs.rm.addNoBestHint")}
            </ThemedText>
          )}
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: surfaceColor,
              borderColor,
            },
          ]}
        >
          <ThemedText
            size={12}
            style={styles.sectionLabel}
            setColor={theme.text}
          >
            {t("programs.rm.estimatedLabel")}
          </ThemedText>
          <View style={styles.inputRow}>
            <ThemedTextInput
              placeholder={t("programs.rm.weightPlaceholder")}
              keyboardType="numeric"
              value={estimated_weight}
              onChangeText={set_estimated_weight}
              style={styles.inputContainer}
            />

            <View
              style={[
                styles.unitBadge,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor,
                },
              ]}
            >
              <ThemedText size={12}>{t("common.kg")}</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <ThemedButton
            title={t("common.close")}
            variant="secondary"
            onPress={handleClose}
            style={styles.actionButton}
          />
          <ThemedButton
            title={t("programs.rm.addButton")}
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </ThemedModal>
  );
}
