import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import Mic from "@resources/Icons/UI-icons/Mic";
import Sparkle from "@resources/Icons/UI-icons/Sparkle";
import styles from "./AskBarStyle";

// The way into Ask FitVen: one quiet bar under the split cards and above the
// friends (design/AskHome.dc.html). One button to a screen reader - "Ask
// FitVen about your training". The mic is the same way in with the cursor
// already in the field, where the phone's keyboard dictation is one tap away.
export default function AskBar() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("ask.openLabel")}
      activeOpacity={0.85}
      onPress={() => navigation.navigate("AskPage", { focusInput: false })}
      style={[styles.bar, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
    >
      <Sparkle width={16} height={16} color={theme.aiBox.icon} thickness={2} />

      <ThemedText numberOfLines={1} style={styles.placeholder} setColor={theme.quietText}>
        {t("ask.placeholder")}
      </ThemedText>

      <TouchableOpacity
        accessible={false}
        importantForAccessibility="no"
        activeOpacity={0.8}
        onPress={() => navigation.navigate("AskPage", { focusInput: true })}
        style={styles.micTouch}
      >
        <View style={[styles.micCircle, { backgroundColor: theme.chipBackground }]}>
          <Mic width={15} height={15} color={theme.quietText} thickness={2} />
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
