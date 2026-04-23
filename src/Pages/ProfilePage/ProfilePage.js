import { View, useColorScheme } from "react-native";
import { useEffect, useState } from "react";

import styles from "./ProfilePageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { logout } from "../../Database/supaBaseClient";
import { useAuth } from "../../Contexts/AuthContext";
import { socialService } from "../../Services";
import {
  ThemedButton,
  ThemedCard,
  ThemedHeader,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

export default function ProfilePage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
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
  const panelSurface = theme.uiBackground ?? cardSurface;
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

  useEffect(() => {
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
  }, [user?.id]);

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
              Your display name and bio show up in people search. Username stays
              fixed for now.
            </ThemedText>

            <View
              style={[
                styles.identityPanel,
                {
                  backgroundColor: panelSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.identityGroup}>
                <ThemedText style={styles.identityLabel} setColor={quietText}>
                  Username
                </ThemedText>
                <ThemedText style={styles.identityValue} setColor={titleColor}>
                  {profile?.username ? `@${profile.username}` : "@..."}
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
                inputStyle={styles.bioInput}
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
    </ThemedView>
  );
}
