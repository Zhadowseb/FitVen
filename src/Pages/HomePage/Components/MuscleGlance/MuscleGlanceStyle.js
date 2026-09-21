import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    marginTop: 22,
    marginHorizontal: 20,
    flexDirection: "column",
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  headline: {
    flexShrink: 0,
    fontSize: 11.5,
    fontWeight: "800",
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
  },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 6,
  },
  value: {
    fontSize: 10.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  track: {
    width: "100%",
    height: 38,
    borderRadius: 6,
    overflow: "hidden",
    // The bar grows upwards, which is the direction the number means.
    justifyContent: "flex-end",
  },
  fill: {
    width: "100%",
    borderRadius: 6,
  },
  name: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
