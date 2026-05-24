import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from "expo-sqlite";

import styles from './HomePageStyle';
import FriendsActivity from './Components/FriendsActivity/FriendsActivity';
import HomeImageShortcutCard from './Components/HomeImageShortcutCard/HomeImageShortcutCard';
import SicknessLogCard from './Components/SicknessLogCard/SicknessLogCard';
import TodayProgramsShortcut from './Components/TodayProgramsShortcut/TodayProgramsShortcut';
import {
  programService,
  socialService,
} from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";

import { 
  ThemedView,
} from "../../Resources/ThemedComponents";
import { useAuth } from '../../Contexts/AuthContext';

const workoutCalendarDarkImage = require("../../Resources/Images/DarkVersion/workout calender dark.png");

export default function App() {
  const db = useSQLiteContext();
  const todayDate = getTodaysDate();
  const [circlePreview, setCirclePreview] = useState({
    currentUser: null,
    people: [],
  });
  const [circlePreviewError, setCirclePreviewError] = useState("");
  const navigation = useNavigation();
  const { user } = useAuth();

  const loadCirclePreview = useCallback(async () => {
    if (!user?.id) {
      setCirclePreview({
        currentUser: null,
        people: [],
      });
      setCirclePreviewError("");
      return;
    }

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

        <FriendsActivity
          currentUser={circlePreview.currentUser}
          people={circlePreview.people}
          errorMessage={circlePreviewError}
          onSeeAll={() => navigation.navigate("SearchPage")}
          onOpenProfile={() => navigation.navigate("ProfilePage")}
        />

        <View style={styles.homeShortcutRow}>
          <SicknessLogCard />

          <HomeImageShortcutCard
            accessibilityLabel="Open workout calendar"
            imageSource={workoutCalendarDarkImage}
            onPress={() => navigation.navigate("WorkoutCalendarPage")}
            title="Workout Calendar"
          />
        </View>
      </ScrollView>

      <StatusBar style="auto" />
    </ThemedView>
  );
}
