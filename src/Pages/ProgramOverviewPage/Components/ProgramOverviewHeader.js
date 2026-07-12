import { Pressable, View, useColorScheme } from "react-native";

import { Colors, withAlpha } from "../../../Resources/GlobalStyling/colors";
import { ThemedText } from "../../../Resources/ThemedComponents";
import StatusPill from "../../../Resources/Components/StatusPill";
import ProgressBar from "../../../Resources/Components/ProgressBar";
import Calender from "../../../Resources/Icons/UI-icons/Calender";
import styles from "./ProgramOverviewHeaderStyle";

const STATUS_LABELS = {
  NOT_STARTED: "Draft",
  ACTIVE: "Active",
  COMPLETE: "Complete",
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
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

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
              {isNotStarted ? "Not scheduled" : period}
            </ThemedText>
          </View>
        </View>

        {isNotStarted && onStart ? (
          <Pressable
            onPress={onStart}
            style={({ pressed }) => [
              styles.startButton,
              {
                backgroundColor: theme.primary,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <ThemedText style={styles.startButtonText} setColor={theme.textInverted}>
              Start
            </ThemedText>
          </Pressable>
        ) : (
          <StatusPill
            style={styles.statusPill}
            label={STATUS_LABELS[status] ?? STATUS_LABELS.NOT_STARTED}
            color={statusColor}
            backgroundColor={statusBackground}
            dotSize={5}
          />
        )}
      </View>

      <View style={styles.progressGroup}>
        <View style={styles.progressHeader}>
          <View style={styles.progressLeft}>
            <ThemedText style={styles.weekLabel} setColor={theme.title}>
              {totalWeeks > 0 ? `Week ${currentWeek} ` : "No weeks"}
            </ThemedText>
            {totalWeeks > 0 && (
              <ThemedText style={styles.weekOfLabel} setColor={theme.quietText}>
                {`of ${totalWeeks}`}
              </ThemedText>
            )}
          </View>
          <ThemedText style={styles.progressPercent} setColor={theme.primary}>
            {`${safePercent}%`}
          </ThemedText>
        </View>

        <ProgressBar progress={safePercent / 100} height={6} />

        <ThemedText style={styles.caption} setColor={theme.quietText}>
          {`${completedWorkouts} of ${totalWorkouts} workouts completed`}
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
            Total volume
          </ThemedText>
          <View style={styles.statValueRow}>
            <ThemedText style={styles.statValue} setColor={theme.title}>
              {totalVolumeLabel}
            </ThemedText>
            <ThemedText style={styles.statUnit} setColor={theme.quietText}>
              {` ${totalVolumeUnit}`}
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
            Avg session
          </ThemedText>
          <View style={styles.statValueRow}>
            <ThemedText style={styles.statValue} setColor={theme.title}>
              {avgSessionMinutes}
            </ThemedText>
            <ThemedText style={styles.statUnit} setColor={theme.quietText}>
              {" min"}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProgramOverviewHeader;
