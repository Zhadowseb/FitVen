import { View, useColorScheme } from "react-native";

import styles from "./FeatureUsageTableStyle";
import { UNMEASURED_SCREENS, getStatusColor } from "../devDashboardView";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

function commitColor(tone, theme) {
  if (tone === "alarm") {
    return theme.danger;
  }

  return tone === "watch" ? theme.record : theme.title;
}

function FeatureRow({ row, theme, isFirst }) {
  const flagged = row.status.status === "watch" || row.status.status === "alarm";
  const badgeColor = row.badge ? getStatusColor(row.badge.status, theme) : null;

  return (
    <View
      accessible
      accessibilityLabel={[
        row.name,
        `${row.share} af de aktive`,
        row.counts,
        `${row.commits} commits`,
        row.inStore,
        row.badge?.label,
      ]
        .filter(Boolean)
        .join(", ")}
      style={[styles.row, isFirst ? null : { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <View style={styles.nameCell}>
        {/* The badge moves to a line of its own when it does not fit. */}
        <View style={styles.nameLine}>
          <ThemedText style={styles.name} setColor={theme.title} numberOfLines={1}>
            {row.name}
          </ThemedText>

          {row.badge ? (
            <View style={[styles.badge, { backgroundColor: withAlpha(badgeColor, 0.14) }]}>
              <ThemedText style={styles.badgeText} setColor={badgeColor} numberOfLines={1}>
                {row.badge.label}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.track, { backgroundColor: withAlpha(theme.title, 0.06) }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(row.fill * 100)}%`,
                // Yellow once the share has been judged too low; grey while it
                // has not been judged at all.
                backgroundColor: flagged
                  ? withAlpha(theme.record, 0.8)
                  : withAlpha(theme.mutedStrong, 0.55),
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.shareCell}>
        <ThemedText style={styles.number} setColor={theme.title} numberOfLines={1}>
          {row.share}
        </ThemedText>
        {row.counts ? (
          <ThemedText
            style={styles.sub}
            setColor={theme.quietText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {row.counts}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.commitsCell}>
        <ThemedText
          style={styles.number}
          setColor={commitColor(row.commitsTone, theme)}
          numberOfLines={1}
        >
          {row.commits}
        </ThemedText>
        {row.inStore ? (
          <ThemedText
            style={styles.sub}
            setColor={theme.quietText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {row.inStore}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * KPI-4, "Hvad bruges · 28 dage": share of the active users who used each
 * released feature, lowest first, with the commits spent on it since 1/9.
 * Features not in the latest store build are chips, not rows - nobody has had
 * them, so they are not judged. `usage` comes from `buildFeatureUsage`.
 */
export default function FeatureUsageTable({ usage }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <View style={[styles.row, styles.headRow, { borderBottomColor: theme.hairline }]}>
        <ThemedText style={[styles.head, styles.headName]} setColor={theme.quietText} numberOfLines={1}>
          FUNKTION
        </ThemedText>
        <ThemedText style={[styles.head, styles.headShare]} setColor={theme.quietText} numberOfLines={1}>
          ANDEL
        </ThemedText>
        <ThemedText style={[styles.head, styles.headCommits]} setColor={theme.quietText} numberOfLines={1}>
          COMMITS
        </ThemedText>
      </View>

      {usage.blocked || usage.isEmpty ? (
        <ThemedText style={styles.message} setColor={theme.quietText}>
          {usage.blocked ? usage.blocked.label : "Ingen funktioner målt endnu."}
        </ThemedText>
      ) : (
        usage.rows.map((row, index) => (
          <FeatureRow key={row.key} row={row} theme={theme} isFirst={index === 0} />
        ))
      )}

      {usage.chips.length > 0 ? (
        <View style={[styles.footerBlock, { borderTopColor: theme.hairline }]}>
          <ThemedText style={styles.head} setColor={theme.quietText} numberOfLines={1}>
            IKKE UDGIVET – BEDØMMES IKKE
          </ThemedText>

          <View style={styles.chips}>
            {usage.chips.map((chip) => (
              <View
                key={chip.key}
                style={[styles.chip, { borderColor: withAlpha(theme.title, 0.08) }]}
              >
                <ThemedText style={styles.chipText} setColor={theme.mutedStrong} numberOfLines={1}>
                  {chip.text}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.footerBlock, { borderTopColor: theme.hairline }]}>
        <ThemedText style={styles.unmeasured} setColor={theme.quietText}>
          <ThemedText style={styles.unmeasuredLead} setColor={theme.quietText}>
            Ikke målt:{" "}
          </ThemedText>
          {UNMEASURED_SCREENS} – de ligger kun på telefonen.
        </ThemedText>
      </View>
    </View>
  );
}
