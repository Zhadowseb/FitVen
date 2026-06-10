import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import styles from "./NotificationHistoryPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { notificationService } from "../../Services";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Bell from "../../Resources/Icons/UI-icons/Bell";
import Cogwheel from "../../Resources/Icons/UI-icons/Cogwheel";
import {
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

function formatTimeAgo(value) {
  const timestamp = value ? new Date(value).getTime() : NaN;

  if (!Number.isFinite(timestamp)) {
    return "Just now";
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (elapsedSeconds < 60) {
    return "Just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default function NotificationHistoryPage() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const avatarSurface = theme.fields ?? theme.uiBackground ?? cardSurface;

  const loadNotifications = useCallback(
    async ({ showLoader = false } = {}) => {
      if (!user?.id) {
        setNotifications([]);
        setLoading(false);
        setRefreshing(false);
        setErrorMessage("Sign in to view notifications.");
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");
        const history = await notificationService.getNotificationHistory({
          user,
        });

        setNotifications(history);

        notificationService
          .markAllNotificationHistoryRead({ user })
          .catch((error) =>
            console.warn("Could not mark notifications as read:", error)
          );
      } catch (error) {
        setNotifications([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load notifications."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      loadNotifications({ showLoader: true });
    }, [loadNotifications])
  );

  const refreshNotifications = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const renderNotification = ({ item }) => (
    <View
      style={[
        styles.notificationCard,
        {
          backgroundColor: cardSurface,
          borderColor: item.readAt ? cardBorder : secondaryColor,
        },
      ]}
    >
      <View style={styles.avatarSlot}>
        <UserAvatar
          uri={item.actor?.avatarUrl}
          size={46}
          backgroundColor={avatarSurface}
          borderColor={cardBorder}
          borderWidth={1}
        />
        <View
          style={[
            styles.avatarBadge,
            {
              backgroundColor: primaryColor,
              borderColor: cardSurface,
            },
          ]}
        >
          <Bell width={11} height={11} color={theme.textInverted ?? "#1b1918"} />
        </View>
      </View>

      <View style={styles.notificationCopy}>
        <View style={styles.notificationTitleRow}>
          <ThemedText
            numberOfLines={1}
            style={styles.notificationTitle}
            setColor={titleColor}
          >
            {item.title}
          </ThemedText>
          {!item.readAt ? (
            <View
              accessibilityLabel="Unread"
              style={[
                styles.unreadDot,
                { backgroundColor: secondaryColor },
              ]}
            />
          ) : null}
        </View>

        <ThemedText style={styles.notificationBody} setColor={quietText}>
          {item.body}
        </ThemedText>
        <ThemedText style={styles.notificationTime} setColor={quietText}>
          {formatTimeAgo(item.createdAt)}
        </ThemedText>
      </View>
    </View>
  );

  const emptyState = (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIcon,
          {
            backgroundColor: cardSurface,
            borderColor: cardBorder,
          },
        ]}
      >
        <Bell width={29} height={29} color={quietText} thickness={1.7} />
      </View>
      <ThemedTitle type="h3" style={styles.emptyTitle}>
        You&apos;re all caught up
      </ThemedTitle>
      <ThemedText style={styles.emptyBody} setColor={quietText}>
        Workout starts and future activity updates will appear here.
      </ThemedText>
    </View>
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader
        right={
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityLabel="Open notification settings"
            accessibilityRole="button"
            onPress={() => navigation.navigate("NotificationSettingsPage")}
            style={[
              styles.settingsButton,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <Cogwheel width={21} height={21} color={titleColor} />
          </TouchableOpacity>
        }
        rightWidth={52}
      >
        <View style={styles.headerTitleGroup}>
          <ThemedText style={styles.headerEyebrow} setColor={quietText}>
            Activity
          </ThemedText>
          <ThemedTitle type="h3" style={styles.headerTitle} numberOfLines={1}>
            Notifications
          </ThemedTitle>
        </View>
      </ThemedHeader>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={primaryColor} />
          <ThemedText style={styles.loadingText} setColor={quietText}>
            Loading notifications...
          </ThemedText>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorState}>
          <ThemedTitle type="h3" style={styles.errorTitle}>
            Notifications unavailable
          </ThemedTitle>
          <ThemedText style={styles.errorBody} setColor={quietText}>
            {errorMessage}
          </ThemedText>
          <TouchableOpacity
            activeOpacity={0.78}
            accessibilityRole="button"
            onPress={() => loadNotifications({ showLoader: true })}
            style={[styles.retryButton, { backgroundColor: primaryColor }]}
          >
            <ThemedText
              style={styles.retryButtonText}
              setColor={theme.textInverted ?? "#1b1918"}
            >
              Try again
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          ListEmptyComponent={emptyState}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
          ]}
          refreshing={refreshing}
          onRefresh={refreshNotifications}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}
