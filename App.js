import { useEffect, useState } from 'react';
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
import WeekPage from './src/Pages/WeekPage/WeekPage';
import WorkoutPage from './src/Pages/WorkoutPage/WorkoutPage';
import SetPage from './src/Pages/SetPage/SetPage';
import ExerciseLibraryPage from "./src/Pages/ExerciseLibraryPage/ExerciseLibraryPage";

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
import DaySync from "./src/Sync/DaySync";
import ExerciseInstanceSync from "./src/Sync/ExerciseInstanceSync";
import ExerciseLibrarySync from "./src/Sync/ExerciseLibrarySync";
import MesocycleSync from "./src/Sync/MesocycleSync";
import MicrocycleSync from "./src/Sync/MicrocycleSync";
import ProgramSync from "./src/Sync/ProgramSync";
import SetSync from "./src/Sync/SetSync";
import WorkoutTypeInstanceSync from "./src/Sync/WorkoutTypeInstanceSync";

import * as SQLite from 'expo-sqlite';

const initializedTaskDatabaseNames = new Set();

TaskManager.defineTask(locationService.RUN_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (!data?.locations?.length) return;

  let db = null;

  try {
    const databaseName = getActiveDatabaseName();
    db = await SQLite.openDatabaseAsync(databaseName);

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
                <Stack.Screen name="ProfilePage" component={ProfilePage} options={{ headerShown: false }} />
                <Stack.Screen name="ProgramPage" component={ProgramPage} options={{headerShown: false}} />
                <Stack.Screen name="ProgramOverviewPage" component={ProgramOverviewPage} options={{headerShown: false}} />
                <Stack.Screen name="MicrocyclePage" component={MicrocyclePage} options={{headerShown: false}} />
                <Stack.Screen name="WeekPage" component={WeekPage} options={{headerShown: false}} />
                <Stack.Screen name="WorkoutPage" component={WorkoutPage} options={{headerShown: false}} />
                <Stack.Screen name="SetPage" component={SetPage} />
                <Stack.Screen name="ExerciseLibraryPage" component={ExerciseLibraryPage} options={{ headerShown: false }} />
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
  const databaseName = getDatabaseNameForUserId(user?.id ?? null);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    setActiveDatabaseName(databaseName);
  }, [databaseName, isAuthLoading]);

  if (isAuthLoading) {
    return (
      <ThemedView style={{ alignItems: "center", justifyContent: "center" }}>
        <ThemedText setColor={theme.quietText ?? theme.iconColor}>
          Restoring session...
        </ThemedText>
      </ThemedView>
    );
  }

  const handleInitializeDatabase = async (db) => {
    await initializeDatabase(db);

    if (user?.id) {
      await migrateLegacySharedDatabaseToUserDatabase({
        userId: user.id,
        targetDatabaseName: databaseName,
        targetDb: db,
      });
    }
  };

  return (
    <SQLiteProvider
      key={databaseName}
      databaseName={databaseName}
      onInit={handleInitializeDatabase}
      options={{ useNewConnection: false }}>
      <ProgramSync />
      <MesocycleSync />
      <MicrocycleSync />
      <DaySync />
      <WorkoutTypeInstanceSync />
      <ExerciseLibrarySync />
      <ExerciseInstanceSync />
      <SetSync />
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
