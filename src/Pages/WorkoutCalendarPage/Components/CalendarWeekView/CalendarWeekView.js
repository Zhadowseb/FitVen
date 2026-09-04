import { useState } from "react";
import { Pressable, TouchableOpacity, View } from "react-native";

import styles, { TILE_GAP, TILE_SIZE } from "./CalendarWeekViewStyle";
import ChevronLeft from "../../../../Resources/Icons/UI-icons/ChevronLeft";
import ChevronRight from "../../../../Resources/Icons/UI-icons/ChevronRight";
import { ThemedText } from "../../../../Resources/ThemedComponents";

const WEEKDAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * How many tiles fit, worked out from the row's real width rather than a fixed
 * number, so a wider screen simply shows more.
 */
function getVisibleTileCount(availableWidth, workoutCount) {
  if (!availableWidth) {
    return workoutCount;
  }

  const maxTiles = Math.max(
    1,
    Math.floor((availableWidth + TILE_GAP) / (TILE_SIZE + TILE_GAP))
  );

  return workoutCount > maxTiles ? maxTiles - 1 : workoutCount;
}

function DayRow({ day, index, isLast, contentWidth, onMeasure, palette, onOpenWorkout, onOpenDay }) {
  const workouts = day.workouts ?? [];
  const cards = day.workoutCards ?? [];
  const isRest = workouts.length === 0;
  const isToday = Boolean(day.active);
  const single = cards[0];
  const SingleIcon = single?.icon;
  const visibleTiles = getVisibleTileCount(contentWidth, cards.length);

  const dateColor = isToday
    ? palette.title
    : isRest
      ? palette.quietText
      : palette.bodyText;

  const surfaceFor = (completed) =>
    completed
      ? palette.cellDone
      : isToday
        ? palette.cellToday
        : palette.cellIdle;

  const contentColorFor = (completed) =>
    completed
      ? palette.secondary
      : isToday
        ? palette.primaryText
        : palette.quietText;

  return (
    <View
      style={[
        styles.dayRow,
        isLast ? styles.dayRowLast : { borderBottomColor: palette.divider },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${day.day} ${day.dateLabel}`}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        style={styles.dateColumn}
        onPress={() => onOpenDay(day)}
      >
        <ThemedText
          style={styles.weekdayLabel}
          setColor={isToday ? palette.primaryText : palette.quietText}
        >
          {WEEKDAY_LABELS[index]}
        </ThemedText>

        <ThemedText
          style={[styles.dateNumber, isToday ? styles.dateNumberToday : null]}
          setColor={dateColor}
        >
          {Number((day.dateLabel ?? "").split(".")[0])}
        </ThemedText>

        {workouts.length > 1 ? (
          <View style={[styles.countBadge, { backgroundColor: palette.band }]}>
            <ThemedText style={styles.countBadgeText} setColor={palette.bodyText}>
              {workouts.length}
            </ThemedText>
          </View>
        ) : null}
      </Pressable>

      {isRest ? (
        <View style={[styles.restStrip, { borderColor: palette.cellRest }]}>
          <ThemedText style={styles.restText} setColor={palette.quietText}>
            Rest day / nothing planned
          </ThemedText>
        </View>
      ) : workouts.length === 1 ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.82}
          style={[
            styles.workoutSurface,
            isToday ? styles.workoutSurfaceToday : null,
            {
              backgroundColor: surfaceFor(single?.completed),
              borderColor: isToday ? palette.primary : palette.cellIdleBorder,
              borderWidth: isToday ? 1.5 : 1,
            },
          ]}
          onPress={() => onOpenWorkout(single?.workout, day)}
        >
          {SingleIcon ? (
            <SingleIcon
              width={isToday ? 21 : 18}
              height={isToday ? 21 : 18}
              color={contentColorFor(single?.completed)}
              primaryColor={contentColorFor(single?.completed)}
              backgroundColor="transparent"
            />
          ) : null}

          <View style={styles.workoutCopy}>
            <ThemedText
              style={[styles.workoutName, isToday ? styles.workoutNameToday : null]}
              setColor={single?.completed ? palette.title : palette.bodyText}
              numberOfLines={1}
            >
              {single?.workout?.label ?? single?.iconLabel ?? "Workout"}
            </ThemedText>
            <ThemedText
              style={styles.workoutMeta}
              setColor={contentColorFor(single?.completed)}
              numberOfLines={1}
            >
              {single?.completed ? "Completed" : isToday ? "Today" : "Planned"}
            </ThemedText>
          </View>

          <ChevronRight width={15} height={15} color={palette.quietText} />
        </TouchableOpacity>
      ) : (
        <View
          style={styles.tileRow}
          onLayout={(event) => onMeasure(event.nativeEvent.layout.width)}
        >
          {cards
            .slice(0, visibleTiles)
            .map((card) => {
              const Icon = card.icon;

              return (
                <TouchableOpacity
                  key={card.key}
                  accessibilityRole="button"
                  activeOpacity={0.82}
                  style={[
                    styles.tile,
                    {
                      backgroundColor: surfaceFor(card.completed),
                      borderColor: isToday
                        ? palette.primary
                        : palette.cellIdleBorder,
                      borderWidth: isToday ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => onOpenWorkout(card.workout, day)}
                >
                  {Icon ? (
                    <Icon
                      width={19}
                      height={19}
                      color={contentColorFor(card.completed)}
                      primaryColor={contentColorFor(card.completed)}
                      backgroundColor="transparent"
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}

          {cards.length > visibleTiles ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Show all ${cards.length} workouts`}
              activeOpacity={0.82}
              style={[styles.tile, { backgroundColor: palette.cellIdle }]}
              onPress={() => onOpenDay(day)}
            >
              <ThemedText style={styles.tileOverflow} setColor={palette.quietText}>
                {`+${cards.length - visibleTiles}`}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** One week, a row per day, with nothing hidden behind a dropdown. */
export default function CalendarWeekView({
  week,
  weekLabel,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
  onOpenWorkout,
  onOpenDay,
  palette,
}) {
  const [contentWidth, setContentWidth] = useState(0);
  const days = week?.days ?? [];
  const workouts = days.flatMap((day) => day.workouts ?? []);
  const total = workouts.length;
  const done = workouts.filter((workout) => Number(workout.done) === 1).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <View>
      <View style={styles.weekNav}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          disabled={!canGoBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onPrevious}
          style={[styles.navButton, !canGoBack ? styles.navButtonOff : null]}
        >
          <ChevronLeft width={16} height={16} color={palette.quietText} />
        </TouchableOpacity>

        <View style={styles.weekNavCopy}>
          <ThemedText style={styles.weekNavLabel} setColor={palette.title}>
            {weekLabel}
          </ThemedText>
          <ThemedText style={styles.weekNavRange} setColor={palette.quietText}>
            {week?.dateRange ?? ""}
          </ThemedText>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next week"
          disabled={!canGoForward}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={onNext}
          style={[styles.navButton, !canGoForward ? styles.navButtonOff : null]}
        >
          <ChevronRight width={16} height={16} color={palette.quietText} />
        </TouchableOpacity>
      </View>

      {total > 0 ? (
        <View style={styles.progressBlock}>
          <View style={[styles.progressTrack, { backgroundColor: palette.band }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: palette.secondary },
              ]}
            />
          </View>

          <View style={styles.progressCopy}>
            <ThemedText style={styles.progressDone} setColor={palette.secondary}>
              {`${done} of ${total} done`}
            </ThemedText>
            {total - done > 0 ? (
              <ThemedText style={styles.progressLeft} setColor={palette.quietText}>
                {`· ${total - done} left this week`}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.dayRows}>
        {days.map((day, index) => (
          <DayRow
            key={`${week?.key}-${day.dateLabel}`}
            day={day}
            index={index}
            isLast={index === days.length - 1}
            contentWidth={contentWidth}
            onMeasure={setContentWidth}
            palette={palette}
            onOpenWorkout={onOpenWorkout}
            onOpenDay={onOpenDay}
          />
        ))}
      </View>
    </View>
  );
}
