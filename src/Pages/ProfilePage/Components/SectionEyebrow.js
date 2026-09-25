import { StyleSheet, useColorScheme } from "react-native";

import { Colors } from "../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../Resources/ThemedComponents/ThemedText";

// The small uppercase heading over each section on Profile (10/800, ls 1.8,
// quietText). The gap to the card under it belongs to the section.
export default function SectionEyebrow({ children }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <ThemedText
      style={styles.eyebrow}
      setColor={theme.quietText}
      accessibilityRole="header"
    >
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
});
