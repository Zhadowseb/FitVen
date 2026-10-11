import { useCallback, useState } from "react";
import { Platform, TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { formatNumber, useTranslation } from "@localization";

import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../../Resources/ThemedComponents/ThemedText";
import StepZoneBar from "../../../../Resources/Components/StepZoneBar";
import ChevronRight from "../../../../Resources/Icons/UI-icons/ChevronRight";
import Footsteps from "../../../../Resources/Icons/UI-icons/Footsteps";
import { stepsService } from "../../../../Services";
import styles from "./StepsCardStyle";

// Today's steps on Home: the walked steps (the phone's own count), the steps
// training added in orange, the zone and the segmented bar. Tapping it opens
// the Steps page. Under the Days-since / Quick start row.
//
// It asks for the steps the first time somebody taps "Allow" here - never when
// the app opens - and says so in one line when it cannot read them. It never
// shows a zero as if it were real: a phone that has said nothing all week is
// "no data", not a quiet day.

export default function StepsCard({ refreshKey = 0 }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [data, setData] = useState(null);
  const [isAsking, setIsAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await stepsService.loadHomeSteps(db, { theme }));
    } catch (error) {
      console.warn("Could not load today's steps:", error);
    }
  }, [db, theme]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, refreshKey])
  );

  if (!data) {
    return null;
  }

  const healthApp = t(`steps.healthApp.${Platform.OS === "ios" ? "ios" : "android"}`);
  const today = data.today;
  // Something real to show: the phone said something this week, or a workout did.
  const hasNumber =
    today?.active !== null &&
    today?.active !== undefined &&
    (data.hasPhoneData || today.training > 0 || today.walks > 0);
  const cardStyle = [
    styles.card,
    { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
  ];

  const allow = async () => {
    setIsAsking(true);

    try {
      await stepsService.requestStepsAccess();
      await load();
    } finally {
      setIsAsking(false);
    }
  };

  /* No health app on this phone, and nothing of our own to show: no card at all. */
  if (data.status === "unavailable" && !hasNumber) {
    return null;
  }

  /* Not asked yet - the question comes first - or asked and not allowed / nothing came back. */
  if (data.status === "undetermined" || !hasNumber) {
    const asking = data.status === "undetermined";

    return (
      <View style={cardStyle}>
        <View style={styles.topRow}>
          <Footsteps width={16} height={16} color={theme.stepZones.sweetSpot} thickness={2} />
          <ThemedText style={styles.askText} setColor={theme.text}>
            {asking ? t("steps.access.ask") : t("steps.access.blocked", { app: healthApp })}
          </ThemedText>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isAsking}
            onPress={asking ? allow : () => stepsService.openStepsSettings()}
            style={[styles.askButton, { backgroundColor: withAlpha(theme.primary, 0.14) }]}
          >
            <ThemedText style={styles.askButtonText} setColor={theme.primaryText}>
              {asking ? t("steps.access.askButton") : t("steps.access.openApp", { app: healthApp })}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const walked = today.walked;
  const training = today.training;
  const zone = today.zone;
  const zoneName = t(zone.labelKey);
  const label =
    walked !== null && training > 0
      ? t("steps.card.a11yWithTraining", {
          walked: formatNumber(walked),
          training: formatNumber(training),
          total: formatNumber(today.active),
          zone: zoneName,
        })
      : t("steps.card.a11y", { total: formatNumber(today.active), zone: zoneName });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.85}
      onPress={() => navigation.navigate("StepsPage")}
      style={cardStyle}
    >
      <View style={styles.topRow}>
        <Footsteps width={16} height={16} color={theme.stepZones.sweetSpot} thickness={2} />
        <ThemedText style={styles.walked} setColor={walked === null ? theme.quietText : theme.title}>
          {walked === null ? "–" : formatNumber(walked)}
        </ThemedText>
        {training > 0 ? (
          <ThemedText style={styles.training} setColor={theme.primary}>
            {`+${formatNumber(training)}`}
          </ThemedText>
        ) : null}
        <ThemedText style={styles.unit} setColor={theme.quietText}>
          {t("steps.card.steps")}
        </ThemedText>
        <View style={styles.spacer} />
        <View style={[styles.pill, { backgroundColor: withAlpha(zone.color, 0.14) }]}>
          <ThemedText style={styles.pillText} setColor={zone.color}>
            {zoneName}
          </ThemedText>
        </View>
        <ChevronRight width={14} height={14} color={theme.quietText} thickness={2.2} />
      </View>

      <StepZoneBar walked={walked ?? 0} active={today.active} />
    </TouchableOpacity>
  );
}
