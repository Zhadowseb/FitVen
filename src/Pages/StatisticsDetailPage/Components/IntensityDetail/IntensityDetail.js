import { useMemo } from "react";
import { View } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import {
  Caption,
  Card,
  EmptyState,
  HeroNumber,
  HighlightRow,
  Section,
  ShareBars,
  StatTiles,
  detailStyles as styles,
  formatPercent,
  useDetailTheme,
} from "../DetailBlocks/DetailBlocks";
import { withAlpha } from "@resources/GlobalStyling/colors";
import { buildIntensity } from "@utils/statisticsInsights";

// The heavier the zone, the deeper the accent: the bars show where the work
// sits without bringing in a second colour.
const ZONE_WEIGHT = { below60: 0.35, from60: 0.5, from70: 0.65, from80: 0.82, from90: 1 };
const RPE_WEIGHT = { upTo7: 0.5, rpe8: 0.65, rpe9: 0.82, rpe10: 1 };

/**
 * How heavy the period's training was: every working and AMRAP set against
 * the best estimated 1RM of its exercise up to that day, as an average, the
 * spread over five zones and the heavy sets - and the RPE, when any set in
 * the period has one.
 */
export default function IntensityDetail({ sets, period, emptyBody }) {
  const { t } = useTranslation();
  const theme = useDetailTheme();
  const intensity = useMemo(() => buildIntensity(sets, { period }), [sets, period]);

  if (intensity.count === 0) {
    return <EmptyState title={t("statistics.intensity.empty")} body={emptyBody} />;
  }

  return (
    <View style={styles.screen}>
      <HeroNumber
        value={formatPercent(intensity.average, t)}
        title={t("statistics.intensity.average")}
        caption={t("statistics.intensity.caption")}
      />

      <StatTiles
        tiles={[
          {
            key: "sets",
            label: t("statistics.intensity.sets"),
            value: formatNumber(intensity.count),
          },
          {
            key: "heavy",
            label: t("statistics.intensity.heavy"),
            value: formatNumber(intensity.heavyCount),
            note: t("statistics.intensity.heavyNote"),
          },
        ]}
      />

      <Section label={t("statistics.intensity.zonesTitle")}>
        <Card>
          <ShareBars
            rows={intensity.zones.map((zone) => ({
              key: zone.key,
              label: t(`statistics.intensity.zones.${zone.key}`),
              share: zone.share,
              valueLabel: formatPercent(zone.share, t),
              color: withAlpha(theme.primary, ZONE_WEIGHT[zone.key]),
            }))}
          />
        </Card>
      </Section>

      {intensity.rpe ? (
        <Section label={t("statistics.intensity.rpe.title")}>
          <Card>
            <HighlightRow
              label={t("statistics.intensity.rpe.average")}
              value={formatNumber(intensity.rpe.average, { maximumFractionDigits: 1 })}
            />
            <ShareBars
              rows={intensity.rpe.bands.map((band) => ({
                key: band.key,
                label: t(`statistics.intensity.rpe.bands.${band.key}`),
                share: band.share,
                valueLabel: formatPercent(band.share, t),
                color: withAlpha(theme.primary, RPE_WEIGHT[band.key]),
              }))}
            />
            <Caption>{t("statistics.intensity.rpe.basis", { count: intensity.rpe.count })}</Caption>
          </Card>
        </Section>
      ) : null}
    </View>
  );
}
