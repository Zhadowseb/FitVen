import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SQLiteProvider } from 'expo-sqlite';
import { initializeDatabase } from './src/Database/db';
import { locationSchemaSql } from './src/Database/schema/location';
import { View, useColorScheme } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as TaskManager from 'expo-task-manager';
import * as ScreenOrientation from "expo-screen-orientation";


import LoginPage from './src/Pages/LoginPage/LoginPage';
import RegisterPage from './src/Pages/RegisterPage/RegisterPage';
import HomePage from './src/Pages/HomePage/HomePage';
import ProfilePage from './src/Pages/ProfilePage/ProfilePage';
import ProgramPage from './src/Pages/ProgramPage/ProgramPage';
import ProgramOverviewPage from './src/Pages/ProgramOverviewPage/ProgramOverviewPage';
import MicrocyclePage from './src/Pages/MicrocyclePage/MicrocyclePage';
import SearchPage from "./src/Pages/SearchPage/SearchPage";
import SocialUserListPage from "./src/Pages/SocialUserListPage/SocialUserListPage";
import WeekPage from './src/Pages/WeekPage/WeekPage';
import WorkoutPage from './src/Pages/WorkoutPage/WorkoutPage';
import SetPage from './src/Pages/SetPage/SetPage';
import ExerciseCatalogPage from "./src/Pages/ExerciseCatalogPage/ExerciseCatalogPage";
import ExerciseLibraryPage from "./src/Pages/ExerciseLibraryPage/ExerciseLibraryPage";
import PersonalRecordsPage from "./src/Pages/PersonalRecordsPage/PersonalRecordsPage";
import WorkoutCalendarPage from "./src/Pages/WorkoutCalendarPage/WorkoutCalendarPage";
import SicknessPage from "./src/Pages/SicknessPage/SicknessPage";
import NotificationHistoryPage from "./src/Pages/NotificationHistoryPage/NotificationHistoryPage";
import NotificationSettingsPage from "./src/Pages/NotificationSettingsPage/NotificationSettingsPage";
import SocialPostEditPage from "./src/Pages/SocialPostEditPage/SocialPostEditPage";
import SocialPostSettingsPage from "./src/Pages/SocialPostSettingsPage/SocialPostSettingsPage";
import ExerciseSocialPostSettingsPage from "./src/Pages/ExerciseSocialPostSettingsPage/ExerciseSocialPostSettingsPage";
import OneRepMaxCalculatorPage from "./src/Pages/OneRepMaxCalculatorPage/OneRepMaxCalculatorPage";
import WorkoutTypesSettingsPage from "./src/Pages/WorkoutTypesSettingsPage/WorkoutTypesSettingsPage";
import RunHeartRateChartPage from "./src/Pages/WorkoutPage/WorkoutTypes/Run/RunHeartRateChartPage";

import { Colors } from './src/Resources/GlobalStyling/colors';
import {
  ThemedBottomNavigation,
  ThemedText,
  ThemedView,
} from './src/Resources/ThemedComponents';
import {
  getActiveDatabaseName,
  getDatabaseNameForUserId,
  migrateLegacySharedDatabaseToUserDatabase,
  setActiveDatabaseName,
} from "./src/Database/localDatabase";
import { locationService, notificationService } from "./src/Services";
import { AuthProvider, useAuth } from './src/Contexts/AuthContext';
import ExerciseLibrarySync from "./src/Sync/ExerciseLibrarySync";
import PushNotificationRegistrationSync from "./src/Sync/PushNotificationRegistrationSync";
import SetSync from "./src/Sync/SetSync";
import WorkoutTypeCatalogSync from "./src/Sync/WorkoutTypeCatalogSync";
import WorkoutTypeInstanceSync from "./src/Sync/WorkoutTypeInstanceSync";

import * as SQLite from 'expo-sqlite';

// The location task fires roughly every second while a run is tracked, so it
// keeps one cached connection per database instead of opening, migrating, and
// closing a fresh connection for every GPS batch. The old approach raced the
// foreground app for the write lock and made whole batches of points disappear
// whenever SQLite reported "database is locked".
const locationTaskDatabaseCache = {
  name: null,
  openPromise: null,
};

