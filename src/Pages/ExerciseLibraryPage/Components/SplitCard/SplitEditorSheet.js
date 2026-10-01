import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { formatDate, useTranslation } from "@localization";

import styles from "./SplitCardStyle";
import SplitWorkoutPicker from "./SplitWorkoutPicker";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Calender from "@resources/Icons/UI-icons/Calender";
import { ThemedBottomSheet, ThemedText } from "@resources/ThemedComponents";
import {
  SPLIT_MAX_ENTRIES,
  SPLIT_MIN_ENTRIES,
  addSplitEntry,
  splitEntryKey,
} from "@utils/splitEntries";
import { workoutDisplayName } from "@utils/workoutTypeLabel";

function nameOnlyKey(name) {
  return splitEntryKey({ name, workout: null });
}

/**
 * Choosing the split, two to six sessions in the order they are done.
 *
 * The names from the last workouts are tapped on and off; each is a session
 * by name, which repeats the latest workout of that name - so it carries the
 * weights last used forward. "Choose from calendar" adds one particular
 * workout (SplitWorkoutPicker): that session repeats exactly that workout,
 * and two of them can share a name. A picked one is listed with its date, and
 * tapping it takes it out again. Nothing is kept until Save. "Use the
 * suggestion" clears the choice, and the cards go back to the guess.
 */
export default function SplitEditorSheet({
  visible,
  candidates = [],
  chosenEntries = null,
  isSaving = false,
  onClose,
  onSave,
  onRenamed,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [picked, setPicked] = useState([]);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    if (visible) {
      setPicked(Array.isArray(chosenEntries) ? chosenEntries : []);
      setIsPicking(false);
    }
  }, [chosenEntries, visible]);

  // The pinned sessions first, then each name - a chosen name no longer in
  // the history still shows, so it can be removed.
  const candidateKeys = new Set(candidates.map(nameOnlyKey));
  const rows = [
    ...picked.filter((entry) => entry.workout || !candidateKeys.has(splitEntryKey(entry))),
    ...candidates.map((name) => ({ name, workout: null, last: null })),
  ];

  const toggle = (row) => {
    const key = splitEntryKey(row);

    setPicked((current) =>
      current.some((entry) => splitEntryKey(entry) === key)
        ? current.filter((entry) => splitEntryKey(entry) !== key)
        : addSplitEntry(current, row).entries
    );
  };

  const canSave = picked.length >= SPLIT_MIN_ENTRIES && picked.length <= SPLIT_MAX_ENTRIES && !isSaving;

  const fromCalendar = (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      onPress={() => setIsPicking(true)}
      style={[styles.sheetCalendar, { borderColor: withAlpha(theme.primary, 0.45) }]}
    >
      <Calender width={18} height={18} color={theme.primaryText ?? theme.primary} />
      <ThemedText style={styles.sheetCalendarText} setColor={theme.primaryText ?? theme.primary}>
        {t("train.editor.fromCalendar")}
      </ThemedText>
    </TouchableOpacity>
  );

  if (isPicking) {
    return (
      <ThemedBottomSheet visible={visible} onClose={onClose}>
        <SplitWorkoutPicker
          picked={picked}
          onBack={() => setIsPicking(false)}
          onRenamed={onRenamed}
          onAdd={(entry) => {
            setPicked((current) => addSplitEntry(current, entry).entries);
            setIsPicking(false);
          }}
        />
      </ThemedBottomSheet>
    );
  }

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <ThemedText style={styles.sheetTitle} setColor={theme.title}>
        {t("train.editor.title")}
      </ThemedText>
      <ThemedText style={styles.sheetBody} setColor={theme.quietText}>
        {t("train.editor.body")}
      </ThemedText>

      {rows.length === 0 ? (
        <>
          <ThemedText style={styles.sheetEmpty} setColor={theme.quietText}>
            {t("train.editor.empty")}
          </ThemedText>
          {fromCalendar}
        </>
      ) : (
        <>
          <ThemedText style={styles.sheetCount} setColor={theme.primaryText ?? theme.primary}>
            {t("train.editor.count", { count: picked.length })}
          </ThemedText>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {rows.map((row) => {
              const key = splitEntryKey(row);
              const order = picked.findIndex((entry) => splitEntryKey(entry) === key);
              const selected = order >= 0;
              // A picked workout shows its day: it is what tells two
              // sessions of the same name apart.
              const pinnedAt = row.pinnedAt ?? null;

              return (
                <TouchableOpacity
                  key={key}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggle(row)}
                  style={[
                    styles.sheetRow,
                    selected
                      ? { backgroundColor: withAlpha(theme.primary, 0.1), borderColor: theme.primary }
                      : { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
                  ]}
                >
                  <View
                    style={[
                      styles.sheetOrder,
                      selected
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { borderColor: theme.cardBorder },
                    ]}
                  >
                    {selected ? (
                      <ThemedText style={styles.sheetOrderText} setColor={theme.ink}>
                        {order + 1}
                      </ThemedText>
                    ) : null}
                  </View>
                  {/* The name is also the key the split stores; only what is
                      drawn is translated, when the app wrote it. */}
                  <ThemedText style={styles.sheetRowName} setColor={theme.title} numberOfLines={1}>
                    {workoutDisplayName(row.name, t) ?? row.name}
                  </ThemedText>
                  {row.workout ? (
                    <ThemedText style={styles.sheetRowMeta} setColor={theme.quietText} numberOfLines={1}>
                      {pinnedAt
                        ? t("train.editor.pinnedOn", {
                            date: formatDate(pinnedAt, { day: "numeric", month: "short" }),
                          })
                        : t("train.editor.pinned")}
                    </ThemedText>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {fromCalendar}
        </>
      )}

      <View style={styles.sheetActions}>
        <TouchableOpacity
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={() => onSave?.(picked)}
          style={[
            styles.sheetSave,
            { backgroundColor: canSave ? theme.primary : withAlpha(theme.primary, 0.3) },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={theme.ink} />
          ) : (
            <ThemedText style={styles.sheetSaveText} setColor={theme.ink}>
              {t("train.editor.save")}
            </ThemedText>
          )}
        </TouchableOpacity>

        {Array.isArray(chosenEntries) && chosenEntries.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => onSave?.(null)}
            style={styles.sheetReset}
          >
            <ThemedText style={styles.sheetResetText} setColor={theme.quietText}>
              {t("train.editor.useSuggestion")}
            </ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>
    </ThemedBottomSheet>
  );
}
