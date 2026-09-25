import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import styles from "./EditProfilePageStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { useAuth } from "@contexts/AuthContext";
import { useTranslation } from "@localization";
import { socialService } from "@services";
import Lock from "@resources/Icons/UI-icons/Lock";
import {
  calculateAgeFromBirthDate,
  dateToIsoDate,
  isoDateToLocalDate,
} from "@utils/dateUtils";
import {
  ThemedConfirmModal,
  ThemedDateWheelPicker,
  ThemedKeyboardProtection,
  ThemedSegmentedControl,
  ThemedText,
  ThemedView,
} from "@resources/ThemedComponents";
import ProfileAvatarButton from "../ProfilePage/Components/ProfileAvatarButton";
import pickAndUploadAvatar from "../ProfilePage/pickAndUploadAvatar";

// BUG-11, still: Edit profile can be left without Cancel - swiped down, the
// back button, a tab on Android - and that unmounts it, and an unsaved edit
// used to go with it. So the draft lives outside the component, keyed by user
// so it cannot leak between accounts, and only a save that succeeds or
// "Discard" on Cancel drops it. Opened again, the form picks it back up.
let unsavedProfileDraft = null;

function rememberProfileDraft(userId, draft) {
  if (!userId) {
    return;
  }

  unsavedProfileDraft = { userId, ...draft };
}

function readProfileDraft(userId) {
  if (!userId || unsavedProfileDraft?.userId !== userId) {
    return null;
  }

  const { displayName, bio, birthDate, sex } = unsavedProfileDraft;

  return { displayName, bio, birthDate, sex };
}

function forgetProfileDraft() {
  unsavedProfileDraft = null;
}

function toFormValues(profile) {
  return {
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    birthDate: profile?.birthDate ?? "",
    sex: profile?.sex ?? null,
  };
}

/**
 * The profile form, as a modal over Profile: photo, display name, bio, the
 * username that cannot change, birth year and sex. Save is only offered when
 * something changed; Cancel asks before it throws changes away. A save that
 * works closes the sheet, and Profile reads itself again as it comes back into
 * focus.
 *
 * Param `profile`: what Profile had on screen, so the form opens filled in.
 * It is read again straight away, and a field the user has not touched takes
 * the fresh value.
 */
