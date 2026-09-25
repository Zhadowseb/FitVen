import { useState } from "react";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { formatNumber, useTranslation } from "@localization";

import styles, {
  HISTORY_CELL_GAP,
  HISTORY_CELL_WIDTH,
  HISTORY_FADE_WIDTH,
} from "./ExerciseHistoryPanelStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Expand from "@resources/Icons/UI-icons/Expand";
import Star from "@resources/Icons/UI-icons/Star";
import { ThemedText } from "@resources/ThemedComponents";
import { historyCellTone } from "@utils/exerciseHistoryTable";

// Beyond three columns the table scrolls, and snaps a cell at a time so a
// swipe never leaves one cut in half.
const SCROLL_FROM_COLUMNS = 4;

function formatWeight(value) {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

/** The colours a cell is drawn in, from the theme so light mode works too. */
function cellColors(tone, theme) {
  if (tone === "record") {
    return {
      backgroundColor: withAlpha(theme.record, 0.1),
      borderColor: withAlpha(theme.record, 0.28),
    };
  }

  if (tone === "amrap") {
    return {
      backgroundColor: withAlpha(theme.amrap, 0.1),
      borderColor: withAlpha(theme.amrap, 0.3),
    };
  }

  if (tone === "drop") {
    return {
      backgroundColor: withAlpha(theme.dropSet, 0.1),
      borderColor: withAlpha(theme.dropSet, 0.3),
    };
  }

  return {
    backgroundColor: withAlpha(theme.title, 0.04),
    borderColor: "transparent",
  };
}

function HistoryCell({ set, isNewest, theme }) {
  if (!set) {
    // The day had fewer sets than the widest one shown. A dashed outline with
    // a short rule reads as "nothing here", where an empty gap reads as a
    // cell that failed to load.
    return (
      <View
        style={[
          styles.cell,
          styles.cellEmpty,
          { borderColor: withAlpha(theme.title, 0.09) },
        ]}
      >
        <View style={[styles.cellEmptyRule, { backgroundColor: withAlpha(theme.title, 0.14) }]} />
      </View>
    );
  }

  return (
    <View style={[styles.cell, cellColors(historyCellTone(set), theme)]}>
      <ThemedText
        style={styles.cellWeight}
        setColor={isNewest ? theme.title : withAlpha(theme.title, 0.85)}
        numberOfLines={1}
      >
        {formatWeight(set.weight)}
      </ThemedText>
      <ThemedText style={styles.cellReps} setColor={theme.quietText} numberOfLines={1}>
        × {set.reps}
      </ThemedText>
    </View>
  );
}

/**
 * The last three times this exercise was done, one row a session and one
 * column a set.
 *
 * The dates stay put and the sets scroll, all rows together as one sheet, so
 * set 4 of every session lines up under the same header. Warm-ups are not in
 * it: they are preparation, and a table whose first columns are always the
 * lightest sets of the day buries the work.
 */
export default function ExerciseHistoryPanel({
  history,
  heaviestLift,
  isLoading,
  hasError,
  exerciseName,
  onClose,
  surface,
  border,
}) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [scrollViewport, setScrollViewport] = useState(0);

  const sessions = history?.sessions ?? [];
  const maxSets = history?.maxSets ?? 0;
  const columns = Array.from({ length: maxSets }, (_, index) => index + 1);
  const scrolls = maxSets >= SCROLL_FROM_COLUMNS;
  const contentWidth =
    maxSets * HISTORY_CELL_WIDTH + Math.max(0, maxSets - 1) * HISTORY_CELL_GAP;
  const showFade = scrolls && contentWidth > scrollViewport;

  // Pushed, so the back arrow returns to the workout.
  const openRecords = () => navigation.push("RecordsExercisePage", { exerciseName });

  return (
    <View style={[styles.panel, { backgroundColor: surface, borderColor: border }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("workout.history.close")}
        onPress={onClose}
        style={styles.bar}
      >
        <ThemedText style={styles.barTitle} setColor={theme.quietText}>
          {t("workout.history.title")}
        </ThemedText>
        <ThemedText style={styles.barMeta} setColor={theme.quietText} numberOfLines={1}>
          {t("workout.history.lastTimes", { count: sessions.length || 3 })}
        </ThemedText>
        <View style={styles.barChevron}>
          <Expand width={14} height={14} color={theme.quietText} />
        </View>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: border }]} />

      {isLoading && sessions.length === 0 ? (
        <ThemedText style={styles.message} setColor={theme.quietText}>
          {t("workout.history.loading")}
        </ThemedText>
      ) : hasError ? (
        <ThemedText style={styles.message} setColor={theme.danger}>
          {t("workout.history.couldNotLoad")}
        </ThemedText>
      ) : sessions.length === 0 ? (
        <ThemedText style={styles.message} setColor={theme.quietText}>
          {t("workout.history.empty")}
        </ThemedText>
      ) : (
        <View style={styles.table}>
          {/* The date column: never scrolls. */}
          <View style={styles.dateColumn}>
            <View style={styles.headerRow}>
              <ThemedText style={styles.headerText} setColor={theme.quietText} numberOfLines={1}>
                <ThemedText style={styles.headerText} setColor={theme.primaryText ?? theme.primary}>
                  {maxSets}
                </ThemedText>
                {` ${t("workout.history.setsTotal", { count: maxSets })}`}
              </ThemedText>
            </View>

            {sessions.map((session, index) => (
              <View key={session.id} style={styles.dateCell}>
                <ThemedText
                  style={styles.dateLabel}
                  setColor={index === 0 ? theme.primaryText ?? theme.primary : withAlpha(theme.title, 0.92)}
                  numberOfLines={1}
                >
                  {session.dateLabel}
                </ThemedText>
                <ThemedText style={styles.dateRelative} setColor={theme.quietText} numberOfLines={1}>
                  {session.relativeLabel}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Every set column, header and all rows, as one sheet. */}
          <View
            style={styles.scrollArea}
            onLayout={(event) => setScrollViewport(event.nativeEvent.layout.width)}
          >
            <ScrollView
              horizontal
              scrollEnabled={scrolls}
              showsHorizontalScrollIndicator={false}
              snapToInterval={scrolls ? HISTORY_CELL_WIDTH + HISTORY_CELL_GAP : undefined}
              decelerationRate="fast"
            >
              <View>
                <View style={[styles.headerRow, styles.setHeaderRow]}>
                  {columns.map((column) => (
                    <ThemedText
                      key={column}
                      style={[styles.headerText, styles.setHeaderText]}
                      setColor={theme.quietText}
                    >
                      {column}
                    </ThemedText>
                  ))}
                </View>

                {sessions.map((session, sessionIndex) => (
                  <View key={session.id} style={styles.setRow}>
                    {columns.map((column) => (
                      <HistoryCell
                        key={column}
                        set={session.sets[column - 1]}
                        isNewest={sessionIndex === 0}
                        theme={theme}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>

            {showFade ? (
              <Svg
                pointerEvents="none"
                width={HISTORY_FADE_WIDTH}
                height="100%"
                style={styles.fade}
              >
                <Defs>
                  <LinearGradient id="historyFade" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={surface} stopOpacity="0" />
                    <Stop offset="1" stopColor={surface} stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#historyFade)" />
              </Svg>
            ) : null}
          </View>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: border }]} />

      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("workout.history.openRecords", { name: exerciseName })}
        onPress={openRecords}
        style={[styles.recordsRow, { backgroundColor: withAlpha(theme.record, 0.05) }]}
      >
        <Star width={17} height={17} color={theme.record} filled />
        <ThemedText style={styles.recordsLabel} setColor={theme.title} numberOfLines={1}>
          {t("workout.history.records")}
        </ThemedText>
        {heaviestLift ? (
          <ThemedText style={styles.recordsValue} setColor={theme.quietText} numberOfLines={1}>
            {t("workout.history.heaviestLift", {
              weight: formatWeight(heaviestLift.weight),
              reps: heaviestLift.reps,
            })}
          </ThemedText>
        ) : null}
        <ChevronRight width={16} height={16} color={theme.quietText} />
      </TouchableOpacity>
    </View>
  );
}
