import { StyleSheet, View, useColorScheme } from "react-native";

import { Colors } from "../GlobalStyling/colors";
import { Radius } from "../GlobalStyling/spacing";

// The grab handle at the top of a bottom sheet. Eight sheets used to draw this
// themselves, across three sizes, four radii and seven colours — four of them
// hardcoded white, so they vanished in the light theme. theme.navHandle exists
// for exactly this mark.
//
// Placement stays with the caller: some sheets pin the handle absolutely over
// the content, others give it a margin in the flow.
export default function ThemedSheetHandle({ width, height, color, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View
      style={[
        styles.handle,
        width === undefined ? null : { width },
        height === undefined ? null : { height },
        { backgroundColor: color ?? theme.navHandle },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: Radius.pill,
  },
});
