import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useEvent } from "expo";
import { formatDate, formatTime, useTranslation } from "@localization";

import { useAuth } from "../../../Contexts/AuthContext";
import { gymService } from "../../../Services";
import { Colors, withAlpha } from "../../GlobalStyling/colors";
import Checkmark from "../../Icons/UI-icons/Checkmark";
import Cross from "../../Icons/UI-icons/Cross";
import MapPin from "../../Icons/UI-icons/MapPin";
import { ThemedBottomSheet, ThemedText, UserAvatar } from "../../ThemedComponents";
import { APPROVALS_REQUIRED, REJECTIONS_TO_REMOVE, formatWeightKg } from "../../../Utils/gymUtils";

// expo-video throws at import time on a client built before it was added.
// Loaded on demand: the sheet then shows the lift without its video instead
// of taking the whole app down at startup.
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

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = formatDate(value, { day: "numeric", month: "short" });

  return date ? `${date} ${formatTime(value, { hour: "2-digit", minute: "2-digit" })}` : "";
}

function formatClock(seconds) {
  const whole = Math.max(0, Math.floor(Number(seconds) || 0));

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function LiftVideoUnavailable({ theme, message }) {
  return (
    <View style={[styles.video, styles.videoMissing, { backgroundColor: theme.uiBackground }]}>
      <ThemedText style={styles.videoMissingText} setColor={theme.quietText}>
        {message}
      </ThemedText>
    </View>
  );
}

// The video itself: autoplay, muted, looping, tap to pause. Its own component
// so the player is created per lift and torn down with it. Rendered only when
// expo-video is in the build; the hooks below come from that module.
function LiftVideo({ uri, overlayLabel, theme }) {
  // Before the early return, so the hook order is the same on every render of
  // a given build - getVideoModule() answers the same thing for the life of
  // the app.
  const { t } = useTranslation();
  const video = getVideoModule();

  if (!video) {
    return (
      <LiftVideoUnavailable
        theme={theme}
        message={t("gyms.review.videoNeedsBuild")}
      />
    );
  }

  return <NativeLiftVideo video={video} uri={uri} overlayLabel={overlayLabel} theme={theme} />;
}

function NativeLiftVideo({ video, uri, overlayLabel, theme }) {
  const { t } = useTranslation();
  const { VideoView, useVideoPlayer } = video;
  const player = useVideoPlayer(uri ? { uri } : null, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.timeUpdateEventInterval = 0.25;
    instance.play();
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  const { currentTime } = useEvent(player, "timeUpdate", {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });
  const duration = player.duration || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <Pressable
      onPress={() => (isPlaying ? player.pause() : player.play())}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? t("gyms.review.pauseVideo") : t("gyms.review.playVideo")}
      style={[styles.video, { backgroundColor: theme.uiBackground }]}
    >
      {uri ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.videoMissing]}>
          <ThemedText style={styles.videoMissingText} setColor={theme.quietText}>
            {t("gyms.review.videoUnavailable")}
          </ThemedText>
        </View>
      )}

      {overlayLabel ? (
        <View style={styles.videoPill}>
          <MapPin width={11} height={11} color="#FFFFFF" thickness={2.4} />
          <ThemedText style={styles.videoPillText} setColor="#FFFFFF" numberOfLines={1}>
            {overlayLabel}
          </ThemedText>
        </View>
      ) : null}

      <ThemedText style={styles.videoDuration} setColor="#C4C7CF">
        {formatClock(duration)}
      </ThemedText>

      <View style={styles.videoProgressTrack}>
        <View style={[styles.videoProgressFill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]} />
      </View>
    </Pressable>
  );
}

/**
 * The review sheet: one pending lift at a time from the centre's queue,
 * approve or reject (with a reason), skip, and the next slides in. Opened
 * from a pending row in the list or from the "waiting for review" line on the
 * centre overview. When `ownLift` is passed the sheet shows the viewer's own
 * pending lift without buttons.
 */
