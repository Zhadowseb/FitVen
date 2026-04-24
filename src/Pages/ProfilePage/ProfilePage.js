import { Pressable, ScrollView, View, useColorScheme } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

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
  ThemedModal,
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
  const [followCounts, setFollowCounts] = useState({
    followers: 0,
    following: 0,
  });
  const [isLoadingFollowCounts, setIsLoadingFollowCounts] = useState(true);
  const [activeRelationshipType, setActiveRelationshipType] = useState(null);
  const [relationshipProfiles, setRelationshipProfiles] = useState([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [relationshipError, setRelationshipError] = useState("");
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
  const panelSurface = theme.uiBackground ?? theme.background;
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
  const relationshipTitle =
    activeRelationshipType === "following" ? "Following" : "Followers";

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const loadProfile = async () => {
        if (!user?.id) {
          setProfile(null);
          setDisplayName("");
          setBio("");
          setFollowCounts({
            followers: 0,
            following: 0,
          });
          setIsLoadingProfile(false);
          setIsLoadingFollowCounts(false);
          setProfileFeedback({
            status: "error",
            message: "Sign in to view your profile.",
          });
          return;
        }

        setIsLoadingProfile(true);
        setIsLoadingFollowCounts(true);
        setProfileFeedback({
          status: "idle",
          message: "",
        });

        try {
          const nextProfile = await socialService.ensureOwnProfile(user);
          const nextFollowCounts = await socialService.getFollowCounts({
            userId: user.id,
          });

          if (isCancelled) {
            return;
          }

          setProfile(nextProfile);
          setDisplayName(nextProfile.displayName);
          setBio(nextProfile.bio ?? "");
          setFollowCounts(nextFollowCounts);
        } catch (error) {
          if (isCancelled) {
            return;
          }

          setProfile(null);
          setDisplayName("");
          setBio("");
          setFollowCounts({
            followers: 0,
            following: 0,
          });
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
            setIsLoadingFollowCounts(false);
          }
        }
      };

      loadProfile();

      return () => {
        isCancelled = true;
      };
    }, [user?.id])
  );

  const clearProfileFeedback = () => {
    if (profileFeedback.message) {
      setProfileFeedback({
        status: "idle",
        message: "",
      });
    }
  };

  const closeRelationshipModal = () => {
    setActiveRelationshipType(null);
    setRelationshipProfiles([]);
    setRelationshipError("");
    setIsLoadingRelationships(false);
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
      const nextRelationshipProfiles =
        relationshipType === "following"
          ? await socialService.getFollowing({
              userId: user.id,
              currentUserId: user.id,
            })
          : await socialService.getFollowers({
              userId: user.id,
              currentUserId: user.id,
            });

      setRelationshipProfiles(nextRelationshipProfiles);
    } catch (error) {
      setRelationshipError(
        error instanceof Error
          ? error.message
          : `Could not load ${relationshipType}.`
      );
    } finally {
      setIsLoadingRelationships(false);
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
          <View style={styles.relationshipSummaryRow}>
            <Pressable
              onPress={() => handleOpenRelationshipModal("followers")}
              disabled={isLoadingProfile}
              style={({ pressed }) => [
                styles.relationshipSummaryCard,
                {
                  backgroundColor: panelSurface,
                  borderColor: cardBorder,
                },
                pressed && !isLoadingProfile
                  ? styles.relationshipSummaryCardPressed
                  : null,
              ]}
            >
              <ThemedText
                style={styles.relationshipSummaryValue}
                setColor={titleColor}
              >
                {isLoadingFollowCounts ? "..." : followCounts.followers}
              </ThemedText>
              <ThemedText
                style={styles.relationshipSummaryLabel}
                setColor={quietText}
              >
                Followers
              </ThemedText>
              <ThemedText
                style={styles.relationshipSummaryHint}
                setColor={quietText}
              >
                Tap to view
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => handleOpenRelationshipModal("following")}
              disabled={isLoadingProfile}
              style={({ pressed }) => [
                styles.relationshipSummaryCard,
                {
                  backgroundColor: panelSurface,
                  borderColor: cardBorder,
                },
                pressed && !isLoadingProfile
                  ? styles.relationshipSummaryCardPressed
                  : null,
              ]}
            >
              <ThemedText
                style={styles.relationshipSummaryValue}
                setColor={titleColor}
              >
                {isLoadingFollowCounts ? "..." : followCounts.following}
              </ThemedText>
              <ThemedText
                style={styles.relationshipSummaryLabel}
                setColor={quietText}
              >
                Following
              </ThemedText>
              <ThemedText
                style={styles.relationshipSummaryHint}
                setColor={quietText}
              >
                Tap to view
              </ThemedText>
            </Pressable>
          </View>

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

      <ThemedModal
        visible={Boolean(activeRelationshipType)}
        onClose={closeRelationshipModal}
        title={`${relationshipTitle} (${activeRelationshipType === "following"
          ? followCounts.following
          : followCounts.followers})`}
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
            ))}
          </ScrollView>
        ) : (
          <ThemedText style={styles.relationshipStateText} setColor={quietText}>
            {activeRelationshipType === "following"
              ? "You are not following anyone yet."
              : "No one is following you yet."}
          </ThemedText>
        )}

        <ThemedButton
          title="Close"
          variant="secondary"
          onPress={closeRelationshipModal}
          fullWidth
          height={44}
          style={styles.relationshipCloseButton}
        />
      </ThemedModal>
    </ThemedView>
  );
}
