// Building the split from your own workouts: the calendar's Workouts rows for
// a month you can page through, a day's workouts, and one workout opened -
// what was in it, its name to change, and "Add to split".
//
// It lives inside the editor sheet rather than in a sheet of its own: iOS
// drops a modal presented over another one.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { formatDate, useTranslation } from "@localization";

import styles from "./SplitWorkoutPickerStyle";
import { programService, workoutService } from "@services";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import ChevronLeft from "@resources/Icons/UI-icons/ChevronLeft";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import { ThemedText, ThemedTextInput } from "@resources/ThemedComponents";
import {
  buildCalendarLookups,
  formatIsoDate,
  formatLocalDate,
  getMonthPage,
  getMonthTitle,
  startOfDay,
} from "@utils/calendarDays";
import { splitNameOf } from "@utils/splitCard";
import { addSplitEntry } from "@utils/splitEntries";
import { workoutDisplayName } from "@utils/workoutTypeLabel";
import { useGridPalette } from "../../../MicrocyclePage/Components/BlockWeekGrid/BlockWeekGrid";
import CalendarWeekRows, {
  buildCalendarWeekRows,
} from "../../../WorkoutCalendarPage/Components/CalendarWeekRows/CalendarWeekRows";

function workoutDate(workout) {
  const match = String(workout?.date_iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function statusKey(workout, todayIso) {
  if (Number(workout?.done) === 1) {
    return "calendar.status.completed";
  }

  return String(workout?.date_iso ?? "") < todayIso ? "calendar.status.overdue" : "calendar.status.planned";
}

function BackButton({ label, onPress, color }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={styles.back}
    >
      <ArrowLeft width={18} height={18} color={color} />
      <ThemedText style={styles.backText} setColor={color} numberOfLines={1}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

function WorkoutDetail({ workout, picked, todayIso, onBack, onAdd, onRenamed }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [items, setItems] = useState(null);
  const [itemsFailed, setItemsFailed] = useState(false);
  const [label, setLabel] = useState(workout.label);
  const [draft, setDraft] = useState(() => splitNameOf(workout) ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [renameFailed, setRenameFailed] = useState(false);

  useEffect(() => {
    let isActive = true;

    programService
      .getWorkoutExercisePreview(db, workout.workout_id)
      .then((rows) => isActive && setItems(rows))
      .catch((error) => {
        console.warn("Could not load what was in the workout:", error);

        if (isActive) {
          setItemsFailed(true);
          setItems([]);
        }
      });

    return () => {
      isActive = false;
    };
  }, [db, workout.workout_id]);

  const current = { ...workout, label };
  const savedName = splitNameOf(current);
  const typed = draft.trim();
  const isDirty = typed !== (savedName ?? "");
  // What the button would do with the name as it will be once saved. A
  // workout with no sync_id yet gets one on Add; until then it is still this
  // workout, not any workout of its name.
  const outcome = addSplitEntry(picked, {
    name: isDirty ? typed : savedName,
    workout: workout.sync_id ?? `local:${workout.workout_id}`,
  });
  const date = workoutDate(workout);

  // Through workoutService, which marks the workout for sync.
  const rename = async () => {
    const nextLabel = typed.length > 0 ? typed.slice(0, 60) : null;

    await workoutService.updateWorkoutLabel(db, {
      workoutId: workout.workout_id,
      label: nextLabel,
    });

    const stored = nextLabel ?? workout.workout_type;

    setLabel(stored);
    onRenamed?.();

    return stored;
  };

  const saveName = async () => {
    if (isSaving || !isDirty) {
      return;
    }

    setIsSaving(true);
    setRenameFailed(false);

    try {
      await rename();
    } catch (error) {
      console.error("Could not rename the workout:", error);
      setRenameFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  const add = async () => {
    if (isSaving || outcome.status !== "added") {
      return;
    }

    setIsSaving(true);
    setRenameFailed(false);

    try {
      const stored = isDirty ? await rename() : label;
      const name = splitNameOf({ ...workout, label: stored });
      // The session is this workout: pinned by the identity it has on every
      // phone, given one first if it is an older row without.
      const syncId = name ? await workoutService.ensureWorkoutSyncId(db, workout.workout_id) : null;

      if (name && syncId) {
        onAdd?.({ name, workout: syncId, pinnedAt: date ? date.getTime() : null });
      }
    } catch (error) {
      console.error("Could not rename the workout:", error);
      setRenameFailed(true);
    } finally {
      setIsSaving(false);
    }
  };

  const hint =
    outcome.status === "full"
      ? t("train.pick.full")
      : outcome.status === "unnamed"
        ? t("train.pick.needsName")
        : outcome.status === "added"
          ? t("train.pick.pinned")
          : null;
  const canAdd = outcome.status === "added" && !isSaving;

  return (
    <View>
      <BackButton label={t("train.pick.backToCalendar")} onPress={onBack} color={theme.quietText} />

      <ThemedText style={styles.detailTitle} setColor={theme.title} numberOfLines={2}>
        {workoutDisplayName(label, t, workout.workout_type) ?? label}
      </ThemedText>
      <ThemedText style={styles.detailMeta} setColor={theme.quietText} numberOfLines={1}>
        {[
          date ? formatDate(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : null,
          t(statusKey(workout, todayIso)),
        ]
          .filter(Boolean)
          .join(" · ")}
      </ThemedText>

      <ThemedText style={styles.sectionHead} setColor={theme.primaryText ?? theme.primary}>
        {t("train.pick.exercises")}
      </ThemedText>
      <ScrollView style={styles.exerciseList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {items === null ? (
          <ActivityIndicator color={theme.primary} style={styles.loading} />
        ) : items.length === 0 ? (
          <ThemedText style={styles.quiet} setColor={theme.quietText}>
            {itemsFailed ? t("train.pick.exercisesFailed") : t("train.pick.noExercises")}
          </ThemedText>
        ) : (
          items.map((item, index) => (
            <View
              key={`${item.label}-${index}`}
              style={[styles.exerciseRow, { borderBottomColor: theme.cardBorder }]}
            >
              <ThemedText style={styles.exerciseName} setColor={theme.title} numberOfLines={1}>
                {item.label}
              </ThemedText>
              {item.detail ? (
                <ThemedText style={styles.exerciseDetail} setColor={theme.quietText} numberOfLines={1}>
                  {item.detail}
                </ThemedText>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <ThemedText style={styles.sectionHead} setColor={theme.primaryText ?? theme.primary}>
        {t("train.pick.nameLabel")}
      </ThemedText>
      <View style={styles.nameRow}>
        <ThemedTextInput
          style={styles.nameInput}
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setRenameFailed(false);
          }}
          placeholder={t("train.pick.namePlaceholder")}
          accessibilityLabel={t("train.pick.nameLabel")}
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={saveName}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !isDirty || isSaving }}
          disabled={!isDirty || isSaving}
          onPress={saveName}
          style={[
            styles.nameSave,
            { borderColor: isDirty ? theme.primary : theme.cardBorder },
          ]}
        >
          <ThemedText
            style={styles.nameSaveText}
            setColor={isDirty ? theme.primaryText ?? theme.primary : theme.quietText}
          >
            {t("train.pick.saveName")}
          </ThemedText>
        </TouchableOpacity>
      </View>
      {renameFailed ? (
        <ThemedText style={styles.hint} setColor={theme.danger}>
          {t("train.pick.renameFailed")}
        </ThemedText>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAdd }}
        disabled={!canAdd}
        onPress={add}
        style={[
          styles.addButton,
          { backgroundColor: canAdd ? theme.primary : withAlpha(theme.primary, 0.3) },
        ]}
      >
        {isSaving ? (
          <ActivityIndicator color={theme.ink} />
        ) : (
          <ThemedText style={styles.addText} setColor={theme.ink}>
            {outcome.status === "alreadyIn" ? t("train.pick.alreadyIn") : t("train.pick.add")}
          </ThemedText>
        )}
      </TouchableOpacity>
      {hint ? (
        <ThemedText style={styles.hint} setColor={theme.quietText}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * `picked` is the split being edited (entries). `onAdd(entry)` hands back the
 * session the workout becomes - its name and the workout itself, pinned by
 * sync_id - and `onRenamed()` says a workout's name changed, so the Train tab
 * reloads once the sheet closes. A rename does not rename a session already
 * in the split.
 */
export default function SplitWorkoutPicker({ picked = [], onBack, onAdd, onRenamed }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const palette = useGridPalette();
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayLabel = formatLocalDate(today);
  const todayIso = formatIsoDate(today);
  const [monthOffset, setMonthOffset] = useState(0);
  const [rows, setRows] = useState({ workouts: [], programDays: [], sicknessPeriods: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [openWorkout, setOpenWorkout] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const monthPage = useMemo(() => getMonthPage(today, monthOffset), [monthOffset, today]);

  useEffect(() => {
    let isActive = true;
    const range = { startIsoDate: monthPage.startIsoDate, endIsoDate: monthPage.endIsoDate };

    setIsLoading(true);
    setLoadFailed(false);

    Promise.all([
      programService.getWorkoutCalendarWorkouts(db, range),
      programService.getWorkoutCalendarProgramDays(db, range),
      programService.getSicknessPeriods(db),
    ])
      .then(([workouts, programDays, sicknessPeriods]) => {
        if (isActive) {
          setRows({ workouts, programDays, sicknessPeriods });
          setIsLoading(false);
        }
      })
      .catch((error) => {
        console.warn("Could not load the month for the split:", error);

        if (isActive) {
          setRows({ workouts: [], programDays: [], sicknessPeriods: [] });
          setLoadFailed(true);
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [db, monthPage, reloadKey]);

  const lookups = useMemo(
    () =>
      buildCalendarLookups({
        ...rows,
        startIsoDate: monthPage.startIsoDate,
        endIsoDate: monthPage.endIsoDate,
      }),
    [monthPage, rows]
  );
  const weeks = useMemo(
    () => buildCalendarWeekRows(monthPage, lookups, { todayLabel, t }),
    [lookups, monthPage, t, todayLabel]
  );
  const dayWorkouts = selectedDate ? lookups.workoutsByDate.get(selectedDate.dateLabel) ?? [] : [];

  const pressDay = useCallback(
    (day) => {
      const workouts = lookups.workoutsByDate.get(day.dateLabel) ?? [];

      if (workouts.length === 1) {
        setSelectedDate(null);
        setOpenWorkout(workouts[0]);
        return;
      }

      setSelectedDate(workouts.length > 1 ? day : null);
    },
    [lookups]
  );

  const changeMonth = (delta) => {
    setSelectedDate(null);
    setMonthOffset((current) => current + delta);
  };

  if (openWorkout) {
    return (
      <WorkoutDetail
        key={openWorkout.workout_id}
        workout={openWorkout}
        picked={picked}
        todayIso={todayIso}
        onBack={() => setOpenWorkout(null)}
        onAdd={onAdd}
        onRenamed={() => {
          // The cells and the day list read the label from the month's rows.
          setReloadKey((key) => key + 1);
          onRenamed?.();
        }}
      />
    );
  }

  const monthHasWorkouts = rows.workouts.some((workout) =>
    String(workout.date_iso ?? "").startsWith(monthPage.key)
  );

  return (
    <View>
      <BackButton label={t("train.pick.backToSplit")} onPress={onBack} color={theme.quietText} />

      <ThemedText style={styles.title} setColor={theme.title}>
        {t("train.pick.title")}
      </ThemedText>
      <ThemedText style={styles.body} setColor={theme.quietText}>
        {t("train.pick.body")}
      </ThemedText>

      <View style={styles.monthBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("calendar.previousMonth")}
          hitSlop={10}
          onPress={() => changeMonth(-1)}
          style={[styles.monthButton, { borderColor: theme.cardBorder }]}
        >
          <ChevronLeft width={16} height={16} color={theme.title} thickness={2.4} />
        </TouchableOpacity>
        <ThemedText style={styles.monthTitle} setColor={theme.primaryText ?? theme.primary} numberOfLines={1}>
          {getMonthTitle(monthPage.monthDate, t)}
        </ThemedText>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("calendar.nextMonth")}
          hitSlop={10}
          onPress={() => changeMonth(1)}
          style={[styles.monthButton, { borderColor: theme.cardBorder }]}
        >
          <ChevronRight width={16} height={16} color={theme.title} thickness={2.4} />
        </TouchableOpacity>
      </View>

      <CalendarWeekRows weeks={weeks} palette={palette} onPressDay={pressDay} showWeekdays />

      {isLoading ? (
        <ActivityIndicator color={theme.primary} style={styles.loading} />
      ) : loadFailed ? (
        <ThemedText style={styles.quiet} setColor={theme.quietText}>
          {t("train.pick.loadFailed")}
        </ThemedText>
      ) : !monthHasWorkouts ? (
        <ThemedText style={styles.quiet} setColor={theme.quietText}>
          {t("train.pick.emptyMonth")}
        </ThemedText>
      ) : null}

      {selectedDate && dayWorkouts.length > 0 ? (
        <View style={styles.dayList}>
          <ThemedText style={styles.sectionHead} setColor={theme.primaryText ?? theme.primary}>
            {t("train.pick.dayTitle", {
              date: formatDate(selectedDate.date, { weekday: "long", day: "numeric", month: "long" }),
            })}
          </ThemedText>
          {dayWorkouts.map((workout) => (
            <TouchableOpacity
              key={workout.workout_id}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => setOpenWorkout(workout)}
              style={[
                styles.dayRow,
                { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
              ]}
            >
              <ThemedText style={styles.dayRowName} setColor={theme.title} numberOfLines={1}>
                {workoutDisplayName(workout.label, t, workout.workout_type) ?? workout.label}
              </ThemedText>
              <ThemedText style={styles.dayRowMeta} setColor={theme.quietText} numberOfLines={1}>
                {t(statusKey(workout, todayIso))}
              </ThemedText>
              <ChevronRight width={14} height={14} color={theme.quietText} thickness={2.4} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}
