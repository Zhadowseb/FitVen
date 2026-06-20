import React, { useEffect, useState } from "react";
import { Alert, ScrollView, View, useColorScheme } from "react-native";

import { Colors } from "../../../../../../Resources/GlobalStyling/colors";
import styles from "./EditEstimatedSetStyle";
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

export default function EditEstimatedSet({
  visible,
  onClose,
  onSubmit,
  onDelete,
  estimatedSet,
  programBest,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [estimated_weight, set_estimated_weight] = useState("");

  useEffect(() => {
    if (visible) {
      set_estimated_weight(String(estimatedSet?.estimated_weight ?? ""));
    }
  }, [visible, estimatedSet]);

  const suggestedWeight = getSuggestedProgramBestWeight(programBest);
  const suggestedWeightDisplay =
    suggestedWeight === null
      ? null
      : `${formatDisplayNumber(suggestedWeight)} kg`;
  const surfaceColor = theme.uiBackground ?? "rgba(255, 255, 255, 0.04)";
  const borderColor = theme.cardBorder ?? theme.iconColor ?? "#383838";
  const badgeBackground = theme.primary;
  const badgeTextColor = theme.cardBackground ?? theme.textInverted ?? "#201e2b";

  const persistChanges = async () => {
    const nextEstimatedWeight = estimated_weight.trim();

    if (!estimatedSet || nextEstimatedWeight === "") {
      return;
    }

    if (nextEstimatedWeight === String(estimatedSet.estimated_weight ?? "")) {
      return;
    }

    await onSubmit({
      id: estimatedSet.estimated_set_id,
      estimated_weight: nextEstimatedWeight,
    });
  };

  const handleClose = async () => {
    await persistChanges();
    onClose();
  };

  const handleDelete = async () => {
    if (!estimatedSet) {
      onClose();
      return;
    }

    await onDelete({
      id: estimatedSet.estimated_set_id,
    });
    onClose();
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete estimated 1 RM?",
      "This removes the saved estimate for this exercise.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete 1 RM",
          style: "destructive",
          onPress: () => {
            void handleDelete();
          },
        },
      ]
    );
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={handleClose}
      title="Edit estimated 1 RM"
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
        <ThemedText size={11} style={styles.sectionLabel} setColor={theme.quietText}>
          Exercise
        </ThemedText>
        <ThemedText size={20} style={styles.exerciseName}>
          {estimatedSet?.exercise_name ?? "--"}
        </ThemedText>
        <ThemedText size={12} setColor={theme.quietText}>
          Close the modal to save changes.
        </ThemedText>
      </View>

      <ScrollView
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
              size={11}
              style={styles.sectionLabel}
              setColor={theme.quietText}
            >
              Program best
            </ThemedText>
            {programBest?.isEstimated && (
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

          {programBest && suggestedWeightDisplay ? (
            <>
              <ThemedText size={24} style={styles.suggestedWeight}>
                {suggestedWeightDisplay}
              </ThemedText>
              <ThemedText size={12} setColor={theme.quietText}>
                Best set: {programBest.setDisplayValue}
              </ThemedText>
              {programBest.performedDate && (
                <ThemedText size={12} setColor={theme.quietText}>
                  Achieved on {programBest.performedDate}
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
              No Program best is available for this exercise yet.
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
            size={11}
            style={styles.sectionLabel}
            setColor={theme.quietText}
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
            title="Delete 1 RM"
            variant="danger"
            onPress={confirmDelete}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </ThemedModal>
  );
}
