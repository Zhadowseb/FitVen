import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./FilterSheetStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import { ThemedBottomSheet, ThemedText } from "@resources/ThemedComponents";

/**
 * The values behind a filter pill - Period's three, Age's four - as a sheet,
 * one chosen. Picking one hands it to `onSelect`; the page closes the sheet
 * and fetches the list again.
 */
export default function FilterSheet({ visible, overline, title, hint, options = [], value, onSelect, onClose }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        {overline ? (
          <ThemedText style={styles.overline} setColor={theme.quietText} numberOfLines={1}>
            {overline}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
          {title}
        </ThemedText>
        {hint ? (
          <ThemedText style={styles.hint} setColor={theme.quietText}>
            {hint}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.rows} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.84}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onSelect?.(option.value)}
              style={[
                styles.row,
                selected
                  ? {
                      backgroundColor: withAlpha(theme.primary, 0.1),
                      borderColor: withAlpha(theme.primary, 0.4),
                    }
                  : { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder },
              ]}
            >
              <ThemedText
                style={styles.rowTitle}
                setColor={selected ? theme.primaryText : theme.title}
                numberOfLines={1}
              >
                {option.label}
              </ThemedText>

              <View
                style={[
                  styles.check,
                  selected
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { borderColor: theme.overlayStrong },
                ]}
              >
                {selected ? <Checkmark width={13} height={13} color={theme.textInverted} thickness={3} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ThemedBottomSheet>
  );
}
