import { StyleSheet, View, useColorScheme } from "react-native";

import { Colors } from "../../../Resources/GlobalStyling/colors";

// Inset 1px divider between card rows (marginHorizontal 18, does not touch
// card edges). Kept local to ProfilePage per file-ownership scope.
export default function InsetDivider() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    marginHorizontal: 18,
  },
});
