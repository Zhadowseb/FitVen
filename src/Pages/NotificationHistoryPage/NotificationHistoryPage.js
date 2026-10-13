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
import { cheerService, notificationService } from "../../Services";
import { showToast } from "../../Resources/Components/Toast/Toast";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { formatTimeAgo } from "../../Utils/dateUtils";
import {
  describeNotification,
  notificationHintKey,
  notificationTarget,
} from "@utils/notificationHistory";
import { WORKOUT_STARTED_EVENT_TYPE, isCheerableRow } from "@utils/cheers";
import Bell from "../../Resources/Icons/UI-icons/Bell";
import Cogwheel from "../../Resources/Icons/UI-icons/Cogwheel";
import CheerReplies from "./CheerReplies";
import {
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";

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
  // The cheers this person has sent, by workout event id, and the one being
  // sent now.
  const [sentCheers, setSentCheers] = useState({});
  const [sendingCheerFor, setSendingCheerFor] = useState(null);
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

  const loadSentCheers = useCallback(
    (history) => {
      cheerService
        .getSentCheers({
          user,
          eventIds: history
            .filter((item) => item.eventType === WORKOUT_STARTED_EVENT_TYPE)
            .map((item) => item.eventId),
        })
        .then((sent) => setSentCheers((current) => ({ ...current, ...sent })))
        .catch((error) => console.warn("Could not read the cheers sent:", error));
    },
    [user]
  );

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
        loadSentCheers(history);

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
    [loadSentCheers, markReadRequestId, t, user]
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
  // and nothing happened when you did. Where each kind goes is in
  // Utils/notificationHistory.js.
  const openNotification = (item) => {
    const { route: routeName, params } = notificationTarget(item);

    navigation.navigate(routeName, params);
  };

  // The same insert as the buttons on the notification. A second cheer on
  // the same workout is ignored by the database, and the row then shows what
  // was sent the first time.
  const sendCheerFromRow = async (item, { preset, message }) => {
    if (sendingCheerFor) {
      return;
    }

    setSendingCheerFor(item.eventId);

    try {
      const result = await cheerService.sendCheer({
        eventId: item.eventId,
        preset,
        message,
      });

      if (result === cheerService.CHEER_RESULT.SENT) {
        setSentCheers((current) => ({
          ...current,
          [item.eventId]: { preset, message },
        }));
        showToast(t("cheers.sent"));
      } else if (result === cheerService.CHEER_RESULT.ALREADY_SENT) {
        loadSentCheers([item]);
      } else {
        showToast(t("cheers.sendFailed"), { tone: "info" });
      }
    } finally {
      setSendingCheerFor(null);
    }
  };

  const renderNotification = ({ item }) => {
    const { title, body } = describeNotification(item, t);
    const sentCheer =
      item.eventType === WORKOUT_STARTED_EVENT_TYPE
        ? sentCheers[item.eventId] ?? null
        : null;

    const card = (
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t("notifications.itemLabel", { title, body })}
        accessibilityHint={t(notificationHintKey(item))}
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

    if (!sentCheer && !isCheerableRow(item)) {
      return card;
    }

    // Beside the card's touchable, not inside it: a reply must not also open
    // the row.
    return (
      <View>
        {card}
        <CheerReplies
          theme={theme}
          sent={sentCheer}
          sending={sendingCheerFor === item.eventId}
          onSend={(cheer) => sendCheerFromRow(item, cheer)}
        />
      </View>
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
          keyboardShouldPersistTaps="handled"
          refreshing={refreshing}
          onRefresh={refreshNotifications}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}
