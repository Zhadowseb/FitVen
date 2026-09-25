import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import styles from "./VideoCardStyle";
import { useTranslation } from "@localization";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import CameraPlus from "@resources/Icons/UI-icons/CameraPlus";
import Play from "@resources/Icons/UI-icons/Play";
import { ThemedText } from "@resources/ThemedComponents";
import { formatVideoDuration } from "@utils/customExercises";

function BusyOverlay({ label, overPicture, theme }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={[
        styles.busy,
        {
          backgroundColor: overPicture
            ? withAlpha(Colors.dark.background, 0.62)
            : withAlpha(theme.cardBackground, 0.86),
        },
      ]}
    >
      <ActivityIndicator
        size="small"
        color={overPicture ? Colors.dark.title : theme.primaryText}
      />
      <ThemedText
        style={styles.busyText}
        setColor={overPicture ? Colors.dark.title : theme.title}
      >
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * The clip that shows the exercise. With one: its first frame (or a dark tile
 * when there is no frame - an old build made none, or the phone is offline),
 * the length, and "Change" / "Remove". Without: a dashed tile that adds one.
 *
 * It only draws and reports taps; picking, uploading and the confirmation are
 * the page's. While `busy` a spinner covers the tile and nothing here can be
 * pressed; `disabled` locks it for something else on the page.
 *
 * Props: hasVideo, durationMs, posterUrl, isPublic, maxSeconds,
 *        busy ("upload" | "remove" | null), disabled, error,
 *        onAdd(), onChange(), onRemove()
 */
export default function VideoCard({
  hasVideo = false,
  durationMs = null,
  posterUrl = null,
  isPublic = false,
  maxSeconds,
  busy = null,
  disabled = false,
  error = "",
  onAdd,
  onChange,
  onRemove,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  // `danger` is 4.4:1 as text on white; the darker red holds 4.5 there.
  const dangerInk = isLight ? theme.dangerDark : theme.danger;
  const [posterFailed, setPosterFailed] = useState(false);
  const isBusy = busy !== null;
  const isLocked = disabled || isBusy;
  const duration = formatVideoDuration(durationMs);
  const seconds = duration ? Math.max(1, Math.round(Number(durationMs) / 1000)) : null;
  const busyLabel =
    busy === "remove" ? t("myExercise.video.removing") : t("myExercise.video.uploading");
  const hint = t("myExercise.video.hint", { seconds: maxSeconds });
  const showPoster = Boolean(posterUrl) && !posterFailed;

  // A new clip has a new frame; a frame that failed before may load now.
  useEffect(() => {
    setPosterFailed(false);
  }, [posterUrl]);

  const errorLine = error ? (
    <ThemedText style={styles.error} setColor={dangerInk} accessibilityLiveRegion="polite">
      {error}
    </ThemedText>
  ) : null;

  if (!hasVideo) {
    return (
      <View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("myExercise.video.add")}
          accessibilityHint={hint}
          accessibilityState={{ disabled: isLocked, busy: isBusy }}
          activeOpacity={0.82}
          disabled={isLocked}
          onPress={onAdd}
          style={[
            styles.addTile,
            { backgroundColor: theme.cardBackground, borderColor: theme.overlayStrong },
            disabled && !isBusy ? styles.locked : null,
          ]}
        >
          <View
            style={[
              styles.addIcon,
              { backgroundColor: withAlpha(theme.primary, isLight ? 0.12 : 0.14) },
            ]}
          >
            <CameraPlus width={20} height={20} color={theme.primaryText} thickness={1.8} />
          </View>
          <ThemedText style={styles.addTitle} setColor={theme.title}>
            {t("myExercise.video.add")}
          </ThemedText>
          <ThemedText style={styles.addHint} setColor={theme.quietText}>
            {hint}
          </ThemedText>
          {isBusy ? <BusyOverlay label={busyLabel} theme={theme} /> : null}
        </TouchableOpacity>
        {errorLine}
      </View>
    );
  }

  return (
    <View>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
        ]}
      >
        <View style={styles.row}>
          {/* The picture is dark in both themes, so what sits on it comes
              from the dark palette. */}
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={
              duration
                ? t("myExercise.video.posterA11y", { duration })
                : t("myExercise.video.posterA11yNoDuration")
            }
            style={[styles.poster, { backgroundColor: Colors.dark.raisedSurface }]}
          >
            {showPoster ? (
              <Image
                source={{ uri: posterUrl }}
                resizeMode="cover"
                onError={() => setPosterFailed(true)}
                style={styles.fill}
              />
            ) : null}
            <View
              style={[
                styles.fill,
                { backgroundColor: withAlpha(Colors.dark.background, isLight ? 0.18 : 0.3) },
              ]}
            />
            <View
              style={[
                styles.play,
                {
                  backgroundColor: withAlpha(Colors.dark.background, 0.6),
                  borderColor: withAlpha(Colors.dark.title, 0.3),
                },
              ]}
            >
              <Play width={12} height={12} color={Colors.dark.title} />
            </View>
            {duration ? (
              <ThemedText
                style={[
                  styles.duration,
                  { textShadowColor: withAlpha(Colors.dark.background, 0.85) },
                ]}
                setColor={Colors.dark.title}
              >
                {duration}
              </ThemedText>
            ) : null}
            {isBusy ? <BusyOverlay label={busyLabel} overPicture theme={theme} /> : null}
          </View>

          <View style={styles.copy}>
            <ThemedText style={styles.length} setColor={theme.title}>
              {seconds !== null
                ? t("common.seconds", { count: seconds })
                : t("myExercise.video.section")}
            </ThemedText>
            <ThemedText style={styles.caption} setColor={theme.quietText}>
              {isPublic
                ? t("myExercise.video.shownOnPage")
                : t("myExercise.video.shownWhenShared")}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.actions, isLocked ? styles.locked : null]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("myExercise.video.change")}
            accessibilityState={{ disabled: isLocked }}
            activeOpacity={0.8}
            disabled={isLocked}
            onPress={onChange}
            style={[styles.action, { borderColor: theme.border }]}
          >
            <ThemedText style={styles.actionText} setColor={theme.title}>
              {t("myExercise.video.change")}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("myExercise.video.remove")}
            accessibilityState={{ disabled: isLocked }}
            activeOpacity={0.8}
            disabled={isLocked}
            onPress={onRemove}
            style={[styles.action, { borderColor: theme.border }]}
          >
            <ThemedText style={styles.actionText} setColor={dangerInk}>
              {t("myExercise.video.remove")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
      {errorLine}
    </View>
  );
}
