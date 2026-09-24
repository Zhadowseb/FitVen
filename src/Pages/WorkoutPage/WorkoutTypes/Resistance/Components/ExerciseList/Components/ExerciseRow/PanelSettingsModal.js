import { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import {
  Colors,
  withAlpha,
} from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Delete from "@resources/Icons/UI-icons/Delete";
import Time from "@resources/Icons/UI-icons/Time";

import { ThemedModal, ThemedText } from "@resources/ThemedComponents";
import { useTranslation } from "@localization";
import styles from "./PanelSettingsModalStyle";

// A labelKey is translated when the chip is drawn; RPE and 1RM % read the
// same in every language.
const COLUMN_CONFIG = [
  { key: "set", labelKey: "workout.exercise.columns.set" },
  { key: "rest", labelKey: "workout.exercise.columns.rest" },
  { key: "reps", labelKey: "workout.exercise.columns.reps" },
  { key: "weight", labelKey: "workout.exercise.columns.weight" },
  { key: "done", labelKey: "workout.exercise.columns.done" },
  { key: "note", labelKey: "workout.exercise.columns.note" },
  { key: "rpe", label: "RPE" },
  { key: "rm_percentage", label: "1RM %" },
];

export default function PanelSettingsModal({
  visible,
  onClose,
  onDismiss,
  onDelete,
  onOpenRestUnit,
  currentColumns,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const [columns, setColumns] = useState(currentColumns);

  useEffect(() => {
    if (visible) {
      setColumns(currentColumns);
    }
  }, [visible, currentColumns]);

  const toggleColumn = (key) => {
    setColumns((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const handleClose = () => {
    onClose({ columns });
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={handleClose}
      onDismiss={onDismiss}
      title={t("workout.exercise.settingsTitle")}
      showCloseButton
      bottomOffset={0}
      style={styles.modal}
    >
      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} setColor={theme.text}>
          {t("workout.exercise.visibleColumns")}
        </ThemedText>

        <View style={styles.chipGrid}>
          {COLUMN_CONFIG.map((column) => {
            const isActive = Boolean(columns?.[column.key]);

            return (
              <TouchableOpacity
                key={column.key}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => toggleColumn(column.key)}
                style={[
                  styles.chip,
                  isActive
                    ? {
                        backgroundColor: withAlpha(theme.primary, 0.14),
                        borderColor: withAlpha(theme.primary, 0.5),
                      }
                    : {
                        backgroundColor: theme.uiBackground ?? theme.background,
                        borderColor: theme.cardBorder,
                      },
                ]}
              >
                <ThemedText
                  style={styles.chipText}
                  setColor={isActive ? theme.primary : theme.quietText}
                >
                  {column.labelKey ? t(column.labelKey) : column.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} setColor={theme.text}>
          {t("workout.exercise.rest")}
        </ThemedText>

        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          onPress={() => {
            onClose({ columns });
            onOpenRestUnit?.();
          }}
          style={[
            styles.row,
            {
              backgroundColor: theme.uiBackground ?? theme.background,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View
            style={[
              styles.rowIcon,
              { backgroundColor: withAlpha(theme.primary, 0.14) },
            ]}
          >
            <Time width={17} height={17} stroke={theme.primary} color={primaryTextColor} />
          </View>

          <View style={styles.rowCopy}>
            <ThemedText style={styles.rowTitle} setColor={theme.title}>
              {t("workout.exercise.restUnit")}
            </ThemedText>
            <ThemedText style={styles.rowDetail} setColor={theme.quietText}>
              {t("workout.exercise.restUnitDetail")}
            </ThemedText>
          </View>

          <ChevronRight
            width={16}
            height={16}
            color={theme.quietText}
            thickness={2}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.84}
        accessibilityRole="button"
        onPress={onDelete}
        style={[
          styles.row,
          {
            backgroundColor: theme.uiBackground ?? theme.background,
            borderColor: withAlpha(theme.danger, 0.35),
          },
        ]}
      >
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: withAlpha(theme.danger, 0.14) },
          ]}
        >
          <Delete width={17} height={17} color={theme.danger} />
        </View>

        <View style={styles.rowCopy}>
          <ThemedText style={styles.rowTitle} setColor={theme.danger}>
            {t("workout.exercise.deleteConfirm")}
          </ThemedText>
          <ThemedText style={styles.rowDetail} setColor={theme.quietText}>
            {t("workout.exercise.deleteDetail")}
          </ThemedText>
        </View>
      </TouchableOpacity>
    </ThemedModal>
  );
}
