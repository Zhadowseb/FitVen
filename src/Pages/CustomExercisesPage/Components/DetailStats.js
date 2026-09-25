import { View, useColorScheme } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import styles from "./DetailStatsStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { formatTypicalSetsReps } from "@utils/customExercises";

// What a number that is not known yet looks like.
const UNKNOWN = "–";

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/**
 * Three numbers: how many use it, how many of them train in your centre, and
 * the typical sets × reps - the answer to "how is it done" that would
 * otherwise need a text the owner had to remember to write. All three come
 * from the server, cached for a day.
 *
 * Without a centre of your own the middle one cannot be counted, and says so
 * quietly rather than showing a nought.
 */
export default function DetailStats({ stats, users = null, viewerHasGym = false, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const unknown = t("customExerciseDetail.stats.unknown");
  const userCount = finiteOrNull(stats?.users ?? users);
  const gymCount = finiteOrNull(stats?.gymUsers);
  const typical = formatTypicalSetsReps(stats?.typicalSets, stats?.typicalReps);
  const usersLabel = t("customExerciseDetail.stats.users");
  const gymLabel = t("customExerciseDetail.stats.gymUsers");
  const typicalLabel = t("customExerciseDetail.stats.typical");

  const items = [
    {
      key: "users",
      value: userCount === null ? UNKNOWN : formatNumber(userCount),
      label: usersLabel,
      accessibilityLabel:
        userCount === null
          ? `${usersLabel}: ${unknown}`
          : t("customExercises.users", { count: userCount, value: formatNumber(userCount) }),
    },
    viewerHasGym
      ? {
          key: "gym",
          value: gymCount === null ? UNKNOWN : formatNumber(gymCount),
          label: gymLabel,
          accessibilityLabel: `${gymLabel}: ${gymCount === null ? unknown : formatNumber(gymCount)}`,
        }
      : {
          key: "gym",
          value: UNKNOWN,
          label: t("customExerciseDetail.stats.noGym"),
          accessibilityLabel: t("customExerciseDetail.stats.noGymLabel"),
          quiet: true,
        },
    {
      key: "typical",
      value: typical ?? UNKNOWN,
      label: typicalLabel,
      accessibilityLabel: `${typicalLabel}: ${typical ?? unknown}`,
    },
  ];

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        style,
      ]}
    >
      {items.map((item, index) => (
        <View
          key={item.key}
          accessible
          accessibilityLabel={item.accessibilityLabel}
          style={[styles.stat, index > 0 ? [styles.statDivided, { borderLeftColor: theme.border }] : null]}
        >
          <ThemedText
            style={styles.value}
            setColor={item.quiet ? theme.quietText : theme.title}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {item.value}
          </ThemedText>
          <ThemedText style={styles.label} setColor={theme.quietText} numberOfLines={2}>
            {item.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}
