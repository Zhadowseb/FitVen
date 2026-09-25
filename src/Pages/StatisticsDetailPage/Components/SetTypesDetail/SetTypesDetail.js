import { useMemo } from "react";
import { View } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import localStyles from "./SetTypesDetailStyle";
import {
  Card,
  EMPTY_VALUE,
  EmptyState,
  Section,
  StatTiles,
  detailStyles as styles,
  formatPercent,
  useDetailTheme,
} from "../DetailBlocks/DetailBlocks";
import { ThemedText } from "@resources/ThemedComponents";
import { buildDropVolumeShare, buildSetTypeShares } from "@utils/statisticsInsights";
import { setTypeColor } from "../../../WorkoutPage/WorkoutTypes/Resistance/Components/ExerciseList/Components/ExerciseRow/SetList/setTypeColors";

/** "+2.3", "−0.5", "0": a difference in reps, to one decimal. */
function formatSignedReps(value) {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";

  return `${sign}${formatNumber(Math.abs(rounded), { maximumFractionDigits: 1 })}`;
}

/**
 * What kind of sets the period was made of - warm-ups included, which the
 * rest of the statistics leave out - in the colours the set list gives each
 * type; how far past their target the AMRAP sets went; and how much of the
 * volume the drop sets carried.
 */
export default function SetTypesDetail({ setTypes, sets, period, emptyBody }) {
  const { t } = useTranslation();
  const theme = useDetailTheme();
  const shares = useMemo(() => buildSetTypeShares(setTypes, { period }), [setTypes, period]);
  const dropShare = useMemo(() => buildDropVolumeShare(sets, { period }), [sets, period]);

  if (shares.total === 0) {
    return <EmptyState title={t("statistics.setTypes.empty")} body={emptyBody} />;
  }

  const tiles = [
    {
      key: "dropVolume",
      label: t("statistics.setTypes.dropVolume"),
      value: dropShare === null ? EMPTY_VALUE : formatPercent(dropShare, t),
      note: t("statistics.setTypes.dropVolumeNote"),
    },
  ];

  if (shares.amrap) {
    tiles.push({
      key: "amrap",
      label: t("statistics.setTypes.amrapOver"),
      value: formatSignedReps(shares.amrap.averageOverTarget),
      unit: t("statistics.units.reps"),
      note: t("statistics.setTypes.amrapBasis", { count: shares.amrap.count }),
    });
  }

  return (
    <View style={styles.screen}>
      <Section
        label={t("statistics.setTypes.splitTitle")}
        note={t("statistics.setTypes.total", { count: shares.total })}
      >
        <Card>
          <View style={localStyles.stack}>
            {shares.types
              .filter((entry) => entry.count > 0)
              .map((entry) => (
                <View
                  key={entry.type}
                  style={[
                    localStyles.stackPart,
                    { flex: entry.count, backgroundColor: setTypeColor(entry.type, theme) },
                  ]}
                />
              ))}
          </View>

          <View style={localStyles.legend}>
            {shares.types.map((entry) => (
              <View key={entry.type} style={localStyles.legendRow}>
                <View
                  style={[localStyles.legendDot, { backgroundColor: setTypeColor(entry.type, theme) }]}
                />
                <ThemedText style={localStyles.legendLabel} setColor={theme.title} numberOfLines={1}>
                  {t(`statistics.setTypes.types.${entry.type}`)}
                </ThemedText>
                <ThemedText style={localStyles.legendCount} setColor={theme.title}>
                  {formatNumber(entry.count)}
                </ThemedText>
                <ThemedText style={localStyles.legendShare} setColor={theme.quietText}>
                  {formatPercent(entry.share, t)}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      <StatTiles tiles={tiles} />
    </View>
  );
}
