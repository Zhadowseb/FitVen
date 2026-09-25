import { useEffect, useState } from "react";
import { Image, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./ExerciseThumbnailStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import CameraOff from "@resources/Icons/UI-icons/CameraOff";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import Play from "@resources/Icons/UI-icons/Play";
import { ThemedText } from "@resources/ThemedComponents";
import { formatVideoDuration, muscleToneToken } from "@utils/customExercises";

/**
 * The picture of a shared exercise: its video's first frame under a veil, a
 * play button and the length - or, without a video, a tile that says so, so
 * the difference shows without opening it.
 *
 * `variant` "row" is the 86 dp square in the library; "rail" fills the top of
 * a card on Explore. A video without a poster (made on a build that could not
 * take one, or a signed link that has run out) gets a dark tile in the
 * muscle's tone with the same play button, rather than nothing.
 *
 * A frame is dark in both themes, so what sits on it - the veil, the button,
 * the length - comes from the dark palette whichever theme is showing.
 */
export default function ExerciseThumbnail({
  hasVideo = false,
  posterUrl = null,
  durationMs = null,
  muscleKey = null,
  isAdded = false,
  variant = "row",
  style,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  const isRail = variant === "rail";
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    setPosterFailed(false);
  }, [posterUrl]);

  const toneToken = muscleToneToken(muscleKey);
  const box = isRail ? styles.rail : styles.row;
  const badge = isAdded && !isRail ? (
    <View style={[styles.badge, { backgroundColor: theme.secondary, borderColor: theme.cardBackground }]}>
      <Checkmark width={11} height={11} color={theme.inkOnSecondary} thickness={3} />
    </View>
  ) : null;

  if (!hasVideo) {
    if (isRail) {
      const tone = theme[toneToken] ?? theme.quietText;

      return (
        <View style={[box, { backgroundColor: withAlpha(tone, isLight ? 0.1 : 0.12) }, style]}>
          <CameraOff width={22} height={22} color={tone} />
          <ThemedText style={styles.railNoVideo} setColor={tone} numberOfLines={1}>
            {t("customExercises.noVideo")}
          </ThemedText>
        </View>
      );
    }

    return (
      <View
        style={[
          box,
          styles.dashed,
          { backgroundColor: theme.chipBackground, borderColor: theme.border },
          style,
        ]}
      >
        <CameraOff width={20} height={20} color={theme.quietText} />
        <ThemedText style={styles.noVideo} setColor={theme.quietText} numberOfLines={2}>
          {t("customExercises.noVideo")}
        </ThemedText>
        {badge}
      </View>
    );
  }

  const duration = formatVideoDuration(durationMs);
  const showPoster = Boolean(posterUrl) && !posterFailed;
  const ink = Colors.dark.title;

  return (
    <View style={[box, { backgroundColor: Colors.dark.raisedSurface }, style]}>
      {showPoster ? (
        <>
          <Image
            source={{ uri: posterUrl }}
            style={styles.fill}
            resizeMode="cover"
            onError={() => setPosterFailed(true)}
          />
          <View
            style={[styles.fill, { backgroundColor: withAlpha(Colors.dark.background, isLight ? 0.18 : 0.3) }]}
          />
        </>
      ) : (
        <View style={[styles.fill, { backgroundColor: withAlpha(Colors.dark[toneToken] ?? Colors.dark.music, 0.26) }]} />
      )}

      <View
        style={[
          isRail ? styles.playLarge : styles.play,
          {
            backgroundColor: withAlpha(Colors.dark.background, 0.72),
            borderColor: withAlpha(ink, 0.24),
          },
        ]}
      >
        <Play width={isRail ? 14 : 11} height={isRail ? 14 : 11} color={ink} />
      </View>

      {duration && isRail ? (
        <View style={[styles.durationPill, { backgroundColor: withAlpha(Colors.dark.background, 0.8) }]}>
          <ThemedText style={styles.durationPillText} setColor={ink}>
            {duration}
          </ThemedText>
        </View>
      ) : null}

      {duration && !isRail ? (
        <ThemedText
          style={[styles.duration, { textShadowColor: withAlpha(Colors.dark.background, 0.9) }]}
          setColor={ink}
        >
          {duration}
        </ThemedText>
      ) : null}

      {badge}
    </View>
  );
}
