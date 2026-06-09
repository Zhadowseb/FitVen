import {
  Animated,
  Easing,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useEffect, useRef } from "react";
import Svg, { Circle } from "react-native-svg";

import styles from "./FriendsActivityStyle";
import { Colors } from "../../GlobalStyling/colors";
import Calender from "../../Icons/UI-icons/Calender";
import Checkmark from "../../Icons/UI-icons/Checkmark";
import Male from "../../Icons/UI-icons/Male";
import { getWorkoutIconConfig } from "../../Icons/WorkoutLabels";
import {
  ThemedText,
  UserAvatar,
} from "../../ThemedComponents";

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
            easing: Easing.out(Easing.cubic),
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

function getActivityMeta(theme, activityState, workoutType) {
  const primary = theme.primary ?? "#f7742e";
  const secondary = theme.secondary ?? "#60daac";
  const darkText = theme.background ?? theme.textInverted ?? "#0E0F12";
  const border = theme.border ?? theme.cardBorder ?? theme.iconColor;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const plannedColor = theme.planned ?? Colors.dark.planned ?? "#ffdd00";
  const workoutIconConfig = workoutType ? getWorkoutIconConfig(workoutType) : null;
  const defaultLiveIconConfig = getWorkoutIconConfig("Resistance");

  switch (activityState) {
    case "live":
      return {
        ringColor: primary,
        chipBackground: primary,
        chipTextColor: darkText,
        badgeBackground: primary,
        badgeType: "workout",
        badgeIconConfig: workoutIconConfig ?? defaultLiveIconConfig,
      };
    case "done":
      return {
        ringColor: secondary,
        chipBackground: secondary,
        chipTextColor: darkText,
        badgeBackground: secondary,
        badgeType: "done",
      };
    case "planned":
      return {
        ringColor: plannedColor,
        chipBackground: plannedColor,
        chipTextColor: darkText,
        badgeBackground: plannedColor,
        badgeIconColor: darkText,
        badgeType: "planned",
      };
    default:
      return {
        ringColor: border,
        chipBackground: theme.uiBackground ?? "rgba(255, 255, 255, 0.08)",
        chipTextColor: quietText,
        badgeBackground: null,
        badgeType: null,
      };
  }
}

function getCircleMeta(theme, person) {
  return getActivityMeta(theme, person?.activityState, person?.workoutType);
}

function StatusBadge({
  badgeType,
  badgeBackground,
  badgeIconColor,
  badgeIconConfig,
}) {
  if (!badgeType || !badgeBackground) {
    return null;
  }

  let icon = null;

  if (badgeType === "done") {
    icon = (
      <Checkmark width={12} height={12} color="#0E0F12" thickness={2.3} />
    );
  } else if (badgeType === "planned") {
    icon = (
      <Calender
        width={12}
        height={12}
        color={badgeIconColor ?? "#0E0F12"}
        thickness={1.8}
      />
    );
  } else if (badgeType === "workout" && badgeIconConfig?.Icon) {
    const WorkoutIcon = badgeIconConfig.Icon;
    icon =
      badgeIconConfig.id === "Run" ? (
        <WorkoutIcon width={12} height={12} primaryColor="#ffffff" />
      ) : (
        <WorkoutIcon width={12} height={12} color="#ffffff" />
      );
  }

  if (!icon) {
    return null;
  }

  return (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: badgeBackground,
        },
      ]}
    >
      {icon}
    </View>
  );
}

function CircleCard({
  title,
  subtitle,
  ringColor,
  chipBackground,
  chipTextColor,
  iconColor,
  avatarBackgroundColor,
  avatarUrl,
  badgeType,
  badgeBackground,
  badgeIconColor,
  badgeIconConfig,
  onPress,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.circleCard}
    >
      <View style={styles.avatarShell}>
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: ringColor,
            },
          ]}
        >
          <View
            style={[
              styles.avatarInner,
              {
                backgroundColor: avatarBackgroundColor,
              },
            ]}
          >
            <UserAvatar
              uri={avatarUrl}
              size={56}
              iconSize={28}
              iconColor={iconColor}
              backgroundColor={avatarBackgroundColor}
            />
          </View>
        </View>
        <StatusBadge
          badgeType={badgeType}
          badgeBackground={badgeBackground}
          badgeIconColor={badgeIconColor}
          badgeIconConfig={badgeIconConfig}
        />
      </View>

      <ThemedText style={styles.circleName} numberOfLines={1}>
        {title}
      </ThemedText>

      {subtitle ? (
        <View
          style={[
            styles.circleBadge,
            {
              backgroundColor: chipBackground,
            },
          ]}
        >
          <ThemedText style={styles.circleBadgeText} setColor={chipTextColor}>
            {subtitle}
          </ThemedText>
        </View>
      ) : null}
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
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const cardSurface = theme.cardBackground ?? theme.background;
  const avatarBackgroundColor =
    theme.uiBackground ?? theme.inputBackground ?? "rgba(255,255,255,0.08)";
  const iconColor = theme.primary ?? theme.text;
  const currentUserMeta = getActivityMeta(
    theme,
    currentUser?.activityState,
    currentUser?.workoutType
  );
  const ownProfileSubtitle =
    currentUser?.displayName
      ? currentUser?.activityState && currentUser.activityState !== "rest"
        ? currentUser.activityDetail ?? currentUser.workoutLabel ?? "No activity"
        : "No activity"
      : "Set up profile";

  return (
    <View style={styles.section}>
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
            subtitle={ownProfileSubtitle}
            ringColor={currentUserMeta.ringColor}
            chipBackground={currentUserMeta.chipBackground}
            chipTextColor={currentUserMeta.chipTextColor}
            iconColor={iconColor}
            avatarBackgroundColor={avatarBackgroundColor}
            avatarUrl={currentUser?.avatarUrl}
            badgeType={currentUserMeta.badgeType}
            badgeBackground={currentUserMeta.badgeBackground}
            badgeIconColor={currentUserMeta.badgeIconColor}
            badgeIconConfig={currentUserMeta.badgeIconConfig}
            onPress={onOpenProfile}
          />

          <View
            style={[
              styles.divider,
              {
                backgroundColor: cardBorder,
              },
            ]}
          />

          {isLoading ? (
            <View style={styles.loadingSlot}>
              <RingLoading
                color={theme.primary ?? iconColor}
                mutedColor={cardBorder}
                size={58}
              />
            </View>
          ) : people.length ? (
            people.map((person) => {
              const meta = getCircleMeta(theme, person);
              const subtitle =
                person.activityState && person.activityState !== "rest"
                  ? person.activityDetail ?? person.workoutLabel ?? "No activity"
                  : "No activity";

              return (
                <CircleCard
                  key={person.id}
                  title={person.displayName || person.usernameBase || "Member"}
                  subtitle={subtitle}
                  ringColor={meta.ringColor}
                  chipBackground={meta.chipBackground}
                  chipTextColor={meta.chipTextColor}
                  iconColor={iconColor}
                  avatarBackgroundColor={avatarBackgroundColor}
                  avatarUrl={person.avatarUrl}
                  badgeType={meta.badgeType}
                  badgeBackground={meta.badgeBackground}
                  badgeIconColor={meta.badgeIconColor}
                  badgeIconConfig={meta.badgeIconConfig}
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
        </ScrollView>
      )}
    </View>
  );
}
