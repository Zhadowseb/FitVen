import { StyleSheet } from "react-native";

// Layout only; every colour is applied inline from the theme.
export default StyleSheet.create({
  box: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  label: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  itemIcon: {
    marginTop: 1,
  },
  itemText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
  },
  // Under the last item, in line with its text rather than its icon.
  note: {
    paddingLeft: 24,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  nudge: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
