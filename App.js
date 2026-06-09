import { useCallback, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SQLiteProvider } from 'expo-sqlite';
import { initializeDatabase } from './src/Database/db';
import { View, useColorScheme } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as TaskManager from 'expo-task-manager';


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
import NotificationSettingsPage from "./src/Pages/NotificationSettingsPage/NotificationSettingsPage";
import SocialPostEditPage from "./src/Pages/SocialPostEditPage/SocialPostEditPage";
import SocialPostSettingsPage from "./src/Pages/SocialPostSettingsPage/SocialPostSettingsPage";
import ExerciseSocialPostSettingsPage from "./src/Pages/ExerciseSocialPostSettingsPage/ExerciseSocialPostSettingsPage";

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
import { locationService } from "./src/Services";
import { AuthProvider, useAuth } from './src/Contexts/AuthContext';
import ExerciseLibrarySync from "./src/Sync/ExerciseLibrarySync";
import PushNotificationRegistrationSync from "./src/Sync/PushNotificationRegistrationSync";
import SetSync from "./src/Sync/SetSync";
import WorkoutTypeCatalogSync from "./src/Sync/WorkoutTypeCatalogSync";
import WorkoutTypeInstanceSync from "./src/Sync/WorkoutTypeInstanceSync";

import * as SQLite from 'expo-sqlite';

const initializedTaskDatabaseNames = new Set();

TaskManager.defineTask(locationService.RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (!data?.locations?.length) return;

  let db = null;

  try {
    const databaseName = await getActiveDatabaseName();
    db = await SQLite.openDatabaseAsync(databaseName, {
      useNewConnection: true,
    });

    if (!initializedTaskDatabaseNames.has(databaseName)) {
      await initializeDatabase(db);
      initializedTaskDatabaseNames.add(databaseName);
    }

    await locationService.recordTrackedLocations(db, data.locations);
  } catch (taskError) {
    console.error("Failed to persist tracked run locations:", taskError);
  } finally {
    try {
      await db.closeAsync();
    } catch {
      // Ignore cleanup failures in the background task.
    }
  }
});


const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

function RootNavigator() {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const { isAuthenticated, isAuthLoading } = useAuth();
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

  if (isAuthLoading) {
    return (
      <ThemedView style={{ alignItems: "center", justifyContent: "center" }}>
        <ThemedText setColor={theme.quietText ?? theme.iconColor}>
          Restoring session...
        </ThemedText>
      </ThemedView>
    );
  }

  const syncCurrentRoute = () => {
    const nextRouteName = navigationRef.getCurrentRoute()?.name ?? null;
    setCurrentRouteName(nextRouteName);
  };
  
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
                <Stack.Screen name="NotificationSettingsPage" component={NotificationSettingsPage} options={{ headerShown: false }} />
                <Stack.Screen name="SocialPostEditPage" component={SocialPostEditPage} options={{ headerShown: false }} />
                <Stack.Screen name="SocialPostSettingsPage" component={SocialPostSettingsPage} options={{ headerShown: false }} />
                <Stack.Screen name="ExerciseSocialPostSettingsPage" component={ExerciseSocialPostSettingsPage} options={{ headerShown: false }} />
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

      {isAuthenticated ? (
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
