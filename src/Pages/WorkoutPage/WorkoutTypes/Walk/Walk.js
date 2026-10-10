import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  Vibration,
  View,
  useColorScheme,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import Svg, { Path, Rect } from "react-native-svg";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import { ThemedConfirmModal, ThemedText } from "../../../../Resources/ThemedComponents";
import ChevronLeft from "../../../../Resources/Icons/UI-icons/ChevronLeft";
import ThreeDots from "../../../../Resources/Icons/UI-icons/ThreeDots";
import { walkTrackerService } from "../../../../Services";
import {
  formatClockTime,
  getCurrentStoredTimestampSeconds,
  normalizeElapsedDurationSeconds,
} from "../../../../Utils/timeUtils";
import {
  averagePaceSecondsPerKm,
  cadenceStepsPerMinute,
  currentPaceSecondsPerKm,
  formatPaceClock,
  stepsPerKilometre,
  strideSeconds,
} from "../../../../Utils/walkTracking";
import { formatRunClock } from "../Run/runFormatUtils";
import { useScreenAwake } from "./useScreenAwake";
import WalkFigure from "./WalkFigure";
import WalkMap from "./WalkMap";
import styles from "./WalkStyle";

// The live walk screen (design: WalkWorkout.dc.html): the map, the clock, the
// controls and two cards of numbers. It only shows what Services/
// walkTrackerService.js is tracking and tells it what the walker pressed -
// leaving the screen does not stop the walk, so nothing about the sensors is
// decided here.

const noop = () => {};
const dash = "–";
const HOLD_TO_UNLOCK_MS = 1200;

// The clock steps down in size with its length, so the digits do not resize as
// they roll over (the same reason as Resistance's timerFontSize).
const clockFontSize = (text) => (text.length >= 8 ? 38 : text.length >= 7 ? 46 : 56);

function StopIcon({ color }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={color}>
      <Rect x={5} y={5} width={14} height={14} rx={3} />
    </Svg>
  );
}

function PauseIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={color}>
      <Rect x={5} y={4} width={5} height={16} rx={1.5} />
      <Rect x={14} y={4} width={5} height={16} rx={1.5} />
    </Svg>
  );
}

function PlayIcon({ color }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={color}>
      <Path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12-7.4a1 1 0 0 0 0-1.72l-12-7.4A1 1 0 0 0 7 4.6z" />
    </Svg>
  );
}

