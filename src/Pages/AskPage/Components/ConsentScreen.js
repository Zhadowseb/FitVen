import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import styles from "../AskPageStyle";

const POINTS = ["what", "who", "others"];

/**
 * The one screen before the first question: what is shared, with whom, and
 * that nothing goes to other users. Continue says yes (setAskConsent(true));
 * Not now says nothing and goes back to the chat. It can be turned off again
 * in the profile.
 */
export default function ConsentScreen({ busy, failed, onContinue, onNotNow }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.consent, { paddingBottom: 24 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText accessibilityRole="header" style={styles.consentTitle} setColor={theme.title}>
        {t("ask.consent.title")}
      </ThemedText>
      <ThemedText style={styles.consentIntro} setColor={theme.text}>
        {t("ask.consent.intro")}
      </ThemedText>

      {POINTS.map((point) => (
        <View
          key={point}
          accessible
          accessibilityLabel={`${t(`ask.consent.${point}.title`)}. ${t(`ask.consent.${point}.body`)}`}
          style={[styles.consentCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        >
          <ThemedText style={styles.consentCardTitle} setColor={theme.quietText}>
            {t(`ask.consent.${point}.title`)}
          </ThemedText>
          <ThemedText style={styles.consentCardBody} setColor={theme.title}>
            {t(`ask.consent.${point}.body`)}
          </ThemedText>
        </View>
      ))}

      <ThemedText style={styles.consentNote} setColor={theme.quietText}>
        {t("ask.consent.change")}
      </ThemedText>

      {failed ? (
        <ThemedText accessibilityLiveRegion="polite" style={styles.consentError} setColor={theme.danger}>
          {t("ask.consent.failed")}
        </ThemedText>
      ) : null}

      <View style={styles.consentButtons}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          activeOpacity={0.85}
          disabled={busy}
          onPress={onContinue}
          style={[styles.consentPrimary, { backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 }]}
        >
          <ThemedText style={styles.consentButtonText} setColor={theme.ink}>
            {t("ask.consent.continue")}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          disabled={busy}
          onPress={onNotNow}
          style={[styles.consentSecondary, { borderColor: theme.border }]}
        >
          <ThemedText style={styles.consentButtonText} setColor={theme.title}>
            {t("ask.consent.notNow")}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
