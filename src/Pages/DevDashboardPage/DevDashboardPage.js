import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import styles from "./DevDashboardPageStyle";
import DownloadsCard from "./Components/DownloadsCard";
import FeedbackRow from "./Components/FeedbackRow";
import { useAuth } from "@contexts/AuthContext";
import { adminService } from "@services";
import {
  CRASH_FREE_FLOOR,
  DEFAULT_DEV_DASHBOARD_PERIOD,
  EMPTY_STORE_STATS,
  formatCount,
  formatPercent,
  formatRating,
} from "@utils/devDashboard";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import {
  ThemedSegmentedControl,
  ThemedText,
  ThemedView,
} from "@resources/ThemedComponents";

// This screen is not translated, and deliberately. It is reachable only by an
// account with `is_admin` set by hand in the database - one person - and every
// key put in `locales/` has to be kept in two languages by everybody who edits
// it afterwards. The rest of the app goes through `t()`; the row that opens
// this screen does too.
const PERIOD_OPTIONS = [
  { value: "7d", label: "7 dage" },
  { value: "90d", label: "90 dage" },
  { value: "all", label: "Alt" },
];

const FEEDBACK_PAGE_SIZE = 20;

function OpsBox({ value, valueColor, label, theme }) {
  return (
    <View
      style={[
        styles.opsBox,
        {
          backgroundColor: withAlpha(theme.title, 0.05),
          borderColor: withAlpha(theme.title, 0.08),
        },
      ]}
    >
      <ThemedText style={styles.opsValue} setColor={valueColor}>
        {value}
      </ThemedText>
      <ThemedText style={styles.opsLabel} setColor={theme.quietText} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

/**
 * Profile -> Dev. Downloads, whether the app is running, and the feedback
 * people have sent from inside it.
 *
 * A read screen: nothing here writes anything except marking a message read.
 * Access is the `is_admin` flag, and the flag is checked on the server by the
 * policies behind every one of these reads - the check in this component only
 * decides which of two screens to draw.
 */
export default function DevDashboardPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const navigation = useNavigation();
  const { user } = useAuth();

  const [period, setPeriod] = useState(DEFAULT_DEV_DASHBOARD_PERIOD);
  const [isAdmin, setIsAdmin] = useState(null);
  const [stats, setStats] = useState(EMPTY_STORE_STATS);
  const [ops, setOps] = useState({
    activeToday: null,
    crashFreePercent: null,
    rating: null,
  });
  const [feedback, setFeedback] = useState({ rows: [], total: 0, nextCursor: null });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(
    async (periodKey) => {
      const admin = await adminService.getIsAdmin({ user });

      setIsAdmin(admin);

      if (!admin) {
        setIsLoading(false);
        return;
      }

      try {
        const [nextStats, nextOps, nextFeedback, nextUnread] = await Promise.all([
          adminService.getStoreStats(periodKey),
          adminService.getOpsStats(periodKey),
          adminService.getFeedback({ limit: FEEDBACK_PAGE_SIZE }),
          adminService.getUnreadFeedbackCount(),
        ]);

        setStats(nextStats);
        setOps(nextOps);
        setFeedback(nextFeedback);
        setUnreadCount(nextUnread);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Kunne ikke hente tallene."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      load(period);
    }, [load, period])
  );

  const changePeriod = useCallback(
    (nextPeriod) => {
      setPeriod(nextPeriod);
      setIsLoading(true);
      load(nextPeriod);
    },
    [load]
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await load(period);
    } finally {
      setIsRefreshing(false);
    }
  }, [load, period]);

  // Marking read is the one write on the screen, and it happens against the
  // row already on it: the list is not reloaded, or the message would move
  // under the finger that just opened it.
  const openFeedback = useCallback(async (message) => {
    if (message.readAt) {
      return;
    }

    try {
      await adminService.markFeedbackRead(message.id);
    } catch {
      // Nothing is lost by it staying unread; the next pull tries again.
      return;
    }

    const readAt = new Date().toISOString();

    setFeedback((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === message.id ? { ...row, readAt } : row
      ),
    }));
    setUnreadCount((current) => Math.max(0, current - 1));
  }, []);

  // Written straight onto the row that was tapped rather than by reloading:
  // the list is sorted by date, so a reload would not move anything, but it
  // would blink the whole page for one chip.
  const setStatus = useCallback(async (message, status) => {
    if (message.status === status) {
      return;
    }

    try {
      await adminService.setFeedbackStatus(message.id, status);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Kunne ikke sætte status."
      );
      return;
    }

    const readAt = message.readAt ?? new Date().toISOString();

    setFeedback((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === message.id ? { ...row, status, readAt } : row
      ),
    }));

    if (!message.readAt) {
      setUnreadCount((current) => Math.max(0, current - 1));
    }
  }, []);

  const loadMoreFeedback = useCallback(async () => {
    if (!feedback.nextCursor) {
      return;
    }

    try {
      const next = await adminService.getFeedback({
        limit: FEEDBACK_PAGE_SIZE,
        cursor: feedback.nextCursor,
      });

      setFeedback((current) => ({
        rows: [...current.rows, ...next.rows],
        total: next.total,
        nextCursor: next.nextCursor,
      }));
    } catch {
      // The button stays; pressing it again is the retry.
    }
  }, [feedback.nextCursor]);

  const crashFree = formatPercent(ops.crashFreePercent);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Tilbage"
          activeOpacity={0.82}
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <ArrowLeft width={20} height={20} color={theme.title} />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <ThemedText style={styles.eyebrow} setColor={theme.primaryText ?? theme.primary}>
            INTERN
          </ThemedText>
          <ThemedText style={styles.title} setColor={theme.title}>
            Overblik
          </ThemedText>
        </View>
      </View>

      {isAdmin === false ? (
        <View style={styles.notAdmin}>
          <ThemedText style={styles.notAdminText} setColor={theme.quietText}>
            Denne konto er ikke admin. Sæt {"`is_admin`"} på profilen i databasen.
          </ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
          }
        >
          <ThemedSegmentedControl
            options={PERIOD_OPTIONS}
            value={period}
            onChange={changePeriod}
            style={styles.periodPicker}
          />

          {errorMessage ? (
            <ThemedText style={styles.error} setColor={theme.danger}>
              {errorMessage}
            </ThemedText>
          ) : null}

          {isLoading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <>
              <DownloadsCard stats={stats} />

              <View style={styles.opsRow}>
                <OpsBox
                  value={formatCount(ops.activeToday)}
                  valueColor={theme.title}
                  label="AKTIVE I DAG"
                  theme={theme}
                />
                <OpsBox
                  value={crashFree}
                  valueColor={
                    ops.crashFreePercent !== null && ops.crashFreePercent < CRASH_FREE_FLOOR
                      ? theme.danger
                      : theme.secondary
                  }
                  label="UDEN CRASH"
                  theme={theme}
                />
                <OpsBox
                  value={formatRating(ops.rating)}
                  valueColor={theme.planned}
                  label="BEDØMMELSE"
                  theme={theme}
                />
              </View>

              <View style={styles.feedbackHeader}>
                <ThemedText style={styles.sectionTitle} setColor={theme.quietText}>
                  FEEDBACK
                </ThemedText>

                {unreadCount > 0 ? (
                  <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
                    <ThemedText
                      style={styles.unreadBadgeText}
                      setColor={theme.textInverted}
                    >
                      {unreadCount > 99 ? "99+" : String(unreadCount)}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.spacer} />

                <ThemedText
                  style={styles.seeAll}
                  setColor={theme.primaryText ?? theme.primary}
                >
                  {feedback.total} i alt
                </ThemedText>
              </View>

              {feedback.rows.length === 0 ? (
                <ThemedText style={styles.emptyFeedback} setColor={theme.quietText}>
                  Ingen beskeder endnu.
                </ThemedText>
              ) : (
                <View style={styles.feedbackList}>
                  {feedback.rows.map((message) => (
                    <FeedbackRow
                      key={message.id}
                      feedback={message}
                      onPress={openFeedback}
                      onSetStatus={setStatus}
                    />
                  ))}
                </View>
              )}

              {feedback.nextCursor ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={loadMoreFeedback}
                  style={[
                    styles.loadMore,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <ThemedText
                    style={styles.loadMoreText}
                    setColor={theme.primaryText ?? theme.primary}
                  >
                    Hent flere
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      <StatusBar style="auto" />
    </ThemedView>
  );
}
