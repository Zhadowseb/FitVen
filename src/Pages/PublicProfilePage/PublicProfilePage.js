import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import { formatNumber, useTranslation } from "@localization";

import styles from "./PublicProfilePageStyle";
import ActivityBars from "./Components/ActivityBars";
import PostsGrid from "./Components/PostsGrid";
import RecordRow from "./Components/RecordRow";
import { useAuth } from "@contexts/AuthContext";
import { gymService, publicProfileService, socialService } from "@services";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import ChevronLeft from "@resources/Icons/UI-icons/ChevronLeft";
import Eye from "@resources/Icons/UI-icons/Eye";
import Flag from "@resources/Icons/UI-icons/Flag";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import Plus from "@resources/Icons/UI-icons/Plus";
import ThreeDots from "@resources/Icons/UI-icons/ThreeDots";
import {
  ThemedBottomSheet,
  ThemedConfirmModal,
  ThemedStateBlock,
  ThemedText,
  ThemedTextInput,
  ThemedView,
  UserAvatar,
} from "@resources/ThemedComponents";
import {
  ACTIVITY_WEEKS,
  PROFILE_POST_GRID_SIZE,
  averageWorkoutsPerWeek,
  isSharedCentre,
} from "@utils/publicProfileUtils";

const EMPTY_POSTS = { items: [], total: 0, failed: false };

/**
 * Somebody else's profile: who they are, where they train, what they lift and
 * whether they train regularly - enough to decide whether to follow them.
 *
 * Not ProfilePage. Your own profile has settings and editing and this has none
 * of it, so the two are separate screens rather than one with a flag. Your own
 * id is sent on to ProfilePage - except with `preview`, where this is "How
 * others see you": no menu, a banner, Follow shown but not pressable, and the
 * centre line never in your colour, because that depends on who is looking.
 *
 * Followers and Following are counts, not links. The follow graph was made
 * private on purpose (supabase/migrations/20260905143000_user-blocks.sql), and
 * somebody's profile is not the way around that.
 */
