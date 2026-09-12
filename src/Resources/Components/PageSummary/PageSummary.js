import { Fragment, memo } from "react";
import { View, useColorScheme } from "react-native";

import styles from "./PageSummaryStyle";
import { Colors, withAlpha } from "../../GlobalStyling/colors";
import { ThemedText } from "../../ThemedComponents";

/**
 * The bar at the top of a section screen: what this screen is, and the two or
 * three numbers that say where the user stands before they tap anything.
 *
 * Deliberately not a tool row and not a hero card - it is never tappable, so
 * it cannot compete with the cards under it for the first tap.
 *
 * `stats` entries are `{ key, value, unit?, label, tone? }`. A stat whose value
 * is null renders an em dash: absent and zero are different answers, and a
 * summary that prints 0 for "not loaded yet" is the thing this is meant to
 * stop.
 */
function PageSummary({
  eyebrow,
  title,
  badge = null,
  stats = [],
  caption = null,
  style,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const toneColor = (tone) => {
    if (tone === "primary") return primaryTextColor;
    if (tone === "secondary") return theme.secondary;
    if (tone === "record") return theme.record;
    return titleColor;
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cardSurface, borderColor: cardBorder },
        style,
      ]}
    >
      <View style={styles.headRow}>
        <View style={styles.headText}>
          {eyebrow ? (
            <ThemedText style={styles.eyebrow} setColor={primaryTextColor}>
              {eyebrow}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.title} setColor={titleColor} numberOfLines={1}>
            {title}
          </ThemedText>
        </View>

        {badge ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: withAlpha(toneColor(badge.tone), 0.14) },
            ]}
          >
            <ThemedText
              style={styles.badgeText}
              setColor={toneColor(badge.tone)}
              numberOfLines={1}
            >
              {badge.label}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <Fragment key={stat.key}>
              {index > 0 ? (
                <View
                  style={[
                    styles.statDivider,
                    { backgroundColor: withAlpha(titleColor, 0.12) },
                  ]}
                />
              ) : null}

              <View style={styles.stat}>
                <View style={styles.statValueLine}>
                  <ThemedText
                    style={styles.statValue}
                    setColor={toneColor(stat.tone)}
                    numberOfLines={1}
                  >
                    {stat.value === null || stat.value === undefined
                      ? "\u2013"
                      : stat.value}
                  </ThemedText>
                  {stat.unit ? (
                    <ThemedText style={styles.statUnit} setColor={quietText}>
                      {stat.unit}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText
                  style={styles.statLabel}
                  setColor={quietText}
                  numberOfLines={1}
                >
                  {stat.label}
                </ThemedText>
              </View>
            </Fragment>
          ))}
        </View>
      ) : null}

      {caption ? (
        <ThemedText style={styles.caption} setColor={quietText} numberOfLines={2}>
          {caption}
        </ThemedText>
      ) : null}
    </View>
  );
}

export default memo(PageSummary);
