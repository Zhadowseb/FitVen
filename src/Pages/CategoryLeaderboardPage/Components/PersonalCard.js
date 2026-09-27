import { Animated, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./PersonalCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { useAnimationsEnabled, useBreathAnimation } from "@resources/Components/animationHooks";
import RadialGlow from "@resources/Components/GymLeaderboard/RadialGlow";
import { ThemedText } from "@resources/ThemedComponents";
import {
  NO_VALUE,
  formatEstimateKg,
  formatPercent,
  formatValue,
  progressExerciseName,
  unitLabel,
} from "@utils/categoryFormat";
import { CALISTHENICS_FACTORS } from "@utils/gymCategories";

// "Din fremgang" shows up to this many of your rises, the biggest first.
const PROGRESS_FIELDS = 3;
const POINT_MOVEMENTS = ["pullups", "dips", "pushups"];

function toNumber(value) {
  const numeric = value === null || value === undefined || value === "" ? NaN : Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * One rise of "Din fremgang" (the service's breakdown, which holds only rises
 * with both windows): what it was in, the estimate now, and the rise.
 */
function progressField(rise, index, t) {
  return {
    key: `${rise.exerciseName ?? rise.lift ?? "rise"}-${index}`,
    name: progressExerciseName(rise, t),
    number: formatEstimateKg(rise.now),
    unit: unitLabel("kg", rise.now, t),
    foot: `${formatPercent(rise.percent)} ${unitLabel("percent", rise.percent, t)}`,
  };
}

/** A field with its numbers still to come. */
function loadingField(index) {
  return { key: `loading-${index}`, name: " ", number: NO_VALUE, unit: null, foot: null };
}

/** One movement of "Dine point": the reps, and what they are worth. */
function pointsField(breakdown, movement, t) {
  const entry = breakdown?.[movement] ?? null;
  const reps = toNumber(entry?.reps);
  const factor = toNumber(entry?.factor) ?? CALISTHENICS_FACTORS[movement];
  const points = toNumber(entry?.points) ?? (reps !== null ? reps * factor : null);

  return {
    key: movement,
    name: t(`category.personal.${movement}`),
    number: reps !== null ? formatValue("points", reps) : NO_VALUE,
    unit: null,
    foot:
      reps !== null && points !== null
        ? t("category.personal.formula", { factor, points: formatValue("points", points) })
        : t("category.personal.factor", { factor }),
  };
}

/**
 * Your own numbers, where the podium would be (Progress) or over the filters
 * (Calisthenics): the headline value in the category's colour, then what it
 * is made of - on Progress your biggest rises, whichever exercises they were
 * in, the biggest first and framed, since the headline is that one; on
 * Calisthenics the three movements. `loading` draws the frame with the
 * numbers still to come, breathing while somebody can see it.
 */
export default function PersonalCard({ variant, me, tone, valueColor, loading = false, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { animate } = useAnimationsEnabled();
  const breath = useBreathAnimation(animate && loading, { periodMs: 1800, low: 0.55 });
  const isProgress = variant === "progress";
  const kind = isProgress ? "percent" : "points";
  let fields;

  if (!isProgress) {
    fields = POINT_MOVEMENTS.map((movement) => pointsField(me?.breakdown, movement, t));
  } else if (loading) {
    fields = Array.from({ length: PROGRESS_FIELDS }, (_, index) => loadingField(index));
  } else {
    fields = (Array.isArray(me?.breakdown) ? me.breakdown : [])
      .slice(0, PROGRESS_FIELDS)
      .map((rise, index) => progressField(rise, index, t));
  }

  const hasValue = toNumber(me?.value) !== null;
  const shape = theme.chipBackground;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: withAlpha(tone, 0.32) },
        style,
      ]}
    >
      <RadialGlow color={tone} width={220} height={180} top={-90} right={-60} centerOpacity={0.18} midOpacity={0.05} />

      <View style={styles.header}>
        <ThemedText style={styles.label} setColor={theme.quietText} numberOfLines={1}>
          {isProgress ? t("category.personal.progress") : t("category.personal.points")}
        </ThemedText>
        {loading ? (
          <Animated.View style={[styles.valueShape, { backgroundColor: shape, opacity: breath }]} />
        ) : (
          <View style={styles.valueGroup}>
            <ThemedText style={styles.value} setColor={valueColor} numberOfLines={1}>
              {formatValue(kind, me?.value)}
            </ThemedText>
            {hasValue ? (
              <ThemedText style={styles.unit} setColor={theme.quietText} numberOfLines={1}>
                {unitLabel(kind, me?.value, t)}
              </ThemedText>
            ) : null}
          </View>
        )}
      </View>

      {fields.length ? (
        <View style={styles.fields}>
          {fields.map((field, index) => {
            // The biggest rise is the one the value is about.
            const isFocused = isProgress && !loading && index === 0;

            return (
              <View
                key={field.key}
                style={[
                  styles.field,
                  {
                    backgroundColor: theme.uiBackground,
                    borderColor: isFocused ? withAlpha(tone, 0.45) : "transparent",
                  },
                ]}
              >
                <ThemedText style={styles.fieldName} setColor={theme.quietText} numberOfLines={1}>
                  {field.name}
                </ThemedText>
                {loading ? (
                  <Animated.View style={[styles.numberShape, { backgroundColor: shape, opacity: breath }]} />
                ) : (
                  <View style={styles.numberGroup}>
                    <ThemedText
                      style={styles.number}
                      setColor={theme.title}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {field.number}
                    </ThemedText>
                    {field.unit ? (
                      <ThemedText style={styles.numberUnit} setColor={theme.quietText} numberOfLines={1}>
                        {field.unit}
                      </ThemedText>
                    ) : null}
                  </View>
                )}
                <ThemedText style={styles.foot} setColor={valueColor} numberOfLines={1}>
                  {loading ? " " : field.foot ?? " "}
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
