import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { formatNumber, useTranslation } from "@localization";

import SetBars from "./SetBars";
import ShineName from "./ShineName";
import styles from "./LivePanelStyle";
import { withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { setBars, setLineParts } from "@utils/liveQuickStart";
import { formatCountdownTime } from "@utils/timeUtils";

const POP = Easing.bezier(0.34, 1.56, 0.64, 1);
// The last ten seconds of the rest: the number pops each second.
const TICK_MS = 420;
const TICK_FROM = 1.3;
// "Ready" breathes.
const READY_MS = 600;
const READY_TO = 1.12;

/** "8 × 80" and " kg", or what there is of it; null with nothing to say. */
function setText(set, t) {
  const parts = setLineParts(set);
  const weight = (value) => formatNumber(value, { maximumFractionDigits: 2 });

  switch (parts.kind) {
    case "both":
      return { main: `${parts.reps} × ${weight(parts.weight)}`, unit: ` ${t("common.kg")}` };
    case "weight":
      return { main: weight(parts.weight), unit: ` ${t("common.kg")}` };
    case "reps":
      return {
        main: parts.reps,
        unit: ` ${t("home.quickStart.live.repsUnit", { count: parts.count })}`,
      };
    default:
      return null;
  }
}

// The rest's number, or "Ready" once it has run out.
function Countdown({ view, rest, accent, quiet, animate }) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const remaining = rest?.remaining ?? 0;
  const pops = view === "rest" && Boolean(rest?.pops);

  useEffect(() => {
    if (!animate || !pops) {
      return;
    }

    scale.value = TICK_FROM;
    scale.value = withTiming(1, { duration: TICK_MS, easing: POP });
  }, [animate, pops, remaining, scale]);

  useEffect(() => {
    if (view !== "ready") {
      return undefined;
    }

    cancelAnimation(scale);
    scale.value = 1;

    if (!animate) {
      return undefined;
    }

    scale.value = withRepeat(
      withSequence(
        withTiming(READY_TO, { duration: READY_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: READY_MS, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );

    return () => cancelAnimation(scale);
  }, [animate, scale, view]);

  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.count}>
      <Animated.View style={numberStyle}>
        <ThemedText style={styles.countNumber} setColor={accent} numberOfLines={1}>
          {view === "ready" ? t("home.quickStart.live.ready") : formatCountdownTime(remaining)}
        </ThemedText>
      </Animated.View>
      <ThemedText style={styles.countLabel} setColor={quiet} numberOfLines={1}>
        {view === "ready" ? t("home.quickStart.live.restOver") : t("home.quickStart.live.rest")}
      </ThemedText>
    </View>
  );
}

// The set, large in the panel's colour, with its unit small and quiet.
function SetLine({ set, accent, quiet }) {
  const { t } = useTranslation();
  const text = set?.setId ? setText(set, t) : null;

  if (!text) {
    return null;
  }

  return (
    <ThemedText
      style={styles.setLine}
      setColor={accent}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
    >
      {text.main}
      <ThemedText style={styles.setUnit} setColor={quiet}>
        {text.unit}
      </ThemedText>
    </ThemedText>
  );
}

function Chevron({ accent }) {
  return <View style={[styles.chevron, { borderLeftColor: withAlpha(accent, 0.7) }]} />;
}

/**
 * The panel's body in each view. The set it talks about - the next one, or
 * the latest when nothing is waiting - comes with its exercise's name and
 * one bar per set of that exercise. `fallbackName` is the workout's own, for
 * one with no exercise in it yet.
 */
export default function LivePanelBody({
  view,
  focus,
  progress,
  record,
  rest,
  theme,
  accent,
  gold,
  fills,
  fallbackName,
  animate,
  visible,
}) {
  const { t } = useTranslation();
  const quiet = theme.quietText;
  const set = focus.set;
  const kicker = (text) => (
    <ThemedText style={styles.kicker} setColor={quiet} numberOfLines={1}>
      {text}
    </ThemedText>
  );

  if (view === "record" && record) {
    const text = setText(record, t);

    return (
      <View style={styles.copy}>
        {kicker(t("home.quickStart.live.newRecord"))}
        <ShineName
          text={record.name}
          style={styles.name}
          color={accent}
          shine={gold}
          animate={animate}
        />
        <View style={styles.meta}>
          {text ? (
            <ThemedText
              style={[styles.pill, { backgroundColor: withAlpha(accent, 0.15) }]}
              setColor={accent}
              numberOfLines={1}
            >
              {`${text.main}${text.unit}`}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.metaText} setColor={quiet} numberOfLines={1}>
            {t("home.quickStart.live.strong")}
          </ThemedText>
        </View>
      </View>
    );
  }

  if (view === "finished") {
    const total = progress?.totalSets ?? 0;

    return (
      <>
        <View style={styles.copy}>
          {kicker(t("home.quickStart.live.allSetsDone"))}
          <ThemedText style={styles.name} setColor={theme.title} numberOfLines={1}>
            {t("home.quickStart.live.setsOfTotal", { done: progress?.doneSets ?? total, total })}
          </ThemedText>
          <ThemedText style={styles.metaText} setColor={quiet} numberOfLines={1}>
            {t("home.quickStart.live.wellDone")}
          </ThemedText>
        </View>
        <ThemedText
          style={[styles.finish, { backgroundColor: accent }]}
          setColor={theme.inkOnSecondary}
          numberOfLines={1}
        >
          {t("home.quickStart.live.finish")}
        </ThemedText>
      </>
    );
  }

  const counting = view === "rest" || view === "ready";
  const name = set?.name || fallbackName;

  return (
    <>
      {counting ? (
        <Countdown view={view} rest={rest} accent={accent} quiet={quiet} animate={animate} />
      ) : null}
      <View style={styles.copy}>
        {focus.kicker ? kicker(t("home.quickStart.live.next")) : null}
        {name ? (
          <ThemedText style={styles.name} setColor={theme.title} numberOfLines={1}>
            {name}
          </ThemedText>
        ) : null}
        <SetBars
          bars={setBars(set, { isNext: focus.isNext })}
          fills={fills}
          accent={accent}
          animate={animate}
          visible={visible}
        />
        <SetLine set={set} accent={accent} quiet={quiet} />
      </View>
      {counting ? null : <Chevron accent={accent} />}
    </>
  );
}
