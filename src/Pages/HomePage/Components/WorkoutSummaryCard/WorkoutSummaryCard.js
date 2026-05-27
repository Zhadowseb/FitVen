import { TouchableOpacity, View, useColorScheme } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import styles from "./WorkoutSummaryCardStyle";
import PrIcon from "../../../../Resources/Icons/UI-icons/PR";
import ThreeDots from "../../../../Resources/Icons/UI-icons/ThreeDots";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import {
  ThemedText,
  ThemedTitle,
  UserAvatar,
} from "../../../../Resources/ThemedComponents";

function formatTimeAgo(value) {
  const timestamp = value ? new Date(value).getTime() : NaN;

  if (!Number.isFinite(timestamp)) {
    return "Just now";
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (elapsedSeconds < 60) {
    return "Just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatDurationMinutes(durationSeconds) {
  const numericValue = Number(durationSeconds);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return "0";
  }

  return `${Math.max(1, Math.round(numericValue / 60))}`;
}

function resolveSummaryStats(payload) {
  return [
    {
      label: "Duration",
      value: formatDurationMinutes(payload?.durationSeconds),
      unit: "min",
    },
    { label: "Sets", value: `${Number(payload?.setsCount) || 0}` },
    { label: "Exercises", value: `${Number(payload?.exerciseCount) || 0}` },
  ];
}

function normalizeTopSet(record) {
  return {
    exercise:
      record?.exerciseName ?? record?.exercise_name ?? record?.exercise ?? "",
    weight:
      record?.weightDisplay ??
      (record?.weight ? `${record.weight} ${record.unit ?? "kg"}` : ""),
    reps: `${record?.reps ?? ""}`,
    personalRecord: Boolean(record?.personalRecord ?? record?.personal_record),
  };
}

function getPersonalRecordExerciseNames(records) {
  if (!Array.isArray(records)) {
    return new Set();
  }

  return new Set(
    records
      .map((record) => record?.exerciseName ?? record?.exercise_name)
      .filter(Boolean)
  );
}

export default function WorkoutSummaryCard({
  post,
  onToggleLike,
  onOpenOptions,
  isLikeBusy = false,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const payload = post?.payload ?? {};
  const summaryStats = resolveSummaryStats(payload);
  const personalRecordExerciseNames = getPersonalRecordExerciseNames(
    payload.personalRecords
  );
  const topSets = Array.isArray(payload.topSets)
    ? payload.topSets
        .map(normalizeTopSet)
        .filter((record) => record.exercise)
        .map((record) => ({
          ...record,
          personalRecord:
            record.personalRecord || personalRecordExerciseNames.has(record.exercise),
        }))
    : [];
  const authorName = post?.author?.displayName ?? "FitVen athlete";
  const createdAtLabel = formatTimeAgo(post?.createdAt);
  const postTitle = String(post?.title ?? "").trim();
  const workoutType = String(post?.workoutType ?? "").trim();
  const note = String(post?.body ?? "").trim();
  const showTitle =
    postTitle.length > 0 &&
    postTitle.toLowerCase() !== workoutType.toLowerCase();
  const accent = theme.primary ?? "#f7742e";
  const quietText = theme.iconColor ?? "#8795ad";
  const mutedText = "#8392b0";
  const titleColor = theme.title ?? "#ffffff";
  const surface = theme.cardBackground ?? theme.background;
  const insetSurface = colorScheme === "dark" ? "#181d27" : "#ffffff";
  const softBorder =
    colorScheme === "dark"
      ? "rgba(132, 145, 166, 0.16)"
      : "rgba(40, 37, 58, 0.14)";
  const prYellow = colorScheme === "dark" ? "#ffd21f" : "#d99b00";
  const topSetTableSurface =
    colorScheme === "dark" ? "rgba(16, 17, 24, 0.58)" : "#f5f4fa";
  const topSetTableBorder =
    colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.07)"
      : "rgba(32, 30, 43, 0.12)";
  const footerColor = colorScheme === "dark" ? "#7f90ad" : theme.iconColor;
  const likeColor = post?.isLiked ? accent : footerColor;

  if (!post) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor: softBorder,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <UserAvatar
          uri={post.author?.avatarUrl}
          size={50}
          iconSize={25}
          iconColor={accent}
          backgroundColor={insetSurface}
          borderColor={accent}
          borderWidth={2}
        />

        <View style={styles.headerCopy}>
          <ThemedText style={styles.authorName} setColor={titleColor}>
            {authorName}
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaText} setColor={mutedText}>
              {createdAtLabel}
            </ThemedText>
          </View>
        </View>

        {onOpenOptions ? (
          <TouchableOpacity
            style={styles.optionsButton}
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => onOpenOptions(post)}
          >
            <ThreeDots width={18} height={18} color={quietText} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showTitle ? (
        <ThemedTitle type="h3" style={[styles.title, { color: titleColor }]}>
          {postTitle}
        </ThemedTitle>
      ) : null}

      {note ? (
        <ThemedText
          style={[
            styles.description,
            !showTitle ? styles.descriptionWithoutTitle : null,
          ]}
          setColor={mutedText}
        >
          {note}
        </ThemedText>
      ) : null}

      <View style={[styles.statsPanel, { borderColor: softBorder }]}>
        {summaryStats.map((stat, index) => (
          <View
            key={stat.label}
            style={[
              styles.statItem,
              index > 0 ? { borderLeftColor: softBorder, borderLeftWidth: 1 } : null,
            ]}
          >
            <ThemedText style={styles.statLabel} setColor={mutedText}>
              {stat.label}
            </ThemedText>
            <View style={styles.statValueRow}>
              <ThemedText style={styles.statValue} setColor={titleColor}>
                {stat.value}
              </ThemedText>
              {stat.unit ? (
                <ThemedText style={styles.statUnit} setColor={mutedText}>
                  {stat.unit}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {topSets.length > 0 ? (
        <>
          <ThemedText style={styles.topSetsTitle} setColor={mutedText}>
            Top sets
          </ThemedText>

          <View
            style={[
              styles.topSetsPanel,
              {
                backgroundColor: topSetTableSurface,
                borderColor: topSetTableBorder,
              },
            ]}
          >
            <View
              style={[
                styles.topSetTableHeader,
                { borderBottomColor: topSetTableBorder },
              ]}
            >
              <View
                style={[
                  styles.topSetExerciseCell,
                  styles.topSetHeaderCell,
                  styles.topSetExerciseHeaderCell,
                ]}
              >
                <ThemedText style={styles.topSetHeaderText} setColor={mutedText}>
                  Exercise
                </ThemedText>
              </View>
              <View style={[styles.topSetMetricCell, styles.topSetHeaderCell]}>
                <ThemedText style={styles.topSetHeaderText} setColor={mutedText}>
                  Reps
                </ThemedText>
              </View>
              <View style={[styles.topSetMetricCell, styles.topSetHeaderCell]}>
                <ThemedText style={styles.topSetHeaderText} setColor={mutedText}>
                  Weight
                </ThemedText>
              </View>
            </View>

            {topSets.map((record, rowIndex) => (
              <View
                key={`${record.exercise}-${rowIndex}`}
                style={[
                  styles.topSetTableRow,
                  {
                    borderBottomColor: topSetTableBorder,
                  },
                  rowIndex === topSets.length - 1 && styles.topSetLastRow,
                ]}
              >
                <View style={[styles.topSetExerciseCell, styles.topSetCell]}>
                  <View style={styles.topSetExerciseContent}>
                    <ThemedText
                      style={styles.topSetExerciseText}
                      setColor={titleColor}
                      numberOfLines={1}
                    >
                      {record.exercise}
                    </ThemedText>
                    {record.personalRecord ? (
                      <PrIcon
                        width={16}
                        height={16}
                        stroke={prYellow}
                        color={prYellow}
                      />
                    ) : null}
                  </View>
                </View>
                <View style={[styles.topSetMetricCell, styles.topSetCell]}>
                  <ThemedText style={styles.topSetValueText} setColor={titleColor}>
                    {record.reps}
                  </ThemedText>
                </View>
                <View style={[styles.topSetMetricCell, styles.topSetCell]}>
                  <ThemedText style={styles.topSetValueText} setColor={titleColor}>
                    {record.weight}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={[styles.footerRow, { borderTopColor: softBorder }]}>
        <TouchableOpacity
          style={styles.footerAction}
          activeOpacity={0.75}
          disabled={isLikeBusy}
          onPress={() => onToggleLike?.(post)}
        >
          <Feather name="heart" size={19} color={likeColor} />
          <ThemedText style={styles.footerText} setColor={likeColor}>
            {post.likeCount ?? 0}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}
