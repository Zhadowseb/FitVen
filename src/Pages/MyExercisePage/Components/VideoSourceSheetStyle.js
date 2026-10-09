import { StyleSheet } from "react-native";

// Layout only; every colour is applied inline from the theme.
export default StyleSheet.create({
  header: {
    paddingHorizontal: 4,
    paddingBottom: 14,
    gap: 4,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
  },
  option: {
    minHeight: 64,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  optionBody: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "600",
  },
});
