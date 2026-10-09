import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import styles from "./DevDashboardPageStyle";
import BugReportsTile from "./Components/BugReportsTile";
import CollapsibleSection, { useOpenSections } from "./Components/CollapsibleSection";
import DownloadsCard from "./Components/DownloadsCard";
import FeatureUsageTable from "./Components/FeatureUsageTable";
import FeedbackHeader from "./Components/FeedbackHeader";
import FeedbackRow from "./Components/FeedbackRow";
import KpiTile, { KpiTileRow } from "./Components/KpiTile";
import ReleaseLagCard from "./Components/ReleaseLagCard";
import SecondaryRow from "./Components/SecondaryRow";
import SectionHeader from "./Components/SectionHeader";
import StartedFromTile from "./Components/StartedFromTile";
import SupabaseUsageForm from "./Components/SupabaseUsageForm";
import UsersCard from "./Components/UsersCard";
import {
  DEFAULT_OPEN_SECTIONS,
  LOADING,
  buildBugReportsTile,
  buildComesBackTile,
  buildFeatureUsage,
  buildFeedbackTiming,
  buildPlanTile,
  buildReleaseLag,
  buildSecondarySections,
  buildStartedFromTile,
  buildStoreHealthTile,
  buildTrainersTile,
  buildUsersTable,
  formatClock,
  fromSettled,
  getReleaseContext,
  newestComputedAt,
} from "./devDashboardView";
import { useAuth } from "@contexts/AuthContext";
import { adminService } from "@services";
import { EMPTY_STORE_STATS } from "@utils/devDashboard";
import { Colors } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import {
  ThemedKeyboardProtection,
  ThemedText,
  ThemedView,
} from "@resources/ThemedComponents";

// This screen is not translated, and deliberately. It is reachable only by an
// account with `is_admin` set by hand in the database - one person - and every
// key put in `locales/` has to be kept in two languages by everybody who edits
// it afterwards. The rest of the app goes through `t()`; the row that opens
// this screen does too.

const FEEDBACK_PAGE_SIZE = 20;

// S7 always shows the last 90 days. Every other number has its own fixed
// window, which is why the page no longer has a period picker.
const DOWNLOADS_PERIOD = "90d";

// Every read the page makes, in one `Promise.allSettled`. A read that fails
// greys out what it feeds - "Kunne ikke hentes" - and nothing else.
const SOURCES = [
  ["userTotals", () => adminService.getUserTotals()],
  ["trainingKpis", () => adminService.getTrainingKpis()],
  ["startedFrom", () => adminService.getStartedFrom()],
  ["featureUsage", () => adminService.getFeatureUsage()],
  ["bugReports", () => adminService.getBugReports()],
  ["storeHealth", () => adminService.getStoreHealth()],
  ["releaseLag", () => adminService.getReleaseLag()],
  ["secondary", () => adminService.getSecondaryKpis()],
  ["storeStats", () => adminService.getStoreStats(DOWNLOADS_PERIOD)],
  ["feedback", () => adminService.getFeedback({ limit: FEEDBACK_PAGE_SIZE })],
  ["unreadCount", () => adminService.getUnreadFeedbackCount()],
];

const INITIAL_SOURCES = Object.fromEntries(SOURCES.map(([key]) => [key, LOADING]));

// A read that throws before it has a promise to return - or that is not there
// at all - is a rejection like any other, not an exception out of `load`.
function attempt(read) {
  return new Promise((resolve) => resolve(read()));
}

/**
 * Profile -> Dev. The overview: who uses the app, whether it works, whether it
 * is used, whether development is moving the right way, which features are
 * used, the feedback inbox, and the secondary numbers that only matter once
 * they move.
 *
 * A read screen: nothing here writes anything except marking a message read,
 * deciding about it, and typing in the Supabase reading (S10). Access is the
 * `is_admin` flag, checked on the server by the policies and RPCs behind every
 * one of these reads - the check in this component only decides which of two
 * screens to draw.
 */
