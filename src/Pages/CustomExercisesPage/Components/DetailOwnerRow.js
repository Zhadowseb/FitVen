import { TouchableOpacity, View, useColorScheme } from "react-native";
import { formatDate, useTranslation } from "@localization";

import styles from "./DetailOwnerRowStyle";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText, UserAvatar } from "@resources/ThemedComponents";

// 30 dp high, 44 dp to the finger.
const PROFILE_HIT_SLOP = { top: 7, bottom: 7, left: 6, right: 6 };

// "12 Sept" this year, "12 Sept 2025" before it, in the app's language.
function formatMadeOn(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const thisYear = date.getFullYear() === new Date().getFullYear();

  return formatDate(
    date,
    thisYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }
  );
}

/**
 * Who made the exercise, when, and where they train - "your centre" when it
 * is the viewer's own - with a way to their profile. Your own exercise says
 * "You" and has no profile button: that is where you already are.
 */
export default function DetailOwnerRow({
  owner,
  isMine = false,
  createdAt = null,
  ownerGymName = null,
  onOpenProfile,
  style,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const displayName = owner?.displayName || owner?.username || t("customExerciseDetail.owner.someone");
  const name = isMine ? t("customExercises.you") : displayName;
  const date = formatMadeOn(createdAt);
  const centre = owner?.inYourGym ? t("customExercises.yourGym") : ownerGymName;
  const meta = [date ? t("customExerciseDetail.owner.madeOn", { date }) : null, centre || null]
    .filter(Boolean)
    .join(" · ");
  const canOpenProfile = !isMine && Boolean(owner?.id) && typeof onOpenProfile === "function";

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        style,
      ]}
    >
      <UserAvatar uri={owner?.avatarUrl ?? null} size={34} iconSize={16} />

      <View style={styles.copy}>
        <ThemedText style={styles.name} setColor={theme.title} numberOfLines={1}>
          {name}
        </ThemedText>
        {meta ? (
          <ThemedText style={styles.meta} setColor={theme.quietText} numberOfLines={2}>
            {meta}
          </ThemedText>
        ) : null}
      </View>

      {canOpenProfile ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("customExerciseDetail.owner.openProfile", { name: displayName })}
          activeOpacity={0.8}
          hitSlop={PROFILE_HIT_SLOP}
          onPress={onOpenProfile}
          style={[styles.profileButton, { backgroundColor: theme.chipBackground }]}
        >
          <ThemedText style={styles.profileButtonText} setColor={theme.title} numberOfLines={1}>
            {t("customExerciseDetail.owner.profile")}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
