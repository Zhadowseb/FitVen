import {
  Animated,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useTranslation } from "@localization";

import ChargeFrame from "./ChargeFrame";
import CobwebFrame from "./CobwebFrame";
import Crown from "./Crown";
import EmberFrame from "./EmberFrame";
import SteamFrame from "./SteamFrame";
import styles, {
  AURA_SIZE,
  AVATAR_SIZE,
  TILE_GAP,
  TILE_WIDTH,
} from "./FriendsActivityStyle";
import { Colors, withAlpha } from "../../GlobalStyling/colors";
import Checkmark from "../../Icons/UI-icons/Checkmark";
import Male from "../../Icons/UI-icons/Male";
import MapPin from "../../Icons/UI-icons/MapPin";
import MusicNote from "../../Icons/UI-icons/MusicNote";
import Plus from "../../Icons/UI-icons/Plus";
import { ThemedText, UserAvatar } from "../../ThemedComponents";
import {
  useAnimationsEnabled,
  useBlinkAnimation,
  useBreathAnimation,
  useEqualizerAnimation,
  usePulseAnimation,
  useReduceMotion,
  useTickerAnimation,
} from "../animationHooks";
import {
  buildActivityStatusLabel,
  buildRestWallpaper,
  buildTileCrown,
  buildTileMood,
  chargeLevelFor,
  formatMusicLine,
  resolveMusicBandState,
  sortActivityTiles,
  wallpaperColorForDays,
} from "@utils/friendsActivityUtils";
import { buildAvatarWeb } from "@utils/cobwebGeometry";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const TICKER_COPY_PADDING = 18;

let gradientInstanceCounter = 0;