export default function DevDashboardPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const navigation = useNavigation();
  const { user } = useAuth();

  const [isAdmin, setIsAdmin] = useState(null);
  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [feedback, setFeedback] = useState({ rows: [], total: 0, nextCursor: null });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openSections, toggleSection] = useOpenSections(DEFAULT_OPEN_SECTIONS);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);

  const load = useCallback(async () => {
    const admin = await adminService.getIsAdmin({ user });

    setIsAdmin(admin);

    if (!admin) {
      setIsLoading(false);
      return;
    }

    const settled = await Promise.allSettled(SOURCES.map(([, read]) => attempt(read)));
    const next = Object.fromEntries(
      SOURCES.map(([key], index) => [key, fromSettled(settled[index])])
    );

    setSources(next);
    setErrorMessage("");

    // The list keeps state of its own, because paging and the status chips
    // change it in place. A read that failed leaves what was already there.
    if (next.feedback.state === "ok" && next.feedback.value) {
      setFeedback(next.feedback.value);
    }

    if (next.unreadCount.state === "ok" && typeof next.unreadCount.value === "number") {
      setUnreadCount(next.unreadCount.value);
    }

    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

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

  // S10. After a save the S rows are read back from the server rather than
  // patched here, so the row shows what was stored - and its status and
  // "Aflæst" with it. A failure throws on to the form, which shows it.
  const saveSupabaseUsage = useCallback(async (reading) => {
    const saved = await adminService.setSupabaseUsage(reading);

    if (saved?.unavailable) {
      throw new Error("dev_metrics findes ikke endnu. Kør migrationen først.");
    }

    const [secondary] = await Promise.allSettled([
      attempt(() => adminService.getSecondaryKpis()),
    ]);

    setSources((current) => ({ ...current, secondary: fromSettled(secondary) }));
  }, []);

  const view = useMemo(() => {
    const releaseContext = getReleaseContext(sources.releaseLag);

    return {
      users: buildUsersTable(sources.userTotals),
      storeHealth: buildStoreHealthTile(sources.storeHealth),
      bugs: buildBugReportsTile(sources.bugReports),
      trainers: buildTrainersTile(sources.trainingKpis, releaseContext),
      comesBack: buildComesBackTile(sources.trainingKpis),
      plan: buildPlanTile(sources.trainingKpis, releaseContext),
      startedFrom: buildStartedFromTile(sources.startedFrom),
      releaseLag: buildReleaseLag(sources.releaseLag),
      featureUsage: buildFeatureUsage(sources.featureUsage),
      feedbackTiming: buildFeedbackTiming(sources.secondary),
      sections: buildSecondarySections(sources.secondary, sources.storeStats),
      updatedAt: newestComputedAt(Object.values(sources)),
    };
  }, [sources]);

  const downloadStats =
    sources.storeStats.state === "ok" && sources.storeStats.value
      ? sources.storeStats.value
      : EMPTY_STORE_STATS;
  const feedbackFailed = sources.feedback.state === "failed";

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

        {/* When the numbers were worked out, not when the page was opened. */}
        {isAdmin && view.updatedAt ? (
          <ThemedText style={styles.updated} setColor={theme.quietText} numberOfLines={1}>
            opdateret {formatClock(view.updatedAt)}
          </ThemedText>
        ) : null}
      </View>

      {isAdmin === false ? (
        <View style={styles.notAdmin}>
          <ThemedText style={styles.notAdminText} setColor={theme.quietText}>
            Denne konto er ikke admin. Sæt {"`is_admin`"} på profilen i databasen.
          </ThemedText>
        </View>
      ) : (
        <ThemedKeyboardProtection
          scroll
          bottomOffset={40}
          contentContainerStyle={styles.scrollContent}
          scrollViewProps={{
            showsVerticalScrollIndicator: false,
            refreshControl: (
              <RefreshControl refreshing={isRefreshing} onRefresh={refresh} />
            ),
          }}
        >
          {errorMessage ? (
            <ThemedText style={styles.error} setColor={theme.danger}>
              {errorMessage}
            </ThemedText>
          ) : null}

          {isLoading ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <>
              <SectionHeader title="Brugere" detail={view.users.eyebrow} spacing="first" />
              <UsersCard table={view.users} />

              <SectionHeader title="Virker den?" detail="KPI-5" />
              <KpiTileRow>
                <KpiTile label="Crash · ANR" {...view.storeHealth} />
                <BugReportsTile tile={view.bugs} />
              </KpiTileRow>

              <SectionHeader title="Bruges den?" detail="KPI-1 · 2 · 3" />
              <KpiTileRow>
                <KpiTile label="Trænende · 7 dage" {...view.trainers} />
                <KpiTile label="Kommer igen" {...view.comesBack} />
              </KpiTileRow>
              <KpiTileRow spaced>
                <KpiTile label="Plan gennemført" {...view.plan} />
                <StartedFromTile tile={view.startedFrom} />
              </KpiTileRow>

              <SectionHeader title="Bevæger udviklingen sig rigtigt?" detail="KPI-6" />
              <ReleaseLagCard lag={view.releaseLag} />

              <SectionHeader title="Hvad bruges · 28 dage" detail="KPI-4" spacing="wide" />
              <FeatureUsageTable usage={view.featureUsage} />

              <FeedbackHeader
                unreadCount={unreadCount}
                total={feedback.total}
                timing={view.feedbackTiming}
              />

              {feedbackFailed ? (
                <ThemedText style={styles.feedbackError} setColor={theme.danger}>
                  Kunne ikke hente beskederne.
                  {sources.feedback.message ? ` ${sources.feedback.message}` : ""}
                </ThemedText>
              ) : null}

              {feedback.rows.length === 0 ? (
                feedbackFailed ? null : (
                  <ThemedText style={styles.emptyFeedback} setColor={theme.quietText}>
                    Ingen beskeder endnu.
                  </ThemedText>
                )
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

              <SectionHeader title="Når et tal bevæger sig" detail="S1–S10" spacing="wide" />
              {view.sections.map((section, sectionIndex) => (
                <CollapsibleSection
                  key={section.key}
                  title={section.title}
                  ids={section.ids}
                  summary={section.summary}
                  status={section.status}
                  isOpen={openSections.includes(section.key)}
                  onToggle={() => toggleSection(section.key)}
                  isFirst={sectionIndex === 0}
                >
                  {section.rows.map((row, rowIndex) => {
                    let extra = null;

                    if (row.expands === "downloads" && isDownloadsOpen) {
                      extra = <DownloadsCard stats={downloadStats} />;
                    } else if (row.form === "supabaseUsage") {
                      extra = (
                        <SupabaseUsageForm reading={row.reading} onSave={saveSupabaseUsage} />
                      );
                    }

                    return (
                      <SecondaryRow
                        key={row.id}
                        row={row}
                        isFirst={rowIndex === 0}
                        onPress={
                          row.expands === "downloads"
                            ? () => setIsDownloadsOpen((open) => !open)
                            : null
                        }
                        isExpanded={row.expands === "downloads" && isDownloadsOpen}
                      >
                        {extra}
                      </SecondaryRow>
                    );
                  })}
                </CollapsibleSection>
              ))}
            </>
          )}
        </ThemedKeyboardProtection>
      )}

      <StatusBar style="auto" />
    </ThemedView>
  );
}
