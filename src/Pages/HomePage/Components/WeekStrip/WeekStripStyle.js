import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    marginTop: 16,
    marginHorizontal: 20,
    flexDirection: "row",
    gap: 6,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 9,
    paddingBottom: 8,
    borderRadius: 13,
  },
  todayCell: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  weekdayLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  dotMarker: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginVertical: 2.5,
  },
});
