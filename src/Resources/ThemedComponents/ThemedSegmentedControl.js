import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors } from "../GlobalStyling/colors";
import { Radius } from "../GlobalStyling/spacing";
import ThemedText from "./ThemedText";

// A row of mutually exclusive options, any number of them. Replaces
// ThemedSegmentedToggle, which was locked to exactly two and had no call
// sites; the look here is the appearance control's, which is the one the
// redesign actually shipped.
//
// The segments are short by design, so each carries hitSlop to reach a 44 px
// touch target without growing the row.
export default function ThemedSegmentedControl({
  options = [],
  value,
  onChange,
  style,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.uiBackground, borderColor: theme.border },
        style,
      ]}
    >
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              isActive ? { backgroundColor: theme.primary } : null,
            ]}
          >
            <ThemedText
              style={styles.segmentText}
              setColor={isActive ? theme.textInverted : theme.quietText}
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
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },

  segment: {
    borderRadius: Radius.sm,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },

  segmentText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
