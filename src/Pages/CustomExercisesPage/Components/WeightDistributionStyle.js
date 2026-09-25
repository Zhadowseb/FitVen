import { StyleSheet } from "react-native";

export const BAR_AREA_HEIGHT = 56;

// Layout only; colours come from `theme` in the component.
export default StyleSheet.create({
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  bars: {
    height: BAR_AREA_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
  },
  slot: {
    flex: 1,
    height: BAR_AREA_HEIGHT,
    justifyContent: "flex-end",
  },
  // Grows up from its foot.
  bar: {
    width: "100%",
    borderRadius: 4,
    transformOrigin: "bottom",
  },
  labels: {
    flexDirection: "row",
    gap: 5,
    marginTop: 6,
  },
  label: {
    flex: 1,
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 12,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  footnote: {
    marginTop: 10,
    fontSize: 10.5,
    fontWeight: "700",
    lineHeight: 15,
  },
});
