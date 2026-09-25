import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "@localization";

import styles from "./NotificationHistoryPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { notificationService } from "../../Services";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { formatTimeAgo } from "../../Utils/dateUtils";
import Bell from "../../Resources/Icons/UI-icons/Bell";
import Cogwheel from "../../Resources/Icons/UI-icons/Cogwheel";
import {
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

const LIFT_VERIFICATION_REQUESTED = "lift_verification_requested";
// Written by the server when three people have reported one of your shared
// exercises (supabase/migrations/20260928090000_custom-exercises-can-be-shared.sql).
const CUSTOM_EXERCISE_HIDDEN = "custom_exercise_hidden";

function hiddenExerciseName(item) {
  const name = item?.data?.exercise_name;

  return item?.eventType === CUSTOM_EXERCISE_HIDDEN && typeof name === "string" && name
    ? name
    : null;
}

// What a row says. The server writes every title and body in English; the one
// kind this page has its own words for is shown in the reader's language.
function describeNotification(item, t) {
  const exerciseName = hiddenExerciseName(item);

  if (exerciseName) {
    return {
      title: t("notifications.customExerciseHidden.title"),
      body: t("notifications.customExerciseHidden.body", { name: exerciseName }),
    };
  }

  return { title: item?.title ?? "", body: item?.body ?? "" };
}

export default function NotificationHistoryPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const lastHandledReadRequestRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary;
  const secondaryColor = theme.secondary;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const avatarSurface = theme.fields ?? theme.uiBackground ?? cardSurface;
  const markReadRequestId =
    route.params?.markNotificationsRead === true
      ? route.params?.notificationHistoryOpenId ?? "bell"
      : null;

  const loadNotifications = useCallback(
    async ({ showLoader = false } = {}) => {
      if (!user?.id) {
        setNotifications([]);
        setLoading(false);
        setRefreshing(false);
        setErrorMessage(t("notifications.signInToView"));
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

        if (
          markReadRequestId &&
          lastHandledReadRequestRef.current !== markReadRequestId
        ) {
          lastHandledReadRequestRef.current = markReadRequestId;
          const readAt = new Date().toISOString();

          notificationService
            .markAllNotificationHistoryRead({ user })
            .then(() => {
              setNotifications((currentNotifications) =>
                currentNotifications.map((notification) =>
                  notification.readAt
                    ? notification
                    : { ...notification, readAt }
                )
              );
            })
            .catch((error) =>
              console.warn("Could not mark notifications as read:", error)
            );
        }
      } catch (error) {
        setNotifications([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("notifications.loadFailed")
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [markReadRequestId, t, user]
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

  // A card with an avatar and an unread dot reads as something you can open,
  // and nothing happened when you did. There is no screen for another user's
  // profile in this app, but most notifications here are someone starting a
  // workout, and that is what Social shows - so that is where a row goes. A
  // request to verify a lift goes to that centre, with the review sheet open,
  // and one of your exercises being hidden goes to that exercise.
  const openNotification = (item) => {
    const gymId = Number(item?.data?.gym_id);
    const exerciseName = hiddenExerciseName(item);

    if (item?.eventType === LIFT_VERIFICATION_REQUESTED && Number.isFinite(gymId)) {
      navigation.navigate("GymLeaderboardPage", {
        gym_id: gymId,
        open_verification: true,
        lift_id: item?.data?.lift_id ?? null,
      });
      return;
    }

    if (exerciseName) {
      navigation.navigate("MyExercisePage", { exerciseName });
      return;
    }

    navigation.navigate("SocialPage");
  };

  const hintFor = (item) => {
    if (item.eventType === LIFT_VERIFICATION_REQUESTED) {
      return t("notifications.hints.openVerification");
    }

    return hiddenExerciseName(item)
      ? t("notifications.hints.openExercise")
      : t("notifications.hints.openActivity");
  };

  const renderNotification = ({ item }) => {
    const { title, body } = describeNotification(item, t);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("notifications.itemLabel", { title, body })}
        accessibilityHint={hintFor(item)}
        onPress={() => openNotification(item)}
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
            <Bell width={11} height={11} color={theme.textInverted} />
          </View>
        </View>

        <View style={styles.notificationCopy}>
          <View style={styles.notificationTitleRow}>
            <ThemedText
              numberOfLines={1}
              style={styles.notificationTitle}
              setColor={titleColor}
            >
              {title}
            </ThemedText>
            {!item.readAt ? (
              <View
                accessibilityLabel={t("notifications.unread")}
                style={[
                  styles.unreadDot,
                  { backgroundColor: secondaryColor },
                ]}
              />
            ) : null}
          </View>

          <ThemedText style={styles.notificationBody} setColor={quietText}>
            {body}
          </ThemedText>
          <ThemedText style={styles.notificationTime} setColor={quietText}>
            {formatTimeAgo(item.createdAt)}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  const emptyState = (
    <ThemedStateBlock
      fill
      variant="empty"
      style={styles.emptyState}
      icon={
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: cardSurface, borderColor: cardBorder },
          ]}
        >
          <Bell width={29} height={29} color={quietText} thickness={1.7} />
        </View>
      }
      title={t("notifications.emptyTitle")}
      message={t("notifications.emptyBody")}
    />
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader
        right={
          <TouchableOpacity
            activeOpacity={0.76}
            accessibilityLabel={t("notifications.openSettings")}
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
          <ThemedTitle
            type="pageTitle"
            style={styles.headerTitle}
            numberOfLines={1}
          >
            {t("notifications.title")}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      {loading ? (
        <ThemedStateBlock fill variant="loading" message={t("notifications.loading")} />
      ) : errorMessage ? (
        <ThemedStateBlock
          fill
          variant="error"
          title={t("notifications.unavailable")}
          message={errorMessage}
          actionLabel={t("common.retry")}
          onAction={() => loadNotifications({ showLoader: true })}
        />
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
