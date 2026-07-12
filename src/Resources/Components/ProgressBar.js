import { StyleSheet, View, useColorScheme } from "react-native";
import { Colors } from "../GlobalStyling/colors";

// The redesign's 6px rounded progress bar: accent fill on a hairline track.
function ProgressBar({ progress = 0, height = 6, trackColor, fillColor, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const clampedProgress = Math.min(1, Math.max(0, Number(progress) || 0));

  return (
    <View
      style={[
        styles.track,
        {
          height,
          borderRadius: height,
          backgroundColor: trackColor ?? theme.cardBorder,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress * 100}%`,
            borderRadius: height,
            backgroundColor: fillColor ?? theme.primary,
          },
        ]}
      />
    </View>
  );
}

export default ProgressBar;

const styles = StyleSheet.create({
  track: {
    overflow: "hidden",
  },
  fill: {
    height: "100%",
  },
});
