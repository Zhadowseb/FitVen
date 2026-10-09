import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the component.
export default StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  meta: {
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 14,
  },
  profileButton: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  profileButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
