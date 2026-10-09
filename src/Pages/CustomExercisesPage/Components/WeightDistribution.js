import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View, useColorScheme } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import styles, { BAR_AREA_HEIGHT } from "./WeightDistributionStyle";
import { useReduceMotionSetting } from "./DetailMotion";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import {
  formatBucketLabel,
  mostCommonBucketIndex,
  weightModeLabelKey,
} from "@utils/customExercises";

// A bucket nobody lifted in keeps a sliver of a bar, so a gap reads as a gap
// and not as a bar that failed to draw.
const MIN_BAR_HEIGHT = 4;
const GROW_MS = 700;
// Each bar starts a little after the one to its left and takes 60 % of the
// run, so the row fills in from left to right rather than all at once.
const STAGGER = 0.08;
const GROW_SHARE = 0.6;

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

// overlaySoft to overlayStrong by how full the bar is.
function greyFor(count, maxCount, theme) {
  const share = maxCount > 0 ? count / maxCount : 0;

  if (share > 2 / 3) {
    return theme.overlayStrong;
  }

  if (share > 1 / 3) {
    return theme.overlayMedium;
  }

  return theme.overlaySoft;
}

// "50 to 60 kg" for a screen reader, where the label under the bar says
// "50–60" and "–50" would be read out as minus fifty.
function spokenRange(bucket, t) {
  const from = finiteOrNull(bucket?.from);
  const to = finiteOrNull(bucket?.to);

  if (from === null && to !== null) {
    return t("customExerciseDetail.distribution.rangeUnder", { to: formatNumber(to) });
  }

  if (to === null && from !== null) {
    return t("customExerciseDetail.distribution.rangeOver", { from: formatNumber(from) });
  }

  if (from !== null && to !== null) {
    return t("customExerciseDetail.distribution.rangeBetween", {
      from: formatNumber(from),
      to: formatNumber(to),
    });
  }

  return "";
}

// "Per side · typically 20 kg for 10 reps", leaving out whichever half is not
// known. The weight mode says what the kilos are of.
function typicalLine({ weightMode, typicalWeightKg, typicalReps }, t) {
  const weightValue = finiteOrNull(typicalWeightKg);
  const repsValue = finiteOrNull(typicalReps);
  const weight =
    weightValue !== null && weightValue > 0
      ? formatNumber(weightValue, { maximumFractionDigits: 1 })
      : null;
  const reps = repsValue !== null && repsValue > 0 ? Math.round(repsValue) : null;
  const parts = [t(weightModeLabelKey(weightMode))];

  if (weight && reps) {
    parts.push(
      t("customExerciseDetail.distribution.typicalWeightReps", {
        count: reps,
        weight,
        reps: formatNumber(reps),
      })
    );
  } else if (weight) {
    parts.push(t("customExerciseDetail.distribution.typicalWeight", { weight }));
  } else if (reps) {
    parts.push(
      t("customExerciseDetail.distribution.typicalReps", { count: reps, reps: formatNumber(reps) })
    );
  }

  return parts.join(" · ");
}

/**
 * "What others lift": six weight buckets from every logged set on the
 * exercise and its copies, the most common one in the accent, and the
 * typical set under them. The buckets come from the server
 * (stats.buckets); under DISTRIBUTION_MIN_SETS sets there are none, and
 * then there is no section either - a spread of five sets is a guess.
 *
 * The bars grow in once, when `revealed` first turns true - the page sets it
 * when the section scrolls into view - and stand at full height straight
 * away with reduce motion on.
 */
export default function WeightDistribution({
  buckets,
  weightMode = "total",
  typicalWeightKg = null,
  typicalReps = null,
  setCount = null,
  revealed = true,
  style,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const reduceMotion = useReduceMotionSetting();
  const list = Array.isArray(buckets) ? buckets : [];
  const counts = list.map((bucket) => Math.max(0, finiteOrNull(bucket?.count) ?? 0));
  const maxCount = counts.reduce((max, count) => Math.max(max, count), 0);
  const topIndex = mostCommonBucketIndex(list);
  const progress = useRef(new Animated.Value(0)).current;
  const hasGrownRef = useRef(false);
  const barCount = list.length;
  const scales = useMemo(
    () =>
      Array.from({ length: barCount }, (_, index) => {
        const start = Math.min(index * STAGGER, 1 - GROW_SHARE);

        return progress.interpolate({
          inputRange: [start, start + GROW_SHARE],
          outputRange: [0, 1],
          extrapolate: "clamp",
        });
      }),
    [barCount, progress]
  );

  useEffect(() => {
    if (!revealed || reduceMotion === null) {
      return;
    }

    if (reduceMotion) {
      progress.stopAnimation();
      progress.setValue(1);
      hasGrownRef.current = true;
      return;
    }

    if (hasGrownRef.current) {
      return;
    }

    hasGrownRef.current = true;
    Animated.timing(progress, {
      toValue: 1,
      duration: GROW_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion, revealed]);

  useEffect(() => () => progress.stopAnimation(), [progress]);

  if (barCount === 0) {
    return null;
  }

  const total =
    finiteOrNull(setCount) ?? counts.reduce((sum, count) => sum + count, 0);
  const range = topIndex >= 0 ? spokenRange(list[topIndex], t) : "";
  const summary = range
    ? t("customExerciseDetail.distribution.summary", {
        count: total,
        sets: formatNumber(total),
        range,
      })
    : t("customExerciseDetail.distribution.title");
  const footnote = typicalLine({ weightMode, typicalWeightKg, typicalReps }, t);

  return (
    <View style={style}>
      <ThemedText style={styles.eyebrow} setColor={theme.quietText} accessibilityRole="header">
        {t("customExerciseDetail.distribution.title")}
      </ThemedText>

      <View accessible accessibilityRole="image" accessibilityLabel={summary}>
        <View style={styles.bars}>
          {list.map((bucket, index) => (
            <View key={index} style={styles.slot}>
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height:
                      maxCount > 0
                        ? Math.max(MIN_BAR_HEIGHT, Math.round((counts[index] / maxCount) * BAR_AREA_HEIGHT))
                        : MIN_BAR_HEIGHT,
                    backgroundColor:
                      index === topIndex ? theme.primary : greyFor(counts[index], maxCount, theme),
                    transform: [{ scaleY: scales[index] }],
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.labels}>
          {list.map((bucket, index) => (
            <ThemedText
              key={index}
              style={styles.label}
              setColor={theme.quietText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {formatBucketLabel(bucket, formatNumber)}
            </ThemedText>
          ))}
        </View>
      </View>

      {footnote ? (
        <ThemedText style={styles.footnote} setColor={theme.quietText}>
          {footnote}
        </ThemedText>
      ) : null}
    </View>
  );
}
