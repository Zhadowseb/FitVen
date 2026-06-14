import { Pressable, View, useColorScheme } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { Colors } from "../../../Resources/GlobalStyling/colors";
import { ThemedText } from "../../../Resources/ThemedComponents";
import styles from "./ProgramOverviewHeaderStyle";

const PROGRESS_BAR_WIDTH = 100;
const PROGRESS_BAR_HEIGHT = 6;

const STATUS_LABELS = {
  NOT_STARTED: "Draft",
  ACTIVE: "Active",
  COMPLETE: "Complete",
};

function parseHexColor(color) {
  if (typeof color !== "string" || !color.startsWith("#")) {
    return null;
  }

  const hex = color.slice(1);
  const normalizedHex =
    hex.length === 3
      ? hex
          .split("")
          .map((digit) => `${digit}${digit}`)
          .join("")
      : hex.slice(0, 6);

  if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) {
    return null;
  }

  return {
    red: parseInt(normalizedHex.slice(0, 2), 16),
    green: parseInt(normalizedHex.slice(2, 4), 16),
    blue: parseInt(normalizedHex.slice(4, 6), 16),
  };
}

function interpolateColor(startColor, endColor, progressPercent) {
  const start = parseHexColor(startColor);
  const end = parseHexColor(endColor);

  if (!start || !end) {
    return startColor;
  }

  const progress = Math.min(1, Math.max(0, progressPercent / 100));
  const mix = (startValue, endValue) =>
    Math.round(startValue + (endValue - startValue) * progress);

  return `rgb(${mix(start.red, end.red)}, ${mix(
    start.green,
    end.green
  )}, ${mix(start.blue, end.blue)})`;
}

const ProgramOverviewHeader = ({
  title,
  status,
  statusColor,
  currentWeek,
  totalWeeks,
  period,
  progressPercent,
  onStart,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const titleColor = theme.title ?? theme.text ?? "#ffffff";
  const quietText = theme.iconColor ?? theme.quietText ?? theme.text;
  const cardBackground =
    theme.cardBackground ?? theme.background ?? "transparent";
  const cardBorder =
    colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.07)"
      : theme.cardBorder ?? "rgba(32, 30, 43, 0.10)";
  const trackBackground =
    colorScheme === "dark"
      ? "rgba(255, 255, 255, 0.07)"
      : "rgba(32, 30, 43, 0.10)";
  const primaryColor = theme.primary ?? Colors.dark.primary ?? "#f7742e";
  const secondaryColor =
    theme.secondary ?? Colors.dark.secondary ?? "#60daac";
  const safeProgressPercent = Math.min(
    100,
    Math.max(0, Number(progressPercent) || 0)
  );
  const progressColor = interpolateColor(
    primaryColor,
    secondaryColor,
    safeProgressPercent
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBackground,
          borderColor: cardBorder,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <ThemedText style={styles.eyebrow} setColor={quietText}>
            Program overview
          </ThemedText>
          <ThemedText
            style={styles.title}
            setColor={titleColor}
            numberOfLines={2}
          >
            {title}
          </ThemedText>
        </View>

        {status === "NOT_STARTED" && onStart ? (
          <Pressable
            onPress={onStart}
            style={({ pressed }) => [
              styles.startButton,
              {
                backgroundColor: primaryColor,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <ThemedText style={styles.startButtonText}>Start</ThemedText>
          </Pressable>
        ) : (
          <View style={[styles.statusChip, { borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <ThemedText style={styles.statusText} setColor={statusColor}>
              {STATUS_LABELS[status] ?? STATUS_LABELS.NOT_STARTED}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.detailRow}>
        <View style={styles.detailGroup}>
          <ThemedText style={styles.detailLabel} setColor={quietText}>
            Current phase
          </ThemedText>
          {status === "NOT_STARTED" ? (
            <ThemedText style={styles.detailValue} setColor={titleColor}>
              Draft
            </ThemedText>
          ) : totalWeeks > 0 ? (
            <View style={styles.phaseValueRow}>
              <ThemedText style={styles.detailValue} setColor={titleColor}>
                {`Week ${currentWeek}`}
              </ThemedText>
              <ThemedText style={styles.phaseTotal} setColor={quietText}>
                {`/ ${totalWeeks}`}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.detailValue} setColor={titleColor}>
              No weeks yet
            </ThemedText>
          )}
        </View>

        <View style={[styles.detailGroup, styles.periodGroup]}>
          <ThemedText style={styles.detailLabel} setColor={quietText}>
            Period
          </ThemedText>
          <ThemedText
            style={[styles.detailValue, styles.periodValue]}
            setColor={titleColor}
            numberOfLines={1}
          >
            {status === "NOT_STARTED" ? "Not scheduled" : period}
          </ThemedText>
        </View>
      </View>

      <View style={styles.progressHeader}>
        <View style={styles.progressPhase}>
          <ThemedText style={styles.progressLabel} setColor={progressColor}>
            {totalWeeks > 0 ? `Week ${currentWeek}` : "No weeks"}
          </ThemedText>
          {totalWeeks > 0 && (
            <ThemedText style={styles.progressTotal} setColor={quietText}>
              {` of ${totalWeeks}`}
            </ThemedText>
          )}
        </View>
        <ThemedText style={styles.progressPercent} setColor={progressColor}>
          {`${safeProgressPercent}%`}
        </ThemedText>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: trackBackground }]}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${PROGRESS_BAR_WIDTH} ${PROGRESS_BAR_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient
              id="programOverviewProgressGradient"
              x1="0"
              y1="0"
              x2={PROGRESS_BAR_WIDTH}
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={primaryColor} />
              <Stop offset="1" stopColor={secondaryColor} />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={safeProgressPercent}
            height={PROGRESS_BAR_HEIGHT}
            rx={PROGRESS_BAR_HEIGHT / 2}
            fill="url(#programOverviewProgressGradient)"
          />
        </Svg>
      </View>
    </View>
  );
};

export default ProgramOverviewHeader;
