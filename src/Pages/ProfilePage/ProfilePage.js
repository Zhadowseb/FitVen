import {
  Alert,
  Pressable,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import styles from "./ProfilePageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { logout } from "../../Database/supaBaseClient";
import { useAuth } from "../../Contexts/AuthContext";
import { socialService } from "../../Services";
import Bell from "../../Resources/Icons/UI-icons/Bell";
import FeedbackModal from "../../Resources/Components/FeedbackModal/FeedbackModal";
import Library from "../../Resources/Icons/UI-icons/Library";
import Social from "../../Resources/Icons/UI-icons/Social";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import {
  ThemedButton,
  ThemedCard,
  ThemedHeader,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

const FeedbackGlow = ({
  style,
  color,
  gradientId,
  centerOpacity,
  middleOpacity,
}) => (
  <Svg
    pointerEvents="none"
    style={style}
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
  >
    <Defs>
      <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={color} stopOpacity={centerOpacity} />
        <Stop offset="34%" stopColor={color} stopOpacity={middleOpacity} />
        <Stop offset="68%" stopColor={color} stopOpacity={middleOpacity * 0.46} />
        <Stop offset="90%" stopColor={color} stopOpacity={middleOpacity * 0.12} />
        <Stop offset="100%" stopColor={color} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Rect width="100" height="100" fill={`url(#${gradientId})`} />
  </Svg>
);

export default function ProfilePage() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
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
  const headerEyebrowColor = theme.quietText ?? theme.iconColor;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const panelSurface = theme.uiBackground ?? theme.background;
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const thirdColor = theme.third ?? panelSurface;
  const thirdTextColor = theme.textInverted ?? theme.background ?? "#201e2b";
  const profileStatusColor =
    profileFeedback.status === "success"
      ? theme.secondaryDark ?? theme.secondary ?? titleColor
      : profileFeedback.status === "error"
        ? theme.danger ?? titleColor
        : quietText;
  const normalizedDisplayName = displayName.trim();
  const normalizedBio = bio.trim();
  const displayNameError = normalizedDisplayName
    ? undefined
    : "Display name cannot be empty.";
  const hasUnsavedChanges = profile
    ? normalizedDisplayName !== profile.displayName ||
      normalizedBio !== (profile.bio ?? "")
    : false;
  const avatarButtonLabel = isUploadingAvatar
    ? "Uploading..."
    : profile?.avatarUrl
      ? "Change photo"
      : "Upload photo";

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const loadProfile = async () => {
        if (!user?.id) {
          setProfile(null);
          setDisplayName("");
          setBio("");
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
        } catch (error) {
          if (isCancelled) {
            return;
          }

          setProfile(null);
          setDisplayName("");
          setBio("");
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
      });

      setProfile(updatedProfile);
      setDisplayName(updatedProfile.displayName);
      setBio(updatedProfile.bio ?? "");
      setProfileFeedback({
        status: "success",
        message: "Profile updated.",
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

  const handleLogout = async () => {
    setLogoutError("");
    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Could not log out."
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const openSettingsDraft = (sectionName) => {
    Alert.alert(sectionName, "Settings for this section will be added here.");
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={[
              styles.pageHeaderTitleEyebrow,
              { color: headerEyebrowColor },
            ]}
          >
            FitVen
          </ThemedText>

          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Profile
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <View style={styles.content}>
        <ThemedKeyboardProtection
          scroll
          contentContainerStyle={styles.scrollContent}
        >
          <ThemedCard
            style={[
              styles.profileCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText
              size={12}
              style={styles.cardEyebrow}
              setColor={headerEyebrowColor}
            >
              Public profile
            </ThemedText>
            <ThemedTitle type="h3" style={styles.cardTitle}>
              How others see you
            </ThemedTitle>
            <ThemedText style={styles.cardBody} setColor={quietText}>
              Your display name and bio show up in people search. Your username
              tag stays fixed once the account is created.
            </ThemedText>

            <View style={styles.avatarSection}>
              <UserAvatar
                uri={profile?.avatarUrl}
                size={104}
                iconSize={42}
                iconColor={theme.primary ?? titleColor}
                backgroundColor={panelSurface}
                borderColor={cardBorder}
                borderWidth={1}
              />

              <Pressable
                onPress={handleChooseAvatar}
                disabled={isLoadingProfile || isUploadingAvatar}
                style={({ pressed }) => [
                  styles.avatarButton,
                  {
                    backgroundColor: panelSurface,
                    borderColor: cardBorder,
                  },
                  pressed && !isLoadingProfile && !isUploadingAvatar
                    ? styles.avatarButtonPressed
                    : null,
                ]}
              >
                <ThemedText
                  style={styles.avatarButtonText}
                  setColor={titleColor}
                >
                  {avatarButtonLabel}
                </ThemedText>
              </Pressable>

              <ThemedText style={styles.avatarHelperText} setColor={quietText}>
                Shown in your profile, search and social circle. Square images
                work best. Up to{" "}
                {Math.round(socialService.PROFILE_AVATAR_MAX_BYTES / (1024 * 1024))}{" "}
                MB.
              </ThemedText>
            </View>

            <View style={styles.identityList}>
              <View style={styles.identityGroup}>
                <ThemedText style={styles.identityLabel} setColor={quietText}>
                  Username
                </ThemedText>
                <ThemedText style={styles.identityValue} setColor={titleColor}>
                  {profile?.username ?? "...#...."}
                </ThemedText>
              </View>

              <View style={styles.identityGroup}>
                <ThemedText style={styles.identityLabel} setColor={quietText}>
                  Email
                </ThemedText>
                <ThemedText
                  style={styles.identityValue}
                  setColor={titleColor}
                  numberOfLines={1}
                >
                  {user?.email ?? "Unknown account"}
                </ThemedText>
              </View>
            </View>

            <View style={styles.formSection}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Display name
              </ThemedText>
              <ThemedTextInput
                value={displayName}
                onChangeText={(nextValue) => {
                  clearProfileFeedback();
                  setDisplayName(nextValue);
                }}
                placeholder="How your name appears"
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isLoadingProfile && !isSavingProfile}
                maxLength={socialService.PROFILE_DISPLAY_NAME_MAX_LENGTH}
                error={!isLoadingProfile ? displayNameError : undefined}
                style={styles.inputWrapper}
                inputStyle={{
                  backgroundColor: thirdColor,
                  color: thirdTextColor,
                }}
                placeholderTextColor={thirdTextColor}
              />
              <View style={styles.metaRow}>
                <ThemedText style={styles.metaText} setColor={quietText}>
                  Visible in people search
                </ThemedText>
                <ThemedText style={styles.metaText} setColor={quietText}>
                  {displayName.length}/
                  {socialService.PROFILE_DISPLAY_NAME_MAX_LENGTH}
                </ThemedText>
              </View>
            </View>

            <View style={styles.formSection}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Bio
              </ThemedText>
              <ThemedTextInput
                value={bio}
                onChangeText={(nextValue) => {
                  clearProfileFeedback();
                  setBio(nextValue);
                }}
                placeholder="Tell people a little about your training."
                autoCapitalize="sentences"
                autoCorrect
                editable={!isLoadingProfile && !isSavingProfile}
                maxLength={socialService.PROFILE_BIO_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                style={styles.inputWrapper}
                inputStyle={[
                  styles.bioInput,
                  {
                    backgroundColor: thirdColor,
                    color: thirdTextColor,
                  },
                ]}
                placeholderTextColor={thirdTextColor}
              />
              <View style={styles.metaRow}>
                <ThemedText style={styles.metaText} setColor={quietText}>
                  Short, public intro
                </ThemedText>
                <ThemedText style={styles.metaText} setColor={quietText}>
                  {bio.length}/{socialService.PROFILE_BIO_MAX_LENGTH}
                </ThemedText>
              </View>
            </View>

            {isLoadingProfile ? (
              <ThemedText style={styles.loadingText} setColor={quietText}>
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
                        ? "rgba(186, 0, 0, 0.12)"
                        : theme.secondaryLight ?? "rgba(96, 218, 172, 0.16)",
                    borderColor:
                      profileFeedback.status === "error"
                        ? theme.danger ?? cardBorder
                        : theme.secondary ?? cardBorder,
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

            <View style={styles.actions}>
              <ThemedButton
                title={isSavingProfile ? "Saving..." : "Save profile"}
                onPress={handleSaveProfile}
                fullWidth
                disabled={
                  isLoadingProfile ||
                  isSavingProfile ||
                  !profile ||
                  !hasUnsavedChanges ||
                  Boolean(displayNameError)
                }
                style={styles.primaryButton}
              />
            </View>
          </ThemedCard>

          <ThemedCard
            style={[
              styles.settingsCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText
              size={12}
              style={styles.cardEyebrow}
              setColor={headerEyebrowColor}
            >
              Settings
            </ThemedText>
            <ThemedTitle type="h3" style={styles.cardTitle}>
              Personal settings
            </ThemedTitle>

            <View style={styles.settingsList}>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => openSettingsDraft("Exercises")}
                style={[
                  styles.settingsButton,
                  {
                    backgroundColor: thirdColor,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.settingsButtonContent}>
                  <Library width={22} height={22} color={thirdTextColor} />
                  <ThemedText
                    style={styles.settingsButtonText}
                    setColor={thirdTextColor}
                  >
                    Exercises
                  </ThemedText>
                </View>
                <TailArrowUpRight
                  width={18}
                  height={18}
                  stroke={thirdTextColor}
                  color={thirdTextColor}
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate("NotificationSettingsPage")}
                style={[
                  styles.settingsButton,
                  {
                    backgroundColor: thirdColor,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.settingsButtonContent}>
                  <Bell width={22} height={22} color={thirdTextColor} />
                  <ThemedText
                    style={styles.settingsButtonText}
                    setColor={thirdTextColor}
                  >
                    Notifications
                  </ThemedText>
                </View>
                <TailArrowUpRight
                  width={18}
                  height={18}
                  stroke={thirdTextColor}
                  color={thirdTextColor}
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate("SocialPostSettingsPage")}
                style={[
                  styles.settingsButton,
                  {
                    backgroundColor: thirdColor,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.settingsButtonContent}>
                  <Social width={22} height={22} color={thirdTextColor} />
                  <ThemedText
                    style={styles.settingsButtonText}
                    setColor={thirdTextColor}
                  >
                    Social posts
                  </ThemedText>
                </View>
                <TailArrowUpRight
                  width={18}
                  height={18}
                  stroke={thirdTextColor}
                  color={thirdTextColor}
                />
              </TouchableOpacity>
            </View>
          </ThemedCard>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setFeedbackModalVisible(true)}
            style={[
              styles.feedbackPortal,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <FeedbackGlow
              style={styles.feedbackPortalGlowPrimary}
              color={primaryColor}
              gradientId="profileFeedbackPrimaryGlow"
              centerOpacity={0.28}
              middleOpacity={0.15}
            />
            <FeedbackGlow
              style={styles.feedbackPortalGlowSecondary}
              color={secondaryColor}
              gradientId="profileFeedbackSecondaryGlow"
              centerOpacity={0.23}
              middleOpacity={0.12}
            />

            <View style={styles.feedbackPortalHeader}>
              <View style={styles.feedbackPortalStatusCluster}>
                <View
                  style={[
                    styles.feedbackPortalStatusDot,
                    { backgroundColor: secondaryColor },
                  ]}
                />
                <ThemedText
                  style={styles.feedbackPortalEyebrow}
                  setColor={quietText}
                >
                  FEEDBACK
                </ThemedText>
              </View>

              <View
                style={[
                  styles.feedbackPortalActionIcon,
                  {
                    backgroundColor: panelSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <TailArrowUpRight
                  width={18}
                  height={18}
                  stroke={primaryColor}
                  color={primaryColor}
                />
              </View>
            </View>

            <ThemedTitle
              type="h3"
              style={[styles.feedbackPortalTitle, { color: titleColor }]}
            >
              Send Feedback
            </ThemedTitle>

            <ThemedText
              style={styles.feedbackPortalDescription}
              setColor={quietText}
            >
              Report bugs, odd behavior, ideas or something you're missing.
            </ThemedText>

            <View style={styles.feedbackPortalChipRow}>
              {["Bugs", "Ideas", "Missing"].map((label) => (
                <View
                  key={label}
                  style={[
                    styles.feedbackPortalChip,
                    {
                      backgroundColor: panelSurface,
                      borderColor: cardBorder,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.feedbackPortalChipText}
                    setColor={quietText}
                  >
                    {label}
                  </ThemedText>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          <ThemedCard
            style={[
              styles.accountCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText
              size={12}
              style={styles.cardEyebrow}
              setColor={headerEyebrowColor}
            >
              Account
            </ThemedText>
            <ThemedTitle type="h3" style={styles.cardTitle}>
              Logged in
            </ThemedTitle>
            <ThemedText style={styles.accountValue}>
              {user?.email ?? "Unknown account"}
            </ThemedText>
            <ThemedText style={styles.cardBody} setColor={headerEyebrowColor}>
              You can log out here when you want to switch account.
            </ThemedText>

            <View style={styles.actions}>
              <ThemedButton
                title={isLoggingOut ? "Logging out..." : "Log out"}
                variant="danger"
                onPress={handleLogout}
                fullWidth
                disabled={isLoggingOut}
                style={styles.logoutButton}
              />

              {logoutError ? (
                <ThemedText style={styles.errorText} setColor={theme.danger}>
                  {logoutError}
                </ThemedText>
              ) : null}
            </View>
          </ThemedCard>
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
