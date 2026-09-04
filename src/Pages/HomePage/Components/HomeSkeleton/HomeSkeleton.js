import { StyleSheet, View, useColorScheme } from "react-native";

import { Colors } from "../../../../Resources/GlobalStyling/colors";

// Placeholder shapes while the first load runs, so the week strip and today's
// card do not sit empty with no explanation.
export default function HomeSkeleton() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const blockColor =
    colorScheme === "light" ? "rgba(15,17,22,0.06)" : "rgba(255,255,255,0.06)";

  return (
    <View>
      <View style={styles.weekRow}>
        {Array.from({ length: 7 }).map((_, index) => (
          <View key={index} style={styles.weekCell}>
            <View style={[styles.weekLabel, { backgroundColor: blockColor }]} />
            <View style={[styles.weekNumber, { backgroundColor: blockColor }]} />
          </View>
        ))}
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={[styles.cardImage, { backgroundColor: blockColor }]} />
        <View style={styles.cardBody}>
          <View style={[styles.cardTitle, { backgroundColor: blockColor }]} />
          <View style={[styles.cardMeta, { backgroundColor: blockColor }]} />
          <View style={[styles.cardButton, { backgroundColor: blockColor }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: {
    marginTop: 16,
    marginHorizontal: 20,
    flexDirection: "row",
    gap: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingTop: 6,
  },
  weekLabel: {
    width: 18,
    height: 7,
    borderRadius: 4,
  },
  weekNumber: {
    width: 14,
    height: 11,
    borderRadius: 2,
  },
  card: {
    marginTop: 14,
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardImage: {
    height: 112,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  cardTitle: {
    width: "58%",
    height: 18,
    borderRadius: 6,
  },
  cardMeta: {
    width: "38%",
    height: 11,
    borderRadius: 5,
  },
  cardButton: {
    marginTop: 4,
    height: 42,
    borderRadius: 14,
  },
});
