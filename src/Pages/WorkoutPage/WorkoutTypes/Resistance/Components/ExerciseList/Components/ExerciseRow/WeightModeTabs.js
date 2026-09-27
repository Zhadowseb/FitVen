import { TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { useTranslation } from "@localization";
import {
  PER_SIDE,
  TOTAL,
  formatWeightNumber,
  tabWeights,
} from "@utils/weightMode";

import styles from "./WeightModeTabsStyle";

// 30 high; this much more above and below makes the touch area 44.
const TAB_HIT_SLOP = { top: 7, bottom: 7, left: 0, right: 0 };

/**
 * "Pr. side · 22,5 | Begge sider · 45" under the card's header (4d): which
 * way this exercise's weights are written in this workout, and what the
 * weight is the other way. The number is the first set not yet ticked off -
 * or the last set when all of them are - and without a weight there are only
 * the two labels.
 *
 * The quiet version the design settled on: no icons, no coloured surface,
 * only a line under the selected tab. Tapping the other one asks the card to
 * switch; this only draws.
 */
export default function WeightModeTabs({ weightMode, weight, onSwitch, disabled = false }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isDark = colorScheme === "dark";
  const rule = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(32, 30, 43, 0.1)";
  const idleColor = isDark ? "#6E727D" : theme.quietText;
  const selectedMode = weightMode === PER_SIDE ? PER_SIDE : TOTAL;
  const values = tabWeights(weight, selectedMode);
  const modeWord =
    selectedMode === PER_SIDE
      ? t("workout.weightMode.suffix")
      : t("workout.weightMode.a11yBothSides");

  const tabs = [
    { mode: PER_SIDE, label: t("workout.weightMode.perSide"), value: values.perSide },
    { mode: TOTAL, label: t("workout.weightMode.bothSides"), value: values.bothSides },
  ];

  return (
    <View accessibilityRole="tablist" style={[styles.row, { borderBottomColor: rule }]}>
      {tabs.map((tab) => {
        const selected = tab.mode === selectedMode;
        const number = formatWeightNumber(tab.value);

        return (
          <TouchableOpacity
            key={tab.mode}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={
              number
                ? t("workout.weightMode.tabValue", { label: tab.label, weight: number })
                : tab.label
            }
            accessibilityHint={selected ? undefined : t("workout.weightMode.a11y", { mode: modeWord })}
            hitSlop={TAB_HIT_SLOP}
            disabled={disabled}
            onPress={() => {
              if (!selected) {
                onSwitch?.(tab.mode);
              }
            }}
            style={styles.tab}
          >
            <ThemedText
              style={[styles.label, selected ? styles.labelSelected : styles.labelIdle]}
              setColor={selected ? theme.title : idleColor}
              numberOfLines={1}
            >
              {tab.label}
            </ThemedText>
            {number ? (
              <ThemedText
                style={styles.value}
                setColor={selected ? theme.quietText : idleColor}
                numberOfLines={1}
              >
                {`· ${number}`}
              </ThemedText>
            ) : null}
            {selected ? (
              <View
                pointerEvents="none"
                style={[styles.underline, { backgroundColor: theme.primary }]}
              />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