function LockIcon({ color }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={5} y={11} width={14} height={10} rx={2.5} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

// The touch lock: a cover over everything, the navigation included, that
// ignores taps until the unlock button has been held. It is in a Modal so the
// bottom navigation cannot be reached through it, and Android's back button
// does nothing. A screen reader gets "Unlock" as an action instead of a hold.
function LockOverlay({ visible, onUnlock, theme, t }) {
  const progress = useRef(new Animated.Value(0)).current;

  const startHold = () => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_TO_UNLOCK_MS,
      useNativeDriver: false,
    }).start();
  };

  const cancelHold = () => {
    progress.stopAnimation();
    progress.setValue(0);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={noop}
    >
      <View style={[styles.lockRoot, { backgroundColor: withAlpha(theme.background, 0.96) }]}>
        <LockIcon color={theme.title} />
        <ThemedText style={styles.lockTitle} setColor={theme.title}>
          {t("walk.lockScreen.title")}
        </ThemedText>
        <ThemedText style={styles.lockMessage} setColor={theme.quietText}>
          {t("walk.lockScreen.message")}
        </ThemedText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("walk.lockScreen.unlock")}
          accessibilityHint={t("walk.lockScreen.unlockHint")}
          accessibilityActions={[{ name: "activate", label: t("walk.lockScreen.unlockAction") }]}
          onAccessibilityAction={onUnlock}
          delayLongPress={HOLD_TO_UNLOCK_MS}
          onPressIn={startHold}
          onPressOut={cancelHold}
          onLongPress={onUnlock}
          style={[
            styles.unlockButton,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          <Animated.View
            style={[
              styles.unlockFill,
              {
                backgroundColor: withAlpha(theme.primary, 0.3),
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              },
            ]}
          />
          <ThemedText style={styles.unlockText} setColor={theme.title}>
            {t("walk.lockScreen.unlock")}
          </ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

function StatCell({ label, value, children, theme }) {
  return (
    <View style={styles.statCell}>
      <ThemedText style={styles.statLabel} setColor={theme.quietText}>
        {label}
      </ThemedText>
      <ThemedText
        style={styles.statValue}
        setColor={theme.title}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </ThemedText>
      {children}
    </View>
  );
}

export default function Walk({ workout_id, title, onOpenOptions = noop, restartRequestKey = 0 }) {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();

  const [snap, setSnap] = useState(() => walkTrackerService.getWalkSnapshot(workout_id));
  const [now, setNow] = useState(() => Date.now());
  const [locked, setLocked] = useState(false);
  const [finishConfirmVisible, setFinishConfirmVisible] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState(null);
  const [reduceMotionSetting, setReduceMotionSetting] = useState(null);
  const handledRestartRef = useRef(restartRequestKey);

  // Until the system has said what it prefers, nothing moves.
  const reduceMotion = reduceMotionSetting !== false;

  useEffect(() => {
    let isActive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => isActive && setReduceMotionSetting(Boolean(enabled)))
      .catch(() => isActive && setReduceMotionSetting(false));

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) =>
      setReduceMotionSetting(Boolean(enabled))
    );

    return () => {
      isActive = false;
      subscription?.remove?.();
    };
  }, []);

  // Open the walk (or pick up the one that is already being tracked) and follow it.
  useEffect(() => {
    const unsubscribe = walkTrackerService.subscribeWalkTracker((next) => {
      setSnap(next && Number(next.workoutId) === Number(workout_id) ? next : null);
    });

    walkTrackerService.openWalk(db, workout_id).catch((error) => {
      console.error("Failed to open the walk:", error);
    });

    return unsubscribe;
  }, [db, workout_id]);

  const status = snap?.status ?? "loading";
  const isTracking = status === "running" || status === "autoPaused";
  const isDone = status === "done";
  const started = status !== "idle" && status !== "loading";

  // "Restart" in the workout's options.
  useEffect(() => {
    if (!restartRequestKey || handledRestartRef.current === restartRequestKey) {
      return;
    }

    handledRestartRef.current = restartRequestKey;
    setLocked(false);
    setFinishedSummary(null);
    walkTrackerService.restartWalk().catch((error) => {
      console.error("Failed to restart the walk:", error);
    });
  }, [restartRequestKey]);

  // The clock's own second hand, only while there is a clock to move.
  useEffect(() => {
    if (!isTracking) {
      return undefined;
    }

    setNow(Date.now());

    const interval = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(interval);
  }, [isTracking]);

  // The screen stays on while it is locked: that is what the lock is for. A
  // walk that stops being tracked unlocks itself.
  useScreenAwake(locked && isTracking);

  useEffect(() => {
    if (!isTracking && locked) {
      setLocked(false);
    }
  }, [isTracking, locked]);

  /* ------------------------------------------------------------- numbers -- */

  // `now` moves the clock: it is read here only to make this run once a second.
  const elapsedSeconds = useMemo(() => {
    if (!snap) {
      return 0;
    }

    const running =
      snap.timerStart === null
        ? 0
        : Math.max(0, getCurrentStoredTimestampSeconds() - snap.timerStart);

    return normalizeElapsedDurationSeconds(snap.elapsed + running, 0);
  }, [snap, now]);

  const clockText = formatRunClock(elapsedSeconds);

  const totals = snap?.savedTotals ?? null;
  const distanceMeters = isDone && totals ? totals.distanceKm * 1000 : snap?.distanceMeters ?? 0;
  const stepsTotal = !started ? null : isDone ? totals?.steps ?? null : snap?.steps ?? null;
  const hasStepCounter = isDone ? stepsTotal !== null : snap?.stepsAvailable === true;
  const locationOn = snap?.location === "granted";
  const hasRoute = (snap?.route ?? []).some((segment) => segment.length > 0);
  const distanceKnown = started && (locationOn || distanceMeters > 0);

  const averagePace = started ? averagePaceSecondsPerKm(distanceMeters, elapsedSeconds) : null;
  const nowPace = status === "running" && snap ? currentPaceSecondsPerKm(snap.walk, now) : null;
  const cadence = useMemo(() => {
    if (!started || !hasStepCounter || stepsTotal === null) {
      return null;
    }

    if (isDone) {
      return elapsedSeconds > 0 ? Math.round(stepsTotal / (elapsedSeconds / 60)) : null;
    }

    return cadenceStepsPerMinute(snap?.stepSamples, now);
  }, [started, hasStepCounter, stepsTotal, isDone, elapsedSeconds, snap, now]);
  const perKilometre = stepsTotal === null ? null : stepsPerKilometre(stepsTotal, distanceMeters);
  const stride = status === "running" && cadence ? strideSeconds(cadence) : null;

  const unit = t("walk.units.km");
  const distanceText = distanceKnown ? (distanceMeters / 1000).toFixed(2) : dash;

  /* ------------------------------------------------------------- the map -- */

  let mapMode = "notStarted";

  if (isDone && !hasRoute) {
    mapMode = "noRoute";
  } else if (started && snap?.location === "denied") {
    mapMode = "denied";
  } else if (started && snap?.location === "blocked") {
    mapMode = "blocked";
  } else if (started && locationOn) {
    mapMode = snap.fix ? "map" : isDone ? "noRoute" : "waiting";
  }

  /* ------------------------------------------------------------- actions -- */

  // A press runs an action of the tracker; one that fails is logged, not thrown
  // into the gesture handler.
  const press = (action) => () => {
    Promise.resolve()
      .then(action)
      .catch((error) => {
        console.error("The walk could not do that:", error);
      });
  };

  const primaryAction = () => {
    if (status === "idle") {
      return walkTrackerService.startWalk();
    }

    if (status === "paused" || status === "autoPaused") {
      return walkTrackerService.resumeWalk();
    }

    return walkTrackerService.pauseWalk();
  };

  const finish = async () => {
    setFinishConfirmVisible(false);

    try {
      const result = await walkTrackerService.finishWalk();

      if (result) {
        Vibration.vibrate(500);
        setFinishedSummary(result);
      }
    } catch (error) {
      console.error("Failed to finish the walk:", error);
      Alert.alert(t("walk.errors.finishFailedTitle"), t("walk.errors.finishFailedMessage"));
    }
  };

  const summaryText = (summary) => {
    if (!summary) {
      return "";
    }

    const duration = formatRunClock(summary.movingSeconds);
    const distance =
      summary.distanceMeters > 0 ? `${(summary.distanceMeters / 1000).toFixed(2)} ${unit}` : null;
    const steps = summary.steps ? t("walk.finished.steps", { count: summary.steps }) : null;

    if (distance && steps) {
      return t("walk.finished.summary", { duration, distance, steps });
    }

    if (distance) {
      return t("walk.finished.summaryNoSteps", { duration, distance });
    }

    if (steps) {
      return t("walk.finished.summaryNoDistance", { duration, steps });
    }

    return t("walk.finished.summaryTimeOnly", { duration });
  };

  /* -------------------------------------------------------------- colours -- */

  const green = theme.secondary ?? theme.primary;
  const primaryLabel =
    status === "running"
      ? t("walk.pause")
      : status === "paused" || status === "autoPaused"
        ? t("walk.resume")
        : t("walk.start");
  const autoPauseOn = snap?.autoPauseEnabled !== false;
  const sideButtonStyle = {
    backgroundColor: theme.cardBackground,
    borderColor: theme.cardBorder,
  };

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: green }]} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* header */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
            onPress={() => navigation.goBack()}
            style={[styles.roundButton, sideButtonStyle]}
          >
            <ChevronLeft width={18} height={18} color={theme.title} thickness={2} />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <ThemedText style={styles.eyebrow} setColor={theme.quietText} numberOfLines={1}>
              {t("walk.eyebrow")}
            </ThemedText>
            <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1}>
              {title ?? t("walk.title")}
            </ThemedText>
          </View>

          {!isDone ? (
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: autoPauseOn }}
              accessibilityLabel={t("walk.autoPause")}
              onPress={press(() => walkTrackerService.setAutoPause(!autoPauseOn))}
              style={[
                styles.autoPause,
                {
                  backgroundColor: autoPauseOn ? withAlpha(green, 0.14) : theme.cardBackground,
                  borderColor: autoPauseOn ? withAlpha(green, 0.45) : theme.cardBorder,
                },
              ]}
            >
              <ThemedText
                style={styles.autoPauseText}
                setColor={autoPauseOn ? green : theme.quietText}
                numberOfLines={1}
              >
                {t("walk.autoPause")}
              </ThemedText>
              <View
                style={[
                  styles.switchTrack,
                  { backgroundColor: autoPauseOn ? green : withAlpha(theme.quietText, 0.35) },
                ]}
              >
                <View
                  style={[
                    styles.switchThumb,
                    { left: autoPauseOn ? 14 : 2, backgroundColor: theme.background },
                  ]}
                />
              </View>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("walk.options")}
            onPress={onOpenOptions}
            style={[styles.roundButton, sideButtonStyle]}
          >
            <ThreeDots width={18} height={18} color={theme.title} />
          </TouchableOpacity>
        </View>

        {/* map */}
        <WalkMap
          route={snap?.route ?? []}
          fix={snap?.fix ?? null}
          startLabel={
            snap?.originalStart
              ? t("walk.startedAt", { time: formatClockTime(snap.originalStart) })
              : null
          }
          mode={mapMode}
          onAllowLocation={press(() => walkTrackerService.requestLocationAccess())}
          reduceMotion={reduceMotion}
        />

        {/* time */}
        <View style={styles.timeBlock}>
          <ThemedText style={styles.timeLabel} setColor={theme.quietText}>
            {t("walk.time")}
          </ThemedText>
          <ThemedText
            accessibilityRole="timer"
            accessibilityLabel={t("walk.clockLabel", { time: clockText })}
            style={[
              styles.timeValue,
              { fontSize: clockFontSize(clockText), lineHeight: clockFontSize(clockText) + 4 },
            ]}
            setColor={theme.title}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {clockText}
          </ThemedText>
        </View>

        {/* controls */}
        {!isDone ? (
          <View style={styles.controls}>
            {started ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("walk.finish")}
                accessibilityHint={t("walk.finishHint")}
                onPress={() => setFinishConfirmVisible(true)}
                style={[styles.sideButton, sideButtonStyle]}
              >
                <StopIcon color={theme.title} />
                <ThemedText style={styles.sideButtonText} setColor={theme.title}>
                  {t("walk.finish")}
                </ThemedText>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              disabled={status === "loading"}
              onPress={press(primaryAction)}
              style={[
                styles.mainButton,
                { backgroundColor: theme.primary, shadowColor: theme.primary },
              ]}
            >
              {status === "running" ? (
                <PauseIcon color={theme.textInverted} />
              ) : (
                <PlayIcon color={theme.textInverted} />
              )}
              <ThemedText style={styles.mainButtonText} setColor={theme.textInverted}>
                {primaryLabel}
              </ThemedText>
            </TouchableOpacity>

            {isTracking ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("walk.lock")}
                accessibilityHint={t("walk.lockHint")}
                onPress={() => setLocked(true)}
                style={[styles.sideButton, sideButtonStyle]}
              >
                <LockIcon color={theme.title} />
                <ThemedText style={styles.sideButtonText} setColor={theme.title}>
                  {t("walk.lock")}
                </ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* stats */}
        <View
          style={[
            styles.statsCard,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          <StatCell label={t("walk.stats.distance")} value={distanceText} theme={theme}>
            <ThemedText style={styles.statUnit} setColor={theme.text}>
              {unit}
            </ThemedText>
          </StatCell>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

          <StatCell
            label={t("walk.stats.pace", { unit })}
            value={formatPaceClock(averagePace) ?? dash}
            theme={theme}
          >
            {status === "autoPaused" ? (
              <ThemedText style={styles.statUnit} setColor={theme.quietText} numberOfLines={1}>
                {t("walk.autoPaused")}
              </ThemedText>
            ) : nowPace ? (
              <ThemedText style={styles.statUnit} setColor={green} numberOfLines={1}>
                {t("walk.stats.now", { pace: formatPaceClock(nowPace) })}
              </ThemedText>
            ) : (
              <ThemedText style={styles.statUnit} setColor={theme.quietText}>
                {" "}
              </ThemedText>
            )}
          </StatCell>

          {hasStepCounter ? (
            <>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

              <StatCell
                label={t("walk.stats.steps")}
                value={stepsTotal === null ? dash : Number(stepsTotal).toLocaleString()}
                theme={theme}
              >
                <ThemedText style={styles.statUnit} setColor={theme.text}>
                  {t("walk.stats.stepsTotal")}
                </ThemedText>
              </StatCell>
            </>
          ) : null}
        </View>

        {/* cadence: without a step counter there is nothing to show, and no zeros */}
        {hasStepCounter ? (
          <View
            style={[
              styles.cadenceCard,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}
          >
            <View
              style={[styles.figureBox, { backgroundColor: withAlpha(theme.primary, 0.1) }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <WalkFigure
                color={theme.primary}
                strideSeconds={stride}
                animate={!reduceMotion && stride !== null}
              />
            </View>

            <View style={styles.cadenceCell}>
              <ThemedText style={styles.statLabel} setColor={theme.quietText}>
                {t("walk.cadence.title")}
              </ThemedText>
              <ThemedText
                style={styles.cadenceValue}
                setColor={theme.title}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {cadence ? String(cadence) : dash}
              </ThemedText>
              <ThemedText style={styles.statUnit} setColor={theme.text}>
                {t("walk.cadence.unit")}
              </ThemedText>
            </View>

            <View style={[styles.cadenceDivider, { backgroundColor: theme.border }]} />

            <View style={styles.cadenceCell}>
              <ThemedText style={styles.statLabel} setColor={theme.quietText}>
                {t("walk.cadence.perDistance", { unit })}
              </ThemedText>
              <ThemedText
                style={styles.cadenceValue}
                setColor={theme.title}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {perKilometre ? perKilometre.toLocaleString() : dash}
              </ThemedText>
              <ThemedText style={styles.statUnit} setColor={theme.text}>
                {t("walk.cadence.perDistanceUnit", { unit })}
              </ThemedText>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <LockOverlay visible={locked} onUnlock={() => setLocked(false)} theme={theme} t={t} />

      <ThemedConfirmModal
        visible={finishConfirmVisible}
        title={t("walk.finishDialog.title")}
        message={t("walk.finishDialog.message")}
        confirmLabel={t("walk.finishDialog.confirm")}
        tone="positive"
        onConfirm={finish}
        onClose={() => setFinishConfirmVisible(false)}
      />

      <ThemedConfirmModal
        visible={finishedSummary !== null}
        title={t("walk.finished.title")}
        message={summaryText(finishedSummary)}
        confirmLabel={t("common.done")}
        cancelLabel=""
        tone="positive"
        onConfirm={() => setFinishedSummary(null)}
        onClose={() => setFinishedSummary(null)}
      />
    </View>
  );
}