export default function LiftVerificationSheet({
  visible,
  onClose,
  gymId,
  initialLiftId = null,
  ownLift = null,
  onVoted,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isVoting, setIsVoting] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [finishedMessage, setFinishedMessage] = useState("");
  const recordColor = theme.record;

  const loadQueue = useCallback(async () => {
    if (!visible || !gymId || ownLift) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setFinishedMessage("");

    try {
      const lifts = await gymService.getVerificationQueue({ gymId });
      const startIndex = initialLiftId
        ? Math.max(0, lifts.findIndex((lift) => lift.liftId === initialLiftId))
        : 0;

      setQueue(lifts);
      setIndex(startIndex);
      setShowReasons(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("gyms.review.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [gymId, initialLiftId, ownLift, t, visible]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!visible) {
      setQueue([]);
      setIndex(0);
      setShowReasons(false);
      setFinishedMessage("");
    }
  }, [visible]);

  const current = ownLift ?? queue[index] ?? null;
  const total = ownLift ? 1 : queue.length;
  const canVote = Boolean(current && !ownLift && current.canVote && user?.id);
  const missing = Math.max(0, APPROVALS_REQUIRED - (current?.approvals ?? 0));
  const segments = useMemo(
    () => Array.from({ length: APPROVALS_REQUIRED }, (_, position) => position < (current?.approvals ?? 0)),
    [current?.approvals]
  );

  const advance = () => {
    setShowReasons(false);

    if (index + 1 < queue.length) {
      setIndex(index + 1);
      return;
    }

    setFinishedMessage(t("gyms.review.allSeen"));
    setTimeout(() => onClose?.(), 900);
  };

  const submitVote = async ({ approve, reason = null }) => {
    if (!current || !user?.id || isVoting) {
      return;
    }

    setIsVoting(true);
    setErrorMessage("");

    try {
      await gymService.voteOnLift({ userId: user.id, liftId: current.liftId, approve, reason });
      onVoted?.({ liftId: current.liftId, approve });
      advance();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("gyms.review.voteFailed"));
    } finally {
      setIsVoting(false);
    }
  };

  const overlayLabel = current
    ? [current.gym?.shortName, formatDateTime(current.videoUploadedAt ?? current.performedAt)]
        .filter(Boolean)
        .join(" · ")
    : "";
  const metaParts = current
    ? [
        current.previousWeightKg !== null && current.previousWeightKg !== undefined
          ? t("gyms.review.fromPrevious", {
              previous: formatWeightKg(current.previousWeightKg),
              gain: formatWeightKg(current.weightKg - current.previousWeightKg),
            })
          : null,
        current.rankIfVerified ? t("gyms.review.becomesRank", { rank: current.rankIfVerified }) : null,
      ].filter(Boolean)
    : [];

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Cross width={24} height={24} color="#C4C7CF" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.eyebrow} setColor={theme.primary}>
            {t("gyms.review.eyebrow")}
          </ThemedText>
          <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1}>
            {current
              ? t("gyms.review.title", {
                  exercise: current.exerciseName,
                  weight: formatWeightKg(current.weightKg),
                })
              : t("gyms.review.queueTitle")}
          </ThemedText>
        </View>
        <ThemedText style={styles.counter} setColor={theme.quietText}>
          {total > 0 ? t("gyms.review.counter", { index: Math.min(index + 1, total), total }) : ""}
        </ThemedText>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primaryText ?? theme.primary} />
        </View>
      ) : finishedMessage ? (
        <View style={styles.loading}>
          <ThemedText style={styles.finished} setColor={theme.title}>
            {finishedMessage}
          </ThemedText>
        </View>
      ) : !current ? (
        <View style={styles.loading}>
          <ThemedText style={styles.finished} setColor={theme.title}>
            {t("gyms.review.emptyTitle")}
          </ThemedText>
          <ThemedText style={styles.footnote} setColor={theme.quietText}>
            {errorMessage || t("gyms.review.emptyBody")}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <LiftVideo key={current.liftId} uri={current.videoUrl} overlayLabel={overlayLabel} theme={theme} />

            <View style={styles.lifterRow}>
              <UserAvatar uri={current.avatarUrl} size={42} iconSize={20} />
              <View style={styles.lifterCopy}>
                <ThemedText style={styles.lifterName} setColor={theme.title} numberOfLines={1}>
                  {current.isMe ? t("common.you") : current.displayName}
                </ThemedText>
                {metaParts.length ? (
                  <ThemedText style={styles.lifterMeta} setColor={theme.quietText} numberOfLines={2}>
                    {metaParts.join(" · ")}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            <View style={styles.voteStatusRow}>
              <ThemedText style={styles.voteStatusStrong} setColor={recordColor}>
                {t("gyms.review.approvedCount", { count: current.approvals })}
              </ThemedText>
              <ThemedText style={styles.voteStatus} setColor={theme.quietText}>
                {t("gyms.review.rejectedCount", { count: current.rejections })}
              </ThemedText>
              <View style={styles.spacer} />
              <ThemedText style={styles.voteStatus} setColor="#C4C7CF">
                {t("gyms.review.toGo", { count: missing })}
              </ThemedText>
            </View>
            <View style={styles.segments}>
              {segments.map((filled, position) => (
                <View
                  key={position}
                  style={[
                    styles.segment,
                    { backgroundColor: filled ? recordColor : withAlpha(theme.title, 0.08) },
                  ]}
                />
              ))}
            </View>
          </View>

          {errorMessage ? (
            <ThemedText style={styles.error} setColor={theme.danger}>
              {errorMessage}
            </ThemedText>
          ) : null}

          {ownLift || current.isMe ? (
            <ThemedText style={styles.footnote} setColor={theme.quietText}>
              {t("gyms.review.ownLiftWaiting", { count: missing })}
            </ThemedText>
          ) : !canVote ? (
            <ThemedText style={styles.footnote} setColor={theme.quietText}>
              {t("gyms.review.cannotVote")}
            </ThemedText>
          ) : showReasons ? (
            <View style={styles.reasons}>
              <ThemedText style={styles.reasonsTitle} setColor={theme.title}>
                {t("gyms.review.whyReject")}
              </ThemedText>
              {gymService.REJECTION_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  disabled={isVoting}
                  onPress={() => submitVote({ approve: false, reason: reason.value })}
                  style={[styles.reasonRow, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
                >
                  <ThemedText style={styles.reasonText} setColor={theme.title}>
                    {t(reason.labelKey)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowReasons(false)} style={styles.skip}>
                <ThemedText style={styles.skipText} setColor={theme.quietText}>
                  {t("common.back")}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.buttons}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  disabled={isVoting}
                  onPress={() => setShowReasons(true)}
                  style={[
                    styles.button,
                    styles.rejectButton,
                    { backgroundColor: theme.cardBackground, borderColor: "rgba(255, 122, 122, 0.34)" },
                  ]}
                >
                  <Cross width={18} height={18} color="#FF7A7A" />
                  <ThemedText style={styles.buttonText} setColor="#FF7A7A">
                    {t("gyms.review.reject")}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  disabled={isVoting}
                  onPress={() => submitVote({ approve: true })}
                  style={[styles.button, styles.approveButton, { backgroundColor: theme.primary }]}
                >
                  {isVoting ? (
                    <ActivityIndicator color={theme.textInverted} />
                  ) : (
                    <>
                      <Checkmark width={18} height={18} color={theme.textInverted} thickness={2.6} />
                      <ThemedText style={styles.buttonText} setColor={theme.textInverted}>
                        {t("gyms.review.approve")}
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={advance} style={styles.skip} disabled={isVoting}>
                <ThemedText style={styles.skipText} setColor={theme.quietText}>
                  {t("common.skip")}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          <ThemedText style={styles.footnote} setColor={theme.quietText}>
            {t("gyms.review.rules", { approvals: APPROVALS_REQUIRED, rejections: REJECTIONS_TO_REMOVE })}
          </ThemedText>
        </View>
      )}
    </ThemedBottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  counter: {
    fontSize: 12,
    fontWeight: "700",
  },
  loading: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  finished: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  video: {
    height: 420,
    width: "100%",
    justifyContent: "flex-end",
  },
  videoMissing: {
    alignItems: "center",
    justifyContent: "center",
  },
  videoMissingText: {
    fontSize: 13,
    fontWeight: "700",
  },
  videoPill: {
    position: "absolute",
    top: 12,
    left: 12,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 10,
    backgroundColor: "rgba(8, 9, 12, 0.7)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "80%",
  },
  videoPillText: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  videoDuration: {
    position: "absolute",
    right: 12,
    bottom: 12,
    fontSize: 11.5,
    fontWeight: "800",
  },
  videoProgressTrack: {
    height: 3,
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  videoProgressFill: {
    height: 3,
  },
  lifterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  lifterCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  lifterName: {
    fontSize: 15,
    fontWeight: "800",
  },
  lifterMeta: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  voteStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  voteStatusStrong: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  voteStatus: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  spacer: {
    flex: 1,
  },
  segments: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
  },
  approveButton: {
    flex: 1.4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
  },
  skip: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  reasons: {
    gap: 8,
  },
  reasonsTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  reasonRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  reasonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  error: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  footnote: {
    fontSize: 11.5,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
});
