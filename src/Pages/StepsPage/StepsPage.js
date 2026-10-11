import { useCallback, useMemo, useState } from "react";
import { Platform, ScrollView, Switch, TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { formatNumber, getLocaleTag, useTranslation } from "@localization";

import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import {
  ThemedBottomSheet,
  ThemedSegmentedControl,
  ThemedText,
  ThemedView,
} from "../../Resources/ThemedComponents";
import ScienceLink from "../../Resources/Components/ScienceLink";
import StepsBarChart from "../../Resources/Components/StepsBarChart";
import ChevronLeft from "../../Resources/Icons/UI-icons/ChevronLeft";
import Dumbbell from "../../Resources/Icons/UI-icons/Dumbbell";
import { stepsService } from "../../Services";
import {
  addDays,
  groupByWeek,
  listTrainingWorkouts,
  localIsoDate,
  monthRange,
  startOfWeek,
  summarisePeriod,
} from "../../Utils/dailySteps";
import {
  dayOfMonthLabel,
  formatDayRange,
  formatMonthName,
  formatWeekdayShort,
  weekDays,
  weekdayKeyOf,
} from "../../Utils/stepsFormat";
import { STEP_ZONES, TARGET_ZONE_IDS, getZoneById } from "../../Utils/stepZones";
import { workoutDisplayName } from "@utils/workoutTypeLabel";
import styles from "./StepsPageStyle";

// The Steps page (design: StepsDetail.dc.html): the day's, week's or month's
// active steps, a stacked chart of what was walked and what training added, the
// numbers around it, and the two settings - whether training counts, and the
// target. Opened from the Home card and from Statistics.
//
// Walked steps are the phone's own count (Apple Health / Health Connect);
// training is finished strength workouts as step equivalents and is always
// orange. They are never one unmarked number.

const PERIODS = ["day", "week", "month"];

function periodRange(period, todayIso) {
  if (period === "month") {
    return monthRange(todayIso);
  }

  if (period === "day") {
    // The chart shows the last week, with today picked out.
    return { from: addDays(todayIso, -6), to: todayIso };
  }

  const monday = startOfWeek(todayIso);

  return { from: monday, to: addDays(monday, 6) };
}

export default function StepsPage() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const locale = getLocaleTag();

  const [period, setPeriod] = useState("week");
  const [settings, setSettings] = useState(null);
  const [access, setAccess] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [targetSheetVisible, setTargetSheetVisible] = useState(false);

  const todayIso = localIsoDate();
  const range = useMemo(() => periodRange(period, todayIso), [period, todayIso]);

  const load = useCallback(async () => {
    try {
      const [nextSettings, nextAccess] = await Promise.all([
        stepsService.getStepsSettings(),
        stepsService.getStepsAccess(),
      ]);
      const result = await stepsService.loadStepDays(db, {
        fromIso: range.from,
        toIso: range.to,
        countTraining: nextSettings.countTraining,
        theme,
      });

      setSettings(nextSettings);
      setAccess(nextAccess);
      setLoaded(result);
    } catch (error) {
      console.warn("Could not load the steps page:", error);
    }
  }, [db, range, theme, period]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const healthApp = t(`steps.healthApp.${Platform.OS === "ios" ? "ios" : "android"}`);
  const green = theme.secondary ?? theme.primary;

  /* ------------------------------------------------------------- numbers -- */

  const view = useMemo(() => {
    if (!loaded || !settings) {
      return null;
    }

    const days = loaded.days;
    const summaryDays = period === "day" ? days.filter((day) => day.date === todayIso) : days;
    const summary = summarisePeriod(summaryDays, { theme });
    const byDate = new Map(days.map((day) => [day.date, day]));

    let bars;

    if (period === "month") {
      bars = groupByWeek(days).map((week) => ({
        key: week.start,
        label: dayOfMonthLabel(week.start),
        walked: week.days > 0 ? week.averageWalked : null,
        training: week.days > 0 ? week.averageTraining : null,
        highlight: todayIso >= week.start && todayIso <= addDays(week.start, 6),
      }));
    } else {
      const dates = period === "week" ? weekDays(range.from) : daysBetweenRange(range);

      bars = dates.map((date) => {
        const day = byDate.get(date);
        const weekdayName = t(`programs.weekdays.${weekdayKeyOf(date)}`);

        return {
          key: date,
          label: date === todayIso ? t("steps.chart.today") : weekdayName.slice(0, 1).toUpperCase(),
          walked: day && day.active !== null ? day.walked ?? 0 : null,
          training: day && day.active !== null ? day.training : null,
          highlight: date === todayIso,
        };
      });
    }

    return { days, summary, bars };
  }, [loaded, settings, period, todayIso, theme, range, t]);

  const withTraining = settings?.countTraining ?? true;

  /* -------------------------------------------------------------- actions -- */

  const askForAccess = async () => {
    await stepsService.requestStepsAccess();
    await load();
  };

  const chooseTarget = async (zoneId) => {
    setTargetSheetVisible(false);
    await stepsService.setTargetZone(zoneId);
    await load();
  };

  const toggleTraining = async (enabled) => {
    // Written before the read, so the same pass shows the new numbers.
    await stepsService.setCountTraining(enabled);
    await load();
  };

  /* ----------------------------------------------------------------- UI -- */

  const cardStyle = [styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }];
  const summary = view?.summary;
  const targetZone = settings ? getZoneById(settings.targetZoneId) : null;
  const targetName = targetZone ? t(targetZone.labelKey) : "";
  const hasData = Boolean(summary && summary.days > 0);

  let caption = "";

  if (period === "day") {
    caption = t("steps.hero.today", { range: formatDayRange(todayIso, todayIso, locale) });
  } else if (period === "week") {
    caption = t("steps.hero.dailyAverage", { range: formatDayRange(range.from, range.to, locale) });
  } else {
    caption = t("steps.hero.dailyAverage", { range: formatMonthName(range.from, locale) });
  }

  const asking = access === "undetermined";
  const needsAccess = access === "undetermined" || access === "denied" || (access === "granted" && loaded && !loaded.days.some((day) => day.source === "phone" && day.walked > 0));
  const showPrompt = access !== null && access !== "unavailable" && needsAccess;

  const chartSummary = summary
    ? t(`steps.chart.summary.${period}`, {
        average: formatNumber(summary.average ?? 0),
        zone: summary.zone ? t(summary.zone.labelKey) : "",
        sweet: summary.sweetSpotDays,
        days: summary.days,
      })
    : "";

  const best = summary?.best ?? null;
  const bestWorkout = best?.trainingWorkouts?.[0] ?? null;
  const bestDetail = best
    ? bestWorkout
      ? t("steps.tiles.bestDetail", {
          weekday: t(`programs.weekdays.${weekdayKeyOf(best.date)}`),
          workout: workoutDisplayName(bestWorkout.label, t, bestWorkout.type),
        })
      : t(`programs.weekdays.${weekdayKeyOf(best.date)}`)
    : "";

  const trainingList = view && withTraining ? listTrainingWorkouts(view.days) : [];
  const shares = summary?.shares ?? null;

  return (
    <ThemedView safe={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          >
            <ChevronLeft width={18} height={18} color={theme.title} thickness={2} />
          </TouchableOpacity>

          <View style={styles.headerTitles}>
            <ThemedText style={styles.eyebrow} setColor={theme.quietText} numberOfLines={1}>
              {t("steps.eyebrow")}
            </ThemedText>
            <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1}>
              {t("steps.title")}
            </ThemedText>
          </View>
        </View>

        {/* period */}
        <ThemedSegmentedControl
          stretch
          style={styles.period}
          value={period}
          onChange={setPeriod}
          options={PERIODS.map((value) => ({ value, label: t(`steps.periods.${value}`) }))}
        />

        {showPrompt ? (
          <View style={[styles.prompt, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <ThemedText style={styles.promptText} setColor={theme.text}>
              {asking ? t("steps.access.ask") : t("steps.access.blocked", { app: healthApp })}
            </ThemedText>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={asking ? askForAccess : () => stepsService.openStepsSettings()}
              style={[styles.promptButton, { backgroundColor: withAlpha(theme.primary, 0.14) }]}
            >
              <ThemedText style={styles.promptButtonText} setColor={theme.primaryText}>
                {asking ? t("steps.access.askButton") : t("steps.access.openApp", { app: healthApp })}
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        {view ? (
          <>
            {/* hero */}
            {hasData ? (
              <View style={styles.hero}>
                <View style={styles.heroText}>
                  <ThemedText style={styles.heroCaption} setColor={theme.quietText}>
                    {caption}
                  </ThemedText>
                  <View style={styles.heroRow}>
                    <ThemedText style={styles.heroNumber} setColor={theme.title}>
                      {formatNumber(summary.average)}
                    </ThemedText>
                    <ThemedText style={styles.heroUnit} setColor={theme.text}>
                      {t("steps.hero.activeSteps")}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.heroSplit} setColor={theme.quietText}>
                    <ThemedText style={styles.heroSplit} setColor={green}>
                      {t("steps.hero.walked", { count: formatNumber(summary.averageWalked ?? 0) })}
                    </ThemedText>
                    {withTraining && summary.averageTraining > 0 ? (
                      <>
                        {" + "}
                        <ThemedText style={styles.heroSplit} setColor={theme.primary}>
                          {t("steps.hero.fromTraining", { count: formatNumber(summary.averageTraining) })}
                        </ThemedText>
                      </>
                    ) : null}
                  </ThemedText>
                </View>

                {summary.zone ? (
                  <View style={[styles.zonePill, { backgroundColor: withAlpha(summary.zone.color, 0.16) }]}>
                    <View style={[styles.zoneSwatch, { backgroundColor: summary.zone.color }]} />
                    <ThemedText style={styles.zonePillText} setColor={summary.zone.color}>
                      {t(summary.zone.labelKey)}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* chart */}
            <View style={[cardStyle, styles.chartCard]}>
              {hasData ? (
                <>
                  <StepsBarChart
                    bars={view.bars}
                    target={settings.targetSteps}
                    targetLabel={t("steps.chart.target", { zone: targetName, steps: formatNumber(settings.targetSteps) })}
                    targetColor={targetZone ? theme.stepZones[targetZone.id] : undefined}
                    summary={chartSummary}
                  />
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.swatch, { backgroundColor: green }]} />
                      <ThemedText style={styles.legendText} setColor={theme.text}>
                        {t("steps.chart.walking")}
                      </ThemedText>
                    </View>
                    {withTraining ? (
                      <View style={styles.legendItem}>
                        <View style={[styles.swatch, { backgroundColor: theme.primary }]} />
                        <ThemedText style={styles.legendText} setColor={theme.text}>
                          {t("steps.chart.training")}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ScienceLink articleId="step-zones" style={{ marginTop: 10 }} />
                </>
              ) : (
                <ThemedText style={styles.noData} setColor={theme.quietText}>
                  {t("steps.noData")}
                </ThemedText>
              )}
            </View>

            {/* tiles */}
            {hasData ? (
              <View style={styles.tiles}>
                <View style={styles.tileRow}>
                  <Tile theme={theme} label={t("steps.tiles.total")} value={formatNumber(summary.total)} detail={withTraining && summary.trainingTotal > 0 ? t("steps.tiles.totalWithTraining", { count: formatNumber(summary.trainingTotal) }) : null} />
                  {period === "day" ? (
                    summary.distanceKm ? (
                      <Tile theme={theme} label={t("steps.tiles.distance")} value={`${summary.distanceKm.toFixed(1)} ${t("steps.tiles.km")}`} detail={t("steps.tiles.walkedDistance")} />
                    ) : (
                      <View style={{ flex: 1 }} />
                    )
                  ) : (
                    <Tile
                      theme={theme}
                      label={t("steps.tiles.sweetSpotDays")}
                      value={t("steps.tiles.ofDays", { count: summary.sweetSpotDays, total: summary.days })}
                      valueColor={theme.stepZones.sweetSpot}
                      detail={t("steps.tiles.sweetSpotRule", { steps: formatNumber(getZoneById("sweetSpot").min) })}
                    />
                  )}
                </View>
                {period !== "day" ? (
                  <View style={styles.tileRow}>
                    <Tile theme={theme} label={t("steps.tiles.bestDay")} value={best ? formatNumber(best.active) : "–"} detail={bestDetail} />
                    {summary.distanceKm ? (
                      <Tile theme={theme} label={t("steps.tiles.distance")} value={`${summary.distanceKm.toFixed(1)} ${t("steps.tiles.km")}`} detail={t("steps.tiles.walkedDistance")} />
                    ) : (
                      <View style={{ flex: 1 }} />
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* where it came from */}
            {hasData && shares ? (
              <View style={[cardStyle, styles.sourcesCard]}>
                <View style={styles.sourcesHead}>
                  <ThemedText style={styles.sourcesTitle} setColor={theme.title}>
                    {t("steps.sources.title")}
                  </ThemedText>
                  <ThemedText style={styles.sourcesPeriod} setColor={theme.quietText}>
                    {t(`steps.sources.period.${period}`)}
                  </ThemedText>
                </View>
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={t("steps.sources.a11y", shares)}
                  style={[styles.sourcesBar, { backgroundColor: theme.border }]}
                >
                  <View style={{ width: `${shares.walks}%`, backgroundColor: green }} />
                  <View style={{ width: `${shares.everyday}%`, backgroundColor: withAlpha(green, 0.45) }} />
                  <View style={{ width: `${shares.training}%`, backgroundColor: theme.primary }} />
                </View>
                <View style={styles.sourcesLegend}>
                  <SourceLegend color={green} text={`${t("steps.sources.walks")} ${formatNumber(summary.walksTotal)}`} theme={theme} />
                  <SourceLegend color={withAlpha(green, 0.45)} text={`${t("steps.sources.everyday")} ${formatNumber(summary.everydayTotal)}`} theme={theme} />
                  {withTraining ? (
                    <SourceLegend color={theme.primary} text={`${t("steps.sources.training")} ${formatNumber(summary.trainingTotal)}`} theme={theme} />
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* training counts too */}
            <View style={[cardStyle, styles.trainingCard]}>
              <View style={styles.trainingHead}>
                <View style={[styles.trainingIcon, { backgroundColor: withAlpha(theme.primary, 0.14) }]}>
                  <Dumbbell width={18} height={18} color={theme.primary} />
                </View>
                <View style={styles.trainingTitles}>
                  <ThemedText style={styles.trainingTitle} setColor={theme.title}>
                    {t("steps.trainingCounts.title")}
                  </ThemedText>
                  <ThemedText style={styles.trainingSubtitle} setColor={theme.quietText}>
                    {t("steps.trainingCounts.subtitle")}
                  </ThemedText>
                </View>
                <Switch
                  accessibilityLabel={t("steps.trainingCounts.switch")}
                  value={withTraining}
                  onValueChange={toggleTraining}
                  trackColor={{ true: theme.primary, false: withAlpha(theme.quietText, 0.35) }}
                  thumbColor={theme.onDanger}
                />
              </View>

              {withTraining ? (
                <View style={styles.trainingList}>
                  {trainingList.length > 0 ? (
                    trainingList.map((workout) => (
                      <View key={workout.id} style={[styles.trainingRow, { borderTopColor: theme.border }]}>
                        <ThemedText style={styles.trainingDay} setColor={theme.quietText}>
                          {formatWeekdayShort(workout.date, locale)}
                        </ThemedText>
                        <ThemedText style={styles.trainingName} setColor={theme.title} numberOfLines={1}>
                          {workoutDisplayName(workout.label, t, workout.type)}
                          <ThemedText style={styles.trainingMeta} setColor={theme.quietText}>
                            {` · ${t("steps.trainingCounts.minutes", { minutes: Math.round(workout.seconds / 60) })}`}
                          </ThemedText>
                        </ThemedText>
                        <ThemedText style={styles.trainingSteps} setColor={theme.primary}>
                          {`+${formatNumber(workout.steps)}`}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText style={[styles.trainingEmpty, { borderTopColor: theme.border }]} setColor={theme.quietText}>
                      {t("steps.trainingCounts.empty")}
                    </ThemedText>
                  )}
                </View>
              ) : null}
              <View style={[styles.trainingScience, { borderTopColor: theme.border }]}>
                <ScienceLink articleId="strength-counts-as-steps" />
              </View>
            </View>

            {/* target */}
            <View style={[cardStyle, styles.targetRow]}>
              <ThemedText style={styles.targetText} setColor={theme.text}>
                {`${t("steps.target.label")} `}
                <ThemedText style={styles.targetValue} setColor={theme.title}>
                  {`${targetName} · ${t("steps.target.from", { steps: formatNumber(settings.targetSteps) })}`}
                </ThemedText>
              </ThemedText>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setTargetSheetVisible(true)}
                style={[styles.targetButton, { backgroundColor: withAlpha(theme.primary, 0.14) }]}
              >
                <ThemedText style={styles.targetButtonText} setColor={theme.primaryText}>
                  {t("steps.target.change")}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>

      <ThemedBottomSheet visible={targetSheetVisible} onClose={() => setTargetSheetVisible(false)}>
        <View style={styles.sheetBody}>
          <ThemedText style={styles.sheetTitle} setColor={theme.title}>
            {t("steps.target.title")}
          </ThemedText>
          {TARGET_ZONE_IDS.map((zoneId) => {
            const zone = STEP_ZONES.find((entry) => entry.id === zoneId);
            const selected = settings?.targetZoneId === zoneId;
            const color = theme.stepZones[zoneId];

            return (
              <TouchableOpacity
                key={zoneId}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => chooseTarget(zoneId)}
                style={[
                  styles.option,
                  {
                    backgroundColor: selected ? withAlpha(color, 0.12) : theme.cardBackground,
                    borderColor: selected ? color : theme.cardBorder,
                  },
                ]}
              >
                <View style={[styles.zoneSwatch, { backgroundColor: color }]} />
                <View style={styles.optionTexts}>
                  <ThemedText style={styles.optionName} setColor={theme.title}>
                    {t(zone.labelKey)}
                  </ThemedText>
                  <ThemedText style={styles.optionRange} setColor={theme.quietText}>
                    {t("steps.target.from", { steps: formatNumber(zone.min) })}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ThemedBottomSheet>
    </ThemedView>
  );
}

function Tile({ theme, label, value, detail, valueColor }) {
  return (
    <View style={[styles.tile, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <ThemedText style={styles.tileLabel} setColor={theme.quietText}>
        {label}
      </ThemedText>
      <ThemedText style={styles.tileValue} setColor={valueColor ?? theme.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </ThemedText>
      {detail ? (
        <ThemedText style={styles.tileDetail} setColor={theme.quietText}>
          {detail}
        </ThemedText>
      ) : null}
    </View>
  );
}

function SourceLegend({ color, text, theme }) {
  return (
    <View style={styles.sourcesLegendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText style={styles.sourcesLegendText} setColor={theme.text}>
        {text}
      </ThemedText>
    </View>
  );
}

// The seven days that end `range.to`: the Day view's week of context.
function daysBetweenRange(range) {
  return Array.from({ length: 7 }, (_, index) => addDays(range.from, index));
}
