import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./GreetingHeaderStyle";
import { ThemedText } from "../../../../Resources/ThemedComponents";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import Bell from "../../../../Resources/Icons/UI-icons/Bell";
import Layers from "../../../../Resources/Icons/UI-icons/Layers";

// Builds "SATURDAY · 04.07.2026" from a Date.
function getDateEyebrow(date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${weekday} · ${day}.${month}.${year}`;
}

// Time of day, so the largest type on the screen says something that changes.
function getGreeting(hour) {
  if (hour < 10) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  if (hour < 22) {
    return "Good evening";
  }

  return "Good night";
}

function getFirstName(displayName) {
  const trimmedName = String(displayName ?? "").trim();

  if (!trimmedName) {
    return null;
  }

  return trimmedName.split(/\s+/)[0];
}

export default function GreetingHeader({
  today = new Date(),
  unreadNotificationCount = 0,
  onOpenNotifications,
  activeProgramName = null,
  onOpenActiveProgram,
  displayName = null,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const dateEyebrow = getDateEyebrow(today);
  const firstName = getFirstName(displayName);
  const greeting = getGreeting(new Date().getHours());
  const greetingTitle = firstName ? `${greeting}, ${firstName}` : greeting;
  const badgeCount =
    unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount);
  const hasActiveProgram = Boolean(activeProgramName);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <ThemedText
          style={[styles.eyebrow, { color: theme.quietText }]}
          numberOfLines={1}
        >
          {dateEyebrow}
        </ThemedText>

        <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityLabel={
            hasActiveProgram
              ? `Open active program ${activeProgramName}`
              : "No active program. Open workout calendar"
          }
          accessibilityRole="button"
          onPress={onOpenActiveProgram}
          style={[
            styles.iconButton,
            hasActiveProgram
              ? {
                  backgroundColor: withAlpha(theme.primary, 0.12),
                  borderColor: withAlpha(theme.primary, 0.45),
                }
              : {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.cardBorder,
                },
          ]}
        >
          <Layers
            width={20}
            height={20}
            color={hasActiveProgram ? theme.primary : theme.quietText}
            thickness={1.7}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityLabel="Open notifications"
          accessibilityRole="button"
          onPress={onOpenNotifications}
          style={[
            styles.iconButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Bell width={21} height={21} color={theme.title} thickness={1.7} />

          {unreadNotificationCount > 0 ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.primary,
                  borderColor: theme.background,
                },
              ]}
            >
              <ThemedText style={[styles.badgeText, { color: theme.textInverted }]}>
                {badgeCount}
              </ThemedText>
            </View>
          ) : null}
        </TouchableOpacity>
        </View>
      </View>

      <ThemedText style={[styles.title, { color: theme.title }]} numberOfLines={1}>
        {greetingTitle}
      </ThemedText>
    </View>
  );
}
