import { StyleSheet } from "react-native";

// Layout only. The fill, the shadow's colour, the ink and the light all come
// from the component body (src/Pages/AGENTS.md).
export const SHINE_WIDTH = 46;
// How far the light reaches past the top and bottom, so its slanted ends are
// never seen inside the button.
export const SHINE_OVERHANG = 10;
export const SHINE_SKEW_DEG = 18;

export default StyleSheet.create({
  // Two views, because iOS draws no shadow outside a view that hides its
  // overflow. This one carries the fill and the shadow - Android's elevation
  // needs the fill on the same view - and the one inside it clips the light.
  button: {
    flex: 1,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 6,
  },
  surface: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    paddingVertical: 12,
    paddingHorizontal: 13,
    justifyContent: "space-between",
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15.5,
    fontWeight: "800",
    lineHeight: 19,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: "700",
  },
  shine: {
    position: "absolute",
    top: -SHINE_OVERHANG,
    bottom: -SHINE_OVERHANG,
    left: 0,
    width: SHINE_WIDTH,
  },
});
