import { StyleSheet } from "react-native";

export default StyleSheet.create({
  card: {
    flex: 1,
    height: 168,
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  imageRadius: {
    borderRadius: 24,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 8, 12, 0.44)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 15, 18, 0.52)",
    borderColor: "rgba(255, 255, 255, 0.24)",
  },
  content: {
    gap: 10,
    alignItems: "flex-start",
  },
  title: {
    padding: 0,
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 26,
  },
  sideAccent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 4,
  },
  sideAccentLeft: {
    left: 0,
  },
  sideAccentRight: {
    right: 0,
  },
});