async function openLocationTaskDatabase(databaseName) {
  const db = await SQLite.openDatabaseAsync(databaseName, {
    useNewConnection: true,
  });

  // busy_timeout is a per-connection setting: without it a concurrent write
  // from the app connection makes inserts fail instantly instead of waiting.
  // The location tables are created idempotently so the task never has to run
  // the full migration suite inside a headless background invocation.
  await db.execAsync(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    ${locationSchemaSql}
  `);

  return db;
}

function getLocationTaskDatabase(databaseName) {
  if (
    locationTaskDatabaseCache.name !== databaseName ||
    !locationTaskDatabaseCache.openPromise
  ) {
    const staleOpenPromise = locationTaskDatabaseCache.openPromise;

    locationTaskDatabaseCache.name = databaseName;
    locationTaskDatabaseCache.openPromise = (async () => {
      if (staleOpenPromise) {
        try {
          const staleDb = await staleOpenPromise;
          await staleDb.closeAsync();
        } catch {
          // The stale connection is unusable either way.
        }
      }

      return openLocationTaskDatabase(databaseName);
    })();
  }

  return locationTaskDatabaseCache.openPromise;
}

function resetLocationTaskDatabaseCache() {
  locationTaskDatabaseCache.name = null;
  locationTaskDatabaseCache.openPromise = null;
}

function isUnusableDatabaseConnectionError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();

  return (
    message.includes("closed resource") ||
    message.includes("database is closed") ||
    message.includes("access to closed") ||
    message.includes("connection") ||
    message.includes("nullpointer")
  );
}

TaskManager.defineTask(locationService.RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (!data?.locations?.length) return;

  const persistLocations = async () => {
    const databaseName = await getActiveDatabaseName();
    const db = await getLocationTaskDatabase(databaseName);
    await locationService.recordTrackedLocations(db, data.locations);
  };

  try {
    await persistLocations();
  } catch (taskError) {
    if (!isUnusableDatabaseConnectionError(taskError)) {
      console.error("Failed to persist tracked run locations:", taskError);
      return;
    }

    // The OS can recycle the background process and leave a dead cached
    // handle behind. Reopen once and retry so a single stale connection
    // cannot break tracking for the rest of the run.
    resetLocationTaskDatabaseCache();

    try {
      await persistLocations();
    } catch (retryError) {
      console.error("Failed to persist tracked run locations:", retryError);
    }
  }
});


const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();
const NOTIFICATION_HISTORY_ROUTE = "NotificationHistoryPage";
const RUN_HEART_RATE_CHART_ROUTE = "RunHeartRateChartPage";

function getNotificationResponseKey(response) {
  const notification = response?.notification;
  const request = notification?.request;
  const contentData = request?.content?.data;
  const dataId =
    contentData?.notificationId ??
    contentData?.notification_id ??
    contentData?.eventId ??
    contentData?.event_id ??
    contentData?.id;

  return [
    request?.identifier,
    response?.actionIdentifier,
    dataId,
    notification?.date,
  ]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .join(":");
}

function RootNavigator() {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const { isAuthenticated, isAuthLoading } = useAuth();
  const handledNotificationResponsesRef = useRef(new Set());
  const notificationResponseRetryRef = useRef(null);
  const [currentRouteName, setCurrentRouteName] = useState(null);

  const navTheme =
    colorScheme === "dark"
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: theme.background,
            card: theme.background,
            text: theme.text,
            border: theme.border,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: theme.background,
            card: theme.background,
            text: theme.text,
            border: theme.border,
          },
        };

  const syncCurrentRoute = () => {
    const nextRouteName = navigationRef.getCurrentRoute()?.name ?? null;
    setCurrentRouteName(nextRouteName);
  };

  const openNotificationHistoryFromResponse = useCallback((response) => {
    if (!response) {
      return;
    }

    const responseKey = getNotificationResponseKey(response);

    if (
      responseKey &&
      handledNotificationResponsesRef.current.has(responseKey)
    ) {
      return;
    }

    const navigateToHistory = () => {
      if (!navigationRef.isReady()) {
        return false;
      }

      navigationRef.navigate(NOTIFICATION_HISTORY_ROUTE, {
        markNotificationsRead: false,
        openedFromNotification: true,
        notificationHistoryOpenId: Date.now(),
      });
      notificationService.clearLastNotificationResponse();
      return true;
    };

    if (responseKey) {
      handledNotificationResponsesRef.current.add(responseKey);
    }

    if (navigateToHistory()) {
      return;
    }

    clearTimeout(notificationResponseRetryRef.current);
    notificationResponseRetryRef.current = setTimeout(navigateToHistory, 250);
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return undefined;
    }

    const lastResponse = notificationService.getLastNotificationResponse();

    if (lastResponse) {
      openNotificationHistoryFromResponse(lastResponse);
    }

    const subscription =
      notificationService.addNotificationResponseReceivedListener(
        openNotificationHistoryFromResponse
      );

    return () => {
      subscription?.remove?.();
      clearTimeout(notificationResponseRetryRef.current);
    };
  }, [
    isAuthenticated,
    isAuthLoading,
    openNotificationHistoryFromResponse,
  ]);

  useEffect(() => {
    const orientationLock =
      currentRouteName === RUN_HEART_RATE_CHART_ROUTE
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP;

    ScreenOrientation.lockAsync(orientationLock).catch((error) => {
      console.warn("Unable to lock screen orientation:", error);
    });
  }, [currentRouteName]);

  if (isAuthLoading) {
    return (
      <ThemedView style={{ alignItems: "center", justifyContent: "center" }}>
        <ThemedText setColor={theme.quietText ?? theme.iconColor}>
          Restoring session...
        </ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1 }}>
        <NavigationContainer
          ref={navigationRef}
          theme={navTheme}
          onReady={syncCurrentRoute}
          onStateChange={syncCurrentRoute}
        >
          <Stack.Navigator
                key={isAuthenticated ? "app" : "auth"}
                initialRouteName={isAuthenticated ? 'HomePage' : 'LoginPage'}
                screenOptions={{ 
                  headerShown: true,
                  headerStyle: {
                    backgroundColor: theme.background
                  },
                  contentStyle: {
                    backgroundColor: theme.background
                  }
                }}>
            {isAuthenticated ? (
              <>
                <Stack.Screen name="HomePage" component={HomePage} options={{ headerShown: false }} />
                <Stack.Screen name="SearchPage" component={SearchPage} options={{ headerShown: false }} />
                <Stack.Screen name="SocialUserListPage" component={SocialUserListPage} options={{ headerShown: false }} />
                <Stack.Screen name="ProfilePage" component={ProfilePage} options={{ headerShown: false }} />
                <Stack.Screen name="ProgramPage" component={ProgramPage} options={{headerShown: false}} />
                <Stack.Screen name="ProgramOverviewPage" component={ProgramOverviewPage} options={{headerShown: false}} />
                <Stack.Screen name="MicrocyclePage" component={MicrocyclePage} options={{headerShown: false}} />
                <Stack.Screen name="WeekPage" component={WeekPage} options={{headerShown: false}} />
                <Stack.Screen name="WorkoutPage" component={WorkoutPage} options={{headerShown: false}} />
                <Stack.Screen name="SetPage" component={SetPage} />
                <Stack.Screen name="ExerciseCatalogPage" component={ExerciseCatalogPage} options={{ headerShown: false }} />
                <Stack.Screen name="ExerciseLibraryPage" component={ExerciseLibraryPage} options={{ headerShown: false }} />
                <Stack.Screen name="PersonalRecordsPage" component={PersonalRecordsPage} options={{ headerShown: false }} />
                <Stack.Screen name="WorkoutCalendarPage" component={WorkoutCalendarPage} options={{ headerShown: false }} />
                <Stack.Screen name="NotificationHistoryPage" component={NotificationHistoryPage} options={{ headerShown: false }} />
                <Stack.Screen name="NotificationSettingsPage" component={NotificationSettingsPage} options={{ headerShown: false }} />
                <Stack.Screen name="SocialPostEditPage" component={SocialPostEditPage} options={{ headerShown: false }} />
                <Stack.Screen name="SocialPostSettingsPage" component={SocialPostSettingsPage} options={{ headerShown: false }} />
                <Stack.Screen name="ExerciseSocialPostSettingsPage" component={ExerciseSocialPostSettingsPage} options={{ headerShown: false }} />
                <Stack.Screen name="OneRepMaxCalculatorPage" component={OneRepMaxCalculatorPage} options={{ headerShown: false }} />
                <Stack.Screen name="WorkoutTypesSettingsPage" component={WorkoutTypesSettingsPage} options={{ headerShown: false }} />
                <Stack.Screen
                  name={RUN_HEART_RATE_CHART_ROUTE}
                  component={RunHeartRateChartPage}
                  options={{
                    animation: "fade",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="SicknessPage"
                  component={SicknessPage}
                  options={{ headerShown: false }}
                />
              </>
            ) : (
              <>
                <Stack.Screen name="LoginPage" component={LoginPage} options={{ headerShown: false }} />
                <Stack.Screen name="RegisterPage" component={RegisterPage} options={{ headerShown: false }} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </View>

      {isAuthenticated && currentRouteName !== RUN_HEART_RATE_CHART_ROUTE ? (
        <ThemedBottomNavigation
          currentRouteName={currentRouteName}
          navigationRef={navigationRef}
        />
      ) : null}
    </View>
  );
}

function UserScopedDatabaseApp() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user, isAuthLoading } = useAuth();
  const userId = user?.id ?? null;
  const databaseName = getDatabaseNameForUserId(userId);

  const handleInitializeDatabase = useCallback(async (db) => {
    await setActiveDatabaseName(databaseName);
    await initializeDatabase(db);

    if (userId) {
      await migrateLegacySharedDatabaseToUserDatabase({
        userId,
        targetDatabaseName: databaseName,
        targetDb: db,
      });
    }
  }, [databaseName, userId]);

  if (isAuthLoading) {
    return (
      <ThemedView style={{ alignItems: "center", justifyContent: "center" }}>
        <ThemedText setColor={theme.quietText ?? theme.iconColor}>
          Restoring session...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <SQLiteProvider
      key={databaseName}
      databaseName={databaseName}
      onInit={handleInitializeDatabase}>
      <WorkoutTypeCatalogSync />
      <ExerciseLibrarySync />
      <SetSync />
      <WorkoutTypeInstanceSync />
      <PushNotificationRegistrationSync />
      <RootNavigator />
    </SQLiteProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UserScopedDatabaseApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
