import { StyleSheet } from "react-native";

export default StyleSheet.create({
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    height: 18,
    borderRadius: 5,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  sender: {
    fontSize: 11,
    fontWeight: "800",
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  age: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  message: {
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  meta: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 5,
    marginTop: 8,
  },
  statusChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "800",
  },
});
