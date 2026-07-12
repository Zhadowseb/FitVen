import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import {
  AccentThemes,
  Colors,
  withAlpha,
} from "../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../Resources/ThemedComponents/ThemedText";

// 2x2 grid of accent-theme options (Ember/Volt/Ultraviolet/Coral). Each shows
// the combo's brand primary+secondary as overlapping swatch dots.
export default function AccentThemePicker({ value, onChange }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={styles.grid}>
      {Object.entries(AccentThemes).map(([accentKey, accent]) => {
        const isSelected = value === accentKey;

        return (
          <TouchableOpacity
            key={accentKey}
            activeOpacity={0.85}
            onPress={() => onChange(accentKey)}
            style={[
              styles.option,
              {
                backgroundColor: isSelected
                  ? withAlpha(theme.primary, 0.1)
                  : theme.uiBackground,
                borderColor: isSelected ? theme.primary : theme.border,
              },
            ]}
          >
            <View style={styles.swatchPair}>
              <View
                style={[
                  styles.swatchDot,
                  {
                    backgroundColor: accent.swatch.primary,
                    borderColor: theme.cardBackground,
                  },
                ]}
              />
              <View
                style={[
                  styles.swatchDot,
                  styles.swatchDotOverlap,
                  {
                    backgroundColor: accent.swatch.secondary,
                    borderColor: theme.cardBackground,
                  },
                ]}
              />
            </View>
            <ThemedText
              style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}
              setColor={isSelected ? theme.title : theme.text}
              numberOfLines={1}
            >
              {accent.name}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  swatchPair: {
    flexDirection: "row",
    alignItems: "center",
  },
  swatchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  swatchDotOverlap: {
    marginLeft: -7,
  },
  optionLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  optionLabelSelected: {
    fontWeight: "800",
  },
});
