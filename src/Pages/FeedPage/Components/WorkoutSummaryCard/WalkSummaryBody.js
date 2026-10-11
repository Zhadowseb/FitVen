import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { formatNumber, useTranslation } from "@localization";

import Lock from "../../../../Resources/Icons/UI-icons/Lock";
import { withAlpha } from "../../../../Resources/GlobalStyling/colors";
import { ThemedText } from "../../../../Resources/ThemedComponents";
import {
  formatWalkDistance,
  formatWalkTime,
  routePointsOf,
  walkPostStats,
} from "../../../../Utils/walkPost";
import { formatPaceClock } from "../../../../Utils/walkTracking";

// What a walk post says where a strength post has its sets (design:
// WalkPost.dc.html, brief: WALK_POST.md): distance and time as the only big
// numbers, the trimmed route when the person shared it, and a small row of
// pace, steps, cadence and steps a kilometre. Same card around it, same header
// and footer - this is only the body.
//
// Pace and steps/km are worked out here from the payload, so they follow what
// the reader sees; nothing is ever shown as a zero (without a step counter the
// small row is the pace alone).

const ROUTE_HEIGHT = 150;
const ROUTE_WIDTH = 320;
const ROUTE_PADDING = 22;
// The line fades away over this many steps at each end, which says that the
// start and the end are not there.
const FADE_STEPS = 6;

// The route on a flat map, fitted to the card: a few kilometres is flat enough.
function projectRoute(points) {
  const meanLatitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const scaleX = Math.cos((meanLatitude * Math.PI) / 180);
  const flat = points.map((point) => ({ x: point.longitude * scaleX, y: -point.latitude }));
  const minX = Math.min(...flat.map((point) => point.x));
  const maxX = Math.max(...flat.map((point) => point.x));
  const minY = Math.min(...flat.map((point) => point.y));
  const maxY = Math.max(...flat.map((point) => point.y));
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min(
    (ROUTE_WIDTH - ROUTE_PADDING * 2) / spanX,
    (ROUTE_HEIGHT - ROUTE_PADDING * 2) / spanY
  );
  const offsetX = (ROUTE_WIDTH - spanX * scale) / 2;
  const offsetY = (ROUTE_HEIGHT - spanY * scale) / 2;

  return flat.map((point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (point.y - minY) * scale,
  }));
}

const pathOf = (points) =>
  points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");

// The line in pieces: a few that fade in, the long middle in one, a few that fade out.
function routeParts(projected) {
  const count = projected.length;
  const fade = Math.min(FADE_STEPS, Math.floor((count - 1) / 3));

  if (fade < 1) {
    return [{ d: pathOf(projected), opacity: 1 }];
  }

  const size = Math.max(1, Math.round((count - 1) * 0.04));
  const parts = [];
  const slice = (from, to) => projected.slice(from, to + 1);

  for (let step = 0; step < fade; step += 1) {
    parts.push({
      d: pathOf(slice(step * size, (step + 1) * size)),
      opacity: (step + 1) / (fade + 1),
    });
  }

  parts.push({ d: pathOf(slice(fade * size, count - 1 - fade * size)), opacity: 1 });

  for (let step = fade - 1; step >= 0; step -= 1) {
    parts.push({
      d: pathOf(slice(count - 1 - (step + 1) * size, count - 1 - step * size)),
      opacity: (step + 1) / (fade + 1),
    });
  }

  return parts;
}

