import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./GreetingHeaderStyle";
import { ThemedText, UserAvatar } from "@resources/ThemedComponents";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Bell from "@resources/Icons/UI-icons/Bell";

// Time of day, so the largest type on the screen says something that changes.
function getGreeting(hour, t) {
  if (hour < 10) {
    return t("home.greeting.morning");
  }

  if (hour < 17) {
    return t("home.greeting.afternoon");
  }

  if (hour < 22) {
    return t("home.greeting.evening");
  }

  return t("home.greeting.night");
}

function getFirstName(displayName) {
  const trimmedName = String(displayName ?? "").trim();

  if (!trimmedName) {
    return null;
  }

  return trimmedName.split(/\s+/)[0];
}

/**
 * The greeting, the bell and the way into your own profile.
 *
 * The date line is gone: a phone already shows the date, and the row it took
 * was the one thing on the screen nobody needed. The greeting is two lines
 * instead, so the name can be the size it deserves.
 *
 * The avatar is how you reach your profile now that it is not a tab.
 */
export default function GreetingHeader({
  unreadNotificationCount = 0,
  onOpenNotifications,
  onOpenProfile,
  displayName = null,
  avatarUrl = null,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const firstName = getFirstName(displayName);
  const greeting = getGreeting(new Date().getHours(), t);
  const badgeCount =
    unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <ThemedText style={styles.greeting} setColor={theme.quietText} numberOfLines={1}>
            {`${greeting},`}
          </ThemedText>

          {firstName ? (
            <ThemedText style={styles.name} setColor={theme.title} numberOfLines={2}>
              {firstName}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("home.greeting.openNotifications")}
            activeOpacity={0.82}
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
                  { backgroundColor: theme.primary, borderColor: theme.uiBackground },
                ]}
              >
                <ThemedText style={styles.badgeText} setColor={theme.textInverted}>
                  {badgeCount}
                </ThemedText>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("home.greeting.openProfile")}
            activeOpacity={0.82}
            onPress={onOpenProfile}
          >
            <UserAvatar
              uri={avatarUrl}
              size={44}
              iconSize={22}
              borderColor={withAlpha(theme.title, 0.12)}
              borderWidth={1.5}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
