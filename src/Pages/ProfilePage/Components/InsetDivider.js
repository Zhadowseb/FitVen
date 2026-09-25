import { StyleSheet, View, useColorScheme } from "react-native";

import { Colors } from "../../../Resources/GlobalStyling/colors";

// 1 dp line between the rows of a card, inset 16 so it does not touch the
// card's edges.
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
    marginHorizontal: 16,
  },
});
