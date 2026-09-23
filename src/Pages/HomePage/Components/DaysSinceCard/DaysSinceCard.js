import { Animated, View, useColorScheme } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "@localization";

import styles from "./DaysSinceCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Fire from "@resources/Icons/UI-icons/Fire";
import { ThemedText } from "@resources/ThemedComponents";
import { useAnimationsEnabled, useBreathAnimation } from "@resources/Components/animationHooks";
import ChargeFrame from "@resources/Components/FriendsActivity/ChargeFrame";
import CobwebFrame from "@resources/Components/FriendsActivity/CobwebFrame";
import Crown from "@resources/Components/FriendsActivity/Crown";
import EmberFrame from "@resources/Components/FriendsActivity/EmberFrame";
import SteamFrame from "@resources/Components/FriendsActivity/SteamFrame";
import {
  buildTileCrown,
  buildTileMood,
  chargeLevelFor,
  wallpaperColorForDays,
} from "@utils/friendsActivityUtils";
import { boltPath } from "@utils/tileMoodGeometry";

const CARD_RADIUS = 18;
// The own card's frames are seeded the same every time, so it keeps its
// cobwebs and its bolts' spots from one visit to Home to the next.
const OWN_SEED = 7;

// The colour of the card in each mood - the same the friend tiles use, so
// the two read as one system.
function moodAccent(mood, days, theme) {
  switch (mood) {
    case "embers":
      return theme.fire;
    case "steam":
      return theme.secondary;
    case "charged":
      return theme.charge;
    case "cobweb":
      return theme.quietText;
    default:
      break;
  }

  if (!Number.isFinite(days)) {
    return theme.quietText;
  }

  return (
    wallpaperColorForDays(days, [theme.heatHot, theme.heatWarm, theme.heatCool, theme.quietText]) ??
    theme.quietText
  );
}

// The flame, flickering while a workout is running.
function FlameIcon({ color, flicker }) {
  const breath = useBreathAnimation(flicker, { periodMs: 700, low: 0 });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Fire width={20} height={20} color={color} />
    </Animated.View>
  );
}

function BoltIcon({ theme }) {
  return (
    <Svg width={20} height={20} viewBox="-10 -10 20 20">
      <Path d={boltPath(18)} fill={theme.chargeCore} stroke={theme.charge} strokeWidth={1} strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Whole days since the last finished workout, of any type.
 *
 * The number is the point of the box, so it is the only thing drawn large. Zero
 * days is not "0 days since" - it is today, and the label says so instead of
 * making the reader work out that zero means well done.
 *
 * `days` is null when there has never been a workout: a dash, not a zero.
 *
 * The card wears the same mood as your tile in the friends strip, so the
 * number is never just a number: on a fire while a workout is running,
 * steaming once one is done today - with the crown if it held a record -
 * charged for five days after, the day's colour after that, cobwebs from a
 * month. Layout untouched; the moods are drawn behind the content.
 */
export default function DaysSinceCard({ days = null, isTraining = false, recordsToday = 0 }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { animate } = useAnimationsEnabled();

  const hasWorkouts = Number.isFinite(days);
  const value = hasWorkouts ? String(days) : t("home.daysSince.neverValue");
  const label = !hasWorkouts
    ? t("home.daysSince.never")
    : days === 0
      ? t("home.daysSince.today")
      : t("home.daysSince.days");

  const self = {
    activityState: isTraining ? "live" : undefined,
    daysSinceLastWorkout: hasWorkouts ? days : null,
    recordsToday,
  };
  const mood = buildTileMood(self);
  const crown = buildTileCrown(self);
  const accent = moodAccent(mood, days, theme);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: withAlpha(accent, 0.08),
          borderColor: withAlpha(accent, 0.22),
        },
      ]}
    >
      {mood === "embers" ? <EmberFrame theme={theme} seed={OWN_SEED} animate={animate} /> : null}
      {mood === "steam" ? <SteamFrame theme={theme} seed={OWN_SEED} animate={animate} /> : null}
      {mood === "charged" ? (
        <ChargeFrame
          theme={theme}
          seed={OWN_SEED}
          level={chargeLevelFor(self)}
          animate={animate}
          focus="middle"
        />
      ) : null}
      {mood === "cobweb" ? (
        <CobwebFrame theme={theme} seed={OWN_SEED} animate={animate} cornerRadius={CARD_RADIUS} />
      ) : null}

      {/* The crown takes the icon's place: a record today outranks the flame. */}
      <View style={styles.iconSlot}>
        {crown ? (
          <Crown rubies={crown.rubies} animate={animate} seed={OWN_SEED} style={styles.crown} />
        ) : mood === "charged" ? (
          <BoltIcon theme={theme} />
        ) : (
          <FlameIcon color={accent} flicker={animate && mood === "embers"} />
        )}
      </View>

      <ThemedText style={styles.value} setColor={accent}>
        {value}
      </ThemedText>

      <ThemedText style={styles.label} setColor={theme.quietText}>
        {label}
      </ThemedText>
    </View>
  );
}
