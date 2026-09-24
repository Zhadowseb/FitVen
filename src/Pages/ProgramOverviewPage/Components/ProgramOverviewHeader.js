import { Pressable, View, useColorScheme } from "react-native";

import { Colors, withAlpha } from "../../../Resources/GlobalStyling/colors";
import { ThemedText } from "../../../Resources/ThemedComponents";
import StatusPill from "../../../Resources/Components/StatusPill";
import ProgressBar from "../../../Resources/Components/ProgressBar";
import Calender from "../../../Resources/Icons/UI-icons/Calender";
import styles from "./ProgramOverviewHeaderStyle";
import { useTranslation } from "@localization";

// Stored statuses to their display keys.
const STATUS_LABEL_KEYS = {
  NOT_STARTED: "programs.status.draft",
  ACTIVE: "programs.status.active",
  COMPLETE: "programs.status.complete",
};

const ProgramOverviewHeader = ({
  title,
  status,
  currentWeek,
  totalWeeks,
  period,
  weekProgressPercent,
  completedWorkouts,
  totalWorkouts,
  totalVolumeLabel,
  totalVolumeUnit = "kg",
  avgSessionMinutes,
  onStart,
}) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const isNotStarted = status === "NOT_STARTED";
  const isComplete = status === "COMPLETE";
  const statusColor = isComplete ? theme.secondary : theme.primary;
  const statusBackground = isComplete
    ? withAlpha(theme.secondary, 0.12)
    : withAlpha(theme.primary, 0.12);
  const safePercent = Math.min(100, Math.max(0, Number(weekProgressPercent) || 0));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <ThemedText style={styles.title} setColor={theme.title} numberOfLines={2}>
            {title}
          </ThemedText>
          <View style={styles.dateRow}>
            <Calender width={13} height={13} color={theme.quietText} thickness={1.8} />
            <ThemedText style={styles.dateText} setColor={theme.quietText}>
              {isNotStarted ? t("programs.settings.notScheduled") : period}
            </ThemedText>
          </View>
        </View>

        <StatusPill
          style={styles.statusPill}
          label={t(STATUS_LABEL_KEYS[status] ?? STATUS_LABEL_KEYS.NOT_STARTED)}
          color={statusColor}
          backgroundColor={statusBackground}
          dotSize={5}
        />
      </View>

      {isNotStarted && onStart ? (
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={t("programs.start.action")}
          style={({ pressed }) => [
            styles.startButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <ThemedText
            style={styles.startButtonText}
            setColor={theme.textInverted}
          >
            {t("programs.start.action")}
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={styles.progressGroup}>
        <View style={styles.progressHeader}>
          <View style={styles.progressLeft}>
            <ThemedText style={styles.weekLabel} setColor={theme.title}>
              {totalWeeks > 0
                ? t("programs.overview.currentWeek", { week: currentWeek })
                : t("programs.overview.noWeeks")}
            </ThemedText>
            {totalWeeks > 0 && (
              <ThemedText style={styles.weekOfLabel} setColor={theme.quietText}>
                {t("programs.overview.weekOf", { total: totalWeeks })}
              </ThemedText>
            )}
          </View>
          <ThemedText style={styles.progressPercent} setColor={primaryTextColor}>
            {`${safePercent}%`}
          </ThemedText>
        </View>

        <ProgressBar progress={safePercent / 100} height={6} />

        <ThemedText style={styles.caption} setColor={theme.quietText}>
          {t("programs.overview.workoutsCompleted", {
            completed: completedWorkouts,
            count: totalWorkouts,
          })}
        </ThemedText>
      </View>

      <View style={styles.statsRow}>
        <View
          style={[
            styles.statField,
            {
              backgroundColor: theme.uiBackground,
              borderColor: theme.hairline,
            },
          ]}
        >
          <ThemedText style={styles.statLabel} setColor={theme.quietText}>
            {t("programs.overview.totalVolume")}
          </ThemedText>
          <View style={styles.statValueRow}>
            <ThemedText style={styles.statValue} setColor={theme.title}>
              {totalVolumeLabel ?? "–"}
            </ThemedText>
            <ThemedText style={styles.statUnit} setColor={theme.quietText}>
              {totalVolumeLabel === null || totalVolumeLabel === undefined
                ? ` ${t("programs.overview.notLogged")}`
                : ` ${totalVolumeUnit}`}
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.statField,
            {
              backgroundColor: theme.uiBackground,
              borderColor: theme.hairline,
            },
          ]}
        >
          <ThemedText style={styles.statLabel} setColor={theme.quietText}>
            {t("programs.overview.avgSession")}
          </ThemedText>
          <View style={styles.statValueRow}>
            <ThemedText style={styles.statValue} setColor={theme.title}>
              {avgSessionMinutes ?? "–"}
            </ThemedText>
            <ThemedText style={styles.statUnit} setColor={theme.quietText}>
              {avgSessionMinutes === null || avgSessionMinutes === undefined
                ? ` ${t("programs.overview.notTimed")}`
                : ` ${t("programs.overview.minutesUnit")}`}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProgramOverviewHeader;
