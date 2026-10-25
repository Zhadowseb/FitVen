import { StyleSheet } from "react-native";

// Layout only; the bar's colours are set inline from the theme (a Style.js is
// read once, before the accent is applied - see src/Pages/AGENTS.md).
export default StyleSheet.create({
  bar: {
    marginTop: 14,
    marginHorizontal: 20,
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 0,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  placeholder: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  // The whole height of the bar, so the mic is as easy to hit as the rest.
  micTouch: {
    width: 50,
    minHeight: 44,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  micCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
