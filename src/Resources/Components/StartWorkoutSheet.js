import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../GlobalStyling/colors";
import ThemedSheetHandle from "../ThemedComponents/ThemedSheetHandle";
import ThemedText from "../ThemedComponents/ThemedText";
import ArrowDoubleDown from "../Icons/UI-icons/ArrowDoubleDown";
import ArrowDoubleUp from "../Icons/UI-icons/ArrowDoubleUp";
import Cross from "../Icons/UI-icons/Cross";
import Eye from "../Icons/UI-icons/Eye";
import Plus from "../Icons/UI-icons/Plus";
import ReplayHistory from "../Icons/UI-icons/ReplayHistory";
import Resistance from "../Icons/WorkoutLabels/Resistance";
import Run from "../Icons/WorkoutLabels/Run";
import { getTodaysDate } from "../../Utils/dateUtils";
import {
  filterReleasedWorkoutTypes,
  isWorkoutTypeComingSoon,
} from "../../Utils/workoutTypeAvailability";

const noop = () => {};

// The ids are what a workout row stores; the titles are what the user reads.
// Built per render rather than once at module load, because the language can
// change while the app is open.
function buildFreshStarts(t) {
  return filterReleasedWorkoutTypes(
    [
      {
        id: "Resistance",
        title: t("workoutStart.types.resistance"),
        type: "resistance",
      },
      {
        id: "Run",
        title: t("workoutStart.types.run"),
        type: "run",
      },
      {
        id: "Walk",
        title: t("workoutStart.types.walk"),
        type: "walk",
      },
    ],
    (item) => item.type
  );
}

// Stored type ids to their translation keys. A type not listed here is shown
// as stored, as it was before.
const WORKOUT_TYPE_LABEL_KEYS = {
  Resistance: "workoutStart.types.resistance",
  StrengthTraining: "workoutStart.types.resistance",
  Run: "workoutStart.types.run",
  Walk: "workoutStart.types.walk",
};

function getWorkoutType(workout) {
  return workout?.workout_type ?? workout?.label ?? null;
}

function getWorkoutTypeLabel(workout, t) {
  const workoutType = getWorkoutType(workout);
  const labelKey = WORKOUT_TYPE_LABEL_KEYS[workoutType];

  if (labelKey) {
    return t(labelKey);
  }

  return workoutType ?? t("workoutStart.types.workout");
}

function getWorkoutIconType(workout) {
  const workoutType = getWorkoutType(workout);

  if (workoutType === "Run") {
    return "run";
  }

  if (workoutType === "Walk") {
    return "walk";
  }

  return "resistance";
}

function getWorkoutTitle(workout, t) {
  return workout?.label ?? getWorkoutTypeLabel(workout, t);
}

function getWorkoutDetail(plannedWorkout, t) {
  const workout = plannedWorkout?.workout;
  const programName =
    plannedWorkout?.programName ?? t("workoutStart.workoutCalendar");
  const exerciseCount = workout?.previewItems?.length ?? 0;

  if (exerciseCount > 0) {
    return t("workoutStart.planned.detailWithExercises", {
      programName,
      count: exerciseCount,
    });
  }

  return t("workoutStart.planned.detailReady", { programName });
}

function getRecentWorkoutDetail(workout, t) {
  const previewItems = workout?.previewItems ?? [];

  if (getWorkoutType(workout) === "Run" && previewItems.length > 0) {
    const setSummary = previewItems
      .map((item) => item.detail)
      .filter(Boolean)
      .join(", ");

    return setSummary || t("workoutStart.types.run");
  }

  if (previewItems.length > 0) {
    return t("common.exercises", { count: previewItems.length });
  }

  return t("workoutStart.ready");
}

function parseWorkoutDate(workout) {
  const isoDate = workout?.date_iso;

  if (typeof isoDate === "string" && isoDate.length >= 10) {
    return new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  }

  const localDate = workout?.date;

  if (typeof localDate === "string" && localDate.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
    const [day, month, year] = localDate.split(".").map(Number);
    return new Date(year, month - 1, day);
  }

  return null;
}

