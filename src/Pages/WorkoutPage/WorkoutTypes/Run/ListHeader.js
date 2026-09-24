import { TouchableOpacity, View } from "react-native";
import { useColorScheme } from "react-native";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import { ThemedText } from "../../../../Resources/ThemedComponents";
import { useTranslation } from "@localization";

const ListHeader = ({
  styles,
  dividerColor,
  distanceUnit = "m",
  onDistanceUnitPress,
}) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const headerTextColor =
    colorScheme === "dark" ? "#8f96b3" : theme.quietText ?? theme.text;

  return (
    <View style={[styles.runTableHeaderRow, { borderColor: dividerColor }]}>
      <View style={[styles.runTableHeaderCell, styles.runSetColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          {t("run.table.set")}
        </ThemedText>
      </View>

      <TouchableOpacity
        activeOpacity={0.78}
        onPress={onDistanceUnitPress}
        style={[styles.runTableHeaderCell, styles.runDistanceColumn]}
      >
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          {t("run.stats.distShort")}
        </ThemedText>
        <ThemedText style={styles.runTableHeaderUnit} setColor={headerTextColor}>
          {distanceUnit}
        </ThemedText>
      </TouchableOpacity>

      <View style={[styles.runTableHeaderCell, styles.runPaceColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          {t("run.stats.pace")}
        </ThemedText>
        <ThemedText style={styles.runTableHeaderUnit} setColor={headerTextColor}>
          {t("run.units.minPerKm")}
        </ThemedText>
      </View>

      <View style={[styles.runTableHeaderCell, styles.runTimeColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          {t("run.stats.time")}
        </ThemedText>
        <ThemedText style={styles.runTableHeaderUnit} setColor={headerTextColor}>
          {t("run.units.min")}
        </ThemedText>
      </View>

      <View style={[styles.runTableHeaderCell, styles.runZoneColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          {t("run.stats.zone")}
        </ThemedText>
        <ThemedText style={styles.runTableHeaderUnit} setColor={headerTextColor}>
          {t("run.units.bpmPerZone")}
        </ThemedText>
      </View>

      <View style={[styles.runTableHeaderCell, styles.runDoneColumn]}>
        <Checkmark width={12} height={12} color={headerTextColor} thickness={2.2} />
      </View>
    </View>
  );
};

export default ListHeader;
