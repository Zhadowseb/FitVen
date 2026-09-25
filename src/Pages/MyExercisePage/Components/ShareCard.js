import { ActivityIndicator, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./ShareCardStyle";
import { formatNumber, useTranslation } from "@localization";
import { Colors } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import TradeUp from "@resources/Icons/UI-icons/TradeUp";
import { ThemedSwitch, ThemedText } from "@resources/ThemedComponents";

function LinkButton({ label, onPress, theme, style }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      onPress={onPress}
      style={[styles.link, style]}
    >
      <ThemedText style={styles.linkText} setColor={theme.primaryText}>
        {label}
      </ThemedText>
      <ChevronRight width={14} height={14} color={theme.primaryText} thickness={2.2} />
    </TouchableOpacity>
  );
}

/**
 * "Share the exercise": the switch, what sharing means, and - once it is
 * shared - how many use it and a way to see it as others do. A copy of
 * somebody else's exercise cannot be shared; it says so, and links to the
 * original instead.
 *
 * The card only draws; the page decides. Turning it on goes through the
 * page's confirmation first, so `onToggle(true)` asks rather than shares.
 *
 * Props:
 *   isPublic        shared - or the value a change in flight is setting
 *   isAsking        the confirmation is open: the switch stays where it was
 *                   pushed, and nothing yet says it is shared
 *   pending         null, or the value a change in flight is setting
 *   isCopy          a copy of somebody else's: the switch is off and locked
 *   disabled        something else on the page is talking to the cloud
 *   users           the owner plus everyone who added it; null when unknown
 *   nudge           the "add a video" line, or null
 *   error           why the last change failed, or ""
 *   onToggle(next)  onSeeAsOthers()  onSeeOriginal()  - a link is drawn only with its handler
 */
export default function ShareCard({
  isPublic,
  isAsking = false,
  pending = null,
  isCopy = false,
  disabled = false,
  users = null,
  nudge = null,
  error = "",
  onToggle,
  onSeeAsOthers,
  onSeeOriginal,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // `danger` is 4.4:1 as text on white; the darker red holds 4.5 there.
  const dangerInk = colorScheme === "light" ? theme.dangerDark : theme.danger;
  const isChanging = pending !== null;
  const showStatus = !isCopy && (isPublic || isChanging);
  const hasUsers = Number.isFinite(users) && users > 0;
  let statusLabel = t("myExercise.share.shared");

  if (pending === true) {
    statusLabel = t("myExercise.share.sharing");
  } else if (pending === false) {
    statusLabel = t("myExercise.share.stopping");
  } else if (hasUsers) {
    statusLabel = t("myExercise.share.sharedWithUsers", {
      users: t("customExercises.users", { count: users, value: formatNumber(users) }),
    });
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.headRow}>
        <ThemedText style={styles.title} setColor={theme.title}>
          {t("myExercise.share.title")}
        </ThemedText>
        <ThemedSwitch
          value={!isCopy && (Boolean(isPublic) || isAsking)}
          onValueChange={onToggle}
          disabled={isCopy || disabled || isChanging || isAsking}
          accessibilityLabel={t("myExercise.share.title")}
          accessibilityHint={isCopy ? undefined : t("myExercise.share.switchHint")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
      </View>

      <ThemedText style={styles.body} setColor={theme.quietText}>
        {isCopy ? t("myExercise.share.copyBody") : t("myExercise.share.body")}
      </ThemedText>

      {isCopy && onSeeOriginal ? (
        <LinkButton
          label={t("myExercise.share.seeOriginal")}
          onPress={onSeeOriginal}
          theme={theme}
          style={styles.linkAlone}
        />
      ) : null}

      {showStatus ? (
        <>
          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
          <View style={styles.statusRow}>
            <View style={styles.status} accessibilityLiveRegion="polite">
              {isChanging ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <View style={[styles.statusDot, { backgroundColor: theme.secondary }]} />
              )}
              <ThemedText style={styles.statusText} setColor={theme.mutedStrong}>
                {statusLabel}
              </ThemedText>
            </View>
            {!isChanging && onSeeAsOthers ? (
              <LinkButton
                label={t("myExercise.share.seeAsOthers")}
                onPress={onSeeAsOthers}
                theme={theme}
              />
            ) : null}
          </View>

          {/* Turning it off asks nothing, so what it does is said here,
              before the switch is touched. */}
          {isPublic && !isChanging ? (
            <ThemedText style={styles.helper} setColor={theme.quietText}>
              {t("myExercise.share.offHelper")}
            </ThemedText>
          ) : null}

          {isPublic && nudge ? (
            <View style={styles.nudge}>
              <TradeUp
                width={14}
                height={14}
                stroke={theme.quietText}
                style={styles.nudgeIcon}
              />
              <ThemedText style={styles.nudgeText} setColor={theme.quietText}>
                {nudge}
              </ThemedText>
            </View>
          ) : null}
        </>
      ) : null}

      {error ? (
        <ThemedText
          style={styles.error}
          setColor={dangerInk}
          accessibilityLiveRegion="polite"
        >
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