export default function EditProfilePage() {
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();
  const passedProfile =
    user?.id && route.params?.profile?.id === user.id
      ? route.params.profile
      : null;
  const [profile, setProfile] = useState(passedProfile);
  const [form, setForm] = useState(
    () => readProfileDraft(user?.id) ?? toFormValues(passedProfile)
  );
  // What the last read put in the form. A field that still matches it is
  // untouched and may take a fresh value; anything else is the user's typing.
  const loadedValuesRef = useRef(toFormValues(passedProfile));
  const isMountedRef = useRef(true);
  const closeAfterDismissRef = useRef(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [feedback, setFeedback] = useState({ status: "idle", message: "" });
  const [focusedField, setFocusedField] = useState(null);
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [discardConfirmVisible, setDiscardConfirmVisible] = useState(false);

  const normalizedDisplayName = form.displayName.trim();
  const normalizedBio = form.bio.trim();
  const displayNameError = normalizedDisplayName
    ? undefined
    : t("profile.displayName.empty");
  const calculatedAge = calculateAgeFromBirthDate(form.birthDate);
  // Only the year is kept, so only the year is shown.
  const birthYearDisplay = form.birthDate ? String(form.birthDate).slice(0, 4) : null;
  // Offered once the column exists (20260927090000_a-lifter-can-give-their-sex.sql).
  const showSexField = profile?.sexAvailable === true;
  const fieldsLocked = !profile || isSavingProfile;
  // The birth year and sex could not be read, so they are not written either:
  // an empty field saved over a stored value would erase it. For the same
  // reason a change to them does not count as one Save could keep.
  const privateSettingsUnreadable = profile?.privateSettingsAvailable === false;
  const privateFieldsLocked = fieldsLocked || privateSettingsUnreadable;
  const hasUnsavedChanges = profile
    ? normalizedDisplayName !== profile.displayName ||
      normalizedBio !== (profile.bio ?? "") ||
      (!privateSettingsUnreadable &&
        (form.birthDate !== (profile.birthDate ?? "") ||
          (showSexField && form.sex !== (profile.sex ?? null))))
    : false;
  const isSaveDisabled =
    !profile ||
    !hasUnsavedChanges ||
    Boolean(displayNameError) ||
    isSavingProfile ||
    isLoadingProfile ||
    // Saving closes the sheet, and Profile would read itself before the new
    // photo is in.
    isUploadingAvatar;
  const avatarButtonLabel = isUploadingAvatar
    ? t("profile.avatar.uploading")
    : profile?.avatarUrl
      ? t("profile.avatar.changePhoto")
      : t("profile.avatar.uploadPhoto");
  const avatarMaxMb = Math.round(
    socialService.PROFILE_AVATAR_MAX_BYTES / (1024 * 1024)
  );
  const sexOptions = [
    { value: socialService.PROFILE_SEXES.MALE, label: t("profile.sex.male") },
    { value: socialService.PROFILE_SEXES.FEMALE, label: t("profile.sex.female") },
  ];

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!user?.id) {
      setIsLoadingProfile(false);
      setFeedback({ status: "error", message: t("profile.feedback.signInToView") });

      return () => {
        isCancelled = true;
      };
    }

    setIsLoadingProfile(true);
    socialService
      .ensureOwnProfile(user)
      .then(
        (nextProfile) => {
          if (isCancelled) {
            return;
          }

          // The baseline is read into a local first: the updater runs during
          // the next render, and by then the ref already holds the new values.
          const baseline = loadedValuesRef.current;
          const loadedValues = toFormValues(nextProfile);
          const draft = readProfileDraft(user.id);

          loadedValuesRef.current = loadedValues;
          setProfile(nextProfile);
          setForm((current) =>
            draft ??
            Object.fromEntries(
              Object.entries(loadedValues).map(([key, loadedValue]) => [
                key,
                current[key] === baseline[key] ? loadedValue : current[key],
              ])
            )
          );
        },
        (error) => {
          if (!isCancelled) {
            setFeedback({
              status: "error",
              message:
                error instanceof Error
                  ? error.message
                  : t("profile.feedback.couldNotLoad"),
            });
          }
        }
      )
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [t, user]);

  const clearFeedback = () => {
    if (feedback.message) {
      setFeedback({ status: "idle", message: "" });
    }
  };

  const updateField = (key, value) => {
    const nextForm = { ...form, [key]: value };

    clearFeedback();
    setForm(nextForm);
    rememberProfileDraft(user?.id, nextForm);
  };

  const closeEditor = () => {
    // A save can finish after the sheet was swiped away; closing then would
    // close Profile under it.
    if (!isMountedRef.current) {
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("ProfilePage");
    }
  };

  const handleCancel = () => {
    // Nothing was loaded to compare against, so nothing is thrown away: a
    // draft from before stays for next time.
    if (!profile) {
      closeEditor();
      return;
    }

    if (hasUnsavedChanges) {
      setDiscardConfirmVisible(true);
      return;
    }

    forgetProfileDraft();
    closeEditor();
  };

  const handleDiscard = () => {
    forgetProfileDraft();
    setDiscardConfirmVisible(false);

    // On iOS this screen is a native modal, and the dialog is a second one on
    // top of it: the screen is closed once the dialog has gone, so UIKit is not
    // asked to dismiss both at once. Android has no such stack to unwind.
    if (Platform.OS === "ios") {
      closeAfterDismissRef.current = true;
      return;
    }

    closeEditor();
  };

  const handleDiscardDialogDismissed = () => {
    if (!closeAfterDismissRef.current) {
      return;
    }

    closeAfterDismissRef.current = false;
    closeEditor();
  };

  const handleSaveProfile = async () => {
    if (isSaveDisabled) {
      return;
    }

    if (!user?.id) {
      setFeedback({ status: "error", message: t("profile.feedback.signInToUpdate") });
      return;
    }

    setIsSavingProfile(true);
    setFeedback({ status: "idle", message: "" });

    try {
      const updatedProfile = await socialService.updateOwnProfile({
        user,
        displayName: form.displayName,
        bio: form.bio,
        // Left out when they could not be read - see privateFieldsLocked.
        ...(privateSettingsUnreadable
          ? {}
          : {
              birthDate: form.birthDate || null,
              ...(showSexField ? { sex: form.sex } : {}),
            }),
      });

      if (updatedProfile.privateSettingsError) {
        // The public half is saved and the birth year or sex is not. Stay
        // open with them still in the form, say so, and let Save try again.
        setProfile((current) => ({
          ...current,
          displayName: updatedProfile.displayName,
          bio: updatedProfile.bio,
        }));
        setFeedback({
          status: "error",
          message: t("profile.feedback.publicProfileUpdatedWithWarning", {
            warning: updatedProfile.privateSettingsError,
          }),
        });
        return;
      }

      forgetProfileDraft();
      closeEditor();
    } catch (error) {
      setFeedback({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : t("profile.feedback.couldNotUpdate"),
      });
    } finally {
      if (isMountedRef.current) {
        setIsSavingProfile(false);
      }
    }
  };

  const handleChooseAvatar = async () => {
    if (!user?.id) {
      setFeedback({
        status: "error",
        message: t("profile.feedback.signInToUpdatePhoto"),
      });
      return;
    }

    clearFeedback();
    setIsUploadingAvatar(true);

    try {
      const updatedProfile = await pickAndUploadAvatar({ user });

      if (updatedProfile && isMountedRef.current) {
        // Only the photo: the rest of `profile` is what the form is compared
        // against, and the edits in it are not saved yet.
        setProfile((current) =>
          current
            ? {
                ...current,
                avatarPath: updatedProfile.avatarPath,
                avatarUrl: updatedProfile.avatarUrl,
                avatarUpdatedAt: updatedProfile.avatarUpdatedAt,
                updatedAt: updatedProfile.updatedAt,
              }
            : updatedProfile
        );
        setFeedback({ status: "success", message: t("profile.feedback.photoUpdated") });
      }
    } catch (error) {
      if (isMountedRef.current) {
        setFeedback({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : t("profile.feedback.couldNotUploadPhoto"),
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsUploadingAvatar(false);
      }
    }
  };

  const getBirthDatePickerValue = () => {
    const selectedBirthDate = isoDateToLocalDate(form.birthDate);

    if (selectedBirthDate) {
      return selectedBirthDate;
    }

    const defaultBirthDate = new Date();
    defaultBirthDate.setFullYear(defaultBirthDate.getFullYear() - 18);
    return defaultBirthDate;
  };

  const handleBirthDateConfirm = (selectedDate) => {
    const pickedDate = dateToIsoDate(selectedDate);

    setBirthDatePickerVisible(false);

    if (!pickedDate) {
      return;
    }

    // Stored as the 1st of January, so it is kept that way here too: picking
    // the year that is already saved is not a change.
    updateField("birthDate", `${pickedDate.slice(0, 4)}-01-01`);
  };

  const inputBoxStyle = (fieldKey) => ({
    backgroundColor: theme.cardBackground,
    borderColor: focusedField === fieldKey ? theme.primary : theme.border,
    borderWidth: focusedField === fieldKey ? 1.5 : 1,
  });

  const isErrorFeedback = feedback.status === "error";

  return (
    <ThemedView
      // iOS shows this as a sheet below the status bar, which takes no top
      // inset; on Android the modal is a full screen and does.
      safe={Platform.OS === "ios" ? ["left", "right"] : ["top", "left", "right"]}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={isSavingProfile}
            hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
            onPress={handleCancel}
            style={[styles.cancelButton, isSavingProfile ? styles.locked : null]}
          >
            <ThemedText
              style={styles.cancelText}
              setColor={theme.mutedStrong}
              numberOfLines={1}
            >
              {t("common.cancel")}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText
          style={styles.headerTitle}
          setColor={theme.title}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {t("profile.edit.title")}
        </ThemedText>

        <View style={[styles.headerSide, styles.headerSideEnd]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isSavingProfile ? t("profile.saving") : t("common.save")
            }
            accessibilityState={{
              disabled: isSaveDisabled,
              busy: isSavingProfile,
            }}
            activeOpacity={0.85}
            disabled={isSaveDisabled}
            onPress={handleSaveProfile}
            style={[
              styles.savePill,
              {
                backgroundColor: theme.primary,
                opacity: isSaveDisabled ? 0.4 : 1,
              },
            ]}
          >
            {isSavingProfile ? (
              <ActivityIndicator size="small" color={theme.textInverted} />
            ) : (
              <ThemedText
                style={styles.saveText}
                setColor={theme.textInverted}
                numberOfLines={1}
              >
                {t("common.save")}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {feedback.message ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.feedbackBanner,
            {
              backgroundColor: isErrorFeedback
                ? withAlpha(theme.danger, 0.08)
                : withAlpha(theme.secondary, 0.12),
              borderColor: isErrorFeedback
                ? withAlpha(theme.danger, 0.5)
                : withAlpha(theme.secondary, 0.5),
            },
          ]}
        >
          <ThemedText
            style={styles.feedbackBannerText}
            setColor={isErrorFeedback ? theme.danger : theme.title}
          >
            {feedback.message}
          </ThemedText>
        </View>
      ) : null}

      <ThemedKeyboardProtection
        scroll
        bottomOffset={24}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 28 + (Platform.OS === "ios" ? insets.bottom : 0) },
        ]}
      >
        {/* Photo */}
        <View style={styles.avatarBlock}>
          <ProfileAvatarButton
            uri={profile?.avatarUrl}
            size={108}
            badgeSize={36}
            badgeIconSize={16}
            isUploading={isUploadingAvatar}
            disabled={!user?.id}
            onPress={handleChooseAvatar}
            accessibilityLabel={t("profile.avatar.changeAccessibility")}
          />
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={!user?.id || isUploadingAvatar}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            onPress={handleChooseAvatar}
          >
            <ThemedText style={styles.changePhotoText} setColor={theme.primaryText}>
              {avatarButtonLabel}
            </ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.avatarHint} setColor={theme.quietText}>
            {t("profile.avatar.hint", { maxMb: avatarMaxMb })}
          </ThemedText>
        </View>

        <View style={styles.fields}>
          {/* Display name */}
          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                {t("profile.displayName.label")}
              </ThemedText>
              <ThemedText style={styles.fieldCounter} setColor={theme.quietText}>
                {form.displayName.length}/{socialService.PROFILE_DISPLAY_NAME_MAX_LENGTH}
              </ThemedText>
            </View>
            <View
              style={[
                styles.inputBox,
                inputBoxStyle("displayName"),
                fieldsLocked ? styles.locked : null,
              ]}
            >
              <TextInput
                value={form.displayName}
                onChangeText={(value) => updateField("displayName", value)}
                onFocus={() => setFocusedField("displayName")}
                onBlur={() => setFocusedField(null)}
                accessibilityLabel={t("profile.displayName.label")}
                placeholder={t("profile.displayName.placeholder")}
                placeholderTextColor={theme.quietText}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!fieldsLocked}
                maxLength={socialService.PROFILE_DISPLAY_NAME_MAX_LENGTH}
                style={[styles.textInput, { color: theme.title }]}
              />
            </View>
            {displayNameError && profile ? (
              <ThemedText style={styles.fieldHelper} setColor={theme.danger}>
                {displayNameError}
              </ThemedText>
            ) : (
              <ThemedText style={styles.fieldHelper} setColor={theme.quietText}>
                {t("profile.displayName.hint")}
              </ThemedText>
            )}
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                {t("profile.bio.label")}
              </ThemedText>
              <ThemedText style={styles.fieldCounter} setColor={theme.quietText}>
                {form.bio.length}/{socialService.PROFILE_BIO_MAX_LENGTH}
              </ThemedText>
            </View>
            <View
              style={[
                styles.bioBox,
                inputBoxStyle("bio"),
                fieldsLocked ? styles.locked : null,
              ]}
            >
              <TextInput
                value={form.bio}
                onChangeText={(value) => updateField("bio", value)}
                onFocus={() => setFocusedField("bio")}
                onBlur={() => setFocusedField(null)}
                accessibilityLabel={t("profile.bio.label")}
                placeholder={t("profile.bio.placeholder")}
                placeholderTextColor={theme.quietText}
                autoCapitalize="sentences"
                autoCorrect
                editable={!fieldsLocked}
                maxLength={socialService.PROFILE_BIO_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                style={[styles.bioInput, { color: theme.title }]}
              />
            </View>
          </View>

          {/* Username: shown, never edited */}
          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                {t("profile.username.label")}
              </ThemedText>
            </View>
            <View
              accessible
              accessibilityLabel={t("profile.username.label")}
              accessibilityValue={{ text: profile?.username ?? "" }}
              style={[
                styles.inputBox,
                {
                  backgroundColor: theme.uiBackground,
                  borderColor: theme.hairline,
                  borderWidth: 1,
                },
              ]}
            >
              <ThemedText
                style={styles.usernameValue}
                setColor={theme.mutedStrong}
                numberOfLines={1}
              >
                {profile ? profile.usernameBase || profile.username : "…"}
                {profile?.usernameBase && profile.usernameCode ? (
                  <ThemedText
                    style={styles.usernameValue}
                    setColor={theme.primaryText}
                  >
                    #{profile.usernameCode}
                  </ThemedText>
                ) : null}
              </ThemedText>
              <Lock width={15} height={15} color={theme.quietText} />
            </View>
            <ThemedText style={styles.fieldHelper} setColor={theme.quietText}>
              {t("profile.username.locked")}
            </ThemedText>
          </View>

          {/* Birth year */}
          <View style={styles.field}>
            <View style={styles.fieldLabelRow}>
              <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                {t("profile.birthYear.label")}
              </ThemedText>
              {form.birthDate && !privateFieldsLocked ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  // BUG-18: "Clear" on its own says nothing about what it
                  // clears, which is the birth year beside it.
                  accessibilityLabel={t("profile.birthYear.clearAccessibility")}
                  activeOpacity={0.72}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => updateField("birthDate", "")}
                >
                  <ThemedText style={styles.fieldAction} setColor={theme.primaryText}>
                    {t("profile.birthYear.clear")}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("profile.birthYear.label")}
              accessibilityValue={{
                text: birthYearDisplay ?? t("profile.birthYear.select"),
              }}
              activeOpacity={0.78}
              disabled={privateFieldsLocked}
              onPress={() => setBirthDatePickerVisible(true)}
              style={[
                styles.inputBox,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                  borderWidth: 1,
                },
                privateFieldsLocked ? styles.locked : null,
              ]}
            >
              <ThemedText
                style={styles.birthYearValue}
                setColor={birthYearDisplay ? theme.title : theme.quietText}
                numberOfLines={1}
              >
                {birthYearDisplay ?? t("profile.birthYear.select")}
              </ThemedText>
              {calculatedAge !== null ? (
                <View
                  style={[
                    styles.agePill,
                    { backgroundColor: withAlpha(theme.primary, 0.12) },
                  ]}
                >
                  <ThemedText style={styles.agePillText} setColor={theme.primaryText}>
                    {t("profile.birthYear.age", { count: calculatedAge })}
                  </ThemedText>
                </View>
              ) : null}
            </TouchableOpacity>
            {profile?.privateSettingsAvailable === false &&
            profile.privateSettingsError ? (
              <ThemedText style={styles.fieldHelper} setColor={theme.danger}>
                {profile.privateSettingsError}
              </ThemedText>
            ) : (
              <ThemedText style={styles.fieldHelper} setColor={theme.quietText}>
                {t("profile.birthYear.hint")}
              </ThemedText>
            )}
          </View>

          {/* Sex: private, beside the birth year, never on the public profile */}
          {showSexField ? (
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <ThemedText style={styles.fieldLabel} setColor={theme.quietText}>
                  {t("profile.sex.label")}
                </ThemedText>
                {form.sex && !privateFieldsLocked ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.sex.clearAccessibility")}
                    activeOpacity={0.72}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => updateField("sex", null)}
                  >
                    <ThemedText style={styles.fieldAction} setColor={theme.primaryText}>
                      {t("profile.sex.clear")}
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View
                pointerEvents={privateFieldsLocked ? "none" : "auto"}
                style={[styles.sexControl, privateFieldsLocked ? styles.locked : null]}
              >
                <ThemedSegmentedControl
                  options={sexOptions}
                  value={form.sex}
                  onChange={(value) => updateField("sex", value)}
                />
              </View>
              <ThemedText style={styles.fieldHelper} setColor={theme.quietText}>
                {t("profile.sex.hint")}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </ThemedKeyboardProtection>

      <ThemedDateWheelPicker
        visible={birthDatePickerVisible}
        value={getBirthDatePickerValue()}
        minYear={1900}
        title={t("profile.birthYear.label")}
        onClose={() => setBirthDatePickerVisible(false)}
        onConfirm={handleBirthDateConfirm}
      />

      <ThemedConfirmModal
        visible={discardConfirmVisible}
        title={t("profile.edit.discardTitle")}
        message={t("profile.edit.discardMessage")}
        confirmLabel={t("profile.edit.discard")}
        cancelLabel={t("profile.edit.keepEditing")}
        tone="danger"
        onConfirm={handleDiscard}
        onClose={() => setDiscardConfirmVisible(false)}
        onDismiss={handleDiscardDialogDismissed}
      />
    </ThemedView>
  );
}