export default function PublicProfilePage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const userId = route.params?.userId ? String(route.params.userId) : null;
  const isPreview = route.params?.preview === true;
  const isOwnProfile = Boolean(viewerId) && userId === viewerId && !isPreview;
  const [status, setStatus] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [viewerGymId, setViewerGymId] = useState(null);
  const [posts, setPosts] = useState(EMPTY_POSTS);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFollowBusy, setIsFollowBusy] = useState(false);
  const [followError, setFollowError] = useState("");
  const [isUnfollowOpen, setIsUnfollowOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [isBlockWorking, setIsBlockWorking] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(null);
  const [reportNote, setReportNote] = useState("");
  const [isReportWorking, setIsReportWorking] = useState(false);
  const [reportError, setReportError] = useState("");
  // What was picked in the menu, run once the sheet has gone: iOS drops a
  // modal - or the share sheet - presented while another is still up.
  const pendingMenuActionRef = useRef(null);
  const quiet = theme.quietText;

  // Your own id is your own profile, and that has a page of its own.
  useEffect(() => {
    if (isOwnProfile) {
      navigation.replace("ProfilePage");
    }
  }, [isOwnProfile, navigation]);

  useEffect(() => {
    if (isOwnProfile) {
      return undefined;
    }

    if (!userId || !viewerId) {
      setProfile(null);
      setStatus("unavailable");
      return undefined;
    }

    let cancelled = false;

    setStatus("loading");
    setFollowError("");

    (async () => {
      // All three at once. The posts only count if the profile comes back: a
      // profile that is not there, or not open to the viewer, shows nothing.
      const [profileResult, gymResult, postsResult] = await Promise.allSettled([
        publicProfileService.getPublicProfile({ userId }),
        isPreview ? Promise.resolve(null) : gymService.getMyHomeGym(),
        publicProfileService.getPublicProfilePosts({
          user: { id: viewerId },
          userId,
          limit: PROFILE_POST_GRID_SIZE,
          preview: isPreview,
        }),
      ]);

      if (cancelled) {
        return;
      }

      if (profileResult.status === "rejected") {
        console.error("Could not load the profile:", profileResult.reason);
        setProfile(null);
        setStatus("error");
        return;
      }

      if (!profileResult.value) {
        setProfile(null);
        setStatus("unavailable");
        return;
      }

      if (postsResult.status === "rejected") {
        console.error("Could not load the profile's posts:", postsResult.reason);
      }

      setProfile(profileResult.value);
      // Without the viewer's own centre, every centre reads as somebody else's.
      setViewerGymId(gymResult.status === "fulfilled" ? gymResult.value?.id ?? null : null);
      setPosts(
        postsResult.status === "fulfilled"
          ? { items: postsResult.value.posts, total: postsResult.value.total, failed: false }
          : { ...EMPTY_POSTS, failed: true }
      );
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, isPreview, reloadKey, userId, viewerId]);

  const updateFollow = useCallback(
    async (shouldFollow) => {
      if (!viewerId || !profile?.id || isFollowBusy || isPreview) {
        return;
      }

      const targetUserId = profile.id;
      const change = shouldFollow ? 1 : -1;
      const applyChange = (following, delta) =>
        setProfile((current) =>
          current
            ? {
                ...current,
                isFollowing: following,
                followerCount: Math.max(0, current.followerCount + delta),
              }
            : current
        );

      setIsFollowBusy(true);
      setFollowError("");
      applyChange(shouldFollow, change);

      try {
        if (shouldFollow) {
          await socialService.followUser({ userId: viewerId, targetUserId });
        } else {
          await socialService.unfollowUser({ userId: viewerId, targetUserId });
        }
      } catch (error) {
        console.error("Could not update the follow:", error);
        applyChange(!shouldFollow, -change);
        setFollowError(t("social.errors.updateFollowFailed"));
      } finally {
        setIsFollowBusy(false);
      }
    },
    [isFollowBusy, isPreview, profile?.id, t, viewerId]
  );

  // No web profile to link to, so the text carries the username, which is
  // what finds somebody in search.
  const shareProfile = useCallback(async () => {
    if (!profile) {
      return;
    }

    try {
      await Share.share({
        message: t("publicProfile.share.message", {
          name: profile.displayName,
          username: profile.username,
        }),
      });
    } catch (error) {
      console.warn("Could not open the share sheet:", error);
    }
  }, [profile, t]);

  const chooseFromMenu = (action) => {
    pendingMenuActionRef.current = action;
    setIsMenuOpen(false);
  };

  const runChosenMenuAction = () => {
    const action = pendingMenuActionRef.current;

    pendingMenuActionRef.current = null;

    if (action === "share") {
      shareProfile();
    } else if (action === "block") {
      setBlockError("");
      setIsBlockOpen(true);
    } else if (action === "report") {
      setReportReason(null);
      setReportNote("");
      setReportError("");
      setIsReportOpen(true);
    }
  };

  const confirmBlock = async () => {
    if (!viewerId || !profile?.id || isBlockWorking) {
      return;
    }

    setIsBlockWorking(true);
    setBlockError("");

    try {
      await socialService.blockUser({ userId: viewerId, targetUserId: profile.id });
      setIsBlockOpen(false);
      // Blocked, the profile is closed to both of them - this page included.
      navigation.goBack();
    } catch (error) {
      console.error("Could not block the account:", error);
      setBlockError(t("social.errors.updateBlockFailed"));
    } finally {
      setIsBlockWorking(false);
    }
  };

  const closeReport = () => {
    setIsReportOpen(false);
    setReportReason(null);
    setReportNote("");
    setReportError("");
  };

  const submitReport = async () => {
    if (!viewerId || !profile?.id || !reportReason || isReportWorking) {
      return;
    }

    setIsReportWorking(true);
    setReportError("");

    try {
      await socialService.reportUser({
        userId: viewerId,
        targetUserId: profile.id,
        reason: reportReason,
        note: reportNote,
      });
      closeReport();
      Alert.alert(
        t("social.report.sentTitle"),
        t("social.report.sentMessage", {
          name: profile.displayName || t("social.report.thatAccount"),
        })
      );
    } catch (error) {
      console.error("Could not send the report:", error);
      setReportError(t("social.errors.sendReportFailed"));
    } finally {
      setIsReportWorking(false);
    }
  };

  const openPosts = (postId = null) => {
    if (!profile) {
      return;
    }

    navigation.navigate("UserPostsPage", {
      userId: profile.id,
      postId,
      preview: isPreview,
    });
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
        hitSlop={6}
        onPress={() => navigation.goBack()}
        style={[styles.headerButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
      >
        {isPreview ? (
          <ChevronLeft width={18} height={18} color={theme.title} thickness={2.2} />
        ) : (
          <ArrowLeft width={20} height={20} color={theme.title} />
        )}
      </TouchableOpacity>

      {isPreview ? (
        <ThemedText
          style={styles.headerTitle}
          setColor={theme.title}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {t("publicProfile.preview.title")}
        </ThemedText>
      ) : (
        <View style={styles.headerSpacer} />
      )}

      {/* Share, block, report. Not in a preview: none of the three is
          something you do to yourself. */}
      {!isPreview && status === "ready" && profile ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("publicProfile.menu.open")}
          hitSlop={6}
          onPress={() => setIsMenuOpen(true)}
          style={[styles.headerButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
        >
          <ThreeDots width={17} height={17} color={theme.mutedStrong} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerButtonSpace} />
      )}
    </View>
  );

  const renderProfile = () => {
    const sharedCentre = isSharedCentre({
      profileGymId: profile.homeGym?.id,
      viewerGymId,
      preview: isPreview,
    });
    const centreColor = sharedCentre ? theme.primaryText : theme.mutedStrong;
    const average = averageWorkoutsPerWeek(profile.weeklyWorkouts);
    const stats = [
      { key: "followers", value: profile.followerCount, label: t("publicProfile.stats.followers") },
      { key: "following", value: profile.followingCount, label: t("publicProfile.stats.following") },
      { key: "workouts", value: profile.workoutCount, label: t("publicProfile.stats.workouts") },
    ];

    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isPreview ? (
          <View
            style={[
              styles.previewBanner,
              {
                backgroundColor: withAlpha(theme.primary, 0.1),
                borderColor: withAlpha(theme.primary, 0.32),
              },
            ]}
          >
            <Eye width={18} height={18} color={theme.primaryText} thickness={1.9} />
            <ThemedText style={styles.previewBannerText} setColor={theme.title}>
              {t("publicProfile.preview.banner")}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.identity}>
          <UserAvatar
            uri={profile.avatarUrl}
            size={84}
            iconSize={34}
            borderColor={theme.overlayMedium}
            borderWidth={2}
          />
          <View style={styles.identityCopy}>
            <ThemedText style={styles.name} setColor={theme.title} accessibilityRole="header">
              {profile.displayName}
            </ThemedText>

            {profile.usernameBase ? (
              <ThemedText style={styles.username} setColor={quiet} numberOfLines={1}>
                {`@${profile.usernameBase}`}
                {profile.usernameCode ? (
                  <ThemedText style={styles.usernameCode} setColor={theme.chevron}>
                    {` #${profile.usernameCode}`}
                  </ThemedText>
                ) : null}
              </ThemedText>
            ) : null}

            {/* The one coloured thing up here, when it is the viewer's own
                centre: the quickest reason there is to follow somebody. */}
            {profile.homeGym?.shortName ? (
              <View style={styles.centreRow}>
                <MapPin width={11} height={11} color={centreColor} thickness={2.4} />
                <ThemedText style={styles.centreText} setColor={centreColor} numberOfLines={1}>
                  {profile.homeGym.shortName}
                  {sharedCentre ? (
                    <ThemedText style={styles.centreSuffix} setColor={quiet}>
                      {` ${t("publicProfile.yourCentre")}`}
                    </ThemedText>
                  ) : null}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        {profile.bio ? (
          <ThemedText style={styles.bio} setColor={theme.mutedStrong}>
            {profile.bio}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{
              disabled: isPreview || isFollowBusy,
              selected: profile.isFollowing,
            }}
            disabled={isPreview || isFollowBusy}
            onPress={() => (profile.isFollowing ? setIsUnfollowOpen(true) : updateFollow(true))}
            style={[
              styles.followButton,
              profile.isFollowing
                ? { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }
                : { backgroundColor: theme.primary, borderColor: theme.primary },
              isPreview ? styles.previewDisabled : null,
            ]}
          >
            {profile.isFollowing ? (
              <Checkmark width={15} height={15} color={theme.title} thickness={2.6} />
            ) : (
              <Plus width={17} height={17} color={theme.textInverted} thickness={2.2} />
            )}
            <ThemedText
              style={styles.followText}
              setColor={profile.isFollowing ? theme.title : theme.textInverted}
              numberOfLines={1}
            >
              {profile.isFollowing ? t("publicProfile.following") : t("social.follow")}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            onPress={shareProfile}
            style={[styles.shareButton, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
          >
            <ThemedText style={styles.shareText} setColor={theme.title} numberOfLines={1}>
              {t("publicProfile.share.action")}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {followError ? (
          <ThemedText style={styles.followError} setColor={theme.danger}>
            {followError}
          </ThemedText>
        ) : null}

        <View style={[styles.stats, { backgroundColor: theme.cardBackground }]}>
          {stats.map((stat, index) => (
            <View
              key={stat.key}
              accessible
              style={[
                styles.stat,
                index > 0 ? [styles.statDivided, { borderLeftColor: theme.cardBorder }] : null,
              ]}
            >
              <ThemedText style={styles.statValue} setColor={theme.title}>
                {formatNumber(stat.value)}
              </ThemedText>
              <ThemedText style={styles.statLabel} setColor={quiet} numberOfLines={1}>
                {stat.label}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* No records, no section - an empty one only says "nothing here". */}
        {profile.records.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <ThemedText style={styles.eyebrow} setColor={quiet}>
                {t("publicProfile.records.title")}
              </ThemedText>
            </View>
            <View style={styles.recordList}>
              {profile.records.map((record) => (
                <RecordRow key={record.liftId ?? record.exerciseId} record={record} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <ThemedText style={styles.eyebrow} setColor={quiet}>
              {t("publicProfile.activity.title")}
            </ThemedText>
            <ThemedText style={styles.activityAverage} setColor={quiet}>
              <ThemedText style={styles.activityAverageValue} setColor={theme.title}>
                {formatNumber(average, { maximumFractionDigits: 1 })}
              </ThemedText>
              {` ${t("publicProfile.activity.perWeek", { count: average })}`}
            </ThemedText>
          </View>
          <ActivityBars weeks={profile.weeklyWorkouts} />
          <ThemedText style={styles.footnote} setColor={quiet}>
            {t("publicProfile.activity.footnote", { count: ACTIVITY_WEEKS })}
          </ThemedText>
        </View>

        {posts.items.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <ThemedText style={styles.eyebrow} setColor={quiet}>
                {t("publicProfile.posts.title")}
              </ThemedText>
              <TouchableOpacity accessibilityRole="button" hitSlop={10} onPress={() => openPosts()}>
                <ThemedText style={styles.sectionAction} setColor={theme.primaryText}>
                  {t("publicProfile.posts.seeAll", { count: formatNumber(posts.total) })}
                </ThemedText>
              </TouchableOpacity>
            </View>
            <PostsGrid posts={posts.items} onOpenPost={(post) => openPosts(post.id)} />
          </View>
        ) : posts.failed ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <ThemedText style={styles.eyebrow} setColor={quiet}>
                {t("publicProfile.posts.title")}
              </ThemedText>
            </View>
            <ThemedText style={styles.postsFailed} setColor={quiet}>
              {t("publicProfile.posts.failed")}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  // While it sends you on to your own profile there is nothing to show.
  if (isOwnProfile) {
    return <ThemedView safe={["top", "left", "right"]} style={styles.container} />;
  }

  const displayName = profile?.displayName || t("social.thisPersonSubject");

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      {header}

      {status === "ready" && profile ? (
        renderProfile()
      ) : status === "loading" ? (
        <ThemedStateBlock variant="loading" style={styles.stateBlock} />
      ) : status === "error" ? (
        <ThemedStateBlock
          variant="error"
          style={styles.stateBlock}
          title={t("publicProfile.error.title")}
          message={t("publicProfile.error.body")}
          actionLabel={t("common.retry")}
          onAction={() => setReloadKey((key) => key + 1)}
        />
      ) : (
        // Not found and blocked read the same, so a block cannot be told from a
        // deleted account.
        <ThemedStateBlock
          variant="empty"
          style={styles.stateBlock}
          title={t("publicProfile.unavailable.title")}
          message={t("publicProfile.unavailable.body")}
          actionLabel={t("common.goBack")}
          onAction={() => navigation.goBack()}
        />
      )}

      <ThemedConfirmModal
        visible={isUnfollowOpen}
        title={t("social.unfollowConfirm.title")}
        message={t("social.unfollowConfirm.message", { name: displayName })}
        confirmLabel={t("social.unfollowConfirm.confirm")}
        cancelLabel={t("social.unfollowConfirm.cancel")}
        tone="danger"
        isWorking={isFollowBusy}
        onConfirm={() => {
          setIsUnfollowOpen(false);
          updateFollow(false);
        }}
        onClose={() => setIsUnfollowOpen(false)}
      />

      <ThemedBottomSheet
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onDismiss={runChosenMenuAction}
      >
        <View style={[styles.menuTitle, { borderBottomColor: theme.hairline }]}>
          <ThemedText style={styles.menuTitleText} setColor={theme.title} numberOfLines={1}>
            {displayName}
          </ThemedText>
        </View>

        <View style={styles.menuBody}>
          <TouchableOpacity
            style={styles.menuOption}
            activeOpacity={0.75}
            accessibilityRole="button"
            onPress={() => chooseFromMenu("share")}
          >
            <Feather name="share-2" size={20} color={theme.iconColor} />
            <ThemedText style={styles.menuOptionText} numberOfLines={1}>
              {t("publicProfile.menu.share")}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuOption}
            activeOpacity={0.75}
            accessibilityRole="button"
            onPress={() => chooseFromMenu("block")}
          >
            <Feather name="slash" size={20} color={theme.danger} />
            <ThemedText style={styles.menuOptionText} setColor={theme.danger} numberOfLines={1}>
              {t("social.blockNamed", { name: displayName })}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuOption}
            activeOpacity={0.75}
            accessibilityRole="button"
            onPress={() => chooseFromMenu("report")}
          >
            <Flag width={22} height={22} color={theme.iconColor} />
            <ThemedText style={styles.menuOptionText} numberOfLines={1}>
              {t("social.report.reportNamed", { name: displayName })}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedBottomSheet>

      <ThemedConfirmModal
        visible={isBlockOpen}
        title={t("social.blockConfirm.title")}
        message={blockError || t("social.blockConfirm.message", { name: displayName })}
        confirmLabel={t("social.block")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        isWorking={isBlockWorking}
        onConfirm={confirmBlock}
        onClose={() => setIsBlockOpen(false)}
      />

      <ThemedConfirmModal
        visible={isReportOpen}
        title={t("social.report.title", { name: profile?.displayName || t("social.thisPerson") })}
        message={t("social.report.message")}
        confirmLabel={t("social.report.send")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        isWorking={isReportWorking}
        confirmDisabled={!reportReason}
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
                    borderColor: selected ? theme.danger : theme.cardBorder,
                    backgroundColor: theme.chipBackground,
                  },
                  pressed ? styles.pressed : null,
                ]}
              >
                <ThemedText
                  style={styles.reportReasonText}
                  setColor={selected ? theme.danger : theme.title}
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

        {reportError ? (
          <ThemedText style={styles.reportError} setColor={theme.danger}>
            {reportError}
          </ThemedText>
        ) : null}
      </ThemedConfirmModal>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