function RingLoading({ color, mutedColor, size = 52 }) {
  const firstProgress = useRef(new Animated.Value(0)).current;
  const secondProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createLoop = (progress, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(progress, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ])
      );
    const firstLoop = createLoop(firstProgress, 0);
    const secondLoop = createLoop(secondProgress, 900);

    firstLoop.start();
    secondLoop.start();

    return () => {
      firstLoop.stop();
      secondLoop.stop();
    };
  }, [firstProgress, secondProgress]);

  const maxRadius = 20;
  const firstRadius = firstProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, maxRadius],
  });
  const firstOpacity = firstProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0],
  });
  const secondRadius = secondProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, maxRadius],
  });
  const secondOpacity = secondProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0],
  });

  return (
    <View style={[styles.ringLoadingShell, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 44 44">
        <Circle
          cx="22"
          cy="22"
          r="20"
          stroke={mutedColor}
          strokeWidth="2"
          fill="none"
          opacity={0.24}
        />
        <AnimatedCircle
          cx="22"
          cy="22"
          r={firstRadius}
          stroke={color}
          strokeWidth="2"
          fill="none"
          opacity={firstOpacity}
        />
        <AnimatedCircle
          cx="22"
          cy="22"
          r={secondRadius}
          stroke={color}
          strokeWidth="2"
          fill="none"
          opacity={secondOpacity}
        />
      </Svg>
    </View>
  );
}

// Ring colour and status-row content per state: live -> accent (blinking dot),
// done -> green (checkmark), planned -> yellow (static dot), rest -> hairline
// ring and a quiet dot.
function getActivityMeta(theme, activityState, restDotColor) {
  switch (activityState) {
    case "live":
      return {
        ringColor: theme.primary,
        statusColor: theme.primary,
        statusKind: "blinkDot",
      };
    case "done":
      return {
        ringColor: theme.secondary,
        statusColor: theme.secondary,
        statusKind: "check",
      };
    case "planned":
      return {
        ringColor: theme.planned,
        statusColor: theme.planned,
        statusKind: "dot",
      };
    default:
      return {
        ringColor: theme.border,
        statusColor: theme.quietText,
        statusKind: "restDot",
        dotColor: restDotColor,
      };
  }
}

/* --------------------------------------------------------------- band -- */

// A diagonal (135deg) two-stop fill behind the band text.
function BandGradient({ from, to }) {
  const gradientId = useRef(`music-band-${++gradientInstanceCounter}`).current;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} stopOpacity={1} />
          <Stop offset="1" stopColor={to} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

// The 8 dp / 10 dp fades on either side of a scrolling title, in the card
// colour. Two overlays rather than a mask: masking costs a native view per
// tile and the difference is invisible at this size.
function EdgeFade({ side, color, style }) {
  const gradientId = useRef(`band-fade-${++gradientInstanceCounter}`).current;
  const isLeft = side === "left";

  return (
    <Svg
      style={style}
      pointerEvents="none"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity={isLeft ? 0.95 : 0} />
          <Stop offset="1" stopColor={color} stopOpacity={isLeft ? 0 : 0.95} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

function Equalizer({ color, animate }) {
  const bars = useEqualizerAnimation(animate);
  const heights = [6, 10, 7.5];

  return (
    <View style={styles.equalizer} accessibilityElementsHidden>
      {bars.map((scaleY, index) => (
        <Animated.View
          key={index}
          style={[
            styles.equalizerBar,
            {
              height: heights[index],
              backgroundColor: color,
              transform: [{ scaleY }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// The text line of the band. Measures itself once; when it does not fit it
// becomes a ticker - two copies, sliding left by one copy width, forever.
function BandTicker({ text, color, animate, fadeColor }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const copyWidth = textWidth > 0 ? textWidth + TICKER_COPY_PADDING : 0;
  const { translateX, isScrolling } = useTickerAnimation({
    enabled: animate,
    textWidth: copyWidth,
    containerWidth,
  });

  return (
    <View
      style={styles.bandTextClip}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {/* Measured off-screen so the visible copy can be clipped freely. */}
      <ThemedText
        style={[styles.bandText, styles.tickerMeasure]}
        setColor={color}
        numberOfLines={1}
        onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
      >
        {text}
      </ThemedText>

      {isScrolling ? (
        <Animated.View style={[styles.tickerRow, { transform: [{ translateX }] }]}>
          <ThemedText style={[styles.bandText, styles.tickerCopy]} setColor={color}>
            {text}
          </ThemedText>
          <ThemedText style={[styles.bandText, styles.tickerCopy]} setColor={color}>
            {text}
          </ThemedText>
        </Animated.View>
      ) : (
        <ThemedText style={styles.bandText} setColor={color} numberOfLines={1}>
          {text}
        </ThemedText>
      )}

      {isScrolling ? (
        <>
          <EdgeFade side="left" color={fadeColor} style={styles.edgeFadeLeft} />
          <EdgeFade side="right" color={fadeColor} style={styles.edgeFadeRight} />
        </>
      ) : null}
    </View>
  );
}

function MusicBand({ theme, colorScheme, music, activityState, animate, hasWallpaper }) {
  const { t } = useTranslation();
  const state = resolveMusicBandState(music, activityState);
  const isLight = colorScheme === "light";
  const quietBandFrom = isLight ? "rgba(15, 17, 22, 0.05)" : "rgba(255, 255, 255, 0.08)";
  const quietBandTo = isLight ? "rgba(15, 17, 22, 0.05)" : "rgba(255, 255, 255, 0.03)";
  const emptyBand = isLight ? "rgba(15, 17, 22, 0.03)" : "rgba(255, 255, 255, 0.03)";
  const equalizerColor = isLight ? theme.musicText : "#EADDFF";

  if (state === "none") {
    // Over a wallpaper the empty band steps aside, so the tile reads as one
    // surface rather than a grey strip on top of a coloured one.
    return (
      <View
        style={[styles.band, { backgroundColor: hasWallpaper ? "transparent" : emptyBand }]}
      />
    );
  }

  const isPlaying = state === "playing";
  const textColor = isPlaying ? theme.musicText : theme.musicQuietText;
  const line = formatMusicLine(music);

  return (
    <View
      style={styles.band}
      accessibilityLabel={
        isPlaying
          ? t("friends.music.playing", { track: line })
          : t("friends.music.lastPlayed", { track: line })
      }
    >
      <BandGradient
        from={isPlaying ? theme.musicBandFrom : quietBandFrom}
        to={isPlaying ? theme.musicBandTo : quietBandTo}
      />
      <View style={styles.bandTextRow}>
        <View style={styles.bandIconSlot}>
          {isPlaying ? (
            <Equalizer color={equalizerColor} animate={animate} />
          ) : (
            <MusicNote width={9} height={9} color={theme.musicQuietIcon} thickness={2.2} />
          )}
        </View>
        <BandTicker
          text={line}
          color={textColor}
          animate={animate}
          fadeColor={theme.cardBackground}
        />
      </View>
    </View>
  );
}

/* ---------------------------------------------------------- wallpaper -- */

// A heat scale in colours of its own (see heatHot in colors.js), clear of the
// status colours and of music's purple. Coral today, pink at two days, blue at
// five and drained to grey by nine, and every day in between its own blend of
// the two either side.
function wallpaperColor(wallpaper, theme) {
  if (wallpaper.days === null) {
    return theme.heatWarm;
  }

  return (
    wallpaperColorForDays(wallpaper.days, [
      theme.heatHot,
      theme.heatWarm,
      theme.heatCool,
      theme.quietText,
    ]) ?? theme.quietText
  );
}

// A corner of colour fading out across the tile.
function WallpaperGradient({ color, strength }) {
  const gradientId = useRef(`tile-wallpaper-${++gradientInstanceCounter}`).current;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={strength} />
          <Stop offset="0.55" stopColor={color} stopOpacity={strength * 0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

/**
 * Behind a resting tile: a wash in the colour of how long it has been, and
 * the number of days itself, large and faint, cut off by the tile's corner.
 * Decoration only - the status row already says it in words - so it is
 * hidden from screen readers.
 */
function TileWallpaper({ wallpaper, theme, colorScheme, animate }) {
  const { t } = useTranslation();
  const isLight = colorScheme === "light";
  const color = wallpaperColor(wallpaper, theme);
  const markColor = withAlpha(color, isLight ? 0.13 : 0.15);
  // Trained this week: the wash breathes. A shine used to cross the tile as
  // well, and a slanted bar sweeping over the pictures was too much. The same
  // checks as every other loop in the strip - on screen, app in front,
  // reduced motion off - arrive in `animate`.
  const moves = animate && wallpaper.energy > 0;
  const washOpacity = useBreathAnimation(moves, {
    periodMs: 3200 - 1000 * wallpaper.energy,
    low: 0.55,
  });

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: washOpacity }]}>
        <WallpaperGradient color={color} strength={isLight ? 0.18 : 0.26} />
      </Animated.View>
      <ThemedText style={styles.wallpaperMark} setColor={markColor} numberOfLines={1}>
        {wallpaper.label ?? t("friends.wallpaper.new")}
        {wallpaper.label ? (
          <ThemedText style={styles.wallpaperUnit} setColor={markColor}>
            {t("friends.wallpaper.daysUnit")}
          </ThemedText>
        ) : null}
      </ThemedText>
    </View>
  );
}

/* -------------------------------------------------------------- auras -- */

// Both auras are drawn in a 100 x 100 box centred on the avatar, whose edge
// sits at this radius in those units.
const AURA_AVATAR_RADIUS = (AVATAR_SIZE / AURA_SIZE) * 50;

// Only the upper part of the circle: below the avatar is the name, and a
// flame or a crystal across it would make it harder to read.
function arcPoints(count, fromDeg, toDeg) {
  return Array.from({ length: count }, (_, index) => {
    const deg = fromDeg + ((toDeg - fromDeg) * index) / Math.max(1, count - 1);

    return { deg, rad: (deg * Math.PI) / 180 };
  });
}

// A flame tongue standing on (0, 0), tip up at (0, -height).
function flamePath(width, height) {
  const half = width / 2;

  return [
    `M ${-half} 0`,
    `C ${-half} ${-height * 0.42} ${-width * 0.12} ${-height * 0.62} 0 ${-height}`,
    `C ${width * 0.16} ${-height * 0.56} ${half} ${-height * 0.38} ${half} 0`,
    "Z",
  ].join(" ");
}

// Tongues around the top of the avatar, tallest at the top, each leaning up
// rather than straight out so it reads as fire rising, not a sun.
function FlameRing({ color, count, reach, width, fromDeg, toDeg, lean = 0.55 }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      {arcPoints(count, fromDeg, toDeg).map(({ deg, rad }, index) => {
        const fromTop = Math.abs(deg + 90) / 90;
        const height = reach * (1 - 0.45 * Math.min(1, fromTop)) * (index % 2 ? 0.82 : 1);
        const x = 50 + (AURA_AVATAR_RADIUS - 2) * Math.cos(rad);
        const y = 50 + (AURA_AVATAR_RADIUS - 2) * Math.sin(rad);

        return (
          <Path
            key={index}
            d={flamePath(width, height)}
            fill={color}
            transform={`translate(${x} ${y}) rotate(${(deg + 90) * lean})`}
          />
        );
      })}
    </Svg>
  );
}

/**
 * Flames around the avatar of somebody who is going: two rings of tongues,
 * orange outside and yellow in, flickering out of step, over a warm glow.
 */
function FireAura({ theme, animate, seed }) {
  const glowId = useRef(`fire-glow-${++gradientInstanceCounter}`).current;
  const outer = useBreathAnimation(animate, { periodMs: 760 + (seed % 3) * 110, low: 0.5 });
  const inner = useBreathAnimation(animate, { periodMs: 540 + (seed % 4) * 70, low: 0.35 });
  const outerScale = outer.interpolate({ inputRange: [0.5, 1], outputRange: [1.07, 1] });
  const innerScale = inner.interpolate({ inputRange: [0.35, 1], outputRange: [0.94, 1.02] });

  return (
    <View style={styles.aura} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="46%" r="50%">
            <Stop offset="0.55" stopColor={theme.fire} stopOpacity={0.4} />
            <Stop offset="1" stopColor={theme.fire} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${glowId})`} />
      </Svg>
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: outer, transform: [{ scale: outerScale }] }]}
      >
        <FlameRing color={theme.fire} count={11} reach={17} width={9} fromDeg={-215} toDeg={35} />
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: inner, transform: [{ scale: innerScale }] }]}
      >
        <FlameRing color={theme.fireCore} count={8} reach={10} width={7} fromDeg={-200} toDeg={20} />
      </Animated.View>
    </View>
  );
}

/**
 * A cobweb strung across the upper left of a dusty avatar, over the picture,
 * swaying a little on the corner it hangs from.
 */
function CobwebAura({ theme, animate, seed }) {
  const web = useMemo(() => buildAvatarWeb(AURA_AVATAR_RADIUS), []);
  const breath = useBreathAnimation(animate, { periodMs: 3800 + (seed % 3) * 500, low: 0 });
  const rotate = breath.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] });

  return (
    <Animated.View style={[styles.aura, { transform: [{ rotate }] }]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Path d={`${web.spokes} ${web.rings}`} stroke={theme.cobweb} strokeOpacity={0.12} strokeWidth={1.8} fill="none" />
        <Path d={web.spokes} stroke={theme.cobweb} strokeOpacity={0.55} strokeWidth={0.6} strokeLinecap="round" fill="none" />
        <Path d={web.rings} stroke={theme.cobweb} strokeOpacity={0.45} strokeWidth={0.45} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

/* ------------------------------------------------------------- avatar -- */

function TileAvatar({ theme, meta, activityState, avatarUrl, iconColor, animate, mood, crown, seed }) {
  const isLive = activityState === "live";
  // Flames already say "going"; the pulse under them would only blur it.
  const onFire = mood === "embers";
  const { scale, opacity } = usePulseAnimation(isLive && animate && !onFire);
  // A month gone: the picture has gathered dust, and a web.
  const isDusty = mood === "cobweb";

  return (
    <View style={styles.avatarSlot} pointerEvents="none">
      <View style={styles.avatarShell}>
        {onFire ? <FireAura theme={theme} animate={animate} seed={seed} /> : null}
        {isLive && !onFire ? (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                backgroundColor: withAlpha(theme.primary, 0.45),
                opacity,
                transform: [{ scale }],
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: meta.ringColor,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          <View style={[styles.avatarInner, { backgroundColor: theme.cardBackground }]}>
            <UserAvatar
              uri={avatarUrl}
              size={48}
              iconSize={24}
              iconColor={iconColor}
              backgroundColor={theme.cardBackground}
            />
            {isDusty ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: withAlpha(theme.cardBackground, 0.35) },
                ]}
              />
            ) : null}
          </View>
        </View>
        {isDusty ? <CobwebAura theme={theme} animate={animate} seed={seed} /> : null}
        {crown ? <Crown rubies={crown.rubies} animate={animate} seed={seed} /> : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- facts -- */

function FactRow({ icon, children }) {
  return (
    <View style={styles.factRow}>
      <View style={styles.factIconSlot}>{icon}</View>
      {children}
    </View>
  );
}

function StatusFact({ meta, label, animate }) {
  const blinkOpacity = useBlinkAnimation(meta.statusKind === "blinkDot" && animate);
  let icon;

  if (meta.statusKind === "check") {
    icon = <Checkmark width={10} height={10} color={meta.statusColor} thickness={2.6} />;
  } else {
    icon = (
      <Animated.View
        style={[
          styles.factDot,
          {
            backgroundColor: meta.dotColor ?? meta.statusColor,
            opacity: meta.statusKind === "blinkDot" ? blinkOpacity : 1,
          },
        ]}
      />
    );
  }

  return (
    <FactRow icon={icon}>
      <ThemedText style={styles.factStatusText} setColor={meta.statusColor} numberOfLines={1}>
        {label}
      </ThemedText>
    </FactRow>
  );
}

function GymFact({ gym, theme, otherGymColor, onPress }) {
  const { t } = useTranslation();

  if (!gym?.shortName) {
    return <View style={styles.factSpacer} />;
  }

  const color = gym.isHomeGym ? theme.primary : otherGymColor;
  const row = (
    <FactRow icon={<MapPin width={10} height={10} color={color} thickness={2.4} />}>
      <ThemedText style={styles.factGymText} setColor={color} numberOfLines={1}>
        {gym.shortName}
      </ThemedText>
    </FactRow>
  );

  if (!onPress) {
    return row;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("friends.openGymLeaderboard", { gym: gym.shortName })}
      hitSlop={{ top: 4, bottom: 6, left: 6, right: 6 }}
    >
      {row}
    </TouchableOpacity>
  );
}

/* --------------------------------------------------------------- tile -- */

function ActivityTile({
  theme,
  colorScheme,
  title,
  statusLabel,
  activityState,
  avatarUrl,
  gym,
  music,
  iconColor,
  animate,
  onPress,
  onOpenGym,
  wallpaper = null,
  mood = null,
  chargeLevel = 1,
  crown = null,
  motionSeed = 0,
}) {
  const { t } = useTranslation();
  const isLight = colorScheme === "light";
  const restDotColor = isLight ? "#B7BAC3" : "#4A4F5A";
  const otherGymColor = isLight ? "#5C6270" : "#B8BCC6";
  const meta = getActivityMeta(theme, activityState, restDotColor);
  const isLive = activityState === "live";
  const isRest = !activityState || activityState === "rest";
  const frameSeed = motionSeed + 1;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        gym?.shortName
          ? t("friends.tileLabelAtGym", { name: title, status: statusLabel, gym: gym.shortName })
          : t("friends.tileLabel", { name: title, status: statusLabel })
      }
      style={[
        styles.tile,
        {
          backgroundColor: theme.cardBackground,
          borderColor: isLive
            ? withAlpha(theme.primary, 0.45)
            : mood === "charged"
              ? withAlpha(theme.charge, 0.3)
              : theme.cardBorder,
        },
      ]}
    >
      {wallpaper ? (
        <TileWallpaper
          wallpaper={wallpaper}
          theme={theme}
          colorScheme={colorScheme}
          animate={animate}
        />
      ) : null}

      {/* The tile's mood: where the person is in their week. */}
      {mood === "embers" ? <EmberFrame theme={theme} seed={frameSeed} animate={animate} /> : null}
      {mood === "steam" ? <SteamFrame theme={theme} seed={frameSeed} animate={animate} /> : null}
      {mood === "charged" ? (
        <ChargeFrame theme={theme} seed={frameSeed} level={chargeLevel} animate={animate} />
      ) : null}
      {mood === "cobweb" ? <CobwebFrame theme={theme} seed={frameSeed} animate={animate} /> : null}

      <MusicBand
        theme={theme}
        colorScheme={colorScheme}
        music={music}
        activityState={activityState}
        animate={animate}
        hasWallpaper={Boolean(wallpaper)}
      />

      <View style={styles.tileBody}>
        <ThemedText
          style={styles.tileName}
          setColor={isRest ? theme.text : theme.title}
          numberOfLines={1}
        >
          {title}
        </ThemedText>

        <View style={[styles.factBlock, { borderTopColor: theme.hairline }]}>
          <StatusFact meta={meta} label={statusLabel} animate={animate} />
          <GymFact
            gym={gym}
            theme={theme}
            otherGymColor={otherGymColor}
            onPress={gym?.id && onOpenGym ? () => onOpenGym(gym.id, gym) : null}
          />
        </View>
      </View>

      <TileAvatar
        theme={theme}
        meta={meta}
        activityState={activityState}
        avatarUrl={avatarUrl}
        iconColor={isRest ? theme.quietText : iconColor}
        animate={animate}
        mood={mood}
        crown={crown}
        seed={motionSeed}
      />
    </TouchableOpacity>
  );
}

function AddFriendTile({ theme, colorScheme, onPress }) {
  const { t } = useTranslation();
  const dashColor =
    colorScheme === "light" ? "rgba(15, 17, 22, 0.14)" : "rgba(255, 255, 255, 0.14)";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("friends.addFriends")}
      style={[styles.addTile, { borderColor: dashColor }]}
    >
      <View style={[styles.addCircle, { borderColor: dashColor }]}>
        <Plus width={20} height={20} color={theme.quietText} thickness={1.8} />
      </View>
      <ThemedText style={styles.addLabel} setColor={theme.quietText}>
        {t("friends.addFriends")}
      </ThemedText>
    </TouchableOpacity>
  );
}

function LivePillDot({ color, animate }) {
  const blinkOpacity = useBlinkAnimation(animate);

  return (
    <Animated.View
      style={[styles.livePillDot, { backgroundColor: color, opacity: blinkOpacity }]}
    />
  );
}

/* ------------------------------------------------------------- export -- */

/**
 * The Friends activity strip: one tile per person, the viewer first, then
 * live -> done -> planned -> rest, then Add friends. Each tile carries the
 * status, the centre the workout is at, and what is playing.
 *
 * `currentUser.gym` and `currentUser.music` come from local state (the
 * running workout and the now-playing poller), everyone else's from the
 * cloud through getCirclePreview.
 */
export default function FriendsActivity({
  currentUser,
  people,
  errorMessage,
  isLoading = false,
  onSeeAll,
  onOpenProfile,
  showHeader = false,
  onAddFriend,
  onOpenGym,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { animate } = useAnimationsEnabled();
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const cardSurface = theme.cardBackground ?? theme.background;
  const iconColor = theme.text ?? theme.iconColor;
  const ownIsLive = currentUser?.activityState === "live";
  // "Set up profile" is what an account without a display name is told. While
  // the profile is still loading there is no display name either, so the
  // loading state has to be told apart from a missing profile.
  const ownStatusLabel = currentUser?.displayName
    ? buildActivityStatusLabel(currentUser, { isCurrentUser: true })
    : isLoading
      ? t("common.loading")
      : t("friends.setUpProfile");
  // live -> done -> planned -> rest, newest first inside a group. The order
  // the tiles want; the strip used to put planned before done. The one place
  // it happens - the service hands the list over unordered.
  const orderedPeople = sortActivityTiles(people ?? []);
  const liveCount =
    (ownIsLive ? 1 : 0) +
    orderedPeople.filter((person) => person?.activityState === "live").length;

  return (
    <View style={styles.section}>
      {showHeader ? (
        <View style={styles.headerRow}>
          <ThemedText style={[styles.headerEyebrow, { color: quietText }]}>
            {t("friends.eyebrow")}
          </ThemedText>

          {liveCount > 0 ? (
            <View
              style={[
                styles.livePill,
                { backgroundColor: withAlpha(theme.secondary, 0.12) },
              ]}
            >
              <LivePillDot color={theme.secondary} animate={animate} />
              <ThemedText style={[styles.livePillText, { color: theme.secondary }]}>
                {t("friends.liveCount", { count: liveCount })}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.headerSpacer} />

          <TouchableOpacity activeOpacity={0.75} onPress={onSeeAll}>
            <ThemedText style={[styles.seeAllText, { color: theme.primary }]}>
              {t("common.seeAll")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}

      {errorMessage ? (
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.noticeTitle} setColor={titleColor}>
            {t("friends.circleUnavailable")}
          </ThemedText>
          <ThemedText style={styles.noticeBody} setColor={quietText}>
            {errorMessage}
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          snapToInterval={TILE_WIDTH + TILE_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          <ActivityTile
            theme={theme}
            colorScheme={colorScheme}
            title={t("common.you")}
            statusLabel={ownStatusLabel}
            activityState={currentUser?.activityState}
            avatarUrl={currentUser?.avatarUrl}
            gym={currentUser?.gym ?? null}
            music={currentUser?.music ?? null}
            iconColor={iconColor}
            animate={animate}
            onPress={onOpenProfile}
            onOpenGym={onOpenGym}
            wallpaper={currentUser ? buildRestWallpaper(currentUser) : null}
            mood={currentUser ? buildTileMood(currentUser) : null}
            chargeLevel={currentUser ? chargeLevelFor(currentUser) : 1}
            crown={currentUser ? buildTileCrown(currentUser) : null}
          />

          {isLoading ? (
            <View style={styles.loadingTile}>
              <RingLoading color={theme.primary ?? iconColor} mutedColor={cardBorder} size={58} />
            </View>
          ) : orderedPeople.length ? (
            orderedPeople.map((person, index) => (
              <ActivityTile
                key={person.id}
                theme={theme}
                colorScheme={colorScheme}
                title={person.displayName || person.usernameBase || t("common.member")}
                statusLabel={buildActivityStatusLabel(person)}
                activityState={person.activityState}
                avatarUrl={person.avatarUrl}
                gym={person.gym ?? null}
                music={person.music ?? null}
                iconColor={iconColor}
                animate={animate}
                onPress={onSeeAll}
                onOpenGym={onOpenGym}
                wallpaper={buildRestWallpaper(person)}
                mood={buildTileMood(person)}
                chargeLevel={chargeLevelFor(person)}
                crown={buildTileCrown(person)}
                motionSeed={index + 1}
              />
            ))
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <Male width={24} height={24} color={iconColor} />
              <ThemedText style={styles.emptyTitle} setColor={titleColor}>
                {t("friends.emptyTitle")}
              </ThemedText>
              <ThemedText style={styles.emptyBody} setColor={quietText}>
                {t("friends.emptyBody")}
              </ThemedText>
            </View>
          )}

          {!isLoading && !errorMessage ? (
            <AddFriendTile
              theme={theme}
              colorScheme={colorScheme}
              onPress={onAddFriend ?? onSeeAll}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
