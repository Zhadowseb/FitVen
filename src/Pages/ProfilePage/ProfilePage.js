import { useCallback, useState } from "react";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import appConfig from "../../../app.json";
import styles from "./ProfilePageStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { useAuth } from "@contexts/AuthContext";
import { useThemeMode } from "@contexts/ThemeContext";
import { formatNumber, useTranslation } from "@localization";
import {
  adminService,
  authService,
  gymService,
  musicService,
  notificationService,
  programService,
  socialPostService,
  socialService,
} from "@services";
import Bell from "@resources/Icons/UI-icons/Bell";
import ChevronLeft from "@resources/Icons/UI-icons/ChevronLeft";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Cogwheel from "@resources/Icons/UI-icons/Cogwheel";
import Dumbbell from "@resources/Icons/UI-icons/Dumbbell";
import Eye from "@resources/Icons/UI-icons/Eye";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import MessageCircle from "@resources/Icons/UI-icons/MessageCircle";
import Moon from "@resources/Icons/UI-icons/Moon";
import MusicNote from "@resources/Icons/UI-icons/MusicNote";
import Pencil from "@resources/Icons/UI-icons/Pencil";
import Social from "@resources/Icons/UI-icons/Social";
import FeedbackModal from "@resources/Components/FeedbackModal/FeedbackModal";
import {
  ThemedButton,
  ThemedConfirmModal,
  ThemedModal,
  ThemedSegmentedControl,
  ThemedText,
  ThemedTextInput,
  ThemedView,
} from "@resources/ThemedComponents";
import AccentThemePicker from "./Components/AccentThemePicker";
import InsetDivider from "./Components/InsetDivider";
import ProfileAvatarButton from "./Components/ProfileAvatarButton";
import SectionEyebrow from "./Components/SectionEyebrow";
import SettingsIconTile from "./Components/SettingsIconTile";
import SettingsTile from "./Components/SettingsTile";
import pickAndUploadAvatar from "./pickAndUploadAvatar";

// Not localised on purpose: the word the user types has to match exactly, and
// a translated one is a different word on a phone in a different language.
const DELETE_CONFIRMATION_WORD = "DELETE";

// Keys rather than text, translated when the tile is drawn.
const POST_VISIBILITY_KEYS = {
  [socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.EVERYONE]:
    "settings.socialPosts.visibility.everyone",
  [socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.FOLLOWING]:
    "settings.socialPosts.visibility.following",
  [socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.PRIVATE]:
    "settings.socialPosts.visibility.private",
};

// A service's name reads the same in every language.
const MUSIC_PROVIDER_NAMES = {
  [musicService.MUSIC_PROVIDER_SPOTIFY]: "Spotify",
};

function getNormalizedString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

// A tile's reading, kept raw so it is worded in the language on screen:
// undefined while it is read, null when it could not be.
function describeSetting(rawValue, describe) {
  return rawValue === undefined || rawValue === null
    ? rawValue
    : describe(rawValue);
}

/**
 * Your own profile: who you are to others, your numbers, and the settings.
 * Editing lives on EditProfilePage, a modal over this one; the one edit made
 * here is the photo, straight from the avatar.
 *
 * Profile is not a tab - Feed took its place in the bar - so it is always
 * pushed, from the avatar on Home or the You tile, and the back button shows
 * whenever there is something to go back to. The tabs reset the stack to
 * [Home, tab], which a push also produces, so if Profile ever returns to the
 * bar the tab has to say so in a param for the button to know.
 */
