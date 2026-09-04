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
    paddingTop: 6,
    paddingBottom: 0,
  },
  todayUnderline: {
    width: 16,
    height: 2,
    borderRadius: 1,
    marginTop: 4,
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  dayNumberToday: {
    fontWeight: "900",
  },
  dotMarker: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginVertical: 2.5,
  },
});
