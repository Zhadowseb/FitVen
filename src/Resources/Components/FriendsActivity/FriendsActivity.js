import {
  Animated,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useEffect, useRef } from "react";
import Svg, { Circle } from "react-native-svg";

import styles from "./FriendsActivityStyle";
import { Colors, withAlpha } from "../../GlobalStyling/colors";
import Checkmark from "../../Icons/UI-icons/Checkmark";
import Male from "../../Icons/UI-icons/Male";
import Plus from "../../Icons/UI-icons/Plus";
import { ThemedText, UserAvatar } from "../../ThemedComponents";
import { useBlinkAnimation, usePulseAnimation } from "../animationHooks";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

// Resolves ring color + status-line content per the mock's per-state mapping:
// live -> orange (blinking dot + "Training now"/detail), done -> green
// (checkmark + detail), planned -> yellow (static dot + detail),
// rest/none -> muted hairline ring, no dot, "No activity".
function getActivityMeta(theme, activityState) {
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
        statusKind: "none",
      };
  }
}

function StatusLine({ theme, statusKind, statusColor, label }) {
  const blinkOpacity = useBlinkAnimation(statusKind === "blinkDot");

  if (statusKind === "none") {
    return (
      <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
        {label}
      </Text>
    );
  }

  return (
    <View style={styles.statusRow}>
      {statusKind === "check" ? (
        <Checkmark width={10} height={10} color={statusColor} thickness={2.6} />
      ) : (
        <Animated.View
          style={[
            styles.statusDot,
            {
              backgroundColor: statusColor,
              opacity: statusKind === "blinkDot" ? blinkOpacity : 1,
            },
          ]}
        />
      )}
      <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function LiveAvatarRing({ ringColor, cardBackground, pulseRingBackground, children }) {
  const { scale, opacity } = usePulseAnimation(true);

  return (
    <View style={styles.avatarShell}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulseRing,
          {
            backgroundColor: pulseRingBackground,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      <View style={[styles.avatarRing, { borderColor: ringColor }]}>
        <View style={[styles.avatarInner, { backgroundColor: cardBackground }]}>
          {children}
        </View>
      </View>
    </View>
  );
}

function CircleCard({
  title,
  statusLabel,
  theme,
  activityState,
  avatarUrl,
  iconColor,
  onPress,
}) {
  const meta = getActivityMeta(theme, activityState);
  const cardBackground = theme.cardBackground;
  const pulseRingBackground = withAlpha(theme.primary, 0.45);
  const avatarNode = (
    <UserAvatar
      uri={avatarUrl}
      size={56}
      iconSize={24}
      iconColor={iconColor}
      backgroundColor={cardBackground}
    />
  );

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.circleCard}>
      {activityState === "live" ? (
        <LiveAvatarRing
          ringColor={meta.ringColor}
          cardBackground={cardBackground}
          pulseRingBackground={pulseRingBackground}
        >
          {avatarNode}
        </LiveAvatarRing>
      ) : (
        <View style={styles.avatarShell}>
          <View style={[styles.avatarRing, { borderColor: meta.ringColor }]}>
            <View style={[styles.avatarInner, { backgroundColor: cardBackground }]}>
              {avatarNode}
            </View>
          </View>
        </View>
      )}

      <View style={styles.nameStatusColumn}>
        <ThemedText style={styles.circleName} numberOfLines={1}>
          {title}
        </ThemedText>
        <StatusLine
          theme={theme}
          statusKind={meta.statusKind}
          statusColor={meta.statusColor}
          label={statusLabel}
        />
      </View>
    </TouchableOpacity>
  );
}

function AddFriendCell({ theme, dashedBorderColor, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.circleCard}>
      <View style={styles.avatarShell}>
        <View
          style={[
            styles.avatarRing,
            styles.addRing,
            { borderColor: dashedBorderColor },
          ]}
        >
          <Plus width={20} height={20} color={theme.quietText} thickness={1.8} />
        </View>
      </View>
      <Text style={[styles.addLabel, { color: theme.quietText }]}>Add</Text>
    </TouchableOpacity>
  );
}

