import { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import {
  Colors,
  withAlpha,
} from "../../../../../../../../Resources/GlobalStyling/colors";
import ChevronRight from "../../../../../../../../Resources/Icons/UI-icons/ChevronRight";
import Delete from "../../../../../../../../Resources/Icons/UI-icons/Delete";
import Time from "../../../../../../../../Resources/Icons/UI-icons/Time";

import {
  ThemedModal,
  ThemedText,
  ThemedTextInput,
} from "../../../../../../../../Resources/ThemedComponents";
import styles from "./PanelSettingsModalStyle";

const COLUMN_CONFIG = [
  { key: "set", label: "Set" },
  { key: "rest", label: "Rest" },
  { key: "reps", label: "Reps" },
  { key: "weight", label: "Weight" },
  { key: "done", label: "Done" },
  { key: "note", label: "Note" },
  { key: "rpe", label: "RPE" },
  { key: "rm_percentage", label: "1RM %" },
];

export default function PanelSettingsModal({
  visible,
  onClose,
  onDelete,
  onOpenRestUnit,
  currentColumns,
  currentNote,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const [columns, setColumns] = useState(currentColumns);
  const [note, setNote] = useState(currentNote ?? "");

  useEffect(() => {
    if (visible) {
      setColumns(currentColumns);
      setNote(currentNote ?? "");
    }
  }, [visible, currentColumns, currentNote]);

  const toggleColumn = (key) => {
    setColumns((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const handleClose = () => {
    onClose({ columns, note });
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={handleClose}
      title="Exercise settings"
      showCloseButton
      bottomOffset={0}
      style={styles.modal}
    >
      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} setColor={theme.text}>
          Visible columns
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
                  {column.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} setColor={theme.text}>
          Rest
        </ThemedText>

        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          onPress={() => {
            onClose({ columns, note });
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
              Rest input unit
            </ThemedText>
            <ThemedText style={styles.rowDetail} setColor={theme.quietText}>
              Minutes or seconds, and whether it applies to every set
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

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel} setColor={theme.text}>
          Exercise note
        </ThemedText>

        <ThemedTextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add note"
          multiline
          inputStyle={styles.noteInput}
        />
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
            Delete exercise
          </ThemedText>
          <ThemedText style={styles.rowDetail} setColor={theme.quietText}>
            Removes the exercise and all its sets
          </ThemedText>
        </View>
      </TouchableOpacity>
    </ThemedModal>
  );
}
