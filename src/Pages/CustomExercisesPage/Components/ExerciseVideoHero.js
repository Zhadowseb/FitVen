import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { useEvent } from "expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTranslation } from "@localization";

import styles, { NO_VIDEO_HERO_HEIGHT, VIDEO_HERO_HEIGHT } from "./ExerciseVideoHeroStyle";
import DetailTopBar from "./DetailTopBar";
import { useReduceMotionSetting } from "./DetailMotion";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import CameraOff from "@resources/Icons/UI-icons/CameraOff";
import Play from "@resources/Icons/UI-icons/Play";
import { ThemedText } from "@resources/ThemedComponents";
import { equipmentLabelKey, weightModeLabelKey } from "@utils/customExercises";
import { muscleGroupLabel } from "@utils/exerciseMuscleGroups";

export { NO_VIDEO_HERO_HEIGHT, VIDEO_HERO_HEIGHT };

// If the player never says it has drawn its first frame, the poster still
// steps aside this long after playback began.
const FIRST_FRAME_FALLBACK_MS = 700;

// expo-video throws at import time on a client built before it was added.
// Loaded on demand, as in LiftVerificationSheet: an old build then shows the
// poster instead of taking the whole app down at startup.
let videoModule;

function getVideoModule() {
  if (videoModule === undefined) {
    try {
      videoModule = require("expo-video");
    } catch (error) {
      console.warn("Video playback is unavailable in this build:", error?.message ?? error);
      videoModule = null;
    }
  }

  return videoModule;
}

/** Whether the exercise gets the 270 dp clip at the top, or the 150 dp block. */
export function heroHasVideo(exercise) {
  return Boolean(exercise?.hasVideo || exercise?.videoUrl);
}

export function heroHeightFor(exercise) {
  return heroHasVideo(exercise) ? VIDEO_HERO_HEIGHT : NO_VIDEO_HERO_HEIGHT;
}

let gradientInstanceCounter = 0;

// Spec §4 and §9: dark at the top for the buttons, clear through the middle,
// dark again low down, and the page's own colour at the bottom edge, so the
// clip melts into the page in either theme. The first three stops are the
// dark background on purpose - the clip is dark in both themes.
function HeroGradient({ pageColor }) {
  // Ids are global in the SVG runtime; one per mounted gradient.
  const gradientId = useRef(`exercise-hero-gradient-${++gradientInstanceCounter}`).current;
  const veil = Colors.dark.background;

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={veil} stopOpacity={0.55} />
          <Stop offset="0.35" stopColor={veil} stopOpacity={0.1} />
          <Stop offset="0.82" stopColor={veil} stopOpacity={0.65} />
          <Stop offset="1" stopColor={pageColor} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

function Poster({ uri }) {
  if (!uri) {
    return null;
  }

  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    />
  );
}

function VideoNote({ text }) {
  return (
    <View style={[styles.note, { backgroundColor: withAlpha(Colors.dark.background, 0.6) }]}>
      <ThemedText style={styles.noteText} setColor={Colors.dark.title} numberOfLines={2}>
        {text}
      </ThemedText>
    </View>
  );
}

function PlayButton() {
  return (
    <View
      style={[
        styles.playButton,
        {
          backgroundColor: withAlpha(Colors.dark.background, 0.6),
          borderColor: withAlpha(Colors.dark.title, 0.3),
        },
      ]}
    >
      <Play width={22} height={22} color={Colors.dark.title} />
    </View>
  );
}

// The clip itself: muted, looping, tap to pause. Its own component so the
// player is created with the clip and released with it - useVideoPlayer does
// the releasing on unmount. Rendered only when expo-video is in the build;
// the hooks below come from that module.
function PlayingVideo({ video, uri, posterUrl, active, pageColor }) {
  const { t } = useTranslation();
  const { VideoView, useVideoPlayer } = video;
  const reduceMotion = useReduceMotionSetting();
  // null until reduce motion has answered: then it plays by itself, or waits
  // for a tap. After that, the last tap decides.
  const [wantsToPlay, setWantsToPlay] = useState(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [frameShown, setFrameShown] = useState(false);
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const failed = status === "error";

  useEffect(() => {
    if (wantsToPlay === null && reduceMotion !== null) {
      setWantsToPlay(!reduceMotion);
    }
  }, [reduceMotion, wantsToPlay]);

  // Plays only while somebody can see it: the screen in focus, the app in the
  // foreground and the clip on screen - `active` is all three.
  useEffect(() => {
    try {
      if (wantsToPlay && active && !failed) {
        player.play();
      } else {
        player.pause();
      }
    } catch (error) {
      // A player already released - the screen is on its way out.
    }
  }, [active, failed, player, wantsToPlay]);

  useEffect(() => {
    if (isPlaying) {
      setHasPlayed(true);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!hasPlayed || frameShown) {
      return undefined;
    }

    const timer = setTimeout(() => setFrameShown(true), FIRST_FRAME_FALLBACK_MS);

    return () => clearTimeout(timer);
  }, [frameShown, hasPlayed]);

  // The poster covers the player until the clip has played and drawn a frame:
  // over a player still loading, and with reduce motion until the first tap.
  const showPoster = failed || !(hasPlayed && frameShown);
  const showPlayButton = !failed && wantsToPlay === false;
  const showSpinner = !failed && wantsToPlay === true && active && !isPlaying;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        wantsToPlay ? t("customExerciseDetail.video.pause") : t("customExerciseDetail.video.play")
      }
      accessibilityState={{ disabled: failed }}
      disabled={failed || wantsToPlay === null}
      onPress={() => setWantsToPlay((current) => !current)}
      style={[styles.frame, { backgroundColor: Colors.dark.cardBackground }]}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        // Inside a scroll view: a TextureView moves, clips and stretches with
        // the page on Android, where a SurfaceView can lag behind it.
        surfaceType="textureView"
        onFirstFrameRender={() => setFrameShown(true)}
      />

      {showPoster ? <Poster uri={posterUrl} /> : null}

      <HeroGradient pageColor={pageColor} />

      <View pointerEvents="none" style={styles.center}>
        {failed ? (
          <VideoNote text={t("customExerciseDetail.video.unavailable")} />
        ) : showPlayButton ? (
          <PlayButton />
        ) : showSpinner ? (
          <ActivityIndicator color={Colors.dark.title} />
        ) : null}
      </View>
    </Pressable>
  );
}

