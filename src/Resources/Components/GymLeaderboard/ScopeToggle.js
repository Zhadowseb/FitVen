import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors } from "../../GlobalStyling/colors";
import { ThemedText } from "../../ThemedComponents";

/**
 * The Centre / Friends switch and, in its compact form, kg / xBW. A quieter
 * cousin of ThemedSegmentedControl: the active segment is a raised surface
 * rather than an accent fill, because on these screens the accent already
 * marks the viewer's own row and two oranges would fight.
 */
export default function ScopeToggle({ options = [], value, onChange, compact = false, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const activeSurface = theme.raisedSurface;

  return (
    <View
      style={[
        styles.shell,
        compact ? styles.shellCompact : null,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        style,
      ]}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <TouchableOpacity
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            activeOpacity={0.85}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              compact ? styles.segmentCompact : null,
              isActive ? { backgroundColor: activeSurface } : null,
            ]}
          >
            <ThemedText
              style={[
                compact ? styles.labelCompact : styles.label,
                { fontWeight: isActive ? "800" : "700" },
              ]}
              setColor={isActive ? theme.title : theme.quietText}
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

const styles = StyleSheet.create({
  shell: {
    flexDirection: "row",
    alignItems: "stretch",
    height: 34,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  shellCompact: {
    height: 26,
    padding: 2,
    borderRadius: 9,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    paddingHorizontal: 10,
  },
  segmentCompact: {
    flex: 0,
    borderRadius: 7,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 13,
  },
  labelCompact: {
    fontSize: 11,
  },
});
