import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../../GlobalStyling/colors";
import ThemedText from "../../ThemedComponents/ThemedText";
import { GENDERS, normalizeGender } from "../../../Utils/gymCategories";

// All / Men / Women over every centre level and category page. The choice is
// remembered for the session - across levels, into a category and back - and
// starts at All each time the app does.
let sessionGender = "all";

export function getSessionGender() {
  return sessionGender;
}

export function setSessionGender(value) {
  sessionGender = normalizeGender(value);
}

/**
 * Men in the cool blue, women in the pink, and All split down the middle
 * between the two - so "all" reads as both rather than as neither. A hard
 * edge, drawn as two halves: React Native has no gradient with a hard stop,
 * and two views need no new native module.
 */
export default function GenderSegment({ value = "all", onChange, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const selected = normalizeGender(value);

  const tone = {
    all: theme.quietText,
    men: theme.heatCool,
    women: theme.heatWarm,
  };

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.control, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }, style]}
    >
      {GENDERS.map((gender) => {
        const isSelected = gender === selected;

        return (
          <TouchableOpacity
            key={gender}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={t(`category.gender.${gender}`)}
            activeOpacity={0.85}
            onPress={() => {
              setSessionGender(gender);
              onChange?.(gender);
            }}
            style={[
              styles.segment,
              isSelected
                ? {
                    borderColor:
                      gender === "all"
                        ? withAlpha(theme.title, 0.08)
                        : withAlpha(gender === "men" ? theme.heatCool : theme.heatWarm, 0.55),
                    backgroundColor:
                      gender === "men"
                        ? withAlpha(theme.heatCool, 0.26)
                        : gender === "women"
                          ? withAlpha(theme.heatWarm, 0.24)
                          : "transparent",
                  }
                : styles.segmentIdle,
            ]}
          >
            {isSelected && gender === "all" ? (
              <View pointerEvents="none" style={styles.halves}>
                <View style={[styles.half, { backgroundColor: withAlpha(theme.heatCool, 0.3) }]} />
                <View style={[styles.half, { backgroundColor: withAlpha(theme.heatWarm, 0.3) }]} />
              </View>
            ) : null}

            <ThemedText
              style={[styles.label, isSelected ? styles.labelSelected : null]}
              setColor={isSelected ? theme.title : tone[gender]}
              numberOfLines={1}
            >
              {t(`category.gender.${gender}`)}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  segment: {
    flex: 1,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  segmentIdle: {
    borderColor: "transparent",
  },
  halves: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  half: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  labelSelected: {
    fontWeight: "800",
  },
});
