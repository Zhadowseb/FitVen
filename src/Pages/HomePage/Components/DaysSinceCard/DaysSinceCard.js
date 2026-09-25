import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import CardEdge from "./CardEdge";
import CardLabel from "./CardLabel";
import ChargeSurface from "./ChargeSurface";
import CobwebSurface from "./CobwebSurface";
import CoolGlow from "./CoolGlow";
import DayCount from "./DayCount";
import LiveFire from "./LiveFire";
import LiveSurface from "./LiveSurface";
import NeverDash from "./NeverDash";
import NeverSparks from "./NeverSparks";
import RecordConfetti from "./RecordConfetti";
import StateIcon from "./StateIcon";
import SteamPlumes from "./SteamPlumes";
import styles from "./DaysSinceCardStyle";
import useSceneClock from "./useSceneClock";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { useAnimationsEnabled } from "@resources/Components/animationHooks";
import { buildTileCrown } from "@utils/friendsActivityUtils";
import {
  buildChargeLayout,
  buildDust,
  buildFlint,
  buildLiveLayout,
  buildPlumes,
  buildRecordLayout,
  coolLook,
  daysSinceAccent,
  planOdometer,
  resolveDaysSinceState,
  showsDayCount,
} from "@utils/daysSinceCard";

const BORDER = StyleSheet.flatten(styles.card).borderWidth ?? 1;
// The card's size before it has been measured: near enough for the fire's
// embers, which do not depend on it. Everything else waits for the real one.
const FALLBACK_FRAME = { width: 104, height: 124 };

// What each state scatters over the card, laid out once for its size.
function buildSceneLayout(state, frame, count) {
  switch (state) {
    case "live":
      return { live: buildLiveLayout(frame) };
    case "today":
    case "record":
      return {
        plumes: buildPlumes({ width: frame.width, count: 5 }),
        record: state === "record" ? buildRecordLayout(frame) : null,
      };
    case "charged":
      return { charge: buildChargeLayout({ ...frame, days: count }) };
    case "cool":
      return { plumes: buildPlumes({ width: frame.width, count: 3, slow: 1.3 }) };
    case "cobweb":
      return { dust: buildDust(frame) };
    default:
      return { flint: buildFlint() };
  }
}

// Behind the content: the fire, the steam, the energy, the last glow.
function SceneBack({ state, layout, frame, box, theme, cool, clock, entry, still }) {
  switch (state) {
    case "live":
      return (
        <LiveSurface layout={layout.live} frame={frame} box={box} theme={theme} clock={clock} still={still} />
      );
    case "today":
    case "record":
      return (
        <SteamPlumes
          plumes={layout.plumes}
          frame={frame}
          color={theme.secondary}
          opacity={state === "record" ? 0.12 : 0.2}
          clock={clock}
          still={still}
        />
      );
    case "charged":
      return (
        <ChargeSurface
          layout={layout.charge}
          frame={frame}
          theme={theme}
          clock={clock}
          entry={entry}
          still={still}
        />
      );
    case "cool":
      return (
        <>
          <CoolGlow
            frame={frame}
            color={cool.glowColor}
            opacity={cool.glowOpacity}
            clock={clock}
            still={still}
          />
          <SteamPlumes
            plumes={layout.plumes}
            frame={frame}
            color={theme.quietText}
            opacity={0.14}
            clock={clock}
            still={still}
          />
        </>
      );
    default:
      return null;
  }
}

// Over the content: the edge, and what flies or hangs in front of it all.
function SceneFront({ state, layout, box, theme, gold, accent, count, clock, entry, still, stampAtMs }) {
  let bits = null;

  if (state === "record") {
    bits = (
      <RecordConfetti
        layout={layout.record}
        box={box}
        colors={{
          // Gold, green, ruby and deep gold.
          confetti: [gold, theme.secondary, theme.heatHot, theme.record],
          glint: gold,
        }}
        clock={clock}
        entry={entry}
        still={still}
      />
    );
  } else if (state === "cobweb") {
    bits = (
      <CobwebSurface box={box} dust={layout.dust} theme={theme} accent={accent} clock={clock} still={still} />
    );
  } else if (state === "never") {
    bits = <NeverSparks sparks={layout.flint} box={box} color={theme.fire} clock={clock} still={still} />;
  }

  return (
    <>
      <CardEdge
        state={state}
        days={count}
        theme={theme}
        gold={gold}
        accent={accent}
        box={box}
        clock={clock}
        entry={entry}
        still={still}
        stampAtMs={stampAtMs}
      />
      {bits}
    </>
  );
}

/**
 * One state of the card, from its entrance on. Keyed by the state and the
 * day count, so a new day or a new state starts its own clock and plays its
 * own entrance - the number rolling on from what the card showed before.
 */
