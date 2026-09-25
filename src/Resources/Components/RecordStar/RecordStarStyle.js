import { StyleSheet } from "react-native";

// Colours are set in RecordStar, never here: applyAccentTheme() mutates
// Colors at runtime and StyleSheet.create only runs once.
export default StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  ring: {
    position: "absolute",
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderWidth: 1.5,
  },
  spark: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 7,
    height: 7,
    marginLeft: -3.5,
    marginTop: -3.5,
  },
});
