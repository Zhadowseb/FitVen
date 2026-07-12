import {
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import appConfig from "../../../app.json";
import styles from "./ProfilePageStyle";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import { logout } from "../../Database/supaBaseClient";
import { useAuth } from "../../Contexts/AuthContext";
import { useThemeMode } from "../../Contexts/ThemeContext";
import { notificationService, socialService } from "../../Services";
import Bell from "../../Resources/Icons/UI-icons/Bell";
import Dumbbell from "../../Resources/Icons/UI-icons/Dumbbell";
import Pencil from "../../Resources/Icons/UI-icons/Pencil";
import Moon from "../../Resources/Icons/UI-icons/Moon";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import FeedbackModal from "../../Resources/Components/FeedbackModal/FeedbackModal";
import LockIcon from "./Components/LockIcon";
import DotsHorizontalIcon from "./Components/DotsHorizontalIcon";
import MessageCircleIcon from "./Components/MessageCircleIcon";
import SectionEyebrow from "./Components/SectionEyebrow";
import InsetDivider from "./Components/InsetDivider";
import SettingsIconTile from "./Components/SettingsIconTile";
import AppearanceSegmentedControl from "./Components/AppearanceSegmentedControl";
import AccentThemePicker from "./Components/AccentThemePicker";
import Star from "../../Resources/Icons/UI-icons/Star";
import {
  calculateAgeFromBirthDate,
  dateToIsoDate,
  isoDateToLocalDate,
  normalizeLocalDateString,
} from "../../Utils/dateUtils";
import {
  ThemedButton,
  ThemedCard,
  ThemedDateWheelPicker,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

function getNormalizedString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

export default function ProfilePage() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const { themeMode, setThemeMode, accentTheme, setAccentTheme } =
    useThemeMode();
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState({
    status: "idle",
    message: "",
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const profileStatusColor =
    profileFeedback.status === "success"
      ? theme.secondary
      : profileFeedback.status === "error"
        ? theme.danger
        : theme.quietText;
  const normalizedDisplayName = displayName.trim();
  const normalizedBio = bio.trim();
  const calculatedAge = calculateAgeFromBirthDate(birthDate);
  const birthDateDisplay = normalizeLocalDateString(birthDate);
  const displayNameError = normalizedDisplayName
    ? undefined
    : "Display name cannot be empty.";
  const hasUnsavedChanges = profile
    ? normalizedDisplayName !== profile.displayName ||
      normalizedBio !== (profile.bio ?? "") ||
      birthDate !== (profile.birthDate ?? "")
    : false;
  const avatarButtonLabel = isUploadingAvatar
    ? "Uploading..."
    : profile?.avatarUrl
      ? "Change photo"
      : "Upload photo";
  const avatarMaxMb = Math.round(
    socialService.PROFILE_AVATAR_MAX_BYTES / (1024 * 1024)
  );
  const appName = getNormalizedString(appConfig?.expo?.name) ?? "FitVen";
  const appVersion =
    getNormalizedString(appConfig?.expo?.version) ?? "Unknown";

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const loadProfile = async () => {
        if (!user?.id) {
          setProfile(null);
          setDisplayName("");
          setBio("");
          setBirthDate("");
          setIsLoadingProfile(false);
          setProfileFeedback({
            status: "error",
            message: "Sign in to view your profile.",
          });
          return;
        }

        setIsLoadingProfile(true);
        setProfileFeedback({
          status: "idle",
          message: "",
        });

        try {
          const nextProfile = await socialService.ensureOwnProfile(user);

          if (isCancelled) {
            return;
          }

          setProfile(nextProfile);
          setDisplayName(nextProfile.displayName);
          setBio(nextProfile.bio ?? "");
          setBirthDate(nextProfile.birthDate ?? "");
        } catch (error) {
          if (isCancelled) {
            return;
          }

          setProfile(null);
          setDisplayName("");
          setBio("");
          setBirthDate("");
          setProfileFeedback({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not load your profile.",
          });
        } finally {
          if (!isCancelled) {
            setIsLoadingProfile(false);
          }
        }
      };

      loadProfile();

      return () => {
        isCancelled = true;
      };
    }, [user?.email, user?.id])
  );

  const clearProfileFeedback = () => {
    if (profileFeedback.message) {
      setProfileFeedback({
        status: "idle",
        message: "",
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) {
      setProfileFeedback({
        status: "error",
        message: "Sign in to update your profile.",
      });
      return;
    }

    if (!normalizedDisplayName) {
      setProfileFeedback({
        status: "error",
        message: "Display name cannot be empty.",
      });
      return;
    }

    setIsSavingProfile(true);
    setProfileFeedback({
      status: "idle",
      message: "",
    });

    try {
      const updatedProfile = await socialService.updateOwnProfile({
        user,
        displayName,
        bio,
        birthDate: birthDate || null,
      });

      setProfile(updatedProfile);
      setDisplayName(updatedProfile.displayName);
      setBio(updatedProfile.bio ?? "");
      if (!updatedProfile.privateSettingsError) {
        setBirthDate(updatedProfile.birthDate ?? "");
      }
      setProfileFeedback({
        status: updatedProfile.privateSettingsError ? "error" : "success",
        message: updatedProfile.privateSettingsError
          ? `Public profile updated. ${updatedProfile.privateSettingsError}`
          : "Profile updated.",
      });
    } catch (error) {
      setProfileFeedback({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not update your profile.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChooseAvatar = async () => {
    if (!user?.id) {
      setProfileFeedback({
        status: "error",
        message: "Sign in to update your profile photo.",
      });
      return;
    }

    setIsUploadingAvatar(true);
    setProfileFeedback({
      status: "idle",
      message: "",
    });

    try {
      const permissionResponse =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResponse.granted) {
        throw new Error(
          "Photo library permission is required to choose a profile picture."
        );
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (pickerResult.canceled) {
        return;
      }

      const selectedAsset = pickerResult.assets?.[0];

      if (!selectedAsset) {
        throw new Error("No image was selected.");
      }

      const updatedProfile = await socialService.uploadOwnAvatar({
        user,
        asset: selectedAsset,
      });

      setProfile(updatedProfile);
      setProfileFeedback({
        status: "success",
        message: "Profile photo updated.",
      });
    } catch (error) {
      setProfileFeedback({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not upload your profile photo.",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const getBirthDatePickerValue = () => {
    const selectedBirthDate = isoDateToLocalDate(birthDate);

    if (selectedBirthDate) {
      return selectedBirthDate;
    }

    const defaultBirthDate = new Date();
    defaultBirthDate.setFullYear(defaultBirthDate.getFullYear() - 18);
    return defaultBirthDate;
  };

  const handleBirthDateConfirm = (selectedDate) => {
    const nextBirthDate = dateToIsoDate(selectedDate);

    if (!nextBirthDate) {
      return;
    }

    clearProfileFeedback();
    setBirthDate(nextBirthDate);
    setBirthDatePickerVisible(false);
  };

  const handleLogout = async () => {
    setLogoutError("");
    setIsLoggingOut(true);

    try {
      try {
        await notificationService.disableCurrentPushTokenForUser({ user });
      } catch (cleanupError) {
        console.warn("Push token logout cleanup failed:", cleanupError);
      }

      await logout();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Could not log out."
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <View style={styles.headerTitleGroup}>
          <ThemedText
            size={10}
            style={styles.headerEyebrow}
            setColor={theme.quietText}
          >
            FitVen
          </ThemedText>
          <ThemedText style={[styles.headerTitle, { color: theme.title }]}>
            Profile
          </ThemedText>
        </View>

        <View
          style={[
            styles.headerMenuButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <DotsHorizontalIcon width={18} height={18} color={theme.text} />
        </View>
      </View>

      <View style={styles.content}>
        <ThemedKeyboardProtection
          scroll
          contentContainerStyle={styles.scrollContent}
        >
          {/* Public profile */}
          <View style={styles.section}>
            <SectionEyebrow>Public profile</SectionEyebrow>
            <ThemedCard style={styles.card}>
              <View style={styles.avatarRow}>
                <View style={[styles.avatarRing, { borderColor: theme.primary }]}>
                  <UserAvatar
                    uri={profile?.avatarUrl}
                    size={53}
                    iconSize={26}
                    iconColor={theme.text}
                    backgroundColor={theme.uiBackground}
                    style={styles.avatarInner}
                  />
                </View>

                <View style={styles.avatarInfo}>
                  <TouchableOpacity
                    onPress={handleChooseAvatar}
                    disabled={isLoadingProfile || isUploadingAvatar}
                    activeOpacity={0.85}
                    style={[
                      styles.changePhotoChip,
                      {
                        backgroundColor: theme.chipBackground,
                        borderColor: theme.border,
                        opacity: isLoadingProfile || isUploadingAvatar ? 0.6 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.changePhotoChipText}
                      setColor={theme.title}
                    >
                      {avatarButtonLabel}
                    </ThemedText>
                  </TouchableOpacity>

                  <ThemedText
                    style={styles.avatarHelperText}
                    setColor={theme.quietText}
                  >
                    Square images work best · up to {avatarMaxMb} MB
                  </ThemedText>
                </View>
              </View>

              <InsetDivider />

              <View style={styles.fieldRow}>
                <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                  Username
                </ThemedText>
                <ThemedText
                  style={styles.fieldValue}
                  setColor={theme.title}
                  numberOfLines={1}
                >
                  {profile?.usernameBase ?? profile?.username ?? "..."}
                  {profile?.usernameCode ? (
                    <ThemedText
                      style={styles.fieldValue}
                      setColor={theme.primary}
                    >
                      #{profile.usernameCode}
                    </ThemedText>
                  ) : null}
                </ThemedText>
                <LockIcon width={15} height={15} color={theme.quietText} />
              </View>

              <InsetDivider />

              <View style={styles.fieldRow}>
                <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                  Email
                </ThemedText>
                <ThemedText
                  style={styles.fieldValue}
                  setColor={theme.title}
                  numberOfLines={1}
                >
                  {user?.email ?? "Unknown account"}
                </ThemedText>
                <LockIcon width={15} height={15} color={theme.quietText} />
              </View>

              <InsetDivider />

              <TouchableOpacity
                activeOpacity={0.78}
                disabled={isLoadingProfile || isSavingProfile}
                onPress={() => setBirthDatePickerVisible(true)}
                style={styles.birthDateRow}
              >
                <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                  Birth date
                </ThemedText>
                <View style={styles.birthDateCopy}>
                  <ThemedText
                    style={styles.birthDateValue}
                    setColor={birthDateDisplay ? theme.title : theme.quietText}
                  >
                    {birthDateDisplay ?? "Select birth date"}
                  </ThemedText>
                  <ThemedText
                    style={styles.birthDateSubline}
                    setColor={theme.quietText}
                  >
                    Exact date stays private
                  </ThemedText>
                </View>
                {calculatedAge !== null ? (
                  <View
                    style={[
                      styles.agePill,
                      { backgroundColor: withAlpha(theme.primary, 0.12) },
                    ]}
                  >
                    <ThemedText
                      style={styles.agePillText}
                      setColor={theme.primary}
                    >
                      {calculatedAge} years
                    </ThemedText>
                  </View>
                ) : null}
              </TouchableOpacity>

              {birthDate ? (
                <View style={styles.clearBirthDateRow}>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    onPress={() => {
                      clearProfileFeedback();
                      setBirthDate("");
                    }}
                  >
                    <ThemedText
                      style={styles.clearBirthDateText}
                      setColor={theme.primary}
                    >
                      Clear
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <InsetDivider />

              <View style={styles.displayNameSection}>
                <ThemedText
                  style={styles.fieldSectionLabel}
                  setColor={theme.quietText}
                >
                  Display name
                </ThemedText>
                <View
                  style={[
                    styles.inputField,
                    {
                      backgroundColor: theme.uiBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <TextInput
                    value={displayName}
                    onChangeText={(nextValue) => {
                      clearProfileFeedback();
                      setDisplayName(nextValue);
                    }}
                    placeholder="How your name appears"
                    placeholderTextColor={theme.quietText}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={!isLoadingProfile && !isSavingProfile}
                    maxLength={socialService.PROFILE_DISPLAY_NAME_MAX_LENGTH}
                    style={[styles.inputFieldValue, { color: theme.title }]}
                  />
                  <ThemedText
                    style={styles.inputFieldCounter}
                    setColor={theme.quietText}
                  >
                    {displayName.length}/
                    {socialService.PROFILE_DISPLAY_NAME_MAX_LENGTH}
                  </ThemedText>
                </View>
                {displayNameError && !isLoadingProfile ? (
                  <ThemedText
                    style={styles.fieldHelperText}
                    setColor={theme.danger}
                  >
                    {displayNameError}
                  </ThemedText>
                ) : (
                  <ThemedText
                    style={styles.fieldHelperText}
                    setColor={theme.quietText}
                  >
                    Visible in people search
                  </ThemedText>
                )}
              </View>

              <View style={styles.bioSection}>
                <ThemedText
                  style={styles.fieldSectionLabel}
                  setColor={theme.quietText}
                >
                  Bio
                </ThemedText>
                <View
                  style={[
                    styles.bioField,
                    {
                      backgroundColor: theme.uiBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <TextInput
                    value={bio}
                    onChangeText={(nextValue) => {
                      clearProfileFeedback();
                      setBio(nextValue);
                    }}
                    placeholder="Tell people a little about your training."
                    placeholderTextColor={theme.quietText}
                    autoCapitalize="sentences"
                    autoCorrect
                    editable={!isLoadingProfile && !isSavingProfile}
                    maxLength={socialService.PROFILE_BIO_MAX_LENGTH}
                    multiline
                    textAlignVertical="top"
                    style={[styles.bioFieldValue, { color: theme.title }]}
                  />
                  <ThemedText
                    style={styles.bioFieldCounter}
                    setColor={theme.quietText}
                  >
                    {bio.length}/{socialService.PROFILE_BIO_MAX_LENGTH}
                  </ThemedText>
                </View>
              </View>

              <ThemedDateWheelPicker
                visible={birthDatePickerVisible}
                value={getBirthDatePickerValue()}
                minYear={1900}
                title="Birth date"
                onClose={() => setBirthDatePickerVisible(false)}
                onConfirm={handleBirthDateConfirm}
              />

              {isLoadingProfile ? (
                <ThemedText style={styles.loadingText} setColor={theme.quietText}>
                  Loading profile...
                </ThemedText>
              ) : null}

              {profileFeedback.message ? (
                <View
                  style={[
                    styles.feedbackBanner,
                    {
                      backgroundColor:
                        profileFeedback.status === "error"
                          ? withAlpha(theme.danger, 0.08)
                          : withAlpha(theme.secondary, 0.12),
                      borderColor:
                        profileFeedback.status === "error"
                          ? theme.danger
                          : theme.secondary,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.feedbackBannerText}
                    setColor={profileStatusColor}
                  >
                    {profileFeedback.message}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.saveButtonWrapper}>
                <ThemedButton
                  title={isSavingProfile ? "Saving..." : "Save profile"}
                  onPress={handleSaveProfile}
                  fullWidth
                  height={50}
                  textSize={15}
                  disabled={
                    isLoadingProfile ||
                    isSavingProfile ||
                    !profile ||
                    !hasUnsavedChanges ||
                    Boolean(displayNameError)
                  }
                  style={styles.saveButton}
                />
              </View>
            </ThemedCard>
          </View>

          {/* Settings */}
          <View style={styles.section}>
            <SectionEyebrow>Settings</SectionEyebrow>
            <ThemedCard style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate("WorkoutTypesSettingsPage")}
                style={styles.settingsRow}
              >
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Dumbbell width={18} height={18} color={theme.primary} thickness={1.6} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  Workout types
                </ThemedText>
                <ChevronRight width={18} height={18} color={theme.quietText} />
              </TouchableOpacity>

              <InsetDivider />

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate("NotificationSettingsPage")}
                style={styles.settingsRow}
              >
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Bell width={18} height={18} color={theme.primary} thickness={1.7} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  Notifications
                </ThemedText>
                <ChevronRight width={18} height={18} color={theme.quietText} />
              </TouchableOpacity>

              <InsetDivider />

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate("SocialPostSettingsPage")}
                style={styles.settingsRow}
              >
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Pencil width={18} height={18} color={theme.primary} thickness={1.7} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  Social posts
                </ThemedText>
                <ChevronRight width={18} height={18} color={theme.quietText} />
              </TouchableOpacity>

              <InsetDivider />

              <View style={styles.settingsRow}>
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Moon width={18} height={18} color={theme.primary} thickness={1.7} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  Appearance
                </ThemedText>
                <AppearanceSegmentedControl
                  value={themeMode}
                  onChange={setThemeMode}
                />
              </View>

              <InsetDivider />

              <View style={styles.settingsRow}>
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Star width={18} height={18} color={theme.primary} filled />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  Color theme
                </ThemedText>
              </View>

              <View style={styles.accentPickerWrap}>
                <AccentThemePicker
                  value={accentTheme}
                  onChange={setAccentTheme}
                />
              </View>
            </ThemedCard>
          </View>

          {/* Feedback */}
          <View style={styles.section}>
            <SectionEyebrow>Feedback</SectionEyebrow>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setFeedbackModalVisible(true)}
              style={[
                styles.card,
                styles.feedbackCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.feedbackHeaderRow}>
                <SettingsIconTile backgroundColor={withAlpha(theme.secondary, 0.12)}>
                  <MessageCircleIcon
                    width={18}
                    height={18}
                    color={theme.secondary}
                    thickness={1.7}
                  />
                </SettingsIconTile>
                <View style={styles.feedbackTextColumn}>
                  <ThemedText style={styles.feedbackTitle} setColor={theme.title}>
                    Send feedback
                  </ThemedText>
                  <ThemedText style={styles.feedbackSubtitle} setColor={theme.text}>
                    Report bugs, odd behavior or ideas.
                  </ThemedText>
                </View>
              </View>

              <View style={styles.feedbackChipRow}>
                {["Bugs", "Ideas", "Missing"].map((label) => (
                  <View
                    key={label}
                    style={[
                      styles.feedbackChip,
                      {
                        backgroundColor: theme.chipBackground,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.feedbackChipText}
                      setColor={theme.textStrong}
                    >
                      {label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          </View>

          {/* Account */}
          <View style={styles.section}>
            <SectionEyebrow>Account</SectionEyebrow>
            <ThemedCard style={styles.card}>
              <View style={styles.accountRow}>
                <View style={styles.accountInfo}>
                  <ThemedText style={styles.accountLabel} setColor={theme.quietText}>
                    Logged in as
                  </ThemedText>
                  <ThemedText
                    style={styles.accountValue}
                    setColor={theme.title}
                    numberOfLines={1}
                  >
                    {user?.email ?? "Unknown account"}
                  </ThemedText>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleLogout}
                  disabled={isLoggingOut}
                  style={[
                    styles.logoutButton,
                    {
                      borderColor: "rgba(232,92,74,0.4)",
                      backgroundColor: "rgba(232,92,74,0.08)",
                      opacity: isLoggingOut ? 0.6 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.logoutButtonText}
                    setColor={theme.danger}
                  >
                    {isLoggingOut ? "Logging out..." : "Log out"}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {logoutError ? (
                <ThemedText style={styles.errorText} setColor={theme.danger}>
                  {logoutError}
                </ThemedText>
              ) : null}

              <InsetDivider />

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaRowLabel} setColor={theme.quietText}>
                  App
                </ThemedText>
                <ThemedText style={styles.metaRowValue} setColor={theme.title}>
                  {appName}
                </ThemedText>
              </View>

              <InsetDivider />

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaRowLabel} setColor={theme.quietText}>
                  Version
                </ThemedText>
                <ThemedText
                  style={[styles.metaRowValue, { fontVariant: ["tabular-nums"] }]}
                  setColor={theme.title}
                >
                  {appVersion}
                </ThemedText>
              </View>
            </ThemedCard>
          </View>
        </ThemedKeyboardProtection>
      </View>

      <FeedbackModal
        visible={feedbackModalVisible}
        onClose={() => setFeedbackModalVisible(false)}
        userId={user?.id ?? null}
      />
    </ThemedView>
  );
}
