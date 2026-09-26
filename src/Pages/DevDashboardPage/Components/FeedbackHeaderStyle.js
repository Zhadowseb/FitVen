import { StyleSheet } from "react-native";

export default StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 26,
    marginBottom: 10,
  },
  left: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  right: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  title: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  unreadBadge: {
    height: 18,
    minWidth: 18,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  timing: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  total: {
    flexShrink: 0,
    fontSize: 11.5,
    fontWeight: "800",
  },
});
