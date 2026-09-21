import {
  Animated,
  AppState,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { useTranslation } from "@localization";

import styles, { TILE_GAP, TILE_WIDTH } from "./FriendsActivityStyle";
import { Colors, withAlpha } from "../../GlobalStyling/colors";
import Checkmark from "../../Icons/UI-icons/Checkmark";
import Male from "../../Icons/UI-icons/Male";
import MapPin from "../../Icons/UI-icons/MapPin";
import MusicNote from "../../Icons/UI-icons/MusicNote";
import Plus from "../../Icons/UI-icons/Plus";
import { ThemedText, UserAvatar } from "../../ThemedComponents";
import {
  useBlinkAnimation,
  useEqualizerAnimation,
  usePulseAnimation,
  useReduceMotion,
  useTickerAnimation,
} from "../animationHooks";
import {
  buildActivityStatusLabel,
  formatMusicLine,
  resolveMusicBandState,
  sortActivityTiles,
} from "@utils/friendsActivityUtils";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const TICKER_COPY_PADDING = 18;

let gradientInstanceCounter = 0;

// Whether the loops may run: on screen, app in the foreground, and the OS not
// asking for reduced motion. Everything animated in this file reads this.
function useAnimationsEnabled() {
  const isFocused = useIsFocused();
  const reduceMotion = useReduceMotion();
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active" || AppState.currentState == null
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(nextState === "active");
    });

    return () => subscription.remove();
  }, []);

  return { animate: isFocused && isAppActive && !reduceMotion, reduceMotion };
}

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

function MusicBand({ theme, colorScheme, music, activityState, animate }) {
  const { t } = useTranslation();
  const state = resolveMusicBandState(music, activityState);
  const isLight = colorScheme === "light";
  const quietBandFrom = isLight ? "rgba(15, 17, 22, 0.05)" : "rgba(255, 255, 255, 0.08)";
  const quietBandTo = isLight ? "rgba(15, 17, 22, 0.05)" : "rgba(255, 255, 255, 0.03)";
  const emptyBand = isLight ? "rgba(15, 17, 22, 0.03)" : "rgba(255, 255, 255, 0.03)";
  const equalizerColor = isLight ? theme.musicText : "#EADDFF";

  if (state === "none") {
    return <View style={[styles.band, { backgroundColor: emptyBand }]} />;
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

/* ------------------------------------------------------------- avatar -- */

function TileAvatar({ theme, meta, activityState, avatarUrl, iconColor, animate }) {
  const isLive = activityState === "live";
  const { scale, opacity } = usePulseAnimation(isLive && animate);

  return (
    <View style={styles.avatarSlot} pointerEvents="none">
      <View style={styles.avatarShell}>
        {isLive ? (
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
        <View style={[styles.avatarRing, { borderColor: meta.ringColor, backgroundColor: theme.cardBackground }]}>
          <View style={[styles.avatarInner, { backgroundColor: theme.cardBackground }]}>
            <UserAvatar
              uri={avatarUrl}
              size={48}
              iconSize={24}
              iconColor={iconColor}
              backgroundColor={theme.cardBackground}
            />
          </View>
        </View>
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
}) {
  const { t } = useTranslation();
  const isLight = colorScheme === "light";
  const restDotColor = isLight ? "#B7BAC3" : "#4A4F5A";
  const otherGymColor = isLight ? "#5C6270" : "#B8BCC6";
  const meta = getActivityMeta(theme, activityState, restDotColor);
  const isLive = activityState === "live";
  const isRest = !activityState || activityState === "rest";

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
          borderColor: isLive ? withAlpha(theme.primary, 0.45) : theme.cardBorder,
        },
      ]}
    >
      <MusicBand
        theme={theme}
        colorScheme={colorScheme}
        music={music}
        activityState={activityState}
        animate={animate}
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
          />

          {isLoading ? (
            <View style={styles.loadingTile}>
              <RingLoading color={theme.primary ?? iconColor} mutedColor={cardBorder} size={58} />
            </View>
          ) : orderedPeople.length ? (
            orderedPeople.map((person) => (
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
