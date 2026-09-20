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
import { useTranslation } from "@localization";

import styles from "./SearchPageStyle";
import FriendsActivity from "../../Resources/Components/FriendsActivity/FriendsActivity";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import MapPin from "../../Resources/Icons/UI-icons/MapPin";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import { useAuth } from "../../Contexts/AuthContext";
import { programService, socialService } from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";
import {
  ThemedButton,
  ThemedConfirmModal,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

const findFriendsImage = require("../../Resources/Images/DarkVersion/Find_friends.jpg");
const ownPostsImage = require("../../Resources/Images/DarkVersion/Social_posts_edit.jpg");

// The three lists the relationship modal can show, with the keys for each of
// their states. A map of literal keys rather than keys built from the type,
// so the parity test can see every one of them.
const RELATIONSHIP_COPY = {
  followers: {
    title: "social.relationship.followers",
    loading: "social.relationship.loadingFollowers",
    loadFailed: "social.relationship.loadFollowersFailed",
    empty: "social.relationship.noFollowers",
  },
  following: {
    title: "social.relationship.following",
    loading: "social.relationship.loadingFollowing",
    loadFailed: "social.relationship.loadFollowingFailed",
    empty: "social.relationship.noFollowing",
  },
  blocked: {
    title: "social.relationship.blocked",
    loading: "social.relationship.loadingBlocked",
    loadFailed: "social.relationship.loadBlockedFailed",
    empty: "social.relationship.noBlocked",
  },
};

const SearchPage = () => {
  const { t } = useTranslation();
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
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState(null);
  const [reportNote, setReportNote] = useState("");
  const [isReportWorking, setIsReportWorking] = useState(false);
  const [reportSentFor, setReportSentFor] = useState(null);
  const [isBlockWorking, setIsBlockWorking] = useState(false);
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const relationshipCopy =
    RELATIONSHIP_COPY[activeRelationshipType] ?? RELATIONSHIP_COPY.followers;
  const relationshipTitle = t(relationshipCopy.title);

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

      const homeGym = nextCirclePreview.currentUser?.homeGym ?? null;

      setCirclePreview({
        ...nextCirclePreview,
        currentUser: nextCirclePreview.currentUser
          ? {
              ...nextCirclePreview.currentUser,
              activityState: todayActivitySummary.activityState,
              activityDetail: todayActivitySummary.detail,
              workoutType: todayActivitySummary.workoutType,
              workoutLabel: todayActivitySummary.workoutLabel,
              gym: homeGym
                ? { id: homeGym.id, shortName: homeGym.shortName, isHomeGym: true }
                : null,
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
          : t("social.errors.loadActivityFailed"),
      );
    } finally {
      setIsLoadingFollowCounts(false);
    }
  }, [db, t, todayDate, user]);

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

    // The confirmations live inside this modal, so closing it unmounts them
    // without their own onClose ever running. Left set, the target would still
    // be there the next time the list opened and the confirmation would appear
    // on top of it, asking about somebody the user had moved on from.
    setBlockTarget(null);
    setUnblockTarget(null);
    setReportSentFor(null);
    closeReport();
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
          : t(
              (RELATIONSHIP_COPY[relationshipType] ?? RELATIONSHIP_COPY.followers)
                .loadFailed,
            ),
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
        error instanceof Error ? error.message : t("social.errors.updateBlockFailed"),
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

  const closeReport = () => {
    setReportTarget(null);
    setReportReason(null);
    setReportNote("");
  };

  const submitReport = async () => {
    const profile = reportTarget;

    if (!profile || !reportReason) {
      return;
    }

    setIsReportWorking(true);

    try {
      await socialService.reportUser({
        userId: user.id,
        targetUserId: profile.id,
        reason: reportReason,
        note: reportNote,
      });

      closeReport();
      setReportSentFor(
        profile.displayName ?? profile.username ?? t("social.report.thatAccount"),
      );
    } catch (error) {
      setRelationshipError(
        error instanceof Error ? error.message : t("social.errors.sendReportFailed"),
      );
    } finally {
      setIsReportWorking(false);
    }
  };

  // These open a list, so they are buttons with a real 44 px target on their
  // own row - as a chip beside the heading they were a 30 px strip that did not
  // look tappable.
  // The number is rendered bold on its own, so the word after it comes from a
  // key of its own too; the plural forms live in the locale, where "following"
  // has one form and "follower(s)" has two.
  const renderRelationshipButton = (relationshipType, value, labelKey, countKey) => (
    <Pressable
      key={relationshipType}
      onPress={() => handleOpenRelationshipModal(relationshipType)}
      disabled={!user?.id}
      accessibilityRole="button"
      accessibilityLabel={t(countKey, { count: value })}
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
        {` ${t(labelKey, { count: isLoadingFollowCounts ? 0 : value })}`}
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
            {t("social.todaysActivity")}
          </ThemedTitle>

          <View style={styles.storiesRail}>
            <FriendsActivity
              currentUser={circlePreview.currentUser}
              people={circlePreview.people}
              errorMessage={circlePreviewError}
              isLoading={isLoadingFollowCounts}
              onSeeAll={handleOpenUserList}
              onOpenProfile={() => navigation.navigate("ProfilePage")}
              onOpenGym={(gymId) => navigation.navigate("GymLeaderboardPage", { gym_id: gymId })}
            />
          </View>

          <View style={styles.relationshipStats}>
            {renderRelationshipButton(
              "followers",
              followCounts.followers,
              "social.followersLabel",
              "social.followersCount",
            )}
            {renderRelationshipButton(
              "following",
              followCounts.following,
              "social.followingLabel",
              "social.followingCount",
            )}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={t("social.centresAndLeaderboards")}
          onPress={() => navigation.navigate("GymsPage")}
          style={[styles.centresCard, { backgroundColor: cardSurface, borderColor: cardBorder }]}
        >
          <View style={[styles.centresIcon, { backgroundColor: withAlpha(theme.primary, 0.14) }]}>
            <MapPin width={20} height={20} color={theme.primaryText ?? theme.primary} thickness={2.2} />
          </View>
          <View style={styles.centresCopy}>
            <ThemedText style={styles.centresEyebrow} setColor={quietText}>
              {t("social.centres")}
            </ThemedText>
            <ThemedTitle type="h3" style={styles.centresTitle} numberOfLines={1}>
              {circlePreview.currentUser?.homeGym?.shortName
                ? t("social.leaderboardsAt", {
                    gym: circlePreview.currentUser.homeGym.shortName,
                  })
                : t("social.leaderboardsWhereYouTrain")}
            </ThemedTitle>
          </View>
          <ChevronRight width={20} height={20} color={quietText} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={t("social.yourWorkoutPosts")}
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
                  {t("social.heroPosts.eyebrow")}
                </ThemedText>
                <ThemedTitle
                  type="h3"
                  style={styles.heroTitle}
                  numberOfLines={1}
                >
                  {t("social.heroPosts.title")}
                </ThemedTitle>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={t("social.searchForFriends")}
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
                  {t("social.discover")}
                </ThemedText>
                <ThemedTitle
                  type="h3"
                  style={styles.heroTitle}
                  numberOfLines={1}
                >
                  {t("social.findFriends")}
                </ThemedTitle>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </ScrollView>

      <ThemedModal
        visible={Boolean(activeRelationshipType)}
        onClose={closeRelationshipModal}
        // The blocked list fell through to the followers count, so a list
        // reading "You have not blocked anyone." was headed "Blocked (1)" -
        // the number of followers. A count is only shown once the list it
        // counts has actually arrived.
        title={
          isLoadingRelationships
            ? relationshipTitle
            : t("social.relationship.titleWithCount", {
                title: relationshipTitle,
                count:
                  activeRelationshipType === "blocked"
                    ? relationshipProfiles.length
                    : activeRelationshipType === "following"
                      ? followCounts.following
                      : followCounts.followers,
              })
        }
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
            {t(relationshipCopy.loading)}
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
                  accessibilityLabel={
                    activeRelationshipType === "blocked"
                      ? t("social.unblockNamed", { name: relationshipProfile.displayName })
                      : t("social.blockNamed", { name: relationshipProfile.displayName })
                  }
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
                      ? t("social.unblock")
                      : t("social.block")}
                  </ThemedText>
                </Pressable>

                {/* Not offered on the blocked list: you have already dealt with
                    them, and a report is about the service needing to know,
                    which blocking does not cover. */}
                {activeRelationshipType !== "blocked" ? (
                  <Pressable
                    onPress={() => setReportTarget(relationshipProfile)}
                    disabled={isBlockWorking || isReportWorking}
                    accessibilityRole="button"
                    accessibilityLabel={t("social.report.reportNamed", {
                      name: relationshipProfile.displayName,
                    })}
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
                      setColor={quietText}
                    >
                      {t("social.report.action")}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <ThemedText style={styles.relationshipStateText} setColor={quietText}>
            {t(relationshipCopy.empty)}
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
                ? t("social.relationship.backToFollowers")
                : t("social.relationship.blockedAccounts")}
            </ThemedText>
          </Pressable>
        </View>

        <ThemedButton
          title={t("common.close")}
          variant="secondary"
          onPress={closeRelationshipModal}
          fullWidth
          height={44}
          style={styles.relationshipCloseButton}
        />

        {/* These three live inside the list modal rather than beside it.
            On Android a Modal is just a view and two can be on screen at once;
            on iOS UIKit presents one at a time and silently drops the second,
            so a confirmation opened as a sibling of an open sheet never
            appeared and the button looked dead. Nested in the tree, the outer
            modal presents the inner one. Blocking is one of the four things
            Apple's guideline 1.2 requires, so it failing on iOS was not a
            cosmetic bug. */}
        <ThemedConfirmModal
          visible={Boolean(reportTarget)}
          title={t("social.report.title", {
            name:
              reportTarget?.displayName ??
              reportTarget?.username ??
              t("social.thisPerson"),
          })}
          message={t("social.report.message")}
          confirmLabel={t("social.report.send")}
          cancelLabel={t("common.cancel")}
          tone="danger"
          isWorking={isReportWorking}
          onConfirm={submitReport}
          onClose={closeReport}
        >
          <View style={styles.reportReasonList}>
            {socialService.REPORT_REASONS.map((option) => {
              const selected = reportReason === option.value;
              const label = t(option.labelKey);

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setReportReason(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.reportReason,
                    {
                      borderColor: selected ? theme.danger : cardBorder,
                      backgroundColor: theme.chipBackground,
                    },
                    pressed ? styles.relationshipActionPressed : null,
                  ]}
                >
                  <ThemedText
                    style={styles.reportReasonText}
                    setColor={selected ? theme.danger : titleColor}
                  >
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedTextInput
            value={reportNote}
            onChangeText={setReportNote}
            placeholder={t("social.report.notePlaceholder")}
            multiline
            maxLength={socialService.REPORT_NOTE_MAX_LENGTH}
            style={styles.reportNote}
          />
        </ThemedConfirmModal>

        <ThemedConfirmModal
          visible={Boolean(reportSentFor)}
          title={t("social.report.sentTitle")}
          message={t("social.report.sentMessage", { name: reportSentFor })}
          confirmLabel={t("common.done")}
          cancelLabel={t("common.close")}
          onConfirm={() => setReportSentFor(null)}
          onClose={() => setReportSentFor(null)}
        />

        <ThemedConfirmModal
          visible={Boolean(blockTarget)}
          title={t("social.blockConfirm.title")}
          message={t("social.blockConfirm.message", {
            name:
              blockTarget?.displayName ??
              blockTarget?.username ??
              t("social.thisPersonSubject"),
          })}
          confirmLabel={t("social.block")}
          cancelLabel={t("common.cancel")}
          tone="danger"
          isWorking={isBlockWorking}
          onConfirm={confirmBlock}
          onClose={() => setBlockTarget(null)}
        />

        <ThemedConfirmModal
          visible={Boolean(unblockTarget)}
          title={t("social.unblockConfirm.title")}
          message={t("social.unblockConfirm.message", {
            name:
              unblockTarget?.displayName ??
              unblockTarget?.username ??
              t("social.thisPersonSubject"),
          })}
          confirmLabel={t("social.unblock")}
          cancelLabel={t("common.cancel")}
          isWorking={isBlockWorking}
          onConfirm={confirmUnblock}
          onClose={() => setUnblockTarget(null)}
        />
      </ThemedModal>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default SearchPage;