// The 270 dp frame. Without expo-video in the build, or without an address for
// the clip, it holds the poster and says why nothing plays.
function VideoFrame({ videoUrl, posterUrl, active, pageColor }) {
  // Before the early return, so the hook order is the same on every render.
  const { t } = useTranslation();
  const video = getVideoModule();

  if (video && videoUrl) {
    return (
      <PlayingVideo
        video={video}
        uri={videoUrl}
        posterUrl={posterUrl}
        active={active}
        pageColor={pageColor}
      />
    );
  }

  return (
    <View style={[styles.frame, { backgroundColor: Colors.dark.cardBackground }]}>
      <Poster uri={posterUrl} />
      <HeroGradient pageColor={pageColor} />
      <View pointerEvents="none" style={styles.center}>
        <VideoNote
          text={
            video
              ? t("customExerciseDetail.video.unavailable")
              : t("customExerciseDetail.video.needsUpdate")
          }
        />
      </View>
    </View>
  );
}

/**
 * The top of one shared exercise: the clip that shows how it is done, full
 * bleed under the status bar - or, without one, a quiet block that says so -
 * then the name and the tags, and back and the menu over it all.
 *
 * `active` is whether the clip may play right now; the page turns it off when
 * the screen loses focus, the app goes to the background or the clip has
 * scrolled away.
 */
export default function ExerciseVideoHero({
  name,
  hasVideo = false,
  videoUrl = null,
  posterUrl = null,
  muscleKey = null,
  equipment = null,
  weightMode = null,
  active = true,
  onBack,
  onMenu = null,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const withVideo = heroHasVideo({ hasVideo, videoUrl });
  const equipmentKey = equipmentLabelKey(equipment);
  const tags = [
    muscleKey ? { key: "muscle", label: muscleGroupLabel(muscleKey, t) } : null,
    equipmentKey ? { key: "equipment", label: t(equipmentKey) } : null,
    weightMode ? { key: "weightMode", label: t(weightModeLabelKey(weightMode)) } : null,
  ].filter(Boolean);
  // The muscle tag is the accent. On dark it is the accent at 16 % with a
  // 35 % edge. On light the 16 % tint pulls primaryText under 4.5:1 (4.3 for
  // Ember, 4.1 for Volt), so there it sits on the card's white instead - 5.3
  // or better for every accent - and keeps the edge.
  const muscleTagColors =
    colorScheme === "light"
      ? { backgroundColor: theme.cardBackground, borderColor: withAlpha(theme.primary, 0.35) }
      : {
          backgroundColor: withAlpha(theme.primary, 0.16),
          borderColor: withAlpha(theme.primary, 0.35),
        };
  // The name and the tags sit on the page, under the clip rather than over
  // it, so the other tags are the plain surface's in both variants.
  const plainTagColors = { backgroundColor: theme.chipBackground, borderColor: "transparent" };

  return (
    <View>
      <View
        pointerEvents="none"
        style={[
          styles.overscroll,
          { backgroundColor: withVideo ? Colors.dark.background : theme.cardBackground },
        ]}
      />

      {withVideo ? (
        <VideoFrame
          videoUrl={videoUrl}
          posterUrl={posterUrl}
          active={active}
          pageColor={theme.background}
        />
      ) : (
        <View
          style={[
            styles.block,
            {
              paddingTop: insets.top,
              backgroundColor: theme.cardBackground,
              borderBottomColor: theme.cardBorder,
            },
          ]}
        >
          <CameraOff width={24} height={24} color={theme.quietText} />
          <ThemedText style={styles.blockLabel} setColor={theme.quietText}>
            {t("customExercises.noVideo")}
          </ThemedText>
        </View>
      )}

      <DetailTopBar
        surface={withVideo ? "video" : "block"}
        onBack={onBack}
        onMenu={onMenu}
        style={[styles.topBar, { top: insets.top + 8 }]}
      />

      <View style={[styles.titleBlock, withVideo ? styles.titleBlockAtVideo : styles.titleBlockOnSurface]}>
        <ThemedText style={styles.name} setColor={theme.title} accessibilityRole="header">
          {name}
        </ThemedText>

        {tags.length > 0 ? (
          <View style={styles.tags}>
            {tags.map((tag) => {
              const isMuscle = tag.key === "muscle";

              return (
                <View key={tag.key} style={[styles.tag, isMuscle ? muscleTagColors : plainTagColors]}>
                  <ThemedText
                    style={styles.tagText}
                    setColor={isMuscle ? theme.primaryText : theme.mutedStrong}
                    numberOfLines={1}
                  >
                    {tag.label}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}
