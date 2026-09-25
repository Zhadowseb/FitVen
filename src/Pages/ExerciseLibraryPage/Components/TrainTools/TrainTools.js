import { useCallback, useState } from "react";
import { View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./TrainToolsStyle";
import LibraryTile from "../TrainLibrary/LibraryTile";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Thermostat from "@resources/Icons/UI-icons/Thermostat";
import TradeUp from "@resources/Icons/UI-icons/TradeUp";
import { ThemedText } from "@resources/ThemedComponents";
import { formatNumber, useTranslation } from "@localization";
import { trainService } from "@services";
import { ONE_REP_MAX_DAYS } from "@utils/trainLibrary";

// Until the numbers are in: a dash, not a confident zero.
const PENDING = "–";
const PENDING_MONTHS = Array.from({ length: 12 }, (_, month) => ({
  month,
  days: 0,
  isCurrent: false,
  isUpcoming: false,
}));

/**
 * The Train tab's two tools (spec section 7): the 1RM calculator, showing the
 * best estimated 1RM of the last thirty days and the set behind it, and the
 * sick days of this year month by month. The calculator opens with that set
 * filled in; the sick days open the sickness screen.
 *
 * Loads its own numbers each time the screen gains focus; `refreshKey` loads
 * them again while it stays focused.
 */
export default function TrainTools({ style, refreshKey }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [tools, setTools] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      trainService
        .getToolsOverview(db, { now: Date.now() })
        .then((next) => {
          if (!cancelled) {
            setTools(next);
          }
        })
        .catch((error) => console.error("Failed to load the Train tools:", error));

      return () => {
        cancelled = true;
      };
    }, [db, refreshKey])
  );

  const best = tools?.oneRepMax ?? null;
  const sickDays = tools?.sickDays ?? null;
  const setLabel = best ? `${formatNumber(best.weight)} × ${formatNumber(best.reps)}` : null;
  const noLifts = t("trainLibrary.tools.noLifts", { count: ONE_REP_MAX_DAYS });

  const openCalculator = () =>
    navigation.navigate(
      "OneRepMaxCalculatorPage",
      best ? { exerciseName: best.name, weight: best.weight, reps: best.reps } : undefined
    );

  const monthStyle = (month) => [
    styles.month,
    month.days > 0
      ? { backgroundColor: theme.danger }
      : month.isUpcoming
        ? [styles.monthUpcoming, { borderColor: theme.textDisabled }]
        : { backgroundColor: theme.raisedSurface },
    month.isCurrent ? [styles.monthCurrent, { borderColor: theme.danger }] : null,
  ];

  return (
    <View style={[styles.row, style]}>
      <LibraryTile
        compact
        title={t("trainLibrary.tools.oneRepMax")}
        icon={<TradeUp width={15} height={15} stroke={theme.secondary} />}
        tint={theme.secondary}
        borderColor={withAlpha(theme.secondary, 0.26)}
        value={best ? formatNumber(best.value) : PENDING}
        addendum={best ? t("common.kg") : null}
        addendumColor={theme.secondary}
        accessibilityLabel={
          best
            ? t("trainLibrary.a11y.oneRepMax", {
                value: formatNumber(best.value),
                exercise: best.name,
                weight: formatNumber(best.weight),
                reps: t("common.reps", { count: best.reps }),
              })
            : tools
              ? t("trainLibrary.a11y.oneRepMaxEmpty", { detail: noLifts })
              : undefined
        }
        onPress={openCalculator}
      >
        <View style={[styles.foot, styles.setRow, { backgroundColor: theme.uiBackground }]}>
          {best ? (
            <>
              <ThemedText style={styles.setName} setColor={theme.text} numberOfLines={1}>
                {best.abbreviation}
              </ThemedText>
              <ThemedText style={styles.setValue} setColor={theme.title} numberOfLines={1}>
                {setLabel}
              </ThemedText>
            </>
          ) : tools ? (
            <ThemedText
              style={styles.setEmpty}
              setColor={theme.quietText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {noLifts}
            </ThemedText>
          ) : null}
        </View>
      </LibraryTile>

      <LibraryTile
        compact
        title={t("trainLibrary.tools.sickDays")}
        icon={<Thermostat width={15} height={15} color={theme.danger} />}
        tint={theme.danger}
        borderColor={withAlpha(theme.danger, 0.26)}
        value={sickDays ? formatNumber(sickDays.total) : PENDING}
        addendum={sickDays ? t("trainLibrary.tools.thisYear") : null}
        addendumColor={theme.danger}
        accessibilityLabel={
          sickDays
            ? t("trainLibrary.a11y.sickDays", { count: formatNumber(sickDays.total) })
            : undefined
        }
        onPress={() => navigation.navigate("SicknessPage")}
      >
        <View style={[styles.foot, styles.monthGrid]}>
          {(sickDays?.months ?? PENDING_MONTHS).map((month) => (
            <View key={month.month} style={monthStyle(month)} />
          ))}
        </View>
      </LibraryTile>
    </View>
  );
}
