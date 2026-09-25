import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./ReportExerciseSheetStyle";
import { exerciseService } from "@services";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { showToast } from "@resources/Components/Toast/Toast";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import { ThemedBottomSheet, ThemedText, ThemedTextInput } from "@resources/ThemedComponents";
import { REPORT_NOTE_MAX_LENGTH, REPORT_REASONS } from "@utils/customExercises";

// The reasons in REPORT_REASONS' order, which is the migration's.
const REASON_LABEL_KEYS = {
  wrong: "customExerciseDetail.report.reasons.wrong",
  offensive: "customExerciseDetail.report.reasons.offensive",
  duplicate: "customExerciseDetail.report.reasons.duplicate",
  other: "customExerciseDetail.report.reasons.other",
};

/**
 * Reporting somebody else's shared exercise: one of four reasons, an optional
 * note, and a thank-you once it has gone. The shape and the tone are the
 * app's other report dialogs (ReportPostModal); it is a sheet here because it
 * opens from the exercise page's menu, which is one too.
 *
 * Three different people reporting it hide the exercise - the server decides
 * that, and the copies already made stay where they are.
 */
export default function ReportExerciseSheet({
  visible,
  exerciseId,
  exerciseName = "",
  onClose,
  onReported,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // danger measures 4.4:1 on the sheet's white; the darker red holds 4.5.
  const errorColor = colorScheme === "light" ? theme.dangerDark : theme.danger;
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const canSend = Boolean(reason) && !isSending;

  // A fresh form every time it opens.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote("");
      setErrorMessage("");
    }
  }, [visible]);

  const close = () => {
    if (!isSending) {
      onClose?.();
    }
  };

  const submit = async () => {
    if (!canSend || exerciseId === null || exerciseId === undefined) {
      return;
    }

    setIsSending(true);
    setErrorMessage("");

    try {
      const trimmedNote = note.trim();
      const result = await exerciseService.reportExercise({
        id: exerciseId,
        reason,
        note: trimmedNote ? trimmedNote : null,
      });

      onReported?.(result);
      onClose?.();
      showToast(t("customExerciseDetail.report.thanks"), { tone: "success" });
    } catch (error) {
      console.warn("Could not report the exercise:", error);
      setErrorMessage(
        error instanceof Error && error.message ? error.message : t("customExerciseDetail.report.failed")
      );
    } finally {
      setIsSending(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        accessibilityState={{ disabled: isSending }}
        activeOpacity={0.85}
        disabled={isSending}
        onPress={close}
        style={[
          styles.button,
          styles.cancelButton,
          { backgroundColor: theme.chipBackground, borderColor: theme.cardBorder },
        ]}
      >
        <ThemedText style={styles.buttonText} setColor={theme.title} numberOfLines={1}>
          {t("common.cancel")}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("customExerciseDetail.report.send")}
        accessibilityState={{ disabled: !canSend, busy: isSending }}
        activeOpacity={0.85}
        disabled={!canSend}
        onPress={submit}
        style={[
          styles.button,
          styles.sendButton,
          { backgroundColor: theme.primary, borderColor: theme.primary },
          canSend || isSending ? null : styles.buttonDisabled,
        ]}
      >
        {isSending ? <ActivityIndicator size="small" color={theme.textInverted} /> : null}
        <ThemedText style={styles.buttonText} setColor={theme.textInverted} numberOfLines={1}>
          {t("customExerciseDetail.report.send")}
        </ThemedText>
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedBottomSheet visible={visible} onClose={close} footer={footer}>
      <View style={styles.header}>
        {exerciseName ? (
          <ThemedText style={styles.eyebrow} setColor={theme.quietText} numberOfLines={1}>
            {exerciseName}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
          {t("customExerciseDetail.report.title")}
        </ThemedText>
        <ThemedText style={styles.message} setColor={theme.quietText}>
          {t("customExerciseDetail.report.message")}
        </ThemedText>
      </View>

      <View style={styles.reasons} accessibilityRole="radiogroup">
        {REPORT_REASONS.map((value) => {
          const selected = reason === value;
          const label = t(REASON_LABEL_KEYS[value]);

          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected, disabled: isSending }}
              accessibilityLabel={label}
              disabled={isSending}
              onPress={() => setReason(value)}
              style={({ pressed }) => [
                styles.reason,
                {
                  backgroundColor: selected ? withAlpha(theme.primary, 0.1) : theme.chipBackground,
                  borderColor: selected ? theme.primary : theme.cardBorder,
                },
                pressed ? styles.pressed : null,
              ]}
            >
              <ThemedText style={styles.reasonText} setColor={theme.title}>
                {label}
              </ThemedText>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: selected ? theme.primary : theme.quietText,
                    backgroundColor: selected ? theme.primary : "transparent",
                  },
                ]}
              >
                {selected ? <Checkmark width={11} height={11} color={theme.textInverted} thickness={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ThemedTextInput
        value={note}
        onChangeText={setNote}
        placeholder={t("customExerciseDetail.report.notePlaceholder")}
        multiline
        maxLength={REPORT_NOTE_MAX_LENGTH}
        textAlignVertical="top"
        editable={!isSending}
        style={styles.note}
        inputStyle={styles.noteInput}
      />
      <ThemedText style={styles.count} setColor={theme.quietText}>
        {`${note.length}/${REPORT_NOTE_MAX_LENGTH}`}
      </ThemedText>

      {errorMessage ? (
        <ThemedText style={styles.error} setColor={errorColor} accessibilityLiveRegion="polite">
          {errorMessage}
        </ThemedText>
      ) : null}
    </ThemedBottomSheet>
  );
}
