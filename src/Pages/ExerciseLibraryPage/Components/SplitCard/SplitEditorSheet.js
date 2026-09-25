import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./SplitCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedBottomSheet, ThemedText } from "@resources/ThemedComponents";

const MIN = 2;
const MAX = 6;

/**
 * Choosing the split: the names from the last workouts, tapped in the order
 * they are done - two to six of them. "Use the suggestion" clears the choice,
 * and the card goes back to the guess.
 */
export default function SplitEditorSheet({
  visible,
  candidates = [],
  chosenNames = null,
  isSaving = false,
  onClose,
  onSave,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [picked, setPicked] = useState([]);

  useEffect(() => {
    if (visible) {
      setPicked(Array.isArray(chosenNames) ? chosenNames : []);
    }
  }, [chosenNames, visible]);

  // A chosen name no longer in the history still shows, so it can be removed.
  const names = [...picked.filter((name) => !candidates.includes(name)), ...candidates];

  const toggle = (name) =>
    setPicked((current) =>
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : current.length < MAX
          ? [...current, name]
          : current
    );

  const canSave = picked.length >= MIN && picked.length <= MAX && !isSaving;

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <ThemedText style={styles.sheetTitle} setColor={theme.title}>
        {t("train.editor.title")}
      </ThemedText>
      <ThemedText style={styles.sheetBody} setColor={theme.quietText}>
        {t("train.editor.body")}
      </ThemedText>

      {names.length === 0 ? (
        <ThemedText style={styles.sheetEmpty} setColor={theme.quietText}>
          {t("train.editor.empty")}
        </ThemedText>
      ) : (
        <>
          <ThemedText style={styles.sheetCount} setColor={theme.primaryText ?? theme.primary}>
            {t("train.editor.count", { count: picked.length })}
          </ThemedText>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {names.map((name) => {
              const order = picked.indexOf(name);
              const selected = order >= 0;

              return (
                <TouchableOpacity
                  key={name}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggle(name)}
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
                  <ThemedText style={styles.sheetRowName} setColor={theme.title} numberOfLines={1}>
                    {name}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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

        {Array.isArray(chosenNames) && chosenNames.length > 0 ? (
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
