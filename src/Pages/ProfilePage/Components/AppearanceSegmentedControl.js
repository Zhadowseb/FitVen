import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors } from "../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../Resources/ThemedComponents/ThemedText";

// Local 3-option segmented control for the Appearance settings row.
// Intentionally NOT the shared ThemedSegmentedToggle (that component is a
// strictly 2-option, divider-style control used elsewhere in the app).
const OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "auto", label: "Auto" },
];

export default function AppearanceSegmentedControl({ value, onChange }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.uiBackground,
          borderColor: theme.border,
        },
      ]}
    >
      {OPTIONS.map((option) => {
        const isActive = value === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.8}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              isActive && { backgroundColor: theme.primary },
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
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  segment: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
