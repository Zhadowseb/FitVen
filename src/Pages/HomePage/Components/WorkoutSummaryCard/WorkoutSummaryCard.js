import { TouchableOpacity, View, useColorScheme } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import styles from "./WorkoutSummaryCardStyle";
import PostHeaderGlow from "./PostHeaderGlow";
import ProgressionBar from "./ProgressionBar";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import Star from "../../../../Resources/Icons/UI-icons/Star";
import ThreeDots from "../../../../Resources/Icons/UI-icons/ThreeDots";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import { formatTimeAgo } from "../../../../Utils/dateUtils";
import { ThemedText, UserAvatar } from "../../../../Resources/ThemedComponents";

// No tokens for these two: the gold bar gradient is specific to this card.
const GOLD_BAR_FROM = "#C98F2C";
const GOLD_BAR_TO = "#F0C868";

/** 81 min reads as "1 hour 21 min", not "81 min". */
function buildDurationParts(durationSeconds) {
  const numericValue = Number(durationSeconds);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return [{ value: "0", unit: "min" }];
  }

  const totalMinutes = Math.max(1, Math.round(numericValue / 60));

  if (totalMinutes < 60) {
    return [{ value: `${totalMinutes}`, unit: "min" }];
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [{ value: `${hours}`, unit: hours === 1 ? "hour" : "hours" }];

  if (minutes > 0) {
    parts.push({ value: `${minutes}`, unit: "min" });
  }

  return parts;
}

