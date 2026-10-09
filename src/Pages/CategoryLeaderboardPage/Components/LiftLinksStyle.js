import { StyleSheet } from "react-native";

// Layout only: three buttons, 40 high, side by side.
export default StyleSheet.create({
  block: {
    marginTop: 18,
    gap: 8,
  },
  overline: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  buttons: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: "800",
  },
});
