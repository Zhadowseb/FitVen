import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import {
  AccentThemes,
  Colors,
  withAlpha,
} from "../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../Resources/ThemedComponents/ThemedText";
import { useTranslation } from "@localization";

// Spelled out rather than built from the key, so the localization test can see
// every key. An accent added to colors.js without a translation keeps the name
// it has there.
const ACCENT_NAME_KEYS = {
  ember: "profile.appearance.accent.ember",
  volt: "profile.appearance.accent.volt",
  ultraviolet: "profile.appearance.accent.ultraviolet",
  coral: "profile.appearance.accent.coral",
};

// One column per accent theme (Ember, Volt, Ultraviolet, Coral), four across.
// Each shows the theme's primary as a large dot with its secondary tucked in
// at the bottom right, and the name under it.
export default function AccentThemePicker({ value, onChange }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();

  return (
    <View
      style={styles.row}
      accessibilityLabel={t("profile.appearance.colour")}
    >
      {Object.entries(AccentThemes).map(([accentKey, accent]) => {
        const isSelected = value === accentKey;
        const nameKey = ACCENT_NAME_KEYS[accentKey];

        return (
          <TouchableOpacity
            key={accentKey}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(accentKey)}
            style={[
              styles.option,
              isSelected
                ? {
                    backgroundColor: withAlpha(theme.primary, 0.1),
                    borderColor: theme.primary,
                    borderWidth: 1.5,
                  }
                : {
                    backgroundColor: theme.uiBackground,
                    borderColor: theme.cardBorder,
                    borderWidth: 1,
                  },
            ]}
          >
            <View style={styles.swatch}>
              <View
                style={[
                  styles.swatchPrimary,
                  {
                    backgroundColor: accent.swatch.primary,
                    borderColor: theme.cardBackground,
                  },
                ]}
              />
              <View
                style={[
                  styles.swatchSecondary,
                  {
                    backgroundColor: accent.swatch.secondary,
                    borderColor: theme.cardBackground,
                  },
                ]}
              />
            </View>
            <ThemedText
              style={styles.optionLabel}
              setColor={isSelected ? theme.title : theme.text}
              numberOfLines={1}
            >
              {nameKey ? t(nameKey) : accent.name}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 7,
    borderRadius: 14,
    paddingTop: 10,
    paddingHorizontal: 4,
    paddingBottom: 9,
  },
  swatch: {
    width: 40,
    height: 40,
  },
  swatchPrimary: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  swatchSecondary: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  optionLabel: {
    maxWidth: "100%",
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "800",
    textAlign: "center",
  },
});
