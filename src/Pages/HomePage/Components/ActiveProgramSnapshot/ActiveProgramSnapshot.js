import { Text, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./ActiveProgramSnapshotStyle";
import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import ProgressBar from "../../../../Resources/Components/ProgressBar";
import ChevronRight from "../../../../Resources/Icons/UI-icons/ChevronRight";
import Layers from "../../../../Resources/Icons/UI-icons/Layers";

export default function ActiveProgramSnapshot({
  programName,
  currentWeek,
  totalWeeks,
  completedWorkouts,
  totalWorkouts,
  progress,
  onPress,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const roundedPercent = Math.round((Number(progress) || 0) * 100);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Open active program ${programName}`}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconSquare,
            { backgroundColor: withAlpha(theme.primary, 0.12) },
          ]}
        >
          <Layers width={17} height={17} color={theme.primary} thickness={1.7} />
        </View>

        <View style={styles.textColumn}>
          <Text style={[styles.eyebrow, { color: theme.quietText }]}>
            ACTIVE PROGRAM
          </Text>
          <Text style={[styles.title, { color: theme.title }]} numberOfLines={1}>
            {programName}
          </Text>
        </View>

        <View style={[styles.weekChip, { backgroundColor: theme.chipBackground }]}>
          <Text style={[styles.weekChipText, { color: theme.text }]}>
            {`Week ${currentWeek} `}
            <Text style={{ color: theme.quietText }}>{`/ ${totalWeeks}`}</Text>
          </Text>
        </View>

        <ChevronRight width={17} height={17} color={theme.quietText} thickness={2} />
      </View>

      <View style={styles.progressBlock}>
        <ProgressBar
          progress={progress}
          height={6}
          trackColor={theme.cardBorder}
          fillColor={theme.primary}
        />
        <View style={styles.progressFooterRow}>
          <Text style={[styles.progressFooterText, { color: theme.quietText }]}>
            {`${completedWorkouts} of ${totalWorkouts} workouts completed`}
          </Text>
          <Text style={[styles.progressPercent, { color: theme.primary }]}>
            {`${roundedPercent}%`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
