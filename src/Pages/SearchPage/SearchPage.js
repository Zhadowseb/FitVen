import { StatusBar } from "expo-status-bar";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./SearchPageStyle";
import FriendsActivity from "../../Resources/Components/FriendsActivity/FriendsActivity";
import { Colors } from "../../Resources/GlobalStyling/colors";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import { useAuth } from "../../Contexts/AuthContext";
import { programService, socialService } from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";
import {
  ThemedButton,
  ThemedHeader,
  ThemedModal,
  ThemedText,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

const searchPeopleImage = require("../../Resources/Images/DarkVersion/Search_people.png");

const SearchPage = () => {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const navigation = useNavigation();
  const { user } = useAuth();
  const todayDate = getTodaysDate();
  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const [followCounts, setFollowCounts] = useState({
    followers: 0,
    following: 0,
  });
  const [isLoadingFollowCounts, setIsLoadingFollowCounts] = useState(true);
  const [activeRelationshipType, setActiveRelationshipType] = useState(null);
  const [relationshipProfiles, setRelationshipProfiles] = useState([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [relationshipError, setRelationshipError] = useState("");
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const relationshipTitle =
    activeRelationshipType === "following" ? "Following" : "Followers";

  const loadCirclePreview = useCallback(async () => {
    if (!user?.id) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setFollowCounts({
        followers: 0,
        following: 0,
      });
      setIsLoadingFollowCounts(false);
      setCirclePreviewError("");
      return;
    }

    setCirclePreviewError("");
    setIsLoadingFollowCounts(true);

    try {
      const [nextCirclePreview, todayActivitySummary, nextFollowCounts] =
        await Promise.all([
          socialService.getCirclePreview({
            user,
            limit: 12,
            date: todayDate,
          }),
          programService.getTodayActivitySummary(db, {
            date: todayDate,
          }),
          socialService.getFollowCounts({
            userId: user.id,
          }),
        ]);

      setCirclePreview({
        ...nextCirclePreview,
        currentUser: nextCirclePreview.currentUser
          ? {
              ...nextCirclePreview.currentUser,
              activityState: todayActivitySummary.activityState,
              activityDetail: todayActivitySummary.detail,
              workoutType: todayActivitySummary.workoutType,
              workoutLabel: todayActivitySummary.workoutLabel,
            }
          : null,
      });
      setFollowCounts(nextFollowCounts);
    } catch (error) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setFollowCounts({
        followers: 0,
        following: 0,
      });
      setCirclePreviewError(
        error instanceof Error ? error.message : "Could not load your stories."
      );
    } finally {
      setIsLoadingFollowCounts(false);
    }
  }, [db, todayDate, user]);

  useFocusEffect(
    useCallback(() => {
      loadCirclePreview();
    }, [loadCirclePreview])
  );

  const handleOpenUserList = () => {
    navigation.navigate("SocialUserListPage");
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

  const renderHeaderRelationshipStat = (relationshipType, label, value) => (
    <Pressable
      key={relationshipType}
      onPress={() => handleOpenRelationshipModal(relationshipType)}
      disabled={!user?.id}
      hitSlop={8}
      style={({ pressed }) => [
        styles.headerRelationshipStat,
        pressed && user?.id ? styles.headerRelationshipStatPressed : null,
      ]}
    >
      <ThemedText style={styles.headerRelationshipValue} setColor={titleColor}>
        {isLoadingFollowCounts ? "..." : value}
      </ThemedText>
      <ThemedText style={styles.headerRelationshipLabel} setColor={quietText}>
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader
        leftWidth={132}
        rightWidth={132}
        right={
          <View style={styles.headerRelationshipStats}>
            {renderHeaderRelationshipStat(
              "followers",
              "followers",
              followCounts.followers
            )}
            {renderHeaderRelationshipStat(
              "following",
              "following",
              followCounts.following
            )}
          </View>
        }
      >
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
            Social
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.storiesSection}>
          <View style={styles.sectionHeaderRow}>
            <ThemedTitle type="h3" style={styles.sectionTitle}>
              Stories
            </ThemedTitle>
          </View>

          <View style={styles.storiesRail}>
            <FriendsActivity
              currentUser={circlePreview.currentUser}
              people={circlePreview.people}
              errorMessage={circlePreviewError}
              isLoading={isLoadingFollowCounts}
              onSeeAll={handleOpenUserList}
              onOpenProfile={() => navigation.navigate("ProfilePage")}
            />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel="Search for friends"
          onPress={handleOpenUserList}
          style={[styles.findFriendsCard, { borderColor: cardBorder }]}
        >
          <ImageBackground
            source={searchPeopleImage}
            resizeMode="cover"
            style={styles.findFriendsImage}
            imageStyle={styles.findFriendsImageRadius}
          >
            <View style={styles.findFriendsScrim} />

            <View style={styles.findFriendsActionRow}>
              <View style={styles.findFriendsActionIcon}>
                <TailArrowUpRight
                  width={15}
                  height={15}
                  stroke="#ffffff"
                  color="#ffffff"
                />
              </View>
            </View>

            <View style={styles.findFriendsCopy}>
              <ThemedText style={styles.findFriendsEyebrow} setColor="#ffffff">
                Discover
              </ThemedText>
              <ThemedTitle
                type="h3"
                style={styles.findFriendsTitle}
                numberOfLines={2}
              >
                Find Friends
              </ThemedTitle>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </ScrollView>

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
                <UserAvatar
                  uri={relationshipProfile.avatarUrl}
                  size={44}
                  iconSize={22}
                  iconColor={theme.primary ?? titleColor}
                  backgroundColor={
                    theme.fields ?? theme.uiBackground ?? theme.background
                  }
                  borderColor={cardBorder}
                  borderWidth={1}
                />
                <View style={styles.relationshipCopy}>
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

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default SearchPage;
