import { ActivityIndicator, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./ExerciseRailCardStyle";
import { describeExercise, usersLabel } from "./ExerciseListRow";
import { MuscleTag } from "./ExerciseTags";
import ExerciseThumbnail from "./ExerciseThumbnail";
import { Colors } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import Plus from "@resources/Icons/UI-icons/Plus";
import { ThemedText, UserAvatar } from "@resources/ThemedComponents";
import { primaryMuscleKey } from "@utils/customExercises";

/**
 * A shared exercise on Explore's rail "New exercises from others": its
 * picture, the muscle, the name, who made it, how many use it - and "Add",
 * which takes a copy right there without opening it.
 *
 * The card opens the exercise (`onPress`). The pill calls `onAdd(item)`; the
 * screen does the adding and says how it went, and passes `isAdding` while it
 * runs. A card for your own exercise, or with no `onAdd`, has no pill.
 */
export default function ExerciseRailCard({ item, onPress, onAdd, isAdding = false, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const muscleKey = primaryMuscleKey(item.muscles);
  const users = usersLabel(item, t);
  const ownerName = item.isMine
    ? t("customExercises.you")
    : item.owner?.displayName || item.owner?.username || t("customExercises.someone");
  const showPill = !item.isMine && typeof onAdd === "function";
  const added = Boolean(item.isAdded);

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }, style]}>
      <TouchableOpacity
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={describeExercise(item, t)}
        accessibilityHint={t("customExercises.library.rowHint")}
        onPress={() => onPress?.(item)}
        style={styles.touch}
      >
        <ExerciseThumbnail
          variant="rail"
          hasVideo={item.hasVideo}
          posterUrl={item.posterUrl}
          durationMs={item.videoDurationMs}
          muscleKey={muscleKey}
        />

        <View style={styles.body}>
          <MuscleTag muscleKey={muscleKey} style={styles.tag} />
          <ThemedText style={styles.name} setColor={theme.title} numberOfLines={2}>
            {item.name}
          </ThemedText>
          <View style={styles.owner}>
            <UserAvatar uri={item.owner?.avatarUrl} size={18} iconSize={9} />
            <ThemedText style={styles.ownerName} setColor={theme.quietText} numberOfLines={1}>
              {ownerName}
            </ThemedText>
          </View>
          <View style={[styles.footer, showPill ? styles.footerWithPill : null]}>
            {users ? (
              <ThemedText style={styles.users} setColor={theme.mutedStrong} numberOfLines={1}>
                {users}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {showPill ? (
        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityLabel={
            added
              ? t("customExercises.addedA11y", { name: item.name })
              : t("customExercises.addA11y", { name: item.name })
          }
          accessibilityState={{ disabled: added || isAdding, busy: isAdding }}
          disabled={added || isAdding}
          hitSlop={8}
          onPress={() => onAdd(item)}
          style={[styles.pill, { backgroundColor: added ? theme.chipBackground : theme.primary }]}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color={theme.textInverted} />
          ) : added ? (
            <>
              <Checkmark width={12} height={12} color={theme.mutedStrong} thickness={2.6} />
              <ThemedText style={styles.pillText} setColor={theme.mutedStrong} numberOfLines={1}>
                {t("customExercises.added")}
              </ThemedText>
            </>
          ) : (
            <>
              <Plus width={12} height={12} color={theme.textInverted} thickness={2.6} />
              <ThemedText style={styles.pillText} setColor={theme.textInverted} numberOfLines={1}>
                {t("customExercises.add")}
              </ThemedText>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
