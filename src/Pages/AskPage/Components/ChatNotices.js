import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import Sparkle from "@resources/Icons/UI-icons/Sparkle";
import { screenStateForCode } from "@utils/askResponse";
import { tiersWithQuestions } from "@utils/askTiers";
import styles from "../AskPageStyle";

const DOT_COUNT = 3;

function Dot({ index, color, still }) {
  const opacity = useRef(new Animated.Value(still ? 0.6 : 0.25)).current;

  useEffect(() => {
    if (still) {
      opacity.setValue(0.6);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 160),
        Animated.timing(opacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 360, useNativeDriver: true }),
        Animated.delay((DOT_COUNT - 1 - index) * 160),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [index, opacity, still]);

  return <Animated.View style={[styles.typingDot, { backgroundColor: color, opacity }]} />;
}

/** Three dots while the answer is on its way. Still, for somebody who has reduced motion. */
export function TypingIndicator() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (active) {
          setReduceMotion(Boolean(enabled));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return (
    <View
      accessible
      accessibilityLabel={t("ask.typing")}
      accessibilityLiveRegion="polite"
      style={styles.typingRow}
    >
      <View style={[styles.avatarTile, { backgroundColor: theme.aiBox.surface }]}>
        <Sparkle width={15} height={15} color={theme.aiBox.icon} thickness={2} />
      </View>
      <View style={styles.typingDots}>
        {Array.from({ length: DOT_COUNT }, (_, index) => (
          <Dot key={index} index={index} color={theme.quietText} still={reduceMotion} />
        ))}
      </View>
    </View>
  );
}

/**
 * What went wrong, in words, and what can be done: Try again (offline, a
 * failure), another model (a month's questions used up on one), the consent
 * screen (the cloud says there is no yes yet). `notice` is { code, tier }.
 */
export function ChatNotice({ notice, usage, onRetry, onUseTier, onOpenConsent }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const screen = screenStateForCode(notice.code);
  const others = screen.state === "quota" ? tiersWithQuestions(usage) : [];
  // "All your questions" only when no model has one left; otherwise which one
  // is used up - and the others are offered under it.
  const message =
    screen.state === "quota"
      ? others.length === 0
        ? t("ask.quota.reachedAll")
        : notice.tier
          ? t(screen.messageKey, { tier: t(`ask.tier.${notice.tier}`) })
          : null
      : t(screen.messageKey);
  const buttonStyle = [styles.suggestionButton, { borderWidth: 1, borderColor: theme.border }];

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        {
          backgroundColor: withAlpha(theme.danger, screen.state === "quota" ? 0 : 0.08),
          borderColor: screen.state === "quota" ? theme.cardBorder : withAlpha(theme.danger, 0.35),
        },
      ]}
    >
      {message ? (
        <ThemedText style={styles.noticeText} setColor={theme.title}>
          {message}
        </ThemedText>
      ) : null}

      {screen.state === "quota" && others.length > 0 ? (
        <>
          <ThemedText style={styles.noticeText} setColor={theme.text}>
            {t("ask.quota.pickAnother")}
          </ThemedText>
          <View style={styles.noticeButtons}>
            {others.map((tier) => (
              <TouchableOpacity
                key={tier}
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => onUseTier(tier)}
                style={buttonStyle}
              >
                <ThemedText style={styles.suggestionButtonText} setColor={theme.primaryText}>
                  {t("ask.quota.use", { tier: t(`ask.tier.${tier}`) })}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {screen.state === "consent" ? (
        <View style={styles.noticeButtons}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={onOpenConsent}
            style={buttonStyle}
          >
            <ThemedText style={styles.suggestionButtonText} setColor={theme.primaryText}>
              {t("ask.consent.continue")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}

      {screen.canRetry ? (
        <View style={styles.noticeButtons}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={onRetry}
            style={buttonStyle}
          >
            <ThemedText style={styles.suggestionButtonText} setColor={theme.primaryText}>
              {t("common.retry")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
