import { StatusBar } from "expo-status-bar";
import {
  ScrollView,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import styles from "./SocialUserListPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { useAuth } from "../../Contexts/AuthContext";
import { socialService } from "../../Services";
import {
  ThemedButton,
  ThemedCard,
  ThemedConfirmModal,
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

const SocialUserListPage = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyUserId, setBusyUserId] = useState(null);
  const [unfollowTarget, setUnfollowTarget] = useState(null);
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const secondaryDark = theme.secondaryDark ?? theme.secondary ?? titleColor;

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((currentValue) => currentValue + 1);
    }, [])
  );

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      setResults([]);
      setErrorMessage("Sign in to search for other users.");
      return;
    }

    let isCancelled = false;
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        await socialService.ensureOwnProfile(user);
        const nextResults = await socialService.searchUsers({
          query,
          currentUserId: user.id,
        });

        if (!isCancelled) {
          setResults(nextResults);
        }
      } catch (error) {
        if (!isCancelled) {
          setResults([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load user search right now."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [query, refreshKey, user]);

  const requestToggleFollow = (profile) => {
    if (profile?.isFollowing) {
      setUnfollowTarget(profile);
      return;
    }

    void handleToggleFollow(profile);
  };

  const confirmUnfollow = () => {
    const profile = unfollowTarget;
    setUnfollowTarget(null);

    if (profile) {
      void handleToggleFollow(profile);
    }
  };

  const handleToggleFollow = async (profile) => {
    if (!user?.id || busyUserId) {
      return;
    }

    const wasFollowing = profile.isFollowing;
    setBusyUserId(profile.id);
    setErrorMessage("");
    setResults((currentResults) =>
      currentResults.map((currentProfile) =>
        currentProfile.id === profile.id
          ? { ...currentProfile, isFollowing: !wasFollowing }
          : currentProfile
      )
    );

    try {
      if (wasFollowing) {
        await socialService.unfollowUser({
          userId: user.id,
          targetUserId: profile.id,
        });
      } else {
        await socialService.followUser({
          userId: user.id,
          targetUserId: profile.id,
        });
      }
    } catch (error) {
      setResults((currentResults) =>
        currentResults.map((currentProfile) =>
          currentProfile.id === profile.id
            ? { ...currentProfile, isFollowing: wasFollowing }
            : currentProfile
        )
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update follow status."
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  // Two distinct answers: nobody to show, or nobody matching this search. The
  // search case repeats the term, so it is clear what was looked for.
  const emptyStateTitle = isSearching
    ? `No match for "${trimmedQuery}"`
    : "No other users yet";
  const emptyStateBody = isSearching
    ? "Check the spelling, or search for their username instead."
    : "When more people join FitVen, they will show up here.";

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={12}
            style={[
              styles.pageHeaderTitleEyebrow,
              { color: quietText },
            ]}
          >
            Discover
          </ThemedText>

          <ThemedTitle
            type="pageTitle"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Find Friends
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.searchSection}>
          <ThemedTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or username"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInputWrapper}
          />
        </View>

        {errorMessage ? (
          <ThemedCard
            style={[
              styles.noticeCard,
              {
                backgroundColor: cardSurface,
                borderColor: theme.danger ?? cardBorder,
              },
            ]}
          >
            <ThemedText style={styles.noticeTitle} setColor={titleColor}>
              Search unavailable
            </ThemedText>
            <ThemedText style={styles.noticeBody} setColor={quietText}>
              {errorMessage}
            </ThemedText>
          </ThemedCard>
        ) : null}

        {isLoading ? (
          <ThemedStateBlock
            style={styles.loadingState}
            message="Loading people..."
          />
        ) : results.length > 0 ? (
          <View style={styles.resultsList}>
            {results.map((profile) => (
              <View
                key={profile.id}
                style={[
                  styles.resultRow,
                  {
                    borderColor: cardBorder,
                  },
                ]}
              >
                <UserAvatar
                  uri={profile.avatarUrl}
                  size={48}
                  iconSize={24}
                  iconColor={theme.primary ?? titleColor}
                  backgroundColor={
                    theme.fields ?? theme.uiBackground ?? theme.background
                  }
                  borderColor={cardBorder}
                  borderWidth={1}
                />

                <View style={styles.resultCopy}>
                  <ThemedText
                    style={styles.resultDisplayName}
                    setColor={titleColor}
                  >
                    {profile.displayName}
                  </ThemedText>
                  <ThemedText
                    style={styles.resultUsername}
                    setColor={secondaryDark}
                  >
                    {profile.username}
                  </ThemedText>
                </View>

                <ThemedButton
                  title={
                    busyUserId === profile.id
                      ? "Saving..."
                      : profile.isFollowing
                        ? "Following \u2713"
                        : "Follow"
                  }
                  onPress={() => requestToggleFollow(profile)}
                  width={112}
                  height={36}
                  textSize={13}
                  variant={profile.isFollowing ? "secondary" : "primary"}
                  disabled={busyUserId === profile.id}
                  style={styles.followButton}
                />
              </View>
            ))}
          </View>
        ) : (
          <ThemedCard
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <ThemedText style={styles.emptyStateTitle} setColor={titleColor}>
              {emptyStateTitle}
            </ThemedText>
            <ThemedText style={styles.emptyStateBody} setColor={quietText}>
              {emptyStateBody}
            </ThemedText>
          </ThemedCard>
        )}
      </ScrollView>

      <ThemedConfirmModal
        visible={Boolean(unfollowTarget)}
        title="Stop following?"
        message={`${
          unfollowTarget?.displayName ??
          unfollowTarget?.username ??
          "This person"
        } will no longer appear in your feed. You can follow them again later.`}
        confirmLabel="Stop following"
        cancelLabel="Keep following"
        tone="danger"
        isWorking={Boolean(busyUserId)}
        onConfirm={confirmUnfollow}
        onClose={() => setUnfollowTarget(null)}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default SocialUserListPage;
