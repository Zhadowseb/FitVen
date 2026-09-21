import {
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import appConfig from "../../../app.json";
import styles from "./ProfilePageStyle";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import { authService } from "../../Services";
import { useAuth } from "../../Contexts/AuthContext";
import { useThemeMode } from "../../Contexts/ThemeContext";
import { useTranslation } from "@localization";
import { notificationService, socialService } from "../../Services";
import Bell from "../../Resources/Icons/UI-icons/Bell";
import Dumbbell from "../../Resources/Icons/UI-icons/Dumbbell";
import Pencil from "../../Resources/Icons/UI-icons/Pencil";
import Moon from "../../Resources/Icons/UI-icons/Moon";
import MusicNote from "../../Resources/Icons/UI-icons/MusicNote";
import Social from "../../Resources/Icons/UI-icons/Social";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import FeedbackModal from "../../Resources/Components/FeedbackModal/FeedbackModal";
import Lock from "../../Resources/Icons/UI-icons/Lock";
import MessageCircle from "../../Resources/Icons/UI-icons/MessageCircle";
import SectionEyebrow from "./Components/SectionEyebrow";
import InsetDivider from "./Components/InsetDivider";
import SettingsIconTile from "./Components/SettingsIconTile";
import AccentThemePicker from "./Components/AccentThemePicker";
import Star from "../../Resources/Icons/UI-icons/Star";
import {
  calculateAgeFromBirthDate,
  dateToIsoDate,
  isoDateToLocalDate,
} from "../../Utils/dateUtils";
import {
  ThemedButton,
  ThemedCard,
  ThemedConfirmModal,
  ThemedDateWheelPicker,
  ThemedKeyboardProtection,
  ThemedModal,
  ThemedSegmentedControl,
  ThemedTextInput,
  ThemedText,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

// Not localised on purpose: the word the user types has to match exactly, and
// a translated one is a different word on a phone in a different language.
const DELETE_CONFIRMATION_WORD = "DELETE";

function getNormalizedString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

// BUG-11: leaving this screen through the tab bar pops it off the stack, so
// the component unmounts and any unsaved edit goes with it - the field simply
// came back holding the stored value, with no warning that anything was lost.
// The draft therefore lives outside the component, keyed by user so it cannot
// leak between accounts, and is dropped the moment a save succeeds.
let unsavedProfileDraft = null;

function rememberProfileDraft(userId, draft) {
  if (!userId) {
    return;
  }

  unsavedProfileDraft = { userId, ...draft };
}

export default function ProfilePage() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
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
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  // What the last load put in the fields. A field that still matches this is
  // untouched and may be refreshed; anything else is the user's own typing.
  const loadedProfileRef = useRef({
    displayName: "",
    bio: "",
    birthDate: "",
  });
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
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const profileStatusColor =
    profileFeedback.status === "success"
      ? theme.secondary
      : profileFeedback.status === "error"
        ? theme.danger
        : theme.quietText;
  const normalizedDisplayName = displayName.trim();
  const normalizedBio = bio.trim();
  const calculatedAge = calculateAgeFromBirthDate(birthDate);
  // Only the year is kept, so only the year is shown.
  const birthYearDisplay = birthDate ? String(birthDate).slice(0, 4) : null;
  const displayNameError = normalizedDisplayName
    ? undefined
    : t("profile.displayName.empty");
  const hasUnsavedChanges = profile
    ? normalizedDisplayName !== profile.displayName ||
      normalizedBio !== (profile.bio ?? "") ||
      birthDate !== (profile.birthDate ?? "")
    : false;
  const avatarButtonLabel = isUploadingAvatar
    ? t("profile.avatar.uploading")
    : profile?.avatarUrl
      ? t("profile.avatar.changePhoto")
      : t("profile.avatar.uploadPhoto");
  const avatarMaxMb = Math.round(
    socialService.PROFILE_AVATAR_MAX_BYTES / (1024 * 1024)
  );
  const appName = getNormalizedString(appConfig?.expo?.name) ?? "FitVen";
  const appVersion =
    getNormalizedString(appConfig?.expo?.version) ??
    t("profile.account.unknownVersion");

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
            message: t("profile.feedback.signInToView"),
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

          // BUG-11: this used to overwrite the fields unconditionally, so
          // leaving the screen and coming back threw away whatever had been
          // typed and not saved, without a word. A field the user has edited
          // keeps what they wrote; the rest take the stored value.
          //
          // The baseline is read into a local first. The updater functions run
          // during the re-render, not here, so moving the ref forward before
          // they run compares the field against the value just fetched instead
          // of the value it was last given - which left every field empty.
          const baseline = loadedProfileRef.current;
          // Leaving this screen unmounts it, so unsaved edits cannot be kept in
          // component state - they were gone before this ran. The draft lives
          // outside the component and is cleared on save.
          const draft =
            unsavedProfileDraft?.userId === user.id ? unsavedProfileDraft : null;

          loadedProfileRef.current = {
            displayName: nextProfile.displayName,
            bio: nextProfile.bio ?? "",
            birthDate: nextProfile.birthDate ?? "",
          };

          setDisplayName((current) =>
            draft
              ? draft.displayName
              : current === baseline.displayName
                ? nextProfile.displayName
                : current
          );
          setBio((current) =>
            draft
              ? draft.bio
              : current === baseline.bio
                ? nextProfile.bio ?? ""
                : current
          );
          setBirthDate((current) =>
            draft
              ? draft.birthDate
              : current === baseline.birthDate
                ? nextProfile.birthDate ?? ""
                : current
          );
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
                : t("profile.feedback.couldNotLoad"),
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
        message: t("profile.feedback.signInToUpdate"),
      });
      return;
    }

    if (!normalizedDisplayName) {
      setProfileFeedback({
        status: "error",
        message: t("profile.displayName.empty"),
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
      unsavedProfileDraft = null;
      loadedProfileRef.current = {
        displayName: updatedProfile.displayName,
        bio: updatedProfile.bio ?? "",
        birthDate: updatedProfile.privateSettingsError
          ? loadedProfileRef.current.birthDate
          : updatedProfile.birthDate ?? "",
      };
      if (!updatedProfile.privateSettingsError) {
        setBirthDate(updatedProfile.birthDate ?? "");
      }
      setProfileFeedback({
        status: updatedProfile.privateSettingsError ? "error" : "success",
        message: updatedProfile.privateSettingsError
          ? t("profile.feedback.publicProfileUpdatedWithWarning", {
              warning: updatedProfile.privateSettingsError,
            })
          : t("profile.feedback.profileUpdated"),
      });
    } catch (error) {
      setProfileFeedback({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : t("profile.feedback.couldNotUpdate"),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChooseAvatar = async () => {
    if (!user?.id) {
      setProfileFeedback({
        status: "error",
        message: t("profile.feedback.signInToUpdatePhoto"),
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
        throw new Error(t("profile.feedback.photoPermissionRequired"));
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
        throw new Error(t("profile.feedback.noImageSelected"));
      }

      const updatedProfile = await socialService.uploadOwnAvatar({
        user,
        asset: selectedAsset,
      });

      setProfile(updatedProfile);
      setProfileFeedback({
        status: "success",
        message: t("profile.feedback.photoUpdated"),
      });
    } catch (error) {
      setProfileFeedback({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : t("profile.feedback.couldNotUploadPhoto"),
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
    rememberProfileDraft(user?.id, {
      displayName,
      bio,
      birthDate: nextBirthDate,
    });
    setBirthDatePickerVisible(false);
  };

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

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <View style={styles.content}>
        <ThemedKeyboardProtection
          scroll
          bottomOffset={96}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Public profile */}
          <View style={styles.section}>
            <SectionEyebrow>{t("profile.sections.publicProfile")}</SectionEyebrow>
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
                    {t("profile.avatar.hint", { maxMb: avatarMaxMb })}
                  </ThemedText>
                </View>
              </View>

              <InsetDivider />

              <View style={styles.fieldRow}>
                <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                  {t("profile.username")}
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
                      setColor={primaryTextColor}
                    >
                      #{profile.usernameCode}
                    </ThemedText>
                  ) : null}
                </ThemedText>
                <Lock width={15} height={15} color={theme.quietText} />
              </View>

              {/* The email used to sit here too, under a heading that says
                  Public profile - which it is not, and which was the second
                  place on this one screen it appeared. It is in Account, once,
                  where the thing it identifies actually lives. */}

              <InsetDivider />

              <TouchableOpacity
                activeOpacity={0.78}
                disabled={isLoadingProfile || isSavingProfile}
                onPress={() => setBirthDatePickerVisible(true)}
                style={styles.birthDateRow}
              >
                <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                  {t("profile.birthYear.label")}
                </ThemedText>
                <View style={styles.birthDateCopy}>
                  <ThemedText
                    style={styles.birthDateValue}
                    setColor={birthYearDisplay ? theme.title : theme.quietText}
                  >
                    {birthYearDisplay ?? t("profile.birthYear.select")}
                  </ThemedText>
                  <ThemedText
                    style={styles.birthDateSubline}
                    setColor={theme.quietText}
                  >
                    {t("profile.birthYear.hint")}
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
                      setColor={primaryTextColor}
                    >
                      {t("profile.birthYear.age", { count: calculatedAge })}
                    </ThemedText>
                  </View>
                ) : null}
              </TouchableOpacity>

              {birthDate ? (
                <View style={styles.clearBirthDateRow}>
                  <TouchableOpacity
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    // BUG-18: "Clear" on its own says nothing about what it
                    // clears, which is the birth year above it.
                    accessibilityLabel={t("profile.birthYear.clearAccessibility")}
                    onPress={() => {
                      clearProfileFeedback();
                      setBirthDate("");
                      rememberProfileDraft(user?.id, {
                        displayName,
                        bio,
                        birthDate: "",
                      });
                    }}
                  >
                    <ThemedText
                      style={styles.clearBirthDateText}
                      setColor={primaryTextColor}
                    >
                      {t("profile.birthYear.clear")}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}

              <InsetDivider />

              <View style={styles.displayNameSection}>
                <ThemedText
                  style={styles.fieldSectionLabel}
                  setColor={theme.text}
                >
                  {t("profile.displayName.label")}
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
                      rememberProfileDraft(user?.id, {
                        displayName: nextValue,
                        bio,
                        birthDate,
                      });
                    }}
                    placeholder={t("profile.displayName.placeholder")}
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
                    {t("profile.displayName.hint")}
                  </ThemedText>
                )}
              </View>

              <View style={styles.bioSection}>
                <ThemedText
                  style={styles.fieldSectionLabel}
                  setColor={theme.text}
                >
                  {t("profile.bio.label")}
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
                      rememberProfileDraft(user?.id, {
                        displayName,
                        bio: nextValue,
                        birthDate,
                      });
                    }}
                    placeholder={t("profile.bio.placeholder")}
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
                title={t("profile.birthYear.label")}
                onClose={() => setBirthDatePickerVisible(false)}
                onConfirm={handleBirthDateConfirm}
              />

              {isLoadingProfile ? (
                <ThemedText style={styles.loadingText} setColor={theme.quietText}>
                  {t("profile.loadingProfile")}
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
                  title={
                    isSavingProfile ? t("profile.saving") : t("profile.saveProfile")
                  }
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
            <SectionEyebrow>{t("profile.sections.settings")}</SectionEyebrow>
            <ThemedCard style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate("WorkoutTypesSettingsPage")}
                style={styles.settingsRow}
              >
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Dumbbell width={18} height={18} color={primaryTextColor} thickness={1.6} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  {t("profile.settings.workoutTypes")}
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
                  <Bell width={18} height={18} color={primaryTextColor} thickness={1.7} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  {t("profile.settings.notifications")}
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
                  <Pencil width={18} height={18} color={primaryTextColor} thickness={1.7} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  {t("profile.settings.socialPosts")}
                </ThemedText>
                <ChevronRight width={18} height={18} color={theme.quietText} />
              </TouchableOpacity>

              <InsetDivider />

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate("MusicSettingsPage")}
                style={styles.settingsRow}
              >
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <MusicNote width={18} height={18} color={primaryTextColor} thickness={2} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  {t("profile.settings.music")}
                </ThemedText>
                <ChevronRight width={18} height={18} color={theme.quietText} />
              </TouchableOpacity>

            </ThemedCard>
          </View>

          {/* Appearance
              Its own card, because these two are worked here rather than
              somewhere else. Mixed into the list above they looked identical to
              the rows that navigate away, and the only way to tell which kind a
              row was, was to press it. */}
          <View style={styles.section}>
            <SectionEyebrow>{t("profile.sections.appearance")}</SectionEyebrow>
            <ThemedCard style={styles.card}>
              <View style={styles.settingsControlRow}>
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Moon width={18} height={18} color={primaryTextColor} thickness={1.7} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  {t("profile.appearance.theme")}
                </ThemedText>
                <ThemedSegmentedControl
                  options={appearanceOptions}
                  value={themeMode}
                  onChange={setThemeMode}
                />
              </View>

              <InsetDivider />

              <View style={styles.settingsControlRow}>
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Social width={18} height={18} color={primaryTextColor} thickness={1.7} />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  {t("profile.language.label")}
                </ThemedText>
                <ThemedSegmentedControl
                  options={languageOptions}
                  value={languageMode}
                  onChange={setLanguageMode}
                />
              </View>

              <InsetDivider />

              <View style={styles.settingsControlRow}>
                <SettingsIconTile backgroundColor={withAlpha(theme.primary, 0.12)}>
                  <Star width={18} height={18} color={primaryTextColor} filled />
                </SettingsIconTile>
                <ThemedText style={styles.settingsRowLabel} setColor={theme.title}>
                  {t("profile.appearance.colour")}
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
            <SectionEyebrow>{t("profile.sections.feedback")}</SectionEyebrow>
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
                  <MessageCircle
                    width={18}
                    height={18}
                    color={theme.secondary}
                    thickness={1.7}
                  />
                </SettingsIconTile>
                <View style={styles.feedbackTextColumn}>
                  <ThemedText style={styles.feedbackTitle} setColor={theme.title}>
                    {t("profile.feedbackCard.title")}
                  </ThemedText>
                  <ThemedText style={styles.feedbackSubtitle} setColor={theme.text}>
                    {t("profile.feedbackCard.subtitle")}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.feedbackChipRow}>
                {[
                  t("profile.feedbackCard.bugs"),
                  t("profile.feedbackCard.ideas"),
                  t("profile.feedbackCard.missing"),
                ].map((label) => (
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
            <SectionEyebrow>{t("profile.sections.account")}</SectionEyebrow>
            <ThemedCard style={styles.card}>
              <View style={styles.accountRow}>
                <View style={styles.accountInfo}>
                  <ThemedText style={styles.accountLabel} setColor={theme.quietText}>
                    {t("profile.account.loggedInAs")}
                  </ThemedText>
                  <ThemedText
                    style={styles.accountValue}
                    setColor={theme.title}
                    numberOfLines={1}
                  >
                    {user?.email ?? t("profile.account.unknownAccount")}
                  </ThemedText>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setLogoutConfirmVisible(true)}
                  disabled={isLoggingOut}
                  style={[
                    styles.logoutButton,
                    {
                      // Was two fixed rgba values tuned for the dark theme, so
                      // in light mode the border was a colour from the other
                      // one. The danger token follows the theme.
                      borderColor: withAlpha(theme.danger, 0.4),
                      backgroundColor: withAlpha(theme.danger, 0.08),
                      opacity: isLoggingOut ? 0.6 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.logoutButtonText}
                    setColor={theme.danger}
                  >
                    {isLoggingOut
                      ? t("profile.account.loggingOut")
                      : t("profile.account.logOut")}
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
                  {t("profile.account.app")}
                </ThemedText>
                <ThemedText style={styles.metaRowValue} setColor={theme.title}>
                  {appName}
                </ThemedText>
              </View>

              <InsetDivider />

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaRowLabel} setColor={theme.quietText}>
                  {t("profile.account.version")}
                </ThemedText>
                <ThemedText
                  style={[styles.metaRowValue, { fontVariant: ["tabular-nums"] }]}
                  setColor={theme.title}
                >
                  {appVersion}
                </ThemedText>
              </View>

              <InsetDivider />

              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("profile.account.privacy")}
                onPress={() => navigation.navigate("PrivacyPolicyPage")}
                style={styles.deleteAccountRow}
              >
                <View style={styles.accountInfo}>
                  <ThemedText style={styles.accountValue} setColor={theme.title}>
                    {t("profile.account.privacy")}
                  </ThemedText>
                  <ThemedText
                    style={styles.deleteAccountHint}
                    setColor={theme.quietText}
                  >
                    {t("profile.account.privacyHint")}
                  </ThemedText>
                </View>

                <ChevronRight
                  width={16}
                  height={16}
                  stroke={theme.quietText}
                  color={theme.quietText}
                />
              </TouchableOpacity>

              <InsetDivider />

              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t("profile.account.deleteAccount")}
                onPress={() => setDeleteModalVisible(true)}
                style={styles.deleteAccountRow}
              >
                <View style={styles.accountInfo}>
                  <ThemedText
                    style={styles.accountValue}
                    setColor={theme.danger}
                  >
                    {t("profile.account.deleteAccount")}
                  </ThemedText>
                  <ThemedText
                    style={styles.deleteAccountHint}
                    setColor={theme.quietText}
                  >
                    {t("profile.account.deleteAccountHint")}
                  </ThemedText>
                </View>

                <ChevronRight
                  width={16}
                  height={16}
                  stroke={theme.danger}
                  color={theme.danger}
                />
              </TouchableOpacity>
            </ThemedCard>
          </View>
        </ThemedKeyboardProtection>
      </View>

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

        <ThemedText
          style={styles.deleteModalPrompt}
          setColor={theme.title}
        >
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