function RouteCard({ points, green, theme, divider, t }) {
  const parts = useMemo(() => routeParts(projectRoute(points)), [points]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("walkPost.routeA11y")}
      style={[styles.routeCard, { backgroundColor: theme.uiBackground, borderColor: divider }]}
    >
      <Svg width="100%" height={ROUTE_HEIGHT} viewBox={`0 0 ${ROUTE_WIDTH} ${ROUTE_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        {parts.map((part, index) => (
          <Path
            key={`glow-${index}`}
            d={part.d}
            stroke={green}
            strokeOpacity={0.3 * part.opacity}
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {parts.map((part, index) => (
          <Path
            key={`line-${index}`}
            d={part.d}
            stroke={green}
            strokeOpacity={part.opacity}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </Svg>

      <View style={[styles.routePill, { backgroundColor: withAlpha(theme.background, 0.78) }]}>
        <Lock width={11} height={11} color={theme.quietText} thickness={2.2} />
        <ThemedText style={styles.routePillText} setColor={theme.quietText}>
          {t("walkPost.startEndHidden")}
        </ThemedText>
      </View>
    </View>
  );
}

export default function WalkSummaryBody({ payload, authorName, theme, green, divider }) {
  const { t } = useTranslation();
  const titleColor = theme.title;
  const quietText = theme.quietText ?? theme.iconColor;
  const points = useMemo(() => routePointsOf(payload), [payload]);
  const distance = Number(payload?.distanceMeters) > 0 ? Number(payload.distanceMeters) : null;
  const time = formatWalkTime(payload?.movingSeconds);
  const stats = walkPostStats(payload);
  const timeUnit = t(time.unit === "h" ? "walkPost.hoursUnit" : "walkPost.minutesUnit");

  const small = [
    stats.pace ? { value: formatPaceClock(stats.pace), label: t("walkPost.pace") } : null,
    stats.steps ? { value: formatNumber(stats.steps), label: t("walkPost.steps") } : null,
    stats.steps && stats.cadence ? { value: formatNumber(stats.cadence), label: t("walkPost.cadence") } : null,
    stats.steps && stats.stepsPerKm ? { value: formatNumber(stats.stepsPerKm), label: t("walkPost.stepsPerKm") } : null,
  ].filter(Boolean);

  const summary = distance
    ? t("walkPost.a11yDistance", { name: authorName, km: formatWalkDistance(distance), time: `${time.value} ${timeUnit}` })
    : t("walkPost.a11yTime", { name: authorName, time: `${time.value} ${timeUnit}` });

  return (
    <View accessible={false}>
      {/* the two big numbers */}
      <View accessible accessibilityLabel={summary} style={styles.hero}>
        {distance ? (
          <View style={styles.heroColumn}>
            <ThemedText style={styles.heroLabel} setColor={quietText}>
              {t("walkPost.distance")}
            </ThemedText>
            <View style={styles.heroValueRow}>
              <ThemedText style={styles.heroValue} setColor={titleColor}>
                {formatWalkDistance(distance)}
              </ThemedText>
              <ThemedText style={styles.heroUnit} setColor={theme.text ?? titleColor}>
                {t("walkPost.kmUnit")}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {distance ? <View style={[styles.heroDivider, { backgroundColor: divider }]} /> : null}

        <View style={styles.heroColumn}>
          <ThemedText style={styles.heroLabel} setColor={quietText}>
            {t("walkPost.time")}
          </ThemedText>
          <View style={styles.heroValueRow}>
            <ThemedText style={styles.heroValue} setColor={titleColor}>
              {time.value}
            </ThemedText>
            <ThemedText style={styles.heroUnit} setColor={theme.text ?? titleColor}>
              {timeUnit}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* the route, when it was shared */}
      {points.length >= 2 ? (
        <RouteCard points={points} green={green} theme={theme} divider={divider} t={t} />
      ) : null}

      {/* the small row */}
      {small.length > 0 ? (
        <View style={[styles.smallRow, { borderColor: divider }]}>
          {small.map((stat, index) => (
            <View
              key={stat.label}
              accessible
              accessibilityLabel={`${stat.value} ${stat.label}`}
              style={[
                styles.smallColumn,
                index > 0 ? { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: divider } : null,
              ]}
            >
              <ThemedText style={styles.smallValue} setColor={titleColor}>
                {stat.value}
              </ThemedText>
              <ThemedText style={styles.smallLabel} setColor={quietText}>
                {stat.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  heroColumn: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingHorizontal: 4,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: 12,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  heroValue: {
    flexShrink: 1,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: "800",
  },
  routeCard: {
    height: ROUTE_HEIGHT,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  routePill: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    height: 22,
    borderRadius: 999,
  },
  routePillText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  smallRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  smallColumn: {
    flex: 1,
    alignItems: "center",
    gap: 1,
  },
  smallValue: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  smallLabel: {
    fontSize: 10.5,
    fontWeight: "700",
  },
});
