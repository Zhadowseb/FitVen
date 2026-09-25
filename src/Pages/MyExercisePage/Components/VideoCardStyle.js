import { StyleSheet } from "react-native";

// Layout only; every colour is applied inline, and the ones over the picture
// come from the dark palette in the component.
export default StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  poster: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  play: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    // The triangle's weight sits left of its box; this centres it by eye.
    paddingLeft: 2,
  },
  duration: {
    position: "absolute",
    right: 7,
    bottom: 5,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  length: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  caption: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  locked: {
    opacity: 0.5,
  },
  addTile: {
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  addTitle: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  addHint: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  busyText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  error: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