export default function FriendsActivity({
  currentUser,
  people,
  errorMessage,
  isLoading = false,
  onSeeAll,
  onOpenProfile,
  showHeader = false,
  onAddFriend,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const cardSurface = theme.cardBackground ?? theme.background;
  const iconColor = theme.text ?? theme.iconColor;
  const addRingBorderColor =
    colorScheme === "light" ? "rgba(15, 17, 22, 0.16)" : "rgba(255, 255, 255, 0.16)";
  // Instagram-style hairline that sets "You" apart from everyone else.
  const youDividerColor =
    colorScheme === "light" ? "rgba(15, 17, 22, 0.12)" : "rgba(255, 255, 255, 0.12)";
  const ownIsLive = currentUser?.activityState === "live";
  const ownStatusLabel = currentUser?.displayName
    ? currentUser?.activityState && currentUser.activityState !== "rest"
      ? ownIsLive
        ? "Training now"
        : currentUser.activityDetail ?? currentUser.workoutLabel ?? "No activity"
      : "No activity"
    : "Set up profile";
  const liveCount =
    (ownIsLive ? 1 : 0) +
    (people ?? []).filter((person) => person?.activityState === "live").length;

  return (
    <View style={styles.section}>
      {showHeader ? (
        <View style={styles.headerRow}>
          <Text style={[styles.headerEyebrow, { color: quietText }]}>
            FRIENDS ACTIVITY
          </Text>

          {liveCount > 0 ? (
            <View
              style={[
                styles.livePill,
                { backgroundColor: withAlpha(theme.secondary, 0.12) },
              ]}
            >
              <LivePillDot color={theme.secondary} />
              <Text style={[styles.livePillText, { color: theme.secondary }]}>
                {`${liveCount} LIVE`}
              </Text>
            </View>
          ) : null}

          <View style={styles.headerSpacer} />

          <TouchableOpacity activeOpacity={0.75} onPress={onSeeAll}>
            <Text style={[styles.seeAllText, { color: theme.primary }]}>See all</Text>
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
            Social circle unavailable
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
        >
          <CircleCard
            title="You"
            statusLabel={ownStatusLabel}
            theme={theme}
            activityState={currentUser?.activityState}
            avatarUrl={currentUser?.avatarUrl}
            iconColor={iconColor}
            onPress={onOpenProfile}
          />

          {!isLoading && people.length > 0 ? (
            <View
              style={[styles.youDivider, { backgroundColor: youDividerColor }]}
            />
          ) : null}

          {isLoading ? (
            <View style={styles.loadingSlot}>
              <RingLoading color={theme.primary ?? iconColor} mutedColor={cardBorder} size={58} />
            </View>
          ) : people.length ? (
            people.map((person) => {
              const statusLabel =
                person.activityState && person.activityState !== "rest"
                  ? person.activityDetail ?? person.workoutLabel ?? "No activity"
                  : "No activity";

              return (
                <CircleCard
                  key={person.id}
                  title={person.displayName || person.usernameBase || "Member"}
                  statusLabel={statusLabel}
                  theme={theme}
                  activityState={person.activityState}
                  avatarUrl={person.avatarUrl}
                  iconColor={iconColor}
                  onPress={onSeeAll}
                />
              );
            })
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
                No crew yet
              </ThemedText>
              <ThemedText style={styles.emptyBody} setColor={quietText}>
                Start following people from search to fill this strip.
              </ThemedText>
            </View>
          )}

          {!isLoading && !errorMessage ? (
            <AddFriendCell
              theme={theme}
              dashedBorderColor={addRingBorderColor}
              onPress={onAddFriend ?? onSeeAll}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function LivePillDot({ color }) {
  const blinkOpacity = useBlinkAnimation(true);

  return (
    <Animated.View
      style={[styles.livePillDot, { backgroundColor: color, opacity: blinkOpacity }]}
    />
  );
}
