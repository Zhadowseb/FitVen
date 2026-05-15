import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from "expo-sqlite";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import styles from './HomePageStyle';
import { Colors } from '../../Resources/GlobalStyling/colors';
import FeedbackModal from './Components/FeedbackModal/FeedbackModal';
import FriendsActivity from './Components/FriendsActivity/FriendsActivity';
import TodayProgramsShortcut from './Components/TodayProgramsShortcut/TodayProgramsShortcut';
import Calender from "../../Resources/Icons/UI-icons/Calender";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
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
  const innerSurface = theme.uiBackground ?? cardSurface;
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
              borderColor: cardBorder,
            },
          ]}
        >
          <FeedbackGlow
            style={styles.feedbackPortalGlowPrimary}
            color={primaryColor}
            gradientId="homeFeedbackPrimaryGlow"
            centerOpacity={0.28}
            middleOpacity={0.15}
          />
          <FeedbackGlow
            style={styles.feedbackPortalGlowSecondary}
            color={secondaryColor}
            gradientId="homeFeedbackSecondaryGlow"
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
              <ThemedText style={styles.feedbackPortalEyebrow} setColor={quietText}>
                FEEDBACK
              </ThemedText>
            </View>

            <View
              style={[
                styles.feedbackPortalActionIcon,
                {
                  backgroundColor: innerSurface,
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
                    backgroundColor: innerSurface,
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
