import { StyleSheet, useColorScheme } from "react-native";

import { Colors } from "../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../Resources/ThemedComponents/ThemedText";

// Shared-pattern section eyebrow (10px/800/ls1.8/uppercase/quietText) sitting
// above each card. Kept local to ProfilePage per file-ownership scope.
export default function SectionEyebrow({ children }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <ThemedText size={10} style={styles.eyebrow} setColor={theme.quietText}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
});
