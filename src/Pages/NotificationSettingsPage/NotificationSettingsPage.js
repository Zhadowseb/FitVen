import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import styles from "./NotificationSettingsPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { notificationService, socialService } from "../../Services";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import Cross from "../../Resources/Icons/UI-icons/Cross";
import Search from "../../Resources/Icons/UI-icons/Search";
import {
  ThemedHeader,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedTitle,
  ThemedView,
ThemedCard,
} from "../../Resources/ThemedComponents";

const WORKOUT_START_OPTIONS = [
  {
    value: notificationService.WORKOUT_START_NOTIFICATION_MODES.NONE,
    title: "No notifications",
    body: "No notifications when someone starts a workout.",
  },
  {
    value: notificationService.WORKOUT_START_NOTIFICATION_MODES.FOLLOWING,
    title: "Everyone I follow",
    body: "Get notified when any followed user starts a workout.",
  },
  {
    value: notificationService.WORKOUT_START_NOTIFICATION_MODES.CUSTOM,
    title: "Pick specific people",
    body: "Only the people you choose below.",
  },
];

function getInitials(profile) {
  const name = profile?.displayName || profile?.usernameBase || profile?.username;
  const words = `${name ?? ""}`
    .replace(/#\d+$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function matchesProfileQuery(profile, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [profile.displayName, profile.username, profile.usernameBase]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

export default function NotificationSettingsPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [selectedMode, setSelectedMode] = useState(
    notificationService.DEFAULT_WORKOUT_START_NOTIFICATION_MODE
  );
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [followingProfiles, setFollowingProfiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(null);
  const [savingSourceId, setSavingSourceId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("error");
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.iconColor ?? theme.quietText ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const customPanelSurface = theme.fields ?? cardSurface;
  const pageSurface = theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const primaryColor = theme.primary ?? "#f7742e";
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const selectedSurface = withAlpha(
    theme.primary,
    colorScheme === "dark" ? 0.12 : 0.14
  );
  // A saved choice whose device registration failed is a warning, not a
  // failure: the preference is stored either way.
  const showFeedback = (text, tone = "error") => {
    setFeedback(text);
    setFeedbackTone(tone);
  };

  const selectedSourceIdSet = useMemo(
    () => new Set(selectedSourceIds),
    [selectedSourceIds]
  );
  const selectedProfiles = followingProfiles.filter((profile) =>
    selectedSourceIdSet.has(profile.id)
  );
  const filteredProfiles = followingProfiles.filter((profile) =>
    matchesProfileQuery(profile, searchQuery)
  );

  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      showFeedback("Sign in to manage notification settings.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    showFeedback("");

    try {
      const [nextSettings, nextFollowingProfiles] = await Promise.all([
        notificationService.getPushNotificationSettings({ user }),
        socialService.getFollowing({
          userId: user.id,
          currentUserId: user.id,
          limit: 100,
        }),
      ]);

      setSelectedMode(nextSettings.workoutStartMode);
      setSelectedSourceIds(nextSettings.selectedSourceIds ?? []);
      setFollowingProfiles(nextFollowingProfiles);
    } catch (error) {
      showFeedback(
        error instanceof Error
          ? error.message
          : "Could not load notification settings."
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const selectMode = async (mode) => {
    if (!user?.id || savingMode || mode === selectedMode) {
      return;
    }

    const previousMode = selectedMode;
    setSelectedMode(mode);
    setSavingMode(mode);
    showFeedback("");

    try {
      const nextSettings =
        await notificationService.setWorkoutStartNotificationMode({
          user,
          mode,
        });

      setSelectedMode(nextSettings.workoutStartMode);
      setSelectedSourceIds(nextSettings.selectedSourceIds ?? selectedSourceIds);

      if (nextSettings?.skipped) {
        showFeedback(
          nextSettings.reason === "permission_denied"
            ? "Saved. Notification permission was not granted on this device."
            : "Saved. This device could not register for push notifications, so it may not receive them yet.",
          "warning"
        );
      }
    } catch (error) {
      setSelectedMode(previousMode);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Could not save notification settings."
      );
    } finally {
      setSavingMode(null);
    }
  };

  const toggleSource = async (profile) => {
    if (!user?.id || savingSourceId) {
      return;
    }

    const wasSelected = selectedSourceIdSet.has(profile.id);
    const previousSourceIds = selectedSourceIds;
    const nextSourceIds = wasSelected
      ? selectedSourceIds.filter((sourceId) => sourceId !== profile.id)
      : [...selectedSourceIds, profile.id];

    setSelectedSourceIds(nextSourceIds);
    setSavingSourceId(profile.id);
    showFeedback("");

    try {
      const nextSettings =
        await notificationService.setWorkoutStartNotificationSources({
          user,
          sourceUserIds: nextSourceIds,
        });

      setSelectedSourceIds(nextSettings.selectedSourceIds ?? nextSourceIds);
    } catch (error) {
      setSelectedSourceIds(previousSourceIds);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Could not update custom notification list."
      );
    } finally {
      setSavingSourceId(null);
    }
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={12}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            Settings
          </ThemedText>
          <ThemedTitle
            type="pageTitle"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Notifications
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ThemedKeyboardProtection
        scroll
        bottomOffset={180}
        contentContainerStyle={styles.scrollContent}
        scrollViewProps={{
          style: styles.content,
          showsVerticalScrollIndicator: false,
        }}
      >
        <ThemedCard
          style={[
            styles.card,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitleText} setColor={titleColor}>
              When a workout starts
            </ThemedText>
            <ThemedText style={styles.cardBodyText} setColor={quietText}>
              Choose who triggers a notification when they start training.
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={primaryTextColor} />
            </View>
          ) : (
            <View style={styles.optionList}>
              {WORKOUT_START_OPTIONS.map((option) => {
                const selected = selectedMode === option.value;
                const saving = savingMode === option.value;

                return (
                  <Pressable
                    key={option.value}
                    disabled={Boolean(savingMode)}
                    onPress={() => selectMode(option.value)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      selected
                        ? {
                            backgroundColor: selectedSurface,
                          }
                        : null,
                      pressed && !savingMode ? styles.pressed : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor: selected ? primaryColor : cardBorder,
                        },
                      ]}
                    >
                      {selected ? (
                        <View
                          style={[
                            styles.radioInner,
                            { backgroundColor: primaryColor },
                          ]}
                        />
                      ) : null}
                    </View>

                    <View style={styles.optionCopy}>
                      <ThemedText
                        style={styles.optionTitle}
                        setColor={selected ? primaryColor : titleColor}
                      >
                        {option.title}
                      </ThemedText>
                      <ThemedText style={styles.optionBody} setColor={quietText}>
                        {option.body}
                      </ThemedText>
                    </View>

                    {saving ? (
                      <ActivityIndicator size="small" color={primaryTextColor} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          {!isLoading &&
          selectedMode ===
            notificationService.WORKOUT_START_NOTIFICATION_MODES.CUSTOM ? (
            <View
              style={[
                styles.customPanel,
                {
                  backgroundColor: customPanelSurface,
                },
              ]}
            >
              <View style={styles.selectedBlock}>
                <ThemedText style={styles.selectedLabel} setColor={quietText}>
                  SELECTED ({selectedProfiles.length})
                </ThemedText>

                {selectedProfiles.length ? (
                  <View style={styles.chipRow}>
                    {selectedProfiles.map((profile) => (
                      <Pressable
                        key={profile.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${
                          profile.displayName ?? profile.username ?? "person"
                        }`}
                        disabled={Boolean(savingSourceId)}
                        onPress={() => toggleSource(profile)}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            backgroundColor: selectedSurface,
                            borderColor: withAlpha(theme.primary, 0.45),
                          },
                          pressed && !savingSourceId ? styles.pressed : null,
                        ]}
                      >
                        <ThemedText
                          style={styles.chipText}
                          setColor={primaryTextColor}
                          numberOfLines={1}
                        >
                          {profile.displayName ?? profile.username}
                        </ThemedText>

                        {savingSourceId === profile.id ? (
                          <ActivityIndicator
                            size="small"
                            color={primaryTextColor}
                          />
                        ) : (
                          <Cross width={12} height={12} color={primaryTextColor} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <ThemedText style={styles.chipHint} setColor={quietText}>
                    Nobody selected yet. Pick people from the list below.
                  </ThemedText>
                )}
              </View>

              <View
                style={[
                styles.searchBox,
                {
                  backgroundColor: pageSurface,
                  borderColor: cardBorder,
                },
              ]}
              >
                <Search width={18} height={18} color={quietText} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search people you follow"
                  placeholderTextColor={quietText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.searchInput, { color: titleColor }]}
                />
              </View>

              <View style={styles.peopleList}>
                {filteredProfiles.length ? (
                  filteredProfiles.map((profile) => {
                    const selected = selectedSourceIdSet.has(profile.id);
                    const saving = savingSourceId === profile.id;

                    return (
                      <Pressable
                        key={profile.id}
                        disabled={Boolean(savingSourceId)}
                        onPress={() => toggleSource(profile)}
                        style={({ pressed }) => [
                          styles.personRow,
                          {
                            borderBottomColor: cardBorder,
                          },
                          pressed && !savingSourceId ? styles.pressed : null,
                        ]}
                      >
                        <View
                          style={[
                            styles.initialsAvatar,
                            {
                              backgroundColor: theme.fields ?? cardSurface,
                              borderColor: cardBorder,
                            },
                          ]}
                        >
                          <ThemedText
                            style={styles.initialsText}
                            setColor={titleColor}
                          >
                            {getInitials(profile)}
                          </ThemedText>
                        </View>

                        <View style={styles.personCopy}>
                          <ThemedText
                            style={styles.personName}
                            setColor={titleColor}
                            numberOfLines={1}
                          >
                            {profile.displayName}
                          </ThemedText>
                          <ThemedText
                            style={styles.personUsername}
                            setColor={quietText}
                            numberOfLines={1}
                          >
                            {profile.username}
                          </ThemedText>
                        </View>

                        <View
                          style={[
                            styles.checkOuter,
                            {
                              borderColor: selected ? primaryColor : cardBorder,
                              backgroundColor: selected
                                ? primaryColor
                                : "transparent",
                            },
                          ]}
                        >
                          {saving ? (
                            <ActivityIndicator size="small" color={primaryTextColor} />
                          ) : selected ? (
                            <Checkmark
                              width={15}
                              height={15}
                              color={theme.textInverted ?? "#15100d"}
                              thickness={2.2}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })
                ) : (
                  <View style={styles.emptyPeopleState}>
                    <ThemedText
                      style={styles.emptyPeopleText}
                      setColor={quietText}
                    >
                      No followed people matched.
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          ) : null}
        </ThemedCard>

        {feedback ? (
          <ThemedText
            style={styles.feedbackText}
            setColor={
              feedbackTone === "warning"
                ? theme.planned ?? theme.danger
                : theme.danger
            }
          >
            {feedback}
          </ThemedText>
        ) : null}
      </ThemedKeyboardProtection>
    </ThemedView>
  );
}