function normalizeNumber(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function getPersonalRecordExerciseNames(records) {
  if (!Array.isArray(records)) {
    return new Set();
  }

  return new Set(
    records
      .map((record) => record?.exerciseName ?? record?.exercise_name)
      .filter(Boolean)
      .map((name) => String(name).trim().toLowerCase()),
  );
}

function normalizeTopSet(record, personalRecordExerciseNames) {
  const exercise = String(
    record?.exerciseName ?? record?.exercise_name ?? record?.exercise ?? "",
  ).trim();
  const weight = normalizeNumber(record?.weight);
  // Posts created before the baseline shipped carry no previousBest field at
  // all. That differs from an explicit null (genuinely no history), so their
  // bars are skipped rather than drawn full.
  const hasBaseline =
    record !== null &&
    typeof record === "object" &&
    ("previousBest" in record || "previous_best" in record);
  const previousBest = normalizeNumber(
    record?.previousBest ?? record?.previous_best,
  );
  const flaggedRecord = Boolean(
    record?.personalRecord ?? record?.personal_record,
  );
  const isRecord =
    flaggedRecord ||
    personalRecordExerciseNames.has(exercise.toLowerCase()) ||
    (hasBaseline &&
      weight !== null &&
      (previousBest === null || weight >= previousBest));

  const knownRatio =
    weight !== null && previousBest !== null && previousBest > 0
      ? weight / previousBest
      : null;

  return {
    exercise,
    weightDisplay:
      record?.weightDisplay ??
      (weight !== null ? `${weight} ${record?.unit ?? "kg"}` : ""),
    reps: normalizeNumber(record?.reps),
    weight,
    hasBaseline,
    // A record with no earlier lift to measure against fills the whole track.
    // Without a baseline and without a record there is nothing honest to draw,
    // so the track stays empty rather than showing an invented ratio.
    ratio: knownRatio ?? (isRecord ? 1 : null),
    isRecord,
  };
}

export default function WorkoutSummaryCard({
  post,
  onToggleLike,
  onOpenOptions,
  onOpenComments,
  onShare,
  onPost,
  onManage,
  isLikeBusy = false,
  isPostBusy = false,
  showPostedState = false,
  showFooter = true,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  if (!post) {
    return null;
  }

  const payload = post?.payload ?? {};
  const personalRecordExerciseNames = getPersonalRecordExerciseNames(
    payload.personalRecords,
  );
  const topSets = Array.isArray(payload.topSets)
    ? payload.topSets
        .map((record) => normalizeTopSet(record, personalRecordExerciseNames))
        .filter((record) => record.exercise)
    : [];
  const prCount = topSets.filter((record) => record.isRecord).length;

  const authorName = post?.author?.displayName ?? "FitVen athlete";
  const createdAtLabel = formatTimeAgo(post?.createdAt);
  const postTitle = String(post?.title ?? "").trim();
  const workoutType = String(post?.workoutType ?? "").trim();
  const note = String(post?.body ?? "").trim();
  const showTitle =
    postTitle.length > 0 &&
    postTitle.toLowerCase() !== workoutType.toLowerCase();
  const durationParts = buildDurationParts(payload.durationSeconds);
  const setsCount = Number(payload.setsCount) || 0;
  const exerciseCount = Number(payload.exerciseCount) || 0;

  const accent = theme.primary;
  const gold = theme.planned;
  const titleColor = theme.title;
  const bodyText = theme.textStrong ?? titleColor;
  const noteColor = theme.text ?? titleColor;
  const quietText = theme.quietText ?? theme.iconColor;
  const surface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.hairline;
  const divider = withAlpha(titleColor, 0.06);
  const barTrack = withAlpha(titleColor, colorScheme === "dark" ? 0.055 : 0.07);
  const glowColor = prCount > 0 ? gold : accent;
  const likeColor = post?.isLiked ? accent : quietText;

  return (
    <View style={styles.cardWrapper}>
      <View
        style={[
          styles.card,
          { backgroundColor: surface, borderColor: cardBorder },
        ]}
      >
        <PostHeaderGlow
          color={glowColor}
          starColor={prCount > 0 ? gold : null}
          centerOpacity={colorScheme === "dark" ? 0.38 : 0.22}
          starOpacity={colorScheme === "dark" ? 0.13 : 0.1}
        />

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <UserAvatar
              uri={post.author?.avatarUrl}
              size={42}
              iconSize={21}
              iconColor={accent}
              borderColor={accent}
              borderWidth={2}
            />

            <View style={styles.headerCopy}>
              <ThemedText
                style={styles.authorName}
                setColor={titleColor}
                numberOfLines={1}
              >
                {authorName}
              </ThemedText>

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaText} setColor={quietText}>
                  {createdAtLabel}
                </ThemedText>

                {workoutType ? (
                  <>
                    <View
                      style={[styles.metaDot, { backgroundColor: quietText }]}
                    />
                    <ThemedText style={styles.workoutType} setColor={accent}>
                      {workoutType}
                    </ThemedText>
                  </>
                ) : null}
              </View>
            </View>

            {onOpenOptions ? (
              <TouchableOpacity
                style={styles.optionsButton}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Post options"
                onPress={() => onOpenOptions(post)}
              >
                <ThreeDots width={18} height={18} color={quietText} />
              </TouchableOpacity>
            ) : null}
          </View>

          {showTitle || prCount > 0 ? (
            <View style={styles.titleRow}>
              {showTitle ? (
                <ThemedText
                  style={styles.title}
                  setColor={titleColor}
                  numberOfLines={1}
                >
                  {postTitle}
                </ThemedText>
              ) : null}

              {prCount > 0 ? (
                <View
                  style={[
                    styles.prBadge,
                    {
                      backgroundColor: withAlpha(gold, 0.16),
                      borderColor: withAlpha(gold, 0.4),
                    },
                  ]}
                >
                  <Star width={11} height={11} color={gold} roundness={1} />
                  <ThemedText style={styles.prBadgeText} setColor={gold}>
                    {`${prCount} PR`}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          {note ? (
            <View style={styles.noteRow}>
              <View
                style={[
                  styles.noteRule,
                  { backgroundColor: withAlpha(accent, 0.45) },
                ]}
              />
              <ThemedText style={styles.noteText} setColor={noteColor}>
                {note}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statsGroup}>
              {durationParts.map((part) => (
                <View key={part.unit} style={styles.statsGroup}>
                  <ThemedText
                    style={styles.durationValue}
                    setColor={titleColor}
                  >
                    {part.value}
                  </ThemedText>
                  <ThemedText style={styles.statsUnit} setColor={quietText}>
                    {part.unit}
                  </ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.statsSpacer} />

            <View style={styles.statsGroup}>
              <ThemedText style={styles.volumeValue} setColor={noteColor}>
                {setsCount}
              </ThemedText>
              <ThemedText style={styles.statsUnit} setColor={quietText}>
                sets across
              </ThemedText>
              <ThemedText style={styles.volumeValue} setColor={noteColor}>
                {exerciseCount}
              </ThemedText>
              <ThemedText style={styles.statsUnit} setColor={quietText}>
                {exerciseCount === 1 ? "exercise" : "exercises"}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: divider }]} />

        {topSets.length > 0 ? (
          <>
            <View style={styles.topSetsHeader}>
              <View style={styles.starColumn} />
              <ThemedText style={styles.topSetsLabel} setColor={quietText}>
                Top sets
              </ThemedText>
              <ThemedText
                style={styles.topSetsCompareLabel}
                setColor={withAlpha(quietText, 0.8)}
              >
                vs. personal best
              </ThemedText>
            </View>

            <View style={styles.topSetsList}>
              {topSets.map((record, index) => (
                <View key={`${record.exercise}-${index}`}>
                  <View style={styles.topSetRow}>
                    <View style={styles.starColumn}>
                      {record.isRecord ? (
                        <Star
                          width={11}
                          height={11}
                          color={gold}
                          roundness={1}
                        />
                      ) : null}
                    </View>

                    <ThemedText
                      style={[
                        styles.topSetName,
                        { fontWeight: record.isRecord ? "800" : "700" },
                      ]}
                      setColor={record.isRecord ? titleColor : bodyText}
                      numberOfLines={1}
                    >
                      {record.exercise}
                    </ThemedText>

                    {record.reps !== null ? (
                      <ThemedText
                        style={styles.topSetReps}
                        setColor={quietText}
                      >
                        {`${record.reps} reps`}
                      </ThemedText>
                    ) : null}

                    <ThemedText
                      style={styles.topSetWeight}
                      setColor={record.isRecord ? gold : titleColor}
                    >
                      {record.weightDisplay}
                    </ThemedText>
                  </View>

                  <View style={styles.topSetBarSlot}>
                    <ProgressionBar
                      ratio={record.ratio}
                      isRecord={record.isRecord}
                      index={index}
                      trackColor={barTrack}
                      accentColor={accent}
                      goldFrom={GOLD_BAR_FROM}
                      goldTo={GOLD_BAR_TO}
                    />
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: divider }]} />
          </>
        ) : null}

        {showFooter ? (
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.footerAction}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={post.isLiked ? "Unlike post" : "Like post"}
              disabled={isLikeBusy}
              onPress={() => onToggleLike?.(post)}
            >
              <Feather name="heart" size={19} color={likeColor} />
              <ThemedText style={styles.footerText} setColor={likeColor}>
                {post.likeCount ?? 0}
              </ThemedText>
            </TouchableOpacity>

            {onOpenComments ? (
              <TouchableOpacity
                style={styles.footerAction}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Comments"
                onPress={() => onOpenComments(post)}
              >
                <Feather name="message-circle" size={19} color={quietText} />
                <ThemedText style={styles.footerText} setColor={quietText}>
                  {post.commentCount ?? 0}
                </ThemedText>
              </TouchableOpacity>
            ) : null}

            <View style={styles.footerSpacer} />

            {onShare ? (
              <TouchableOpacity
                style={styles.footerAction}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Share post"
                onPress={() => onShare(post)}
              >
                <Feather name="share-2" size={19} color={quietText} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      {showPostedState ? (
        <View
          style={[
            styles.postedStrip,
            {
              backgroundColor: theme.uiBackground ?? surface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.postedStripBridge,
              { backgroundColor: withAlpha(quietText, 0.45) },
            ]}
          />

          <View
            style={[
              styles.postedBadge,
              {
                backgroundColor: withAlpha(
                  post.isPosted ? theme.secondary : quietText,
                  0.14,
                ),
                borderColor: withAlpha(
                  post.isPosted ? theme.secondary : quietText,
                  0.4,
                ),
              },
            ]}
          >
            {post.isPosted ? (
              <Checkmark
                width={11}
                height={11}
                color={theme.secondary}
                thickness={3}
              />
            ) : null}
            <ThemedText
              style={styles.postedBadgeText}
              setColor={post.isPosted ? theme.secondary : quietText}
            >
              {post.isPosted ? "Posted" : "Not posted"}
            </ThemedText>
          </View>

          <View style={styles.footerSpacer} />

          {!post.isPosted && onPost ? (
            <TouchableOpacity
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityLabel="Post this workout"
              disabled={isPostBusy}
              onPress={() => onPost(post)}
              style={[
                styles.postAction,
                {
                  backgroundColor: withAlpha(accent, 0.12),
                  borderColor: withAlpha(accent, 0.5),
                  opacity: isPostBusy ? 0.6 : 1,
                },
              ]}
            >
              <ThemedText style={styles.postActionText} setColor={accent}>
                {isPostBusy ? "Posting..." : "Post"}
              </ThemedText>
            </TouchableOpacity>
          ) : null}

          {onManage ? (
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Post options"
              hitSlop={10}
              onPress={() => onManage(post)}
              style={[styles.manageButton, { borderColor: cardBorder }]}
            >
              <ThreeDots width={17} height={17} color={quietText} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
