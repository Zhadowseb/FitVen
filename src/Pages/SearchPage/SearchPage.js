import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import styles from "./SearchPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { useAuth } from "../../Contexts/AuthContext";
import { socialService } from "../../Services";
import {
  ThemedButton,
  ThemedCard,
  ThemedHeader,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const SearchPage = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyUserId, setBusyUserId] = useState(null);
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

  const emptyStateTitle =
    query.trim().length > 0 ? "No users matched." : "No other users yet.";
  const emptyStateBody =
    query.trim().length > 0
      ? "Try a different username, tag or display name."
      : "When more people join FitVen, they will show up here.";

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={[
              styles.pageHeaderTitleEyebrow,
              { color: quietText },
            ]}
          >
            Connect
          </ThemedText>

          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Search
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
            placeholder="Search username tags or display names"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInputWrapper}
          />

          <ThemedText style={styles.searchHint} setColor={quietText}>
            Search by username base, full tag or display name.
          </ThemedText>
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
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.primary ?? theme.iconColor} />
            <ThemedText style={styles.loadingLabel} setColor={quietText}>
              Loading people...
            </ThemedText>
          </View>
        ) : results.length > 0 ? (
          <View style={styles.resultsList}>
            {results.map((profile) => (
              <ThemedCard
                key={profile.id}
                style={[
                  styles.resultCard,
                  {
                    backgroundColor: cardSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.resultTopRow}>
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
                          ? "Following"
                          : "Follow"
                    }
                    onPress={() => handleToggleFollow(profile)}
                    width={108}
                    height={40}
                    variant={profile.isFollowing ? "secondary" : "primary"}
                    disabled={busyUserId === profile.id}
                    style={styles.followButton}
                  />
                </View>

                <ThemedText style={styles.resultBio} setColor={quietText}>
                  {profile.bio || "No bio yet."}
                </ThemedText>
              </ThemedCard>
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

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default SearchPage;
