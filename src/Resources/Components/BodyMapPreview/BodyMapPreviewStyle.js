import { StyleSheet } from "react-native";

export default StyleSheet.create({
  fullFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
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
  upperCropFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "200%",
  },
});
