import React, { useState } from "react";
import { ScrollView, View, useColorScheme } from "react-native";

import { Colors } from "../../../../../../Resources/GlobalStyling/colors";
import styles from "./AddEstimatedSetStyle";
import ExerciseDropdown from "../../../../../../Resources/Components/ExerciseDropdown/ExerciseDropdown";
import {
  ThemedButton,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
} from "../../../../../../Resources/ThemedComponents";

function formatDisplayNumber(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return "--";
  }

  return Number.isInteger(parsedValue)
    ? `${parsedValue}`
    : parsedValue.toFixed(1);
}

function getSuggestedProgramBestWeight(programBest) {
  if (!programBest) {
    return null;
  }

  if (programBest.isEstimated) {
    const estimatedValue = Number(programBest.estimatedOneRepMax);

    if (!Number.isFinite(estimatedValue)) {
      return null;
    }

    return Math.round(estimatedValue);
  }

  const weightValue = Number(programBest.weight);

  return Number.isFinite(weightValue) ? weightValue : null;
}

export default function AddEstimatedSet({
  visible,
  onClose,
  onSubmit,
  programExerciseBestMap = {},
}) {
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
      : `${formatDisplayNumber(suggestedWeight)} kg`;
  const canSubmit =
    selectedExerciseName.trim() !== "" && estimated_weight.trim() !== "";
  const surfaceColor = theme.uiBackground ?? "rgba(255, 255, 255, 0.04)";
  const borderColor = theme.cardBorder ?? theme.iconColor ?? "#383838";
  const badgeBackground = theme.primary;
  const badgeTextColor = theme.cardBackground ?? theme.textInverted ?? "#201e2b";

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
      title="Add estimated 1 RM"
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
          Exercise
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
              Program best
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
                  estimated
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
                Best set: {selectedProgramBest.setDisplayValue}
              </ThemedText>
              {selectedProgramBest.performedDate && (
                <ThemedText size={12} setColor={theme.quietText}>
                  Achieved on {selectedProgramBest.performedDate}
                </ThemedText>
              )}
              <ThemedButton
                title={`Use ${suggestedWeightDisplay}`}
                onPress={() => set_estimated_weight(String(suggestedWeight))}
                fullWidth
                style={styles.useBestButton}
              />
            </>
          ) : (
            <ThemedText size={12} setColor={theme.quietText}>
              Select an exercise with a Program best to prefill the 1 RM value.
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
            Estimated 1 RM
          </ThemedText>
          <View style={styles.inputRow}>
            <ThemedTextInput
              placeholder="Enter weight"
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
              <ThemedText size={12}>kg</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <ThemedButton
            title="Close"
            variant="secondary"
            onPress={handleClose}
            style={styles.actionButton}
          />
          <ThemedButton
            title="Add 1 RM"
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </ThemedModal>
  );
}
