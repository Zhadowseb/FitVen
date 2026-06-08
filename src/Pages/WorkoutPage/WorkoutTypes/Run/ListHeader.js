import { View } from "react-native";
import { useColorScheme } from "react-native";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";
import { ThemedText } from "../../../../Resources/ThemedComponents";

const ListHeader = ({ styles, dividerColor }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const headerTextColor =
    colorScheme === "dark" ? "#8f96b3" : theme.quietText ?? theme.text;

  return (
    <View style={[styles.runTableHeaderRow, { borderColor: dividerColor }]}>
      <View style={[styles.runTableHeaderCell, styles.runSetColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          SET
        </ThemedText>
      </View>

      <View style={[styles.runTableHeaderCell, styles.runDistanceColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          DIST
        </ThemedText>
        <ThemedText style={styles.runTableHeaderUnit} setColor={headerTextColor}>
          km
        </ThemedText>
      </View>

      <View style={[styles.runTableHeaderCell, styles.runPaceColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          PACE
        </ThemedText>
        <ThemedText style={styles.runTableHeaderUnit} setColor={headerTextColor}>
          min/km
        </ThemedText>
      </View>

      <View style={[styles.runTableHeaderCell, styles.runTimeColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          TIME
        </ThemedText>
        <ThemedText style={styles.runTableHeaderUnit} setColor={headerTextColor}>
          min
        </ThemedText>
      </View>

      <View style={[styles.runTableHeaderCell, styles.runZoneColumn]}>
        <ThemedText style={styles.runTableHeaderLabel} setColor={headerTextColor}>
          ZONE
        </ThemedText>
        <ThemedText style={styles.runTableHeaderUnit} setColor={headerTextColor}>
          bpm/zone
        </ThemedText>
      </View>

      <View style={[styles.runTableHeaderCell, styles.runDoneColumn]}>
        <Checkmark width={12} height={12} color={headerTextColor} thickness={2.2} />
      </View>
    </View>
  );
};

export default ListHeader;
