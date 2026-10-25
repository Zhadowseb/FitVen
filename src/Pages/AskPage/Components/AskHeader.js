import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import ChevronLeft from "@resources/Icons/UI-icons/ChevronLeft";
import Lock from "@resources/Icons/UI-icons/Lock";
import Sparkle from "@resources/Icons/UI-icons/Sparkle";
import ThreeDots from "@resources/Icons/UI-icons/ThreeDots";
import styles from "../AskPageStyle";

// Back, the sparkle and "Ask FitVen", the green "Only your data" badge (it
// opens the explanation) and, once there is a chat, its menu.
export default function AskHeader({ onBack, onOpenBadge, onOpenMenu, showMenu }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
        activeOpacity={0.8}
        onPress={onBack}
        style={[styles.backButton, { backgroundColor: theme.chipBackground }]}
      >
        <ChevronLeft width={18} height={18} color={theme.title} thickness={2} />
      </TouchableOpacity>

      <View style={styles.headerTitle}>
        <Sparkle width={18} height={18} color={theme.aiBox.icon} thickness={2} />
        <ThemedText
          accessibilityRole="header"
          numberOfLines={1}
          style={styles.headerTitleText}
          setColor={theme.title}
        >
          {t("ask.title")}
        </ThemedText>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("ask.badge")}
        accessibilityHint={t("ask.badgeHint")}
        activeOpacity={0.8}
        onPress={onOpenBadge}
        style={styles.badgeTouch}
      >
        <View style={[styles.badge, { backgroundColor: theme.askBadge.surface }]}>
          <Lock width={11} height={11} color={theme.askBadge.text} thickness={2.6} />
          <ThemedText style={styles.badgeText} setColor={theme.askBadge.text}>
            {t("ask.badge")}
          </ThemedText>
        </View>
      </TouchableOpacity>

      {showMenu ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("ask.menu.open")}
          activeOpacity={0.8}
          onPress={onOpenMenu}
          style={styles.menuButton}
        >
          <ThreeDots width={20} height={20} color={theme.quietText} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
