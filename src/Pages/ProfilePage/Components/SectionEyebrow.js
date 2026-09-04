import { StyleSheet, useColorScheme } from "react-native";

import { Colors } from "../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../Resources/ThemedComponents/ThemedText";

// Shared-pattern section eyebrow (12px/800/ls1.4/uppercase/text) sitting above
// each card. Kept local to ProfilePage per file-ownership scope.
export default function SectionEyebrow({ children }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <ThemedText size={12} style={styles.eyebrow} setColor={theme.text}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