export default function ProfilePage() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const { themeMode, setThemeMode, accentTheme, setAccentTheme } =
    useThemeMode();
  const { t, languageMode, setLanguageMode } = useTranslation();
  // Built per render, not at module load: the labels themselves change with
  // the language they pick.
  const languageOptions = [
    { value: "system", label: t("profile.language.system") },
    { value: "da", label: t("profile.language.da") },
    { value: "en", label: t("profile.language.en") },
  ];
  const appearanceOptions = [
    { value: "dark", label: t("profile.appearance.dark") },
    { value: "light", label: t("profile.appearance.light") },
    { value: "auto", label: t("profile.appearance.auto") },
  ];
  const [profile, setProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [followCounts, setFollowCounts] = useState(null);
  const [homeGymName, setHomeGymName] = useState(null);
  const [settingReadings, setSettingReadings] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const canGoBack = navigation.canGoBack();
  const appVersion =
    getNormalizedString(appConfig?.expo?.version) ??
    t("profile.account.unknownVersion");
  const bio = profile?.bio?.trim() ?? "";
  const tileValues = {
    workoutTypes: describeSetting(settingReadings.workoutTypes, (count) =>
      t("profile.settings.activeCount", { count })
    ),
    notifications: describeSetting(settingReadings.notifications, (enabled) =>
      enabled ? t("common.on") : t("common.off")
    ),
    socialPosts: describeSetting(settingReadings.socialPosts, ({ mode, visibility }) =>
      mode === socialPostService.WORKOUT_SUMMARY_POST_MODES.OFF
        ? t("settings.socialPosts.modes.off")
        : t(
            POST_VISIBILITY_KEYS[visibility] ??
              POST_VISIBILITY_KEYS[
                socialPostService.DEFAULT_WORKOUT_SUMMARY_POST_VISIBILITY
              ]
          )
    ),
    music: describeSetting(settingReadings.music, ({ connection }) =>
      connection
        ? MUSIC_PROVIDER_NAMES[connection.provider] ??
          t("music.status.connected")
        : t("music.status.notConnected")
    ),
  };

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;
      const whileHere = (apply) => (value) => {
        if (!isCancelled) {
          apply(value);
        }
      };

      if (!user?.id) {
        setProfile(null);
        setIsLoadingProfile(false);
        setProfileError(t("profile.feedback.signInToView"));

        return () => {
          isCancelled = true;
        };
      }

      // Everything below is its own read. The identity waits for the profile
      // and nothing else; a count, the centre or a tile that cannot be read
      // leaves only its own gap. A refresh that fails keeps what is shown.
      setIsLoadingProfile(true);
      socialService
        .ensureOwnProfile(user)
        .then(
          whileHere((nextProfile) => {
            setProfile(nextProfile);
            setProfileError("");
          }),
          whileHere((error) => {
            setProfileError(
              error instanceof Error
                ? error.message
                : t("profile.feedback.couldNotLoad")
            );
          })
        )
        .finally(whileHere(() => setIsLoadingProfile(false)));

      socialService
        .getFollowCounts({ userId: user.id })
        .then(whileHere(setFollowCounts), (error) => {
          console.warn("Could not load the follow counts:", error);
        });

      // No centre chosen or trained in, or no centres at all yet: no line.
      gymService.getMyHomeGym().then(
        whileHere((gym) => setHomeGymName(gym?.shortName ?? gym?.name ?? null)),
        () => {}
      );

      // Decides whether the Dev tile is drawn. It is not the access control -
      // the policies behind every query the dashboard makes are.
      adminService.getIsAdmin({ user }).then(whileHere(setIsAdmin), () => {});

      const readSetting = (key, read) => {
        Promise.resolve()
          .then(read)
          .then(
            whileHere((reading) =>
              setSettingReadings((current) => ({ ...current, [key]: reading }))
            ),
            whileHere((error) => {
              console.warn(`Could not read the ${key} setting for its tile:`, error);
              setSettingReadings((current) => ({
                ...current,
                [key]: current[key] ?? null,
              }));
            })
          );
      };

      readSetting("workoutTypes", () =>
        programService.countActiveWorkoutTypes(db)
      );
      readSetting("notifications", () =>
        notificationService.getPushNotificationsEnabled({ user })
      );
      readSetting("socialPosts", async () => {
        const [mode, visibility] = await Promise.all([
          socialPostService.getWorkoutSummaryPostMode({ user }),
          socialPostService.getWorkoutSummaryPostVisibility({ user }),
        ]);

        return { mode, visibility };
      });
      readSetting("music", async () => ({
        connection: await musicService.getMusicConnection(),
      }));

      return () => {
        isCancelled = true;
      };
    }, [db, reloadCount, t, user])
  );

  const handleChooseAvatar = async () => {
    if (!user?.id) {
      setAvatarError(t("profile.feedback.signInToUpdatePhoto"));
      return;
    }

    setAvatarError("");
    setIsUploadingAvatar(true);

    try {
      const updatedProfile = await pickAndUploadAvatar({ user });

      if (updatedProfile) {
        setProfile(updatedProfile);
        setProfileError("");
      }
    } catch (error) {
      setAvatarError(
        error instanceof Error
          ? error.message
          : t("profile.feedback.couldNotUploadPhoto")
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Your own followers and whom you follow, with the lists behind both, are
  // on Social. SocialUserListPage is the people search.
  // Straight into the list that was tapped, on the Social page.
  const openRelationships = (list) => navigation.navigate("SocialPage", { open: list });

  // Signing out mid-week used to be one stray tap away, with the button
  // sitting in a list people scroll past to reach the settings under it.
  const handleLogout = async () => {
    setLogoutConfirmVisible(false);
    setLogoutError("");
    setIsLoggingOut(true);

    try {
      try {
        await notificationService.disableCurrentPushTokenForUser({ user });
      } catch (cleanupError) {
        console.warn("Push token logout cleanup failed:", cleanupError);
      }

      await authService.logout();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : t("profile.feedback.couldNotLogOut")
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const closeDeleteModal = () => {
    if (isDeletingAccount) {
      return;
    }

    setDeleteModalVisible(false);
    setDeleteConfirmText("");
    setDeleteError("");
  };

  // Typed rather than a second Yes button. This is the one action in the app
  // with nothing behind it - no trash, no grace period, no support request that
  // can bring it back - so it should not be reachable by two taps in a row.
  const canConfirmDelete =
    deleteConfirmText.trim().toUpperCase() === DELETE_CONFIRMATION_WORD;

  const handleDeleteAccount = async () => {
    if (!canConfirmDelete || isDeletingAccount) {
      return;
    }

    setDeleteError("");
    setIsDeletingAccount(true);

    try {
      try {
        await notificationService.disableCurrentPushTokenForUser({ user });
      } catch (cleanupError) {
        console.warn("Push token delete cleanup failed:", cleanupError);
      }

      // On success this signs out, which unmounts the screen. Nothing after it
      // is guaranteed to run, so there is no success state to set.
      await authService.deleteAccount({ user });
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : t("profile.feedback.couldNotDeleteAccount")
      );
      setIsDeletingAccount(false);
    }
  };

  const renderIdentityCopy = () => {
    if (profile) {
      return (
        <>
          <ThemedText
            style={styles.displayName}
            setColor={theme.title}
            numberOfLines={3}
          >
            {profile.displayName}
          </ThemedText>
          <ThemedText
            style={styles.usernameLine}
            setColor={theme.quietText}
            numberOfLines={1}
          >
            @{profile.usernameBase || profile.username}
            {profile.usernameBase && profile.usernameCode ? (
              <ThemedText style={styles.usernameCode} setColor={theme.primaryText}>
                #{profile.usernameCode}
              </ThemedText>
            ) : null}
          </ThemedText>
          {homeGymName ? (
            <View style={styles.gymLine}>
              <MapPin width={11} height={11} color={theme.mutedStrong} />
              <ThemedText
                style={styles.gymName}
                setColor={theme.mutedStrong}
                numberOfLines={1}
              >
                {homeGymName}
              </ThemedText>
            </View>
          ) : null}
        </>
      );
    }

    if (!isLoadingProfile && profileError) {
      return (
        <>
          <ThemedText style={styles.identityError} setColor={theme.danger}>
            {profileError}
          </ThemedText>
          {user?.id ? (
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.75}
              onPress={() => setReloadCount((count) => count + 1)}
              style={styles.retryButton}
            >
              <ThemedText style={styles.retryText} setColor={theme.primaryText}>
                {t("common.retry")}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </>
      );
    }

    return (
      <View
        accessible
        accessibilityLabel={t("profile.loadingProfile")}
        accessibilityState={{ busy: true }}
      >
        <View
          style={[styles.skeletonName, { backgroundColor: theme.chipBackground }]}
        />
        <View
          style={[
            styles.skeletonUsername,
            { backgroundColor: theme.chipBackground },
          ]}
        />
      </View>
    );
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarSide}>
          {canGoBack ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("common.goBack")}
              activeOpacity={0.8}
              onPress={() => navigation.goBack()}
              style={[
                styles.backButton,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <ChevronLeft width={18} height={18} color={theme.title} />
            </TouchableOpacity>
          ) : null}
        </View>
        <ThemedText
          style={styles.topBarTitle}
          setColor={theme.title}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {t("profile.title")}
        </ThemedText>
        <View style={styles.topBarSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Who you are */}
        <View style={styles.identityRow}>
          <ProfileAvatarButton
            uri={profile?.avatarUrl}
            size={92}
            badgeSize={32}
            badgeIconSize={15}
            isUploading={isUploadingAvatar}
            disabled={!user?.id}
            onPress={handleChooseAvatar}
            accessibilityLabel={t("profile.avatar.changeAccessibility")}
          />
          <View style={styles.identityCopy}>{renderIdentityCopy()}</View>
        </View>

        {bio ? (
          <ThemedText style={styles.bio} setColor={theme.mutedStrong}>
            {bio}
          </ThemedText>
        ) : null}

        {avatarError ? (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: withAlpha(theme.danger, 0.08),
                borderColor: withAlpha(theme.danger, 0.4),
              },
            ]}
          >
            <ThemedText style={styles.bannerText} setColor={theme.danger}>
              {avatarError}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            disabled={!user?.id}
            onPress={() =>
              navigation.navigate(
                "EditProfilePage",
                profile ? { profile } : undefined
              )
            }
            style={[
              styles.actionButton,
              styles.editButton,
              { backgroundColor: theme.primary, opacity: user?.id ? 1 : 0.5 },
            ]}
          >
            <Pencil width={16} height={16} color={theme.textInverted} />
            <ThemedText
              style={styles.actionText}
              setColor={theme.textInverted}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {t("profile.actions.edit")}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            disabled={!user?.id}
            onPress={() =>
              navigation.navigate("PublicProfilePage", {
                userId: user.id,
                preview: true,
              })
            }
            style={[
              styles.actionButton,
              styles.viewAsOthersButton,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
                opacity: user?.id ? 1 : 0.5,
              },
            ]}
          >
            <Eye width={16} height={16} color={theme.title} />
            <ThemedText
              style={styles.actionText}
              setColor={theme.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {t("profile.actions.viewAsOthers")}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={[styles.statsCard, { backgroundColor: theme.cardBackground }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              followCounts
                ? t("social.followersCount", { count: followCounts.followers })
                : t("social.relationship.followers")
            }
            activeOpacity={0.75}
            onPress={() => openRelationships("followers")}
            style={styles.statColumn}
          >
            <ThemedText style={styles.statValue} setColor={theme.title}>
              {followCounts ? formatNumber(followCounts.followers) : "–"}
            </ThemedText>
            <ThemedText
              style={styles.statLabel}
              setColor={theme.quietText}
              numberOfLines={1}
            >
              {t("social.relationship.followers")}
            </ThemedText>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: theme.cardBorder }]} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              followCounts
                ? t("social.followingCount", { count: followCounts.following })
                : t("social.relationship.following")
            }
            activeOpacity={0.75}
            onPress={() => openRelationships("following")}
            style={styles.statColumn}
          >
            <ThemedText style={styles.statValue} setColor={theme.title}>
              {followCounts ? formatNumber(followCounts.following) : "–"}
            </ThemedText>
            <ThemedText
              style={styles.statLabel}
              setColor={theme.quietText}
              numberOfLines={1}
            >
              {t("social.relationship.following")}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Settings: each tile says what it is set to now */}
        <View style={styles.section}>
          <SectionEyebrow>{t("profile.sections.settings")}</SectionEyebrow>
          <View style={styles.tileGrid}>
            <View style={styles.tileRow}>
              <SettingsTile
                icon={
                  <Dumbbell
                    width={17}
                    height={17}
                    color={theme.primaryText}
                    thickness={1.7}
                  />
                }
                label={t("profile.settings.workoutTypes")}
                value={tileValues.workoutTypes}
                onPress={() => navigation.navigate("WorkoutTypesSettingsPage")}
              />
              <SettingsTile
                icon={
                  <Bell
                    width={17}
                    height={17}
                    color={theme.primaryText}
                    thickness={1.7}
                  />
                }
                label={t("profile.settings.notifications")}
                value={tileValues.notifications}
                onPress={() => navigation.navigate("NotificationSettingsPage")}
              />
            </View>
            <View style={styles.tileRow}>
              <SettingsTile
                icon={
                  <Pencil
                    width={17}
                    height={17}
                    color={theme.primaryText}
                    thickness={1.7}
                  />
                }
                label={t("profile.settings.socialPosts")}
                value={tileValues.socialPosts}
                onPress={() => navigation.navigate("SocialPostSettingsPage")}
              />
              <SettingsTile
                icon={
                  <MusicNote
                    width={17}
                    height={17}
                    color={theme.primaryText}
                    thickness={2}
                  />
                }
                label={t("profile.settings.music")}
                value={tileValues.music}
                onPress={() => navigation.navigate("MusicSettingsPage")}
              />
            </View>
            {/* Only for an account whose is_admin is set by hand in the
                database. Hiding it is not what keeps the data private - the
                policies behind every query the dashboard makes are. */}
            {isAdmin ? (
              <View style={styles.tileRow}>
                <SettingsTile
                  icon={<Cogwheel width={17} height={17} color={theme.primaryText} />}
                  label={t("profile.settings.dev")}
                  value={null}
                  onPress={() => navigation.navigate("DevDashboardPage")}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* Appearance: colour, then theme and language under each other - side
            by side the segments break onto two lines. */}
        <View style={styles.section}>
          <SectionEyebrow>{t("profile.sections.appearance")}</SectionEyebrow>
          <View
            style={[
              styles.appearanceCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <AccentThemePicker value={accentTheme} onChange={setAccentTheme} />

            <View style={styles.appearanceGroup}>
              <View style={styles.appearanceLabelRow}>
                <Moon width={13} height={13} color={theme.quietText} />
                <ThemedText style={styles.appearanceLabel} setColor={theme.quietText}>
                  {t("profile.appearance.theme")}
                </ThemedText>
              </View>
              <ThemedSegmentedControl
                options={appearanceOptions}
                value={themeMode}
                onChange={setThemeMode}
              />
            </View>

            <View style={styles.appearanceGroup}>
              <View style={styles.appearanceLabelRow}>
                <Social width={13} height={13} color={theme.quietText} />
                <ThemedText style={styles.appearanceLabel} setColor={theme.quietText}>
                  {t("profile.language.label")}
                </ThemedText>
              </View>
              <ThemedSegmentedControl
                options={languageOptions}
                value={languageMode}
                onChange={setLanguageMode}
              />
            </View>
          </View>
        </View>

        {/* Feedback: one row. Bug, idea or praise is chosen in the sheet. */}
        <View style={styles.section}>
          <SectionEyebrow>{t("profile.sections.feedback")}</SectionEyebrow>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => setFeedbackModalVisible(true)}
            style={[
              styles.feedbackRow,
              {
                backgroundColor: withAlpha(theme.secondary, 0.08),
                borderColor: withAlpha(theme.secondary, 0.28),
              },
            ]}
          >
            <SettingsIconTile backgroundColor={withAlpha(theme.secondary, 0.16)}>
              <MessageCircle
                width={18}
                height={18}
                color={theme.secondary}
                thickness={1.7}
              />
            </SettingsIconTile>
            <View style={styles.feedbackCopy}>
              <ThemedText
                style={styles.feedbackTitle}
                setColor={theme.title}
                numberOfLines={1}
              >
                {t("profile.feedbackCard.title")}
              </ThemedText>
              <ThemedText
                style={styles.feedbackSubtitle}
                setColor={theme.text}
                numberOfLines={2}
              >
                {t("profile.feedbackCard.subtitle")}
              </ThemedText>
            </View>
            <ChevronRight width={17} height={17} color={theme.secondary} />
          </TouchableOpacity>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <SectionEyebrow>{t("profile.sections.account")}</SectionEyebrow>
          <View
            style={[
              styles.accountCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <ThemedText style={styles.accountLabel} setColor={theme.quietText}>
                  {t("profile.account.loggedInAs")}
                </ThemedText>
                <ThemedText
                  style={styles.accountEmail}
                  setColor={theme.title}
                  numberOfLines={1}
                >
                  {user?.email ?? t("profile.account.unknownAccount")}
                </ThemedText>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => setLogoutConfirmVisible(true)}
                disabled={isLoggingOut}
                style={[
                  styles.logoutPill,
                  {
                    borderColor: withAlpha(theme.danger, 0.4),
                    backgroundColor: withAlpha(theme.danger, 0.08),
                    opacity: isLoggingOut ? 0.6 : 1,
                  },
                ]}
              >
                <ThemedText style={styles.logoutPillText} setColor={theme.danger}>
                  {isLoggingOut
                    ? t("profile.account.loggingOut")
                    : t("profile.account.logOut")}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {logoutError ? (
              <ThemedText style={styles.accountError} setColor={theme.danger}>
                {logoutError}
              </ThemedText>
            ) : null}

            <InsetDivider />

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => navigation.navigate("PrivacyPolicyPage")}
              style={styles.accountLinkRow}
            >
              <ThemedText style={styles.accountLinkText} setColor={theme.title}>
                {t("profile.account.privacy")}
              </ThemedText>
              <ChevronRight width={16} height={16} color={theme.chevron} />
            </TouchableOpacity>

            <InsetDivider />

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => setDeleteModalVisible(true)}
              style={styles.accountLinkRow}
            >
              <ThemedText style={styles.accountLinkText} setColor={theme.danger}>
                {t("profile.account.deleteAccount")}
              </ThemedText>
              <ChevronRight width={16} height={16} color={theme.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <ThemedText style={styles.footer} setColor={theme.quietText}>
          {t("profile.footer", { version: appVersion })}
        </ThemedText>
      </ScrollView>

      <FeedbackModal
        visible={feedbackModalVisible}
        onClose={() => setFeedbackModalVisible(false)}
        userId={user?.id ?? null}
      />

      <ThemedConfirmModal
        visible={logoutConfirmVisible}
        title={t("profile.logoutConfirm.title")}
        message={t("profile.logoutConfirm.message")}
        confirmLabel={t("profile.account.logOut")}
        cancelLabel={t("profile.logoutConfirm.staySignedIn")}
        tone="danger"
        isWorking={isLoggingOut}
        onConfirm={handleLogout}
        onClose={() => setLogoutConfirmVisible(false)}
      />

      <ThemedModal
        visible={deleteModalVisible}
        onClose={closeDeleteModal}
        title={t("profile.deleteModal.title")}
      >
        <ThemedText style={styles.deleteModalBody} setColor={theme.quietText}>
          {t("profile.deleteModal.body")}
        </ThemedText>

        <ThemedText style={styles.deleteModalPrompt} setColor={theme.title}>
          {t("profile.deleteModal.typeToConfirm", {
            word: DELETE_CONFIRMATION_WORD,
          })}
        </ThemedText>

        <ThemedTextInput
          value={deleteConfirmText}
          onChangeText={setDeleteConfirmText}
          placeholder={DELETE_CONFIRMATION_WORD}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isDeletingAccount}
        />

        {deleteError ? (
          <ThemedText style={styles.errorText} setColor={theme.danger}>
            {deleteError}
          </ThemedText>
        ) : null}

        <ThemedButton
          title={
            isDeletingAccount
              ? t("profile.deleteModal.deleting")
              : t("profile.deleteModal.confirm")
          }
          variant="danger"
          onPress={handleDeleteAccount}
          disabled={!canConfirmDelete || isDeletingAccount}
          fullWidth
          height={44}
          style={styles.deleteModalConfirm}
        />

        <ThemedButton
          title={t("common.cancel")}
          variant="secondary"
          onPress={closeDeleteModal}
          disabled={isDeletingAccount}
          fullWidth
          height={44}
          style={styles.deleteModalCancel}
        />
      </ThemedModal>
    </ThemedView>
  );
}
