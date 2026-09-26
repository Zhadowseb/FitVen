import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./CategoryTabsStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * Flid's Workouts / Weeks in a row and Progress's four lifts. Built like the
 * gender control above it, so the two read as one family, but the chosen tab
 * is tinted in the category's colour rather than blue or pink.
 */
export default function CategoryTabs({ options = [], value, onChange, tone }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.control, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            activeOpacity={0.85}
            onPress={() => {
              if (!isSelected) {
                onChange?.(option.value);
              }
            }}
            style={[
              styles.segment,
              isSelected
                ? { backgroundColor: withAlpha(tone, 0.18), borderColor: withAlpha(tone, 0.45) }
                : styles.segmentIdle,
            ]}
          >
            <ThemedText
              style={[styles.label, isSelected ? styles.labelSelected : null]}
              setColor={isSelected ? theme.title : theme.quietText}
              numberOfLines={1}
            >
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
