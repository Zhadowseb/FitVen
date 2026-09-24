import { View } from "react-native";
import { useColorScheme } from "react-native";
import { Colors } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";

import {ThemedText}
  from "@resources/ThemedComponents";

import styles from "./SetListStyle.js";
import { useTranslation } from "@localization";

const Title = ({ visibleColumns }) => {

    const colorScheme = useColorScheme();
    const { t } = useTranslation();
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
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>{t("workout.setList.headers.note")}</ThemedText>
            </View>
        )}

        {visibleColumns.rest && (
            <View style={[styles.pause, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>{t("workout.setList.headers.rest")}</ThemedText>
            </View>
        )}

        {visibleColumns.set && (
            <View style={[styles.set, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>#</ThemedText>
            </View>
        )}

        {visibleColumns.reps && (
            <View style={[styles.reps, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>{t("workout.setList.headers.reps")}</ThemedText>
            </View>
        )}

        {visibleColumns.rpe && (
            <View style={[styles.rpe, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>RPE</ThemedText>
            </View>
        )}

        {visibleColumns.rm_percentage && (
            <View style={[styles.rm_percentage, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>{t("workout.setList.headers.rmPercentage")}</ThemedText>
            </View>
        )}

        {visibleColumns.weight && (
            <View style={[styles.weight, styles.titleCell, titleCellStyle]}>
            <ThemedText style={[styles.titleText, {color: headerTextColor}]}>{t("workout.setList.headers.weight")}</ThemedText>
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
