import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors } from "../GlobalStyling/colors";
import { Radius } from "../GlobalStyling/spacing";
import ThemedText from "./ThemedText";

// A row of mutually exclusive options, any number of them. Replaces
// ThemedSegmentedToggle, which was locked to exactly two and had no call
// sites; the look here is the appearance control's, which is the one the
// redesign actually shipped.
//
// Sized to about 40 px with 13 px labels. It used to be 26 px with 11 px
// text, relying on hitSlop for the rest of the target - which works for the
// finger and not at all for the eye: a control that small does not read as
// something you can press. The hitSlop stays, and now adds to a real target.
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
    padding: 4,
    gap: 2,
  },

  segment: {
    borderRadius: Radius.sm,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 13,
  },

  segmentText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
