import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./FriendsActivityStyle";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Male from "../../../../Resources/Icons/UI-icons/Male";
import { ThemedText, ThemedTitle } from "../../../../Resources/ThemedComponents";

function getRelationshipMeta(theme, relationshipType) {
  const primary = theme.primary ?? "#f7742e";
  const secondary = theme.secondary ?? "#60daac";
  const border = theme.border ?? theme.cardBorder ?? theme.iconColor;

  switch (relationshipType) {
    case "mutual":
      return {
        label: "Mutual",
        ringColor: primary,
        chipBackground: theme.primaryLight ?? "rgba(247, 116, 46, 0.16)",
        chipTextColor: theme.primaryDark ?? primary,
      };
    case "follower":
      return {
        label: "Follows you",
        ringColor: border,
        chipBackground: theme.uiBackground ?? "rgba(255, 255, 255, 0.08)",
        chipTextColor: theme.quietText ?? theme.text,
      };
    default:
      return {
        label: "Following",
        ringColor: secondary,
        chipBackground: theme.secondaryLight ?? "rgba(96, 218, 172, 0.16)",
        chipTextColor: theme.secondaryDark ?? secondary,
      };
  }
}

function CircleCard({
  title,
  subtitle,
  ringColor,
  chipBackground,
  chipTextColor,
  iconColor,
  avatarBackgroundColor,
  onPress,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.circleCard}
    >
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
          <Male width={30} height={30} color={iconColor} />
        </View>
      </View>

      <ThemedText style={styles.circleName} numberOfLines={1}>
        {title}
      </ThemedText>

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
  const secondary = theme.secondary ?? "#60daac";
  const sectionSubtitle = isLoading
    ? "Loading your crew..."
    : people.length > 0
      ? `${people.length} ${people.length === 1 ? "person" : "people"} in your circle`
      : "Follow people to build your crew";
  const ownProfileSubtitle = currentUser?.displayName
    ? "Your profile"
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
            ringColor={secondary}
            chipBackground={theme.secondaryLight ?? "rgba(96, 218, 172, 0.16)"}
            chipTextColor={theme.secondaryDark ?? secondary}
            iconColor={iconColor}
            avatarBackgroundColor={avatarBackgroundColor}
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
              const meta = getRelationshipMeta(theme, person.relationshipType);

              return (
                <CircleCard
                  key={person.id}
                  title={person.displayName || person.usernameBase || "Member"}
                  subtitle={meta.label}
                  ringColor={meta.ringColor}
                  chipBackground={meta.chipBackground}
                  chipTextColor={meta.chipTextColor}
                  iconColor={iconColor}
                  avatarBackgroundColor={avatarBackgroundColor}
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
