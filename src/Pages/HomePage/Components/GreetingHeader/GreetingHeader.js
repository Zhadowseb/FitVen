import { Text, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./GreetingHeaderStyle";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Bell from "../../../../Resources/Icons/UI-icons/Bell";

// Builds "SATURDAY · 04.07.2026" from a Date.
function getDateEyebrow(date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${weekday} · ${day}.${month}.${year}`;
}

export default function GreetingHeader({
  today = new Date(),
  unreadNotificationCount = 0,
  onOpenNotifications,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const dateEyebrow = getDateEyebrow(today);
  const badgeCount =
    unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount);

  return (
    <View style={styles.container}>
      <View style={styles.textColumn}>
        <Text
          style={[styles.eyebrow, { color: theme.quietText }]}
          numberOfLines={1}
        >
          {dateEyebrow}
        </Text>
        <Text style={[styles.title, { color: theme.title }]} numberOfLines={1}>
          Welcome back!
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.82}
        accessibilityLabel="Open notifications"
        accessibilityRole="button"
        onPress={onOpenNotifications}
        style={[
          styles.bellButton,
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
            <Text style={[styles.badgeText, { color: theme.textInverted }]}>
              {badgeCount}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}
