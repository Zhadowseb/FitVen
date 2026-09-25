import { ActivityIndicator, TouchableOpacity, View, useColorScheme } from "react-native";
import { formatDate, useTranslation } from "@localization";

import styles from "./SplitCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import ReplayHistory from "@resources/Icons/UI-icons/ReplayHistory";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * The split, for somebody without an active program: the sessions they
 * rotate through - chosen, or guessed from their last workouts until they
 * choose - with the one that is longest since marked Next, and a button that
 * repeats it today.
 */
export default function SplitCard({ split, onRepeat, onEdit, isRepeating = false }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const quiet = theme.quietText;
  const primaryText = theme.primaryText ?? theme.primary;
  const sessions = split?.sessions ?? [];
  const next = sessions.find((session) => session.isUpNext && session.lastWorkoutId) ?? null;
  const nameOf = (session, index) => session.name ?? t("train.split.unnamed", { number: index + 1 });

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: withAlpha(theme.primary, 0.32) },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.eyebrow} setColor={primaryText}>
            {t("train.split.eyebrow")}
          </ThemedText>
          {split?.source === "guess" && sessions.length > 0 ? (
            <ThemedText style={styles.suggested} setColor={quiet} numberOfLines={1}>
              {t("train.split.suggested")}
            </ThemedText>
          ) : null}
        </View>
        <TouchableOpacity accessibilityRole="button" hitSlop={10} onPress={onEdit}>
          <ThemedText style={styles.edit} setColor={quiet}>
            {t("train.split.edit")}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={styles.emptyTitle} setColor={theme.title}>
            {t("train.split.emptyTitle")}
          </ThemedText>
          <ThemedText style={styles.emptyBody} setColor={quiet}>
            {t("train.split.emptyBody")}
          </ThemedText>
          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            onPress={onEdit}
            style={[styles.chooseButton, { borderColor: withAlpha(theme.primary, 0.45) }]}
          >
            <ThemedText style={styles.chooseText} setColor={primaryText}>
              {t("train.split.choose")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.tiles}>
            {sessions.map((session, index) => {
              const isNext = session === next || (next === null && session.isUpNext);

              return (
                <View
                  key={`${session.name ?? "session"}-${index}`}
                  accessible
                  accessibilityLabel={[
                    nameOf(session, index),
                    isNext ? t("train.split.next") : null,
                    session.doneThisWeek ? t("train.split.doneThisWeek") : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  style={[
                    styles.tile,
                    sessions.length > 3 ? styles.tileWrapped : null,
                    isNext
                      ? {
                          backgroundColor: withAlpha(theme.primary, 0.1),
                          borderColor: theme.primary,
                          borderWidth: 1.5,
                        }
                      : { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.tileTop}>
                    {isNext ? (
                      <ThemedText style={styles.nextBadge} setColor={primaryText}>
                        {t("train.split.next")}
                      </ThemedText>
                    ) : (
                      <View />
                    )}
                    {session.doneThisWeek ? (
                      <Checkmark width={12} height={12} color={theme.secondary} thickness={2.8} />
                    ) : null}
                  </View>
                  <ThemedText style={styles.tileName} setColor={theme.title} numberOfLines={1}>
                    {nameOf(session, index)}
                  </ThemedText>
                  <ThemedText style={styles.tileDate} setColor={quiet} numberOfLines={1}>
                    {session.lastTrainedAt
                      ? formatDate(session.lastTrainedAt, { weekday: "short", day: "numeric", month: "short" })
                      : t("train.split.notYet")}
                  </ThemedText>
                </View>
              );
            })}
          </View>

          {next ? (
            <TouchableOpacity
              activeOpacity={0.88}
              accessibilityRole="button"
              disabled={isRepeating}
              onPress={() => onRepeat?.(next)}
              style={[styles.cta, { backgroundColor: theme.primary }]}
            >
              {isRepeating ? (
                <ActivityIndicator color={theme.ink} />
              ) : (
                <>
                  <ReplayHistory width={17} height={17} color={theme.ink} />
                  <ThemedText style={styles.ctaText} setColor={theme.ink} numberOfLines={1}>
                    {t("train.split.repeat", { name: nameOf(next, sessions.indexOf(next)) })}
                  </ThemedText>
                  {next.exerciseCount > 0 ? (
                    <ThemedText style={styles.ctaMeta} setColor={theme.ink} numberOfLines={1}>
                      {t("train.split.repeatExercises", { count: next.exerciseCount })}
                    </ThemedText>
                  ) : null}
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}
