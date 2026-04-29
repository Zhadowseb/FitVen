import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./FriendsActivityStyle";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Calender from "../../../../Resources/Icons/UI-icons/Calender";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import Male from "../../../../Resources/Icons/UI-icons/Male";
import { getWorkoutIconConfig } from "../../../../Resources/Icons/WorkoutLabels";
import {
  ThemedText,
  ThemedTitle,
  UserAvatar,
} from "../../../../Resources/ThemedComponents";

function getActivityMeta(theme, activityState, workoutType) {
  const primary = theme.primary ?? "#f7742e";
  const secondary = theme.secondary ?? "#60daac";
  const darkText = theme.background ?? theme.textInverted ?? "#0E0F12";
  const border = theme.border ?? theme.cardBorder ?? theme.iconColor;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const plannedColor = "#5f91ff";
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
        chipTextColor: "#ffffff",
        badgeBackground: plannedColor,
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
    icon = <Calender width={12} height={12} color="#ffffff" thickness={1.8} />;
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
  isLoading,
  errorMessage,
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
  const primary = theme.primary ?? "#f7742e";
  const currentUserMeta = getActivityMeta(
    theme,
    currentUser?.activityState,
    currentUser?.workoutType
  );
  const sectionSubtitle = isLoading
    ? "Loading your crew..."
    : currentUser?.activityState === "live"
      ? "Your workout is live right now"
      : currentUser?.activityState === "planned"
        ? "You have training planned today"
        : currentUser?.activityState === "done"
          ? "You finished your training today"
    : people.length > 0
      ? `${people.length} ${people.length === 1 ? "person" : "people"} in your circle`
      : "Follow people to build your crew";
  const ownProfileSubtitle =
    currentUser?.displayName
      ? currentUser?.activityState && currentUser.activityState !== "rest"
        ? currentUser.activityDetail ?? currentUser.workoutLabel ?? "No activity"
        : "No activity"
      : "Set up profile";

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <ThemedTitle type="h3" style={styles.sectionTitle}>
            Crew activity
          </ThemedTitle>
          <ThemedText style={styles.sectionSubtitle} setColor={quietText}>
            {sectionSubtitle}
          </ThemedText>
        </View>

        <TouchableOpacity activeOpacity={0.82} onPress={onSeeAll}>
          <ThemedText style={styles.seeAllText} setColor={primary}>
            See all
          </ThemedText>
        </TouchableOpacity>
      </View>

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

          {people.length ? (
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
