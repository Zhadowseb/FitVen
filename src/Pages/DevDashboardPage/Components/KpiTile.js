import { View, useColorScheme } from "react-native";

import styles from "./KpiTileStyle";
import Sparkline from "./Sparkline";
import { getStatusColor } from "../devDashboardView";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * The edge and the tint a status puts on a card. Only the two that ask for
 * action colour the card: `watch` its edge, `alarm` its edge and its surface.
 */
export function getStatusFrame(status, theme) {
  if (status === "alarm") {
    return {
      borderColor: withAlpha(theme.danger, 0.42),
      tint: withAlpha(theme.danger, 0.07),
    };
  }

  if (status === "watch") {
    return { borderColor: withAlpha(theme.record, 0.38), tint: null };
  }

  return { borderColor: theme.cardBorder, tint: null };
}

/** A dot and a short label, both in the status colour. */
export function StatusLabel({ status, style }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const color = getStatusColor(status.status, theme);

  return (
    <View style={[styles.statusRow, style]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <ThemedText style={styles.statusText} setColor={color} numberOfLines={1}>
        {status.label}
      </ThemedText>
    </View>
  );
}

/** Two tiles side by side, the same height. */
export function KpiTileRow({ children, spaced = false }) {
  return <View style={[styles.row, spaced ? styles.rowSpaced : null]}>{children}</View>;
}

/**
 * One KPI: label, value (with its change or percentage beside it), whatever the
 * tile adds of its own, a sparkline, the window it covers, and the status at
 * the bottom.
 *
 * `side` takes the status colour unless `sideQuiet` - the small-numbers rule,
 * where a percentage over fewer than 30 people must not look like a verdict.
 * `detail` is `{ text, status }`, a second reading under the value. Leave
 * `value` out for a tile whose content is its children.
 */
export default function KpiTile({
  label,
  value,
  side = null,
  sideQuiet = false,
  detail = null,
  series = null,
  thresholds = [],
  window = null,
  status,
  children = null,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const statusColor = getStatusColor(status.status, theme);
  const frame = getStatusFrame(status.status, theme);
  const isFlagged = status.status === "watch" || status.status === "alarm";
  const lines = thresholds.map((line) => ({
    value: line.value,
    color: withAlpha(line.tone === "good" ? theme.secondary : theme.danger, 0.45),
  }));

  return (
    <View
      accessible
      accessibilityLabel={[label, value, side, detail?.text, window, status.label]
        .filter(Boolean)
        .join(", ")}
      style={[
        styles.tile,
        { backgroundColor: theme.cardBackground, borderColor: frame.borderColor },
      ]}
    >
      <View style={[styles.body, frame.tint ? { backgroundColor: frame.tint } : null]}>
        <ThemedText style={styles.label} setColor={theme.quietText} numberOfLines={1}>
          {label.toUpperCase()}
        </ThemedText>

        {value !== undefined ? (
          <View style={styles.valueRow}>
            <ThemedText
              style={styles.value}
              setColor={theme.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {value}
            </ThemedText>

            {side ? (
              <ThemedText
                style={styles.side}
                setColor={sideQuiet ? theme.quietText : statusColor}
                numberOfLines={1}
              >
                {side}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {detail ? (
          <ThemedText
            style={styles.detail}
            setColor={getStatusColor(detail.status, theme)}
            numberOfLines={1}
          >
            {detail.text}
          </ThemedText>
        ) : null}

        {children}

        {series ? (
          <Sparkline
            values={series}
            color={isFlagged ? statusColor : theme.mutedStrong}
            thresholds={lines}
          />
        ) : null}

        {window ? (
          <ThemedText style={styles.window} setColor={theme.quietText} numberOfLines={1}>
            {window}
          </ThemedText>
        ) : null}

        <StatusLabel status={status} style={styles.status} />
      </View>
    </View>
  );
}
