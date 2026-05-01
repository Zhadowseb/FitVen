import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from "expo-sqlite";

import styles from './HomePageStyle';
import { Colors } from '../../Resources/GlobalStyling/colors';
import FeedbackModal from './Components/FeedbackModal/FeedbackModal';
import FriendsActivity from './Components/FriendsActivity/FriendsActivity';
import TodayProgramsShortcut from './Components/TodayProgramsShortcut/TodayProgramsShortcut';
import Calender from "../../Resources/Icons/UI-icons/Calender";
import {
  programService,
  socialService,
} from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";

import { 
  ThemedView,  
  ThemedText,
  ThemedTitle,
} from "../../Resources/ThemedComponents";
import { useAuth } from '../../Contexts/AuthContext';

export default function App() {
  const db = useSQLiteContext();
  const todayDate = getTodaysDate();
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [isLoadingCirclePreview, setIsLoadingCirclePreview] = useState(false);
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;

  const loadCirclePreview = useCallback(async () => {
    if (!user?.id) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setCirclePreviewError("");
      setIsLoadingCirclePreview(false);
      return;
    }

    setIsLoadingCirclePreview(true);
    setCirclePreviewError("");

    try {
      try {
        await programService.syncWorkoutTypeInstancesWithCloud(db);
      } catch (syncError) {
        console.warn(
          "Could not refresh workout activity before loading home preview:",
          syncError
        );
      }

      const [nextCirclePreview, todayActivitySummary] = await Promise.all([
        socialService.getCirclePreview({
          user,
          limit: 12,
          date: todayDate,
        }),
        programService.getTodayActivitySummary(db, {
          date: todayDate,
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
    } catch (error) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setCirclePreviewError(
        error instanceof Error ? error.message : "Could not load your circle."
      );
    } finally {
      setIsLoadingCirclePreview(false);
    }
  }, [db, todayDate, user]);

  useFocusEffect(
    useCallback(() => {
      loadCirclePreview();
    }, [loadCirclePreview])
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <TodayProgramsShortcut />

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate("WorkoutCalendarPage")}
          style={[
            styles.calendarShortcut,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View
            style={[
              styles.calendarShortcutIcon,
              { backgroundColor: theme.primaryLight ?? "rgba(247, 116, 46, 0.16)" },
            ]}
          >
            <Calender width={24} height={24} color={primaryColor} thickness={1.8} />
          </View>

          <View style={styles.calendarShortcutBody}>
            <ThemedText style={styles.calendarShortcutEyebrow} setColor={primaryColor}>
              CALENDAR
            </ThemedText>
            <ThemedTitle
              type="h3"
              style={[styles.calendarShortcutTitle, { color: titleColor }]}
            >
              Workout Calendar
            </ThemedTitle>
          </View>
        </TouchableOpacity>

        <FriendsActivity
          currentUser={circlePreview.currentUser}
          people={circlePreview.people}
          isLoading={isLoadingCirclePreview}
          errorMessage={circlePreviewError}
          onSeeAll={() => navigation.navigate("SearchPage")}
          onOpenProfile={() => navigation.navigate("ProfilePage")}
        />

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => setFeedbackModalVisible(true)}
          style={[
            styles.feedbackPortal,
            {
              backgroundColor: cardSurface,
              borderColor: primaryColor,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.feedbackPortalGlowPrimary,
              { backgroundColor: primaryColor },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.feedbackPortalGlowSecondary,
              { backgroundColor: secondaryColor },
            ]}
          />

          <View style={styles.feedbackPortalTopRow}>
            <View
              style={[
                styles.feedbackPortalSticker,
                {
                  backgroundColor:
                    theme.secondaryLight ?? "rgba(96, 218, 172, 0.16)",
                  borderColor: cardBorder,
                },
              ]}
            >
              <ThemedText
                style={styles.feedbackPortalStickerText}
                setColor={theme.secondaryDark ?? secondaryColor}
              >
                HELP US IMPROVE
              </ThemedText>
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

        </TouchableOpacity>
      </ScrollView>

      <FeedbackModal
        visible={feedbackModalVisible}
        onClose={() => setFeedbackModalVisible(false)}
        userId={user?.id ?? null}
      />

      <StatusBar style="auto" />
    </ThemedView>
  );
}