function getRecentWorkoutMeta(workout, t) {
  const workoutDate = parseWorkoutDate(workout);

  if (!workoutDate || Number.isNaN(workoutDate.getTime())) {
    return workout?.date ?? t("workoutStart.recent");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  workoutDate.setHours(0, 0, 0, 0);

  const dayDifference = Math.round(
    (today.getTime() - workoutDate.getTime()) / 86400000
  );

  if (dayDifference <= 0) {
    return t("time.today");
  }

  if (dayDifference === 1) {
    return t("time.yesterday");
  }

  if (dayDifference <= 6) {
    return t("time.daysAgo", { count: dayDifference });
  }

  return workout?.date ?? t("workoutStart.recent");
}

function getUsualWorkoutDetail(workout, t) {
  const exerciseCount = Number(workout?.exerciseCount) || 0;

  if (exerciseCount > 0) {
    return t("common.exercises", { count: exerciseCount });
  }

  return t("workoutStart.types.workout");
}

function getUsualWorkoutMeta(workout, t) {
  return getRecentWorkoutMeta(
    {
      date: workout?.latestDate,
      date_iso: workout?.latestDateIso,
    },
    t
  );
}

function WorkoutGlyph({ type, size = 26, color }) {
  if (type === "run" || type === "walk") {
    return <Run width={size} height={size} primaryColor={color} />;
  }

  return <Resistance width={size} height={size} color={color} />;
}

function getIconColors(type, theme) {
  if (type === "run") {
    return {
      backgroundColor: withAlpha(theme.record, 0.16),
      color: theme.record,
    };
  }

  if (type === "walk") {
    return {
      backgroundColor: withAlpha(theme.secondary, 0.14),
      color: theme.secondary,
    };
  }

  return {
    backgroundColor: withAlpha(theme.primary, 0.14),
    color: theme.primaryText,
  };
}

function IconTile({
  type,
  theme,
  styles,
  size = "regular",
  active = false,
  badge = null,
}) {
  const iconColors = getIconColors(type, theme);
  const tileSize = size === "large" ? 56 : 46;
  const glyphSize = size === "large" ? 30 : 25;
  const badgeIconSize = badge === "fresh" ? 11 : 12;

  return (
    <View
      style={[
        styles.iconTile,
        {
          width: tileSize,
          height: tileSize,
          borderRadius: size === "large" ? 14 : 12,
          backgroundColor: active ? theme.primary : iconColors.backgroundColor,
        },
      ]}
    >
      <WorkoutGlyph
        type={type}
        size={glyphSize}
        color={active ? theme.textInverted : iconColors.color}
      />
      {badge ? (
        <View
          style={[
            styles.iconTileBadge,
            {
              backgroundColor:
                badge === "fresh" ? iconColors.color : theme.background,
              borderColor: theme.cardBackground,
            },
          ]}
        >
          {badge === "fresh" ? (
            <Plus
              width={badgeIconSize}
              height={badgeIconSize}
              color={theme.textInverted}
              thickness={2.4}
            />
          ) : (
            <ReplayHistory
              width={badgeIconSize}
              height={badgeIconSize}
              color={iconColors.color}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

function MiniClock({ styles }) {
  return (
    <View style={styles.clock}>
      <View style={styles.clockHandTall} />
      <View style={styles.clockHandWide} />
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
  actionDisabled = false,
  onActionPress = noop,
  theme,
  styles,
  showRotationIcon = false,
  showPlusIcon = false,
  emphasizeTitle = false,
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <View style={styles.sectionTitleGroup}>
          {showPlusIcon ? (
            <Plus width={14} height={14} color={theme.quietText} thickness={2.2} />
          ) : null}
          {showRotationIcon ? (
            <ReplayHistory
              width={15}
              height={15}
              color={emphasizeTitle ? theme.title : theme.quietText}
            />
          ) : null}
          <ThemedText
            style={[
              styles.sectionTitle,
              emphasizeTitle ? styles.sectionTitleStrong : null,
            ]}
          >
            {title}
          </ThemedText>
        </View>
        {subtitle ? <ThemedText style={styles.sectionSubtitle}>{subtitle}</ThemedText> : null}
      </View>
      {action ? (
        <TouchableOpacity
          activeOpacity={0.75}
          accessibilityRole="button"
          disabled={actionDisabled}
          onPress={onActionPress}
          style={actionDisabled ? styles.disabledAction : null}
        >
          <ThemedText style={styles.sectionAction}>{action}</ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PlannedTodaySection({ isToday, shortcut, onOpen, theme, styles }) {
  const { t } = useTranslation();
  const [showChoices, setShowChoices] = useState(false);
  const plannedWorkouts = shortcut?.workouts ?? [];
  const primaryWorkout = plannedWorkouts[0] ?? null;
  const workout = primaryWorkout?.workout;
  const hasMultipleWorkouts = plannedWorkouts.length > 1;

  useEffect(() => {
    setShowChoices(false);
  }, [shortcut]);

  if (!workout) {
    return null;
  }

  return (
    <View style={styles.plannedTodaySection}>
      <ThemedText style={styles.plannedTodayPrompt}>
        {hasMultipleWorkouts
          ? isToday
            ? t("workoutStart.planned.promptMultipleToday")
            : t("workoutStart.planned.promptMultipleOnDay")
          : isToday
            ? t("workoutStart.planned.promptSingleToday")
            : t("workoutStart.planned.promptSingleOnDay")}
      </ThemedText>

      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => {
          if (hasMultipleWorkouts) {
            setShowChoices((currentValue) => !currentValue);
            return;
          }

          onOpen(primaryWorkout);
        }}
        style={styles.todayShortcutCard}
      >
        <IconTile
          type={getWorkoutIconType(workout)}
          theme={theme}
          styles={styles}
          size="large"
          active
        />
        <View style={styles.todayShortcutCopy}>
          <ThemedText style={styles.todayShortcutLabel}>
            {isToday
              ? t("workoutStart.planned.eyebrowToday")
              : t("workoutStart.planned.eyebrow")}
          </ThemedText>
          <ThemedText style={styles.cardTitle} numberOfLines={1}>
            {hasMultipleWorkouts
              ? t("workoutStart.planned.workoutsPlanned", {
                  count: plannedWorkouts.length,
                })
              : getWorkoutTitle(workout, t)}
          </ThemedText>
          <ThemedText style={styles.cardDetails} numberOfLines={1}>
            {hasMultipleWorkouts
              ? t("workoutStart.planned.countReady", {
                  count: plannedWorkouts.length,
                })
              : getWorkoutDetail(primaryWorkout, t)}
          </ThemedText>
        </View>
        <View style={styles.expandIcon}>
          {showChoices ? (
            <ArrowDoubleUp width={20} height={20} color={theme.quietText} />
          ) : (
            <ArrowDoubleDown width={20} height={20} color={theme.quietText} />
          )}
        </View>
      </TouchableOpacity>

      {showChoices ? (
        <View style={styles.todayChoiceList}>
          {plannedWorkouts.map((plannedWorkout) => (
            <TouchableOpacity
              key={`${plannedWorkout.programId ?? "standalone"}-${plannedWorkout.workout.workout_id}`}
              activeOpacity={0.84}
              onPress={() => onOpen(plannedWorkout)}
              style={styles.todayChoiceRow}
            >
              <IconTile
                type={getWorkoutIconType(plannedWorkout.workout)}
                theme={theme}
                styles={styles}
              />
              <View style={styles.recentCopy}>
                <ThemedText style={styles.cardTitle} numberOfLines={1}>
                  {getWorkoutTitle(plannedWorkout.workout, t)}
                </ThemedText>
                <ThemedText style={styles.cardDetails} numberOfLines={1}>
                  {getWorkoutDetail(plannedWorkout, t)}
                </ThemedText>
              </View>
              <ThemedText style={styles.chevron}>{">"}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function UsualWorkoutCard({ workout, theme, styles }) {
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={noop}
      style={[
        styles.usualCard,
        workout.suggested ? styles.usualCardSuggested : null,
      ]}
    >
      <View style={styles.usualTopRow}>
        <IconTile
          type={getWorkoutIconType(workout)}
          theme={theme}
          styles={styles}
        />
        {workout.suggested ? (
          <View style={styles.suggestedBadge}>
            <ThemedText style={styles.suggestedText}>{t("workoutStart.suggested")}</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={styles.cardTitle} numberOfLines={1}>
        {workout.title}
      </ThemedText>
      <ThemedText style={styles.cardDetails} numberOfLines={1}>
        {getUsualWorkoutDetail(workout, t)}
      </ThemedText>
      <View style={styles.cardMetaRow}>
        <View style={styles.inlineMeta}>
          <MiniClock styles={styles} />
          <ThemedText style={styles.metaText} numberOfLines={1}>
            {getUsualWorkoutMeta(workout, t)}
          </ThemedText>
        </View>
        <ThemedText style={styles.metaText}>
          {t("workoutStart.timesCount", { count: workout.occurrenceCount })}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

function UsualWorkoutSection({ isLoading, workouts, theme, styles }) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t("workoutStart.usual.title")}
        action={t("workoutStart.usual.manage")}
        theme={theme}
        styles={styles}
        showRotationIcon
      />
      {isLoading ? (
        <View style={styles.usualStateRow}>
          <ThemedText style={styles.recentStateText}>
            {t("workoutStart.usual.loading")}
          </ThemedText>
        </View>
      ) : workouts.length > 0 ? (
        <View style={styles.usualGrid}>
          {workouts.map((workout) => (
            <UsualWorkoutCard
              key={workout.id}
              workout={workout}
              theme={theme}
              styles={styles}
            />
          ))}
        </View>
      ) : (
        <View style={styles.usualStateRow}>
          <ThemedText style={styles.recentStateText}>
            {t("workoutStart.usual.empty")}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function RecentWorkoutRow({ workout, disabled, onPress, theme, styles }) {
  const { t } = useTranslation();
  const [showExercises, setShowExercises] = useState(false);
  const isSuggested = Boolean(workout?.suggested);
  const occurrenceCount = Number(workout?.occurrenceCount) || 0;
  const detail = workout?.exerciseCount
    ? getUsualWorkoutDetail(workout, t)
    : getRecentWorkoutDetail(workout, t);
  const previewItems = Array.isArray(workout?.previewItems)
    ? workout.previewItems
    : [];

  return (
    <View style={[styles.recentRow, disabled ? styles.disabledCard : null]}>
      <View style={styles.recentRowTop}>
        <TouchableOpacity
          activeOpacity={0.84}
          disabled={disabled}
          onPress={() => onPress(workout)}
          style={styles.recentRowMain}
        >
          <IconTile
            type={getWorkoutIconType(workout)}
            theme={theme}
            styles={styles}
            badge="repeat"
          />
          <View style={styles.recentCopy}>
            <View style={styles.repeatTitleRow}>
              <ThemedText style={styles.cardTitle} numberOfLines={1}>
                {getWorkoutTitle(workout, t)}
              </ThemedText>
              {isSuggested ? (
                <View style={styles.suggestedBadge}>
                  <ThemedText style={styles.suggestedText}>{t("workoutStart.suggested")}</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={styles.cardDetails} numberOfLines={1}>
              {detail}
            </ThemedText>
          </View>
          <View style={styles.repeatMetaColumn}>
            <ThemedText style={styles.metaText} numberOfLines={1}>
              {isSuggested
                ? getUsualWorkoutMeta(workout, t)
                : getRecentWorkoutMeta(workout, t)}
            </ThemedText>
            {occurrenceCount > 0 ? (
              <View style={styles.repeatCountChip}>
                <ThemedText style={styles.repeatCountText}>
                  {t("workoutStart.timesCount", { count: occurrenceCount })}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            showExercises
              ? t("workoutStart.repeat.hideExercises", {
                  title: getWorkoutTitle(workout, t),
                })
              : t("workoutStart.repeat.showExercises", {
                  title: getWorkoutTitle(workout, t),
                })
          }
          onPress={() => setShowExercises((isOpen) => !isOpen)}
          style={[styles.eyeButton, showExercises ? styles.eyeButtonOpen : null]}
        >
          <Eye
            width={17}
            height={17}
            color={showExercises ? theme.primaryText : theme.quietText}
          />
        </TouchableOpacity>
      </View>

      {showExercises ? (
        <View style={styles.exerciseList}>
          {previewItems.length > 0 ? (
            previewItems.map((item, index) => (
              <View key={`${item.label}-${index}`} style={styles.exerciseRow}>
                <ThemedText style={styles.exerciseName} numberOfLines={1}>
                  {item.label}
                </ThemedText>
                {item.detail ? (
                  <ThemedText style={styles.exerciseDetail} numberOfLines={1}>
                    {item.detail}
                  </ThemedText>
                ) : null}
              </View>
            ))
          ) : (
            <ThemedText style={styles.exerciseDetail}>
              {t("workoutStart.repeat.noExercises")}
            </ThemedText>
          )}
        </View>
      ) : null}
    </View>
  );
}

function RecentWorkoutSection({
  isLoadingUsual,
  isLoading,
  isLoadingMore,
  isStartingWorkout,
  usualWorkouts = [],
  workouts = [],
  onLoadMore,
  onCopyWorkout,
  theme,
  styles,
}) {
  const { t } = useTranslation();
  const repeatWorkouts = [...usualWorkouts, ...workouts].filter(
    (workout) =>
      !isWorkoutTypeComingSoon(getWorkoutIconType(workout)) &&
      (workout?.previewItems?.length ?? 0) > 0
  );
  const workoutRows = (
    <>
      {repeatWorkouts.map((workout, index) => (
        <RecentWorkoutRow
          key={`${workout.workout_id ?? workout.id}-${index}`}
          workout={workout}
          disabled={isStartingWorkout}
          onPress={onCopyWorkout}
          theme={theme}
          styles={styles}
        />
      ))}
      {isLoadingMore ? (
        <View style={styles.recentStateRow}>
          <ThemedText style={styles.recentStateText}>
            {t("workoutStart.repeat.loadingMore")}
          </ThemedText>
        </View>
      ) : null}
    </>
  );
  const handleListScroll = ({ nativeEvent }) => {
    if (isLoadingMore) {
      return;
    }

    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (distanceFromBottom <= 96) {
      onLoadMore();
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t("workoutStart.repeat.title")}
        theme={theme}
        styles={styles}
        showRotationIcon
        emphasizeTitle
      />
      {isLoading || isLoadingUsual ? (
        <View style={styles.recentStateRow}>
          <ThemedText style={styles.recentStateText}>
            {t("workoutStart.repeat.loading")}
          </ThemedText>
        </View>
      ) : repeatWorkouts.length > 0 ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          style={styles.recentList}
          contentContainerStyle={styles.listStack}
        >
          {workoutRows}
        </ScrollView>
      ) : (
        <View style={styles.recentStateRow}>
          <ThemedText style={styles.recentStateText}>
            {t("workoutStart.repeat.empty")}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function FreshStartCard({ item, disabled, onPress, theme, styles }) {
  const iconColors = getIconColors(item.type, theme);

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={item.title}
      onPress={() =>
        onPress({
          id: item.id,
          displayName: item.title,
        })
      }
      style={[
        styles.freshCard,
        {
          borderColor: iconColors.color,
          backgroundColor: iconColors.backgroundColor,
        },
        disabled ? styles.disabledCard : null,
      ]}
    >
      <WorkoutGlyph type={item.type} size={32} color={iconColors.color} />
      <ThemedText
        style={[styles.cardTitle, styles.freshCardTitle]}
        numberOfLines={1}
      >
        {item.title}
      </ThemedText>
      <View
        style={[
          styles.iconTileBadge,
          {
            backgroundColor: iconColors.color,
            borderColor: theme.cardBackground,
          },
        ]}
      >
        <Plus width={11} height={11} color={theme.textInverted} />
      </View>
    </TouchableOpacity>
  );
}

export default function StartWorkoutSheet({
  visible,
  onClose,
  onStartFresh = noop,
  onOpenPlannedWorkout = noop,
  plannedTodayShortcut = null,
  usualWorkouts = [],
  isLoadingUsualWorkouts = false,
  recentWorkouts = [],
  isLoadingRecentWorkouts = false,
  isLoadingMoreRecentWorkouts = false,
  onLoadMoreRecentWorkouts = noop,
  onCopyRecentWorkout = noop,
  isStartingWorkout = false,
  targetDate = null,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const freshStarts = useMemo(() => buildFreshStarts(t), [t]);
  const isToday = !targetDate || targetDate === getTodaysDate();
  const targetDateLabel = targetDate?.slice(0, 5);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              paddingTop: Math.max(insets.top, 10) + 12,
            },
          ]}
        >
          <ThemedSheetHandle style={styles.handle} />

          <TouchableOpacity
            activeOpacity={0.72}
            accessibilityLabel={t("workoutStart.closeSheet")}
            accessibilityRole="button"
            hitSlop={6}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Cross width={19} height={19} color={theme.quietText} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + 18 },
            ]}
          >
            <View style={styles.header}>
              <ThemedText style={styles.title}>
                {isToday
                  ? t("workoutStart.title")
                  : t("workoutStart.titleForDate", { date: targetDateLabel })}
              </ThemedText>
            </View>

            {plannedTodayShortcut ? (
              <PlannedTodaySection
                shortcut={plannedTodayShortcut}
                isToday={isToday}
                onOpen={onOpenPlannedWorkout}
                theme={theme}
                styles={styles}
              />
            ) : null}

            <View style={styles.section}>
              <View style={styles.freshGrid}>
                {freshStarts.map((item) => (
                  <FreshStartCard
                    key={item.id}
                    item={item}
                    disabled={isStartingWorkout}
                    onPress={onStartFresh}
                    theme={theme}
                    styles={styles}
                  />
                ))}
              </View>
            </View>

            <RecentWorkoutSection
              isLoadingUsual={isLoadingUsualWorkouts}
              isLoading={isLoadingRecentWorkouts}
              isLoadingMore={isLoadingMoreRecentWorkouts}
              isStartingWorkout={isStartingWorkout}
              usualWorkouts={usualWorkouts}
              workouts={recentWorkouts}
              onLoadMore={onLoadMoreRecentWorkouts}
              onCopyWorkout={onCopyRecentWorkout}
              theme={theme}
              styles={styles}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: theme.sheetScrim,
  },
  sheet: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  handle: {
    position: "absolute",
    top: 14,
  },
  closeButton: {
    position: "absolute",
    top: 24,
    right: 22,
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    zIndex: 2,
  },
  closeText: {
    color: theme.quietText,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 24,
  },
  header: {
    gap: 8,
    paddingRight: 36,
  },
  title: {
    color: theme.title,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  plannedTodaySection: {
    gap: 12,
  },
  plannedTodayPrompt: {
    color: theme.quietText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 0,
  },
  todayShortcutCard: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: withAlpha(theme.primary, 0.52),
    borderRadius: 14,
    backgroundColor: withAlpha(theme.primary, 0.14),
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  todayShortcutCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  todayShortcutLabel: {
    color: theme.primaryText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  todayChoiceList: {
    gap: 8,
  },
  todayChoiceRow: {
    minHeight: 70,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardTitle: {
    color: theme.title,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: 0,
  },
  freshCardTitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  cardDetails: {
    color: theme.quietText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    letterSpacing: 0,
  },
  chevron: {
    color: theme.quietText,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "300",
  },
  expandIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    minHeight: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: theme.quietText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 4,
  },
  sectionTitleStrong: {
    color: theme.title,
  },
  sectionAction: {
    color: theme.primaryText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: theme.quietText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  disabledAction: {
    opacity: 0.56,
  },
  usualGrid: {
    flexDirection: "row",
    gap: 10,
  },
  usualCard: {
    flex: 1,
    minHeight: 144,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBackground,
    padding: 14,
    gap: 7,
  },
  usualCardSuggested: {
    borderColor: withAlpha(theme.primary, 0.52),
    backgroundColor: withAlpha(theme.primary, 0.08),
  },
  usualTopRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  usualStateRow: {
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  suggestedBadge: {
    borderRadius: 999,
    backgroundColor: withAlpha(theme.primary, 0.14),
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexShrink: 0,
  },
  suggestedText: {
    color: theme.primaryText,
    fontSize: 11,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  cardMetaRow: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  inlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    color: theme.quietText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  clock: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.quietText,
    alignItems: "center",
    justifyContent: "center",
  },
  clockHandTall: {
    position: "absolute",
    width: 1,
    height: 4,
    top: 2,
    backgroundColor: theme.quietText,
  },
  clockHandWide: {
    position: "absolute",
    width: 3,
    height: 1,
    right: 2,
    backgroundColor: theme.quietText,
  },
  listStack: {
    gap: 10,
  },
  recentList: {
    maxHeight: 326,
  },
  recentRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.background,
    paddingHorizontal: 14,
  },
  recentRowTop: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recentRowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  eyeButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  eyeButtonOpen: {
    borderColor: withAlpha(theme.primary, 0.52),
    backgroundColor: withAlpha(theme.primary, 0.14),
  },
  exerciseList: {
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
    paddingVertical: 10,
    gap: 6,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  exerciseName: {
    flex: 1,
    minWidth: 0,
    color: theme.title,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
  exerciseDetail: {
    color: theme.quietText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  repeatTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    gap: 8,
  },
  repeatMetaColumn: {
    alignItems: "flex-end",
    gap: 5,
    maxWidth: 86,
  },
  repeatCountChip: {
    borderRadius: 999,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  repeatCountText: {
    color: theme.primaryText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  recentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  recentStateRow: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: theme.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  recentStateText: {
    color: theme.quietText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  freshGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  freshCard: {
    flex: 1,
    minWidth: "30%",
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledCard: {
    opacity: 0.64,
  },
  iconTile: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconTileBadge: {
    position: "absolute",
    right: -5,
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  });
}
