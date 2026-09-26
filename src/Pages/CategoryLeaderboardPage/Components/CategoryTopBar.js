import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./CategoryTopBarStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * Back, then where the list is (the centre, the region or the country - no
 * "Globalt" here, the page is one place), the category in its own colour and
 * one line on how it is counted.
 */
export default function CategoryTopBar({ place, title, explanation, titleColor, onBack }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={styles.bar}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
        activeOpacity={0.82}
        hitSlop={8}
        onPress={onBack}
        style={[styles.back, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
      >
        <ArrowLeft width={18} height={18} color={theme.title} />
      </TouchableOpacity>

      <View style={styles.copy}>
        <View style={styles.eyebrowRow}>
          <MapPin width={10} height={10} color={theme.primaryText} thickness={2.6} />
          <ThemedText style={styles.eyebrow} setColor={theme.primaryText} numberOfLines={1}>
            {place}
          </ThemedText>
        </View>
        <ThemedText style={styles.title} setColor={titleColor} numberOfLines={1} accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText style={styles.explanation} setColor={theme.quietText}>
          {explanation}
        </ThemedText>
      </View>
    </View>
  );
}