function DaysSinceScene({
  state,
  count,
  rollFrom,
  label,
  neverValue,
  accent,
  theme,
  gold,
  rubies,
  size,
  animate,
}) {
  const { clock, entry } = useSceneClock(animate);
  const still = !animate;
  const frame = size ?? FALLBACK_FRAME;
  const box = { width: frame.width - BORDER * 2, height: frame.height - BORDER * 2 };
  // Keyed on the size's numbers, not the object.
  const layout = useMemo(
    () => buildSceneLayout(state, { width: frame.width, height: frame.height }, count),
    [state, count, frame.width, frame.height]
  );
  const cool = state === "cool" ? coolLook(count, theme) : null;
  const stampAtMs =
    state === "today" || state === "record" ? planOdometer({ to: count, from: rollFrom }).totalMs : 0;

  let value;

  if (state === "live") {
    value = <LiveFire layout={layout.live} theme={theme} clock={clock} still={still} />;
  } else if (state === "never") {
    value = <NeverDash text={neverValue} color={accent} clock={clock} still={still} />;
  } else {
    value = (
      <DayCount
        state={state}
        value={count}
        from={rollFrom}
        color={accent}
        animate={animate}
        clock={clock}
        entry={entry}
        still={still}
      />
    );
  }

  return (
    <>
      {size ? (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <SceneBack
            state={state}
            layout={layout}
            frame={frame}
            box={box}
            theme={theme}
            cool={cool}
            clock={clock}
            entry={entry}
            still={still}
          />
        </View>
      ) : null}

      <View style={styles.iconSlot}>
        <StateIcon
          state={state}
          theme={theme}
          accent={accent}
          cool={cool}
          rubies={rubies}
          animate={animate}
          clock={clock}
          entry={entry}
          still={still}
        />
      </View>

      {value}

      <CardLabel
        text={label}
        color={state === "live" ? accent : theme.quietText}
        pulse={state === "live"}
        time={state === "live" ? clock : entry}
        still={still}
      />

      {size ? (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <SceneFront
            state={state}
            layout={layout}
            box={box}
            theme={theme}
            gold={gold}
            accent={accent}
            count={count}
            clock={clock}
            entry={entry}
            still={still}
            stampAtMs={stampAtMs}
          />
        </View>
      ) : null}
    </>
  );
}

/**
 * Whole days since the last finished workout, of any type - the first thing
 * on Home, and the liveliest.
 *
 * The number is the point of the box, so it is the only thing drawn large,
 * and it rolls in like an odometer. Zero days is not "0 days since" - it is
 * today, and the label says so. While a workout is running there is no
 * number at all, but a fire in its place. `days` is null when there has
 * never been a workout: a dash, not a zero.
 *
 * The card wears the mood of your tile in the friends strip, from edge to
 * edge: on fire while you train, steaming once you are done - gold, a crown
 * and confetti for a record - charged for five days, cooling to the fourth
 * week, cobwebs from a month, an unlit flame before the first workout. Its
 * size and shape never change; everything is drawn inside it, outside the
 * layout.
 *
 * It moves only while Home is on screen, the app is in front and reduce
 * motion is off. Otherwise it is drawn finished and still.
 */
export default function DaysSinceCard({ days = null, isTraining = false, recordsToday = 0 }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // Light mode's record gold is dark enough to read as text; the highlight
  // borrows the bright gold, as the record star does.
  const gold = colorScheme === "dark" ? theme.recordLight : Colors.dark.record;
  const { animate } = useAnimationsEnabled();
  const [size, setSize] = useState(null);

  const state = resolveDaysSinceState({ days, isTraining, recordsToday });
  const count = showsDayCount(state) ? Math.max(0, Math.trunc(days)) : null;
  const accent = daysSinceAccent(state, count, theme);
  const crown = state === "record" ? buildTileCrown({ daysSinceLastWorkout: 0, recordsToday }) : null;
  const sceneKey = `${state}:${count ?? "-"}`;

  let label;

  switch (state) {
    case "live":
      label = t("home.daysSince.live");
      break;
    case "never":
      label = t("home.daysSince.never");
      break;
    case "today":
    case "record":
      label = t("home.daysSince.today");
      break;
    default:
      label = t("home.daysSince.days");
  }

  // The number the card showed before this state, so the next one rolls on
  // from it: read while the new state renders, updated once it has. Only a
  // new scene asks, so the memo is keyed on the scene alone.
  const shownCountRef = useRef(null);
  const rollFrom = useMemo(() => {
    const shown = shownCountRef.current;

    return count !== null && shown !== null && shown !== count ? shown : null;
  }, [sceneKey]);

  useEffect(() => {
    shownCountRef.current = count;
  }, [count, sceneKey]);

  // The digits are hidden from screen readers - they are strips of 0 to 9 -
  // so the card says its number and its label as one. Zero is not read out:
  // "Trained today" already says it.
  const spoken = (count ? `${count} ${label}` : label).replace(/\s*\n\s*/g, " ");

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: withAlpha(accent, 0.08),
          borderColor: withAlpha(accent, 0.22),
        },
      ]}
      accessible
      accessibilityLabel={spoken}
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width * 2) / 2;
        const height = Math.round(event.nativeEvent.layout.height * 2) / 2;

        setSize((current) =>
          current?.width === width && current?.height === height ? current : { width, height }
        );
      }}
    >
      <DaysSinceScene
        key={sceneKey}
        state={state}
        count={count}
        rollFrom={rollFrom}
        label={label}
        neverValue={t("home.daysSince.neverValue")}
        accent={accent}
        theme={theme}
        gold={gold}
        rubies={crown?.rubies ?? 2}
        size={size}
        animate={animate}
      />
    </View>
  );
}
