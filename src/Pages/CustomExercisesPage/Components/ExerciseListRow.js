import { memo } from "react";
import { Animated, TouchableOpacity, View, useColorScheme } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import styles from "./ExerciseListRowStyle";
import ExerciseTags from "./ExerciseTags";
import ExerciseThumbnail from "./ExerciseThumbnail";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText, UserAvatar } from "@resources/ThemedComponents";
import { primaryMuscleKey } from "@utils/customExercises";
import { muscleGroupLabel } from "@utils/exerciseMuscleGroups";

/** "{n} bruger": the owner plus everyone who added it. Null when unknown. */
export function usersLabel(item, t) {
  const users = Number(item?.users);

  return Number.isFinite(users) && users > 0
    ? t("customExercises.users", { count: users, value: formatNumber(users) })
    : null;
}

/** Who made it: "You" for your own, and " · your centre" when you share one. */
export function ownerLine(item, t) {
  const name = item?.isMine
    ? t("customExercises.you")
    : item?.owner?.displayName || item?.owner?.username || t("customExercises.someone");

  return item?.owner?.inYourGym ? `${name} · ${t("customExercises.yourGym")}` : name;
}

/**
 * The one sentence a screen reader says for an exercise: what it is, the
 * muscle, who made it, how many use it, and whether there is a video.
 */
export function describeExercise(item, t) {
  const muscleKey = primaryMuscleKey(item?.muscles);
  const seconds = Math.round(Number(item?.videoDurationMs) / 1000);
  const owner = item?.isMine
    ? t("customExercises.madeByYou")
    : t("customExercises.madeBy", {
        name: item?.owner?.displayName || item?.owner?.username || t("customExercises.someone"),
      });
  const video = !item?.hasVideo
    ? t("customExercises.noVideo")
    : seconds > 0
      ? t("customExercises.videoSeconds", { count: seconds, value: formatNumber(seconds) })
      : t("customExercises.withVideo");

  return [
    item?.name,
    muscleKey ? muscleGroupLabel(muscleKey, t) : null,
    owner,
    usersLabel(item, t),
    video,
    item?.isAdded ? t("customExercises.inYourExercises") : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * One exercise in the library: its picture, the name, the line that says
 * what it is, its tags and who made it. The whole row is one touch target
 * and opens the exercise.
 */
function ExerciseListRow({ item, onPress, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const users = usersLabel(item, t);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={describeExercise(item, t)}
      accessibilityHint={t("customExercises.library.rowHint")}
      onPress={() => onPress?.(item)}
      style={[styles.row, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }, style]}
    >
      <ExerciseThumbnail
        hasVideo={item.hasVideo}
        posterUrl={item.posterUrl}
        durationMs={item.videoDurationMs}
        muscleKey={primaryMuscleKey(item.muscles)}
        isAdded={item.isAdded}
      />

      <View style={styles.column}>
        <ThemedText style={styles.name} setColor={theme.title} numberOfLines={1}>
          {item.name}
        </ThemedText>

        {item.description ? (
          <ThemedText style={styles.description} setColor={theme.quietText} numberOfLines={2}>
            {item.description}
          </ThemedText>
        ) : null}

        <ExerciseTags muscles={item.muscles} equipment={item.equipment} weightMode={item.weightMode} />

        <View style={styles.owner}>
          <UserAvatar uri={item.owner?.avatarUrl} size={20} iconSize={10} />
          <ThemedText style={styles.ownerName} setColor={theme.quietText} numberOfLines={1}>
            {ownerLine(item, t)}
          </ThemedText>
          {users ? (
            <ThemedText style={styles.users} setColor={theme.mutedStrong} numberOfLines={1}>
              {users}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(ExerciseListRow);

/**
 * A row's shape while the first page loads. `opacity` is the page's one pulse
 * (an Animated value, or 1 when motion is reduced), shared by every row so
 * they breathe together.
 */
export function ExerciseListRowSkeleton({ opacity = 1, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const block = { backgroundColor: theme.overlaySoft };

  return (
    <Animated.View
      style={[
        styles.row,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder, opacity },
        style,
      ]}
    >
      <View style={[styles.skeletonThumb, block]} />
      <View style={styles.column}>
        <View style={[styles.skeletonName, block]} />
        <View style={[styles.skeletonDescription, block]} />
        <View style={styles.skeletonTags}>
          <View style={[styles.skeletonTagShort, block]} />
          <View style={[styles.skeletonTagLong, block]} />
        </View>
        <View style={styles.owner}>
          <View style={[styles.skeletonAvatar, block]} />
          <View style={[styles.skeletonOwner, block]} />
        </View>
      </View>
    </Animated.View>
  );
}
