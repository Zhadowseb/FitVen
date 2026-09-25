import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import SettingsIconTile from "./SettingsIconTile";

// One of the settings tiles on Profile: icon on top, the name and what it is
// set to now at the bottom, and the whole tile opens that setting's screen.
//
// `value` undefined is "still being read", and holds the line's height so the
// tile does not grow when the answer arrives. Null is "could not be read", and
// the line is left out - the tile is still the way in.
export default function SettingsTile({ icon, label, value, onPress, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
        style,
      ]}
    >
      <SettingsIconTile size={34} backgroundColor={withAlpha(theme.primary, 0.12)}>
        {icon}
      </SettingsIconTile>

      <View style={styles.copy}>
        <ThemedText style={styles.label} setColor={theme.title} numberOfLines={1}>
          {label}
        </ThemedText>
        {typeof value === "string" && value.length > 0 ? (
          <ThemedText
            style={styles.value}
            setColor={theme.quietText}
            numberOfLines={1}
          >
            {value}
          </ThemedText>
        ) : value === undefined ? (
          <View style={styles.valuePlaceholder} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 84,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 13,
    justifyContent: "space-between",
    gap: 8,
  },
  copy: {
    gap: 1,
  },
  label: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800",
  },
  value: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  valuePlaceholder: {
    height: 14,
  },
});
