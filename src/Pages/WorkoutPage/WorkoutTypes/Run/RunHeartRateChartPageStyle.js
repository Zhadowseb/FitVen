import { StyleSheet } from "react-native";

export default StyleSheet.create({
  screen: {
    width: "100%",
    height: "100%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  heading: {
    flex: 1,
    minWidth: 0,
  },

  eyebrow: {
    marginBottom: 1,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
  },

  legend: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  legendZoneLine: {
    width: 18,
    height: 2,
    flexDirection: "row",
  },

  legendZoneSegment: {
    flex: 1,
    height: 2,
  },

  legendLineThin: {
    width: 18,
    height: 1,
  },

  legendLabel: {
    fontSize: 7,
    lineHeight: 9,
    fontWeight: "800",
  },

  summary: {
    minWidth: 72,
    alignItems: "flex-end",
  },

  summaryValue: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "900",
  },

  summaryLabel: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
  },

  chartShell: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
});
