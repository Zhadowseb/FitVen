import { StyleSheet } from "react-native";

export default StyleSheet.create({
  divided: {
    borderTopWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  id: {
    width: 26,
    paddingTop: 2,
    fontSize: 10.5,
    fontWeight: "800",
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: "800",
  },
  note: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  status: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  valueBox: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  value: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  toggle: {
    width: 12,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  extra: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
