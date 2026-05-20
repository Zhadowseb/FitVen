import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    width: "58%",
    maxWidth: 210,
    aspectRatio: 503 / 1294,
    alignSelf: "center",
    position: "relative",
    overflow: "hidden",
  },
  upperCropContainer: {
    aspectRatio: 503 / 647,
  },
  upperCropSvgFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "200%",
  },
});
