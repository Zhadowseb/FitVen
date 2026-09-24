import { useEffect, useState } from "react";
import { Alert, ScrollView, View, useColorScheme } from "react-native";

import { Colors } from "../../../../../../Resources/GlobalStyling/colors";
import { formatDisplayNumber } from "../../../../../../Utils/numberUtils";
import { getSuggestedProgramBestWeight } from "../../../../../../Utils/oneRepMaxUtils";
import styles from "./EditEstimatedSetStyle";
import {
  ThemedButton,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
} from "../../../../../../Resources/ThemedComponents";
import { useTranslation } from "@localization";

export default function EditEstimatedSet({
  visible,
  onClose,
  onSubmit,
  onDelete,
  estimatedSet,
  programBest,
}) {
  const { t } = useTranslation();
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
      : `${formatDisplayNumber(suggestedWeight)} ${t("common.kg")}`;
  const surfaceColor = theme.uiBackground;
  const borderColor = theme.cardBorder ?? theme.iconColor;
  const badgeBackground = theme.primary;
  const badgeTextColor = theme.cardBackground ?? theme.textInverted;

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
      t("programs.rm.deleteConfirmTitle"),
      t("programs.rm.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("programs.rm.deleteButton"),
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
      title={t("programs.rm.editTitle")}
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
        <ThemedText size={20} style={styles.exerciseName}>
          {estimatedSet?.exercise_name ?? "--"}
        </ThemedText>
        <ThemedText size={12} setColor={theme.quietText}>
          {t("programs.rm.closeToSave")}
        </ThemedText>
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
                  {t("programs.rm.estimatedBadge")}
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
                {t("programs.rm.bestSet", { set: programBest.setDisplayValue })}
              </ThemedText>
              {programBest.performedDate && (
                <ThemedText size={12} setColor={theme.quietText}>
                  {t("programs.rm.achievedOn", { date: programBest.performedDate })}
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
              {t("programs.rm.editNoBestHint")}
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
            title={t("programs.rm.deleteButton")}
            variant="danger"
            onPress={confirmDelete}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </ThemedModal>
  );
}
