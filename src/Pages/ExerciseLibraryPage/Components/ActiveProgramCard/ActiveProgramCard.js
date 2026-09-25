import { ActivityIndicator, TouchableOpacity, View, useColorScheme } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import styles from "./ActiveProgramCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import { ThemedText } from "@resources/ThemedComponents";
import { programService } from "@services";

const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/**
 * The active program on the Train tab: its block and week, how far through
 * the block you are, this week's seven days, and today's next workout with a
 * Start button. The whole card opens the program.
 */
export default function ActiveProgramCard({ card, onOpen, onStart, isStarting = false }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const quiet = theme.quietText;
  const primaryText = theme.primaryText ?? theme.primary;
  const hasFocus = card.focus && !programService.isDefaultFocus(card.focus);
  const today = card.today;

  const dayLabel = (entry, index) => {
    const day = t(`programs.weekdays.${WEEKDAY_KEYS[index]}`);

    if (entry.state === "done") {
      return t("train.program.dayDone", { day });
    }

    if (entry.isToday) {
      return t("train.program.dayToday", { day });
    }

    return entry.state === "planned"
      ? t("train.program.dayPlanned", { day })
      : t("train.program.dayRest", { day });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={t("train.program.open", { name: card.programName ?? "" })}
      onPress={onOpen}
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: withAlpha(theme.primary, 0.32) },
      ]}
    >
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: withAlpha(theme.primary, 0.14) }]}>
          <ThemedText style={styles.badgeText} setColor={primaryText}>
            {t("train.program.badge")}
          </ThemedText>
        </View>
        <ChevronRight width={16} height={16} color={theme.chevron} thickness={2} />
      </View>

      <View style={styles.titleBlock}>
        <ThemedText style={styles.name} setColor={theme.title} numberOfLines={2}>
          {card.programName}
        </ThemedText>
        <ThemedText style={styles.blockLine} setColor={quiet} numberOfLines={1}>
          {hasFocus
            ? t("train.program.blockLineFocus", {
                block: card.blockNumber,
                blocks: card.blockCount,
                focus: programService.getFocusLabel(card.focus, t),
              })
            : t("train.program.blockLine", { block: card.blockNumber, blocks: card.blockCount })}
        </ThemedText>
      </View>

      {/* How far through the block: one segment per week. */}
      <View style={styles.progress}>
        <View style={styles.progressHead}>
          <ThemedText style={styles.progressText} setColor={theme.title}>
            {t("train.program.week", { week: card.weekNumber, weeks: card.weekCount })}
          </ThemedText>
          <ThemedText style={styles.progressText} setColor={quiet}>
            {t("train.program.weekWorkouts", {
              done: formatNumber(card.weekDone),
              planned: formatNumber(card.weekPlanned),
            })}
          </ThemedText>
        </View>
        <View style={styles.segments}>
          {card.segments.map((segment) => (
            <View key={segment.key} style={[styles.segment, { backgroundColor: theme.raisedSurface }]}>
              <View
                style={[
                  styles.segmentFill,
                  {
                    width: `${Math.round(Math.min(1, segment.fraction) * 100)}%`,
                    backgroundColor: theme.primary,
                  },
                ]}
              />
            </View>
          ))}
        </View>
      </View>

      {/* The seven days of this week. */}
      <View style={styles.days}>
        {card.days.map((entry, index) => {
          const isDone = entry.state === "done";
          const isPlanned = entry.state === "planned";

          return (
            <View key={entry.weekday} style={styles.dayColumn} accessible accessibilityLabel={dayLabel(entry, index)}>
              <View
                style={[
                  styles.day,
                  isDone
                    ? { backgroundColor: withAlpha(theme.secondary, 0.14), borderColor: "transparent" }
                    : entry.isToday
                      ? { backgroundColor: withAlpha(theme.primary, 0.1), borderColor: theme.primary, borderWidth: 1.5 }
                      : isPlanned
                        ? { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder }
                        : { backgroundColor: "transparent", borderColor: "transparent" },
                ]}
              >
                {isDone ? (
                  <Checkmark width={14} height={14} color={theme.secondary} thickness={2.6} />
                ) : entry.isToday || isPlanned ? (
                  <View
                    style={[
                      styles.dayDot,
                      { backgroundColor: entry.isToday ? theme.primary : theme.planned },
                    ]}
                  />
                ) : (
                  <View style={[styles.restDash, { backgroundColor: theme.quietText }]} />
                )}
              </View>
              <ThemedText
                style={styles.dayInitial}
                setColor={entry.isToday ? primaryText : quiet}
              >
                {t(`programs.weekdayInitials.${WEEKDAY_KEYS[index]}`)}
              </ThemedText>
            </View>
          );
        })}
      </View>

      {/* Today's next workout. */}
      {today ? (
        <View style={[styles.today, { borderTopColor: theme.hairline }]}>
          <View style={styles.todayCopy}>
            <ThemedText style={styles.todayEyebrow} setColor={primaryText}>
              {t("train.program.today")}
            </ThemedText>
            <ThemedText style={styles.todayName} setColor={theme.title} numberOfLines={1}>
              {today.label}
            </ThemedText>
            <ThemedText style={styles.todayMeta} setColor={quiet} numberOfLines={1}>
              {[
                today.exerciseCount > 0
                  ? t("train.program.todayExercises", { count: today.exerciseCount })
                  : null,
                today.estimatedMinutes > 0
                  ? t("train.program.todayMinutes", { minutes: today.estimatedMinutes })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </ThemedText>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            disabled={isStarting}
            onPress={onStart}
            style={[styles.start, { backgroundColor: theme.primary }]}
          >
            {isStarting ? (
              <ActivityIndicator color={theme.ink} />
            ) : (
              <ThemedText style={styles.startText} setColor={theme.ink}>
                {t("train.program.start")}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
