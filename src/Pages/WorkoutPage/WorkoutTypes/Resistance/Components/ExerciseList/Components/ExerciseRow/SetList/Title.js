import { TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import { Colors } from "../../../../../../../../../Resources/GlobalStyling/colors";
import Checkmark from "../../../../../../../../../Resources/Icons/UI-icons/Checkmark";

import {ThemedText}
  from "../../../../../../../../../Resources/ThemedComponents";

import styles from "./SetListStyle.js";

const Title = ({ visibleColumns, onRestTitlePress }) => {

    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme] ?? Colors.light;
    const headerTextColor =
      colorScheme === "dark" ? "#8f96b3" : theme.quietText ?? theme.text;
    const dividerColor =
      colorScheme === "dark"
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(32, 30, 43, 0.1)";
    const titleCellStyle = { borderColor: dividerColor };

  return (
    <View style={[styles.container, styles.titleRow, { borderColor: dividerColor }]}>

        {visibleColumns.note && (
            <View style={[styles.note, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>NOTE</ThemedText>
            </View>
        )}

        {visibleColumns.rest && (
            <TouchableOpacity
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Choose rest input unit"
              style={[
                styles.pause,
                styles.titleCell,
                styles.restTitleCell,
                titleCellStyle,
              ]}
              onPress={onRestTitlePress}
            >
            <View
              pointerEvents="none"
              style={[
                styles.restTitleAffordance,
                { borderColor: dividerColor },
              ]}
            />
            <ThemedText
              style={[
                styles.titleText,
                styles.restTitleText,
                { color: headerTextColor },
              ]}
            >
              REST
            </ThemedText>
            </TouchableOpacity>
        )}

        {visibleColumns.set && (
            <View style={[styles.set, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>#</ThemedText>
            </View>
        )}

        {visibleColumns.reps && (
            <View style={[styles.reps, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>REPS</ThemedText>
            </View>
        )}

        {visibleColumns.rpe && (
            <View style={[styles.rpe, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>RPE</ThemedText>
            </View>
        )}

        {visibleColumns.rm_percentage && (
            <View style={[styles.rm_percentage, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>1RM%</ThemedText>
            </View>
        )}

        {visibleColumns.weight && (
            <View style={[styles.weight, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>WEIGHT</ThemedText>
            </View>
        )}

        {visibleColumns.done && (
            <View style={[styles.done, styles.titleCell, titleCellStyle]}>
            <Checkmark width={12} height={12} color={headerTextColor} thickness={2.2} />
            </View>
        )}
    </View>
  );
};

export default Title;
