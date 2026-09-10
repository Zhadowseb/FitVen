import { StatusBar } from "expo-status-bar";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./SearchPageStyle";
import FriendsActivity from "../../Resources/Components/FriendsActivity/FriendsActivity";
import { Colors } from "../../Resources/GlobalStyling/colors";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import { useAuth } from "../../Contexts/AuthContext";
import { programService, socialService } from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";
import {
  ThemedButton,
  ThemedConfirmModal,
  ThemedModal,
  ThemedText,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

const findFriendsImage = require("../../Resources/Images/DarkVersion/Find_friends.jpg");
const ownPostsImage = require("../../Resources/Images/DarkVersion/Social_posts_edit.jpg");

const SearchPage = () => {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const navigation = useNavigation();
  const { user } = useAuth();
  const todayDate = getTodaysDate();
  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const [followCounts, setFollowCounts] = useState({
    followers: 0,
    following: 0,
  });
  const [isLoadingFollowCounts, setIsLoadingFollowCounts] = useState(true);
  const [activeRelationshipType, setActiveRelationshipType] = useState(null);
  const [relationshipProfiles, setRelationshipProfiles] = useState([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [relationshipError, setRelationshipError] = useState("");
  const [blockTarget, setBlockTarget] = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);
  const [isBlockWorking, setIsBlockWorking] = useState(false);
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const relationshipTitle =
    activeRelationshipType === "following"
      ? "Following"
      : activeRelationshipType === "blocked"
        ? "Blocked"
        : "Followers";

  const loadCirclePreview = useCallback(async () => {
    if (!user?.id) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setFollowCounts({
        followers: 0,
        following: 0,
      });
      setIsLoadingFollowCounts(false);
      setCirclePreviewError("");
      return;
    }

    setCirclePreviewError("");
    setIsLoadingFollowCounts(true);

    try {
      const [nextCirclePreview, todayActivitySummary, nextFollowCounts] =
        await Promise.all([
          socialService.getCirclePreview({
            user,
            limit: 12,
            date: todayDate,
          }),
          programService.getTodayActivitySummary(db, {
            date: todayDate,
          }),
          socialService.getFollowCounts({
            userId: user.id,
          }),
        ]);

      setCirclePreview({
        ...nextCirclePreview,
        currentUser: nextCirclePreview.currentUser
          ? {
              ...nextCirclePreview.currentUser,
              activityState: todayActivitySummary.activityState,
              activityDetail: todayActivitySummary.detail,
              workoutType: todayActivitySummary.workoutType,
              workoutLabel: todayActivitySummary.workoutLabel,
            }
          : null,
      });
      setFollowCounts(nextFollowCounts);
    } catch (error) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setFollowCounts({
        followers: 0,
        following: 0,
      });
      setCirclePreviewError(
        error instanceof Error
          ? error.message
          : "Could not load today's activity.",
      );
    } finally {
      setIsLoadingFollowCounts(false);
    }
  }, [db, todayDate, user]);

  useFocusEffect(
    useCallback(() => {
      loadCirclePreview();
    }, [loadCirclePreview]),
  );

  const handleOpenUserList = () => {
    navigation.navigate("SocialUserListPage");
  };

  const closeRelationshipModal = () => {
    setActiveRelationshipType(null);
    setRelationshipProfiles([]);
    setRelationshipError("");
    setIsLoadingRelationships(false);
  };

  const loadRelationshipProfiles = async (relationshipType) => {
    if (relationshipType === "following") {
      return socialService.getFollowing({
        userId: user.id,
        currentUserId: user.id,
      });
    }

    if (relationshipType === "blocked") {
      return socialService.getBlockedProfiles({ userId: user.id });
    }

    return socialService.getFollowers({
      userId: user.id,
      currentUserId: user.id,
    });
  };

  const handleOpenRelationshipModal = async (relationshipType) => {
    if (!user?.id) {
      return;
    }

    setActiveRelationshipType(relationshipType);
    setRelationshipProfiles([]);
    setRelationshipError("");
    setIsLoadingRelationships(true);

    try {
      setRelationshipProfiles(await loadRelationshipProfiles(relationshipType));
    } catch (error) {
      setRelationshipError(
        error instanceof Error
          ? error.message
          : `Could not load ${relationshipType}.`,
      );
    } finally {
      setIsLoadingRelationships(false);
    }
  };

  // Blocking cuts the follow in both directions, so the counts on the page
  // behind the modal are stale the moment it succeeds.
  const applyBlockChange = async (action) => {
    if (!user?.id || isBlockWorking) {
      return;
    }

    setIsBlockWorking(true);
    setRelationshipError("");

    try {
      await action();
      await loadCirclePreview();
      setRelationshipProfiles(
        await loadRelationshipProfiles(activeRelationshipType),
      );
    } catch (error) {
      setRelationshipError(
        error instanceof Error ? error.message : "Could not update the block.",
      );
    } finally {
      setIsBlockWorking(false);
    }
  };

  const confirmBlock = () => {
    const profile = blockTarget;
    setBlockTarget(null);

    if (profile) {
      void applyBlockChange(() =>
        socialService.blockUser({
          userId: user.id,
          targetUserId: profile.id,
        }),
      );
    }
  };

  const confirmUnblock = () => {
    const profile = unblockTarget;
    setUnblockTarget(null);

    if (profile) {
      void applyBlockChange(() =>
        socialService.unblockUser({
          userId: user.id,
          targetUserId: profile.id,
        }),
      );
    }
  };

  // These open a list, so they are buttons with a real 44 px target on their
  // own row - as a chip beside the heading they were a 30 px strip that did not
  // look tappable.
  const renderRelationshipButton = (relationshipType, label, value) => (
    <Pressable
      key={relationshipType}
      onPress={() => handleOpenRelationshipModal(relationshipType)}
      disabled={!user?.id}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [
        styles.relationshipStat,
        {
          backgroundColor: theme.chipBackground,
          borderColor: cardBorder,
        },
        pressed && user?.id ? styles.relationshipStatPressed : null,
      ]}
    >
      <ThemedText style={styles.relationshipStatText} setColor={quietText}>
        <ThemedText
          style={styles.relationshipStatValue}
          setColor={titleColor}
        >
          {isLoadingFollowCounts ? "..." : value}
        </ThemedText>
        {` ${label}`}
      </ThemedText>
    </Pressable>
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.storiesSection}>
          <ThemedTitle type="h3" style={styles.sectionTitle}>
            Today&apos;s activity
          </ThemedTitle>

          <View style={styles.storiesRail}>
            <FriendsActivity
              currentUser={circlePreview.currentUser}
              people={circlePreview.people}
              errorMessage={circlePreviewError}
              isLoading={isLoadingFollowCounts}
              onSeeAll={handleOpenUserList}
              onOpenProfile={() => navigation.navigate("ProfilePage")}
            />
          </View>

          <View style={styles.relationshipStats}>
            {renderRelationshipButton(
              "followers",
              "followers",
              followCounts.followers,
            )}
            {renderRelationshipButton(
              "following",
              "following",
              followCounts.following,
            )}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel="Your workout posts"
          onPress={() => navigation.navigate("WorkoutPostsPage")}
          style={[styles.heroCard, styles.heroCardPosts]}
        >
          <ImageBackground
            source={ownPostsImage}
            resizeMode="cover"
            style={styles.heroImage}
          >
            <View style={styles.heroScrim} />

            <View style={styles.heroContent}>
              <View style={styles.heroActionRow}>
                <View style={styles.heroActionIcon}>
                  <TailArrowUpRight
                    width={15}
                    height={15}
                    stroke="#ffffff"
                    color="#ffffff"
                  />
                </View>
              </View>

              <View style={styles.heroCopy}>
                <ThemedText style={styles.heroEyebrow} setColor="#ffffff">
                  Your Workout
                </ThemedText>
                <ThemedTitle
                  type="h3"
                  style={styles.heroTitle}
                  numberOfLines={1}
                >
                  Posts
                </ThemedTitle>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel="Search for friends"
          onPress={handleOpenUserList}
          style={[styles.heroCard, styles.heroCardFriends]}
        >
          <ImageBackground
            source={findFriendsImage}
            resizeMode="cover"
            style={styles.heroImage}
          >
            <View style={styles.heroScrim} />

            <View style={styles.heroContent}>
              <View style={styles.heroActionRow}>
                <View style={styles.heroActionIcon}>
                  <TailArrowUpRight
                    width={15}
                    height={15}
                    stroke="#ffffff"
                    color="#ffffff"
                  />
                </View>
              </View>

              <View style={styles.heroCopy}>
                <ThemedText style={styles.heroEyebrow} setColor="#ffffff">
                  Discover
                </ThemedText>
                <ThemedTitle
                  type="h3"
                  style={styles.heroTitle}
                  numberOfLines={1}
                >
                  Find Friends
                </ThemedTitle>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </ScrollView>

      <ThemedModal
        visible={Boolean(activeRelationshipType)}
        onClose={closeRelationshipModal}
        title={`${relationshipTitle} (${
          activeRelationshipType === "following"
            ? followCounts.following
            : followCounts.followers
        })`}
        style={[
          styles.relationshipModal,
          {
            backgroundColor: cardSurface,
          },
        ]}
        contentStyle={styles.relationshipModalContent}
      >
        {isLoadingRelationships ? (
          <ThemedText style={styles.relationshipStateText} setColor={quietText}>
            Loading {relationshipTitle.toLowerCase()}...
          </ThemedText>
        ) : relationshipError ? (
          <ThemedText
            style={styles.relationshipStateText}
            setColor={theme.danger}
          >
            {relationshipError}
          </ThemedText>
        ) : relationshipProfiles.length ? (
          <ScrollView
            style={styles.relationshipList}
            contentContainerStyle={styles.relationshipListContent}
            showsVerticalScrollIndicator={false}
          >
            {relationshipProfiles.map((relationshipProfile) => (
              <View
                key={relationshipProfile.id}
                style={[
                  styles.relationshipRow,
                  {
                    borderBottomColor: cardBorder,
                  },
                ]}
              >
                <UserAvatar
                  uri={relationshipProfile.avatarUrl}
                  size={44}
                  iconSize={22}
                  iconColor={theme.primary ?? titleColor}
                  backgroundColor={
                    theme.fields ?? theme.uiBackground ?? theme.background
                  }
                  borderColor={cardBorder}
                  borderWidth={1}
                />
                <View style={styles.relationshipCopy}>
                  <ThemedText
                    style={styles.relationshipDisplayName}
                    setColor={titleColor}
                  >
                    {relationshipProfile.displayName}
                  </ThemedText>
                  <ThemedText
                    style={styles.relationshipUsername}
                    setColor={quietText}
                  >
                    {relationshipProfile.username}
                  </ThemedText>
                </View>

                <Pressable
                  onPress={() =>
                    activeRelationshipType === "blocked"
                      ? setUnblockTarget(relationshipProfile)
                      : setBlockTarget(relationshipProfile)
                  }
                  disabled={isBlockWorking}
                  accessibilityRole="button"
                  accessibilityLabel={`${
                    activeRelationshipType === "blocked" ? "Unblock" : "Block"
                  } ${relationshipProfile.displayName}`}
                  style={({ pressed }) => [
                    styles.relationshipAction,
                    {
                      borderColor: cardBorder,
                      backgroundColor: theme.chipBackground,
                    },
                    pressed ? styles.relationshipActionPressed : null,
                  ]}
                >
                  <ThemedText
                    style={styles.relationshipActionText}
                    setColor={
                      activeRelationshipType === "blocked"
                        ? titleColor
                        : theme.danger
                    }
                  >
                    {activeRelationshipType === "blocked"
                      ? "Unblock"
                      : "Block"}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <ThemedText style={styles.relationshipStateText} setColor={quietText}>
            {activeRelationshipType === "following"
              ? "You are not following anyone yet."
              : activeRelationshipType === "blocked"
                ? "You have not blocked anyone."
                : "No one is following you yet."}
          </ThemedText>
        )}

        {/* The way back to an account you blocked. It lives here rather than as
            a third chip on the page, because a permanent "0 blocked" counter
            beside your followers is not something anyone needs to look at. */}
        <View style={styles.relationshipFooter}>
          <Pressable
            onPress={() =>
              handleOpenRelationshipModal(
                activeRelationshipType === "blocked" ? "followers" : "blocked",
              )
            }
            disabled={isLoadingRelationships || isBlockWorking}
            accessibilityRole="button"
            style={styles.relationshipFooterLink}
          >
            <ThemedText
              style={styles.relationshipFooterText}
              setColor={theme.primaryText ?? titleColor}
            >
              {activeRelationshipType === "blocked"
                ? "Back to followers"
                : "Blocked accounts"}
            </ThemedText>
          </Pressable>
        </View>

        <ThemedButton
          title="Close"
          variant="secondary"
          onPress={closeRelationshipModal}
          fullWidth
          height={44}
          style={styles.relationshipCloseButton}
        />
      </ThemedModal>

      <ThemedConfirmModal
        visible={Boolean(blockTarget)}
        title="Block this person?"
        message={`${
          blockTarget?.displayName ?? blockTarget?.username ?? "This person"
        } will stop following you and you will stop following them. They will not be told, and they will not be able to follow you again or find you in search.`}
        confirmLabel="Block"
        cancelLabel="Cancel"
        tone="danger"
        isWorking={isBlockWorking}
        onConfirm={confirmBlock}
        onClose={() => setBlockTarget(null)}
      />

      <ThemedConfirmModal
        visible={Boolean(unblockTarget)}
        title="Unblock this person?"
        message={`${
          unblockTarget?.displayName ?? unblockTarget?.username ?? "This person"
        } will be able to find you and follow you again. Neither of you starts following the other.`}
        confirmLabel="Unblock"
        cancelLabel="Cancel"
        isWorking={isBlockWorking}
        onConfirm={confirmUnblock}
        onClose={() => setUnblockTarget(null)}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default SearchPage;
