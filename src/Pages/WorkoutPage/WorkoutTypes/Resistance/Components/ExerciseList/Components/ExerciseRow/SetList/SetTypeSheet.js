import { useEffect, useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./SetTypeSheetStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Amrap from "@resources/Icons/UI-icons/Amrap";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import Delete from "@resources/Icons/UI-icons/Delete";
import {
  ThemedBottomSheet,
  ThemedText,
  ThemedTextInput,
} from "@resources/ThemedComponents";
import { setTypeColor } from "./setTypeColors";

// The order the sheet lists them in: the order a session runs in.
const TYPE_ROWS = [
  { type: "warmup", mark: "W" },
  { type: "working", mark: "1" },
  { type: "drop", mark: "D" },
  { type: "amrap", mark: null },
];

function parseTarget(value) {
  const numeric = Math.trunc(Number(String(value ?? "").replace(",", ".")));

  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * What kind of set this is, behind a long press on its badge.
 *
 * Choosing a type saves it at once and leaves the sheet open, so the choice
 * is visible - and so an AMRAP set can be given its target straight after.
 * Delete sits in the corner and asks nothing: the list offers an undo for a
 * few seconds instead, which is cheaper than a question every time.
 */
export default function SetTypeSheet({
  visible,
  onClose,
  label,
  exerciseName,
  setType,
  amrapTarget,
  onSelectType,
  onChangeAmrapTarget,
  onDelete,
  note,
  onChangeNote,
  onEndEditingNote,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [targetDraft, setTargetDraft] = useState("");

  useEffect(() => {
    setTargetDraft(amrapTarget ? String(amrapTarget) : "");
  }, [amrapTarget, visible]);

  const commitTarget = () => {
    const next = parseTarget(targetDraft);

    if (next !== (amrapTarget ?? null)) {
      onChangeAmrapTarget?.(next);
    }
  };

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.overline} setColor={theme.quietText} numberOfLines={1}>
            {t("workout.setType.overline", { label: label ?? "", exercise: exerciseName ?? "" })}
          </ThemedText>
          <ThemedText style={styles.title} setColor={theme.title}>
            {t("workout.setType.title")}
          </ThemedText>
        </View>

        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel={t("workout.setType.deleteSet", { label: label ?? "" })}
          hitSlop={8}
          onPress={onDelete}
          style={[
            styles.deleteButton,
            {
              backgroundColor: withAlpha(theme.danger, 0.12),
              borderColor: withAlpha(theme.danger, 0.35),
            },
          ]}
        >
          <Delete width={15} height={15} color={theme.danger} />
          <ThemedText style={styles.deleteText} setColor={theme.danger}>
            {t("workout.setType.delete")}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.rows}>
        {TYPE_ROWS.map(({ type, mark }) => {
          const color = setTypeColor(type, theme);
          const selected = setType === type;

          return (
            <TouchableOpacity
              key={type}
              activeOpacity={0.84}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onSelectType?.(type)}
              style={[
                styles.row,
                selected
                  ? {
                      backgroundColor: withAlpha(color, 0.1),
                      borderColor: withAlpha(color, 0.45),
                    }
                  : {
                      backgroundColor: theme.fields ?? theme.uiBackground,
                      borderColor: theme.cardBorder,
                    },
              ]}
            >
              <View
                style={[
                  styles.mark,
                  {
                    backgroundColor: withAlpha(color, 0.16),
                    borderColor: withAlpha(color, 0.45),
                  },
                ]}
              >
                {mark ? (
                  <ThemedText style={styles.markText} setColor={color}>
                    {mark}
                  </ThemedText>
                ) : (
                  <Amrap width={16} height={16} color={color} />
                )}
              </View>

              <View style={styles.rowCopy}>
                <ThemedText style={styles.rowTitle} setColor={theme.title}>
                  {t(`workout.setType.types.${type}.title`)}
                </ThemedText>
                <ThemedText style={styles.rowDetail} setColor={theme.quietText} numberOfLines={1}>
                  {t(`workout.setType.types.${type}.detail`)}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.check,
                  selected
                    ? { backgroundColor: color, borderColor: color }
                    : { borderColor: withAlpha(theme.title, 0.18) },
                ]}
              >
                {selected ? (
                  <Checkmark width={13} height={13} color={theme.textInverted} thickness={3} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {setType === "amrap" ? (
        <View style={styles.section}>
          <View style={styles.targetRow}>
            <View style={styles.rowCopy}>
              <ThemedText style={styles.rowTitle} setColor={theme.title}>
                {t("workout.setType.amrapTarget")}
              </ThemedText>
              <ThemedText style={styles.rowDetail} setColor={theme.quietText} numberOfLines={1}>
                {t("workout.setType.amrapTargetDetail")}
              </ThemedText>
            </View>

            <ThemedTextInput
              value={targetDraft}
              onChangeText={setTargetDraft}
              onEndEditing={commitTarget}
              onBlur={commitTarget}
              keyboardType="number-pad"
              placeholder={t("workout.setType.amrapTargetPlaceholder")}
              style={styles.targetInputWrap}
              inputStyle={styles.targetInput}
            />
          </View>
        </View>
      ) : null}

      <View style={[styles.section, styles.lastSection]}>
        <ThemedText style={styles.label} setColor={theme.quietText}>
          {t("workout.setType.note")}
        </ThemedText>

        <ThemedTextInput
          value={note}
          onChangeText={onChangeNote}
          onEndEditing={onEndEditingNote}
          placeholder={t("workout.setType.notePlaceholder")}
          multiline
          inputStyle={styles.noteInput}
        />
      </View>
    </ThemedBottomSheet>
  );
}
