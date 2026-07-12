import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 11,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 14.5,
    fontWeight: "800",
  },
  weekChip: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  weekChipText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  progressBlock: {
    gap: 6,
  },
  progressFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressFooterText: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 10.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
