import { StyleSheet, View } from "react-native";
import Svg from "react-native-svg";

// "66" -> 66, "100%" stays: the sizes react-native-svg accepts, as a View takes them.
function toLayoutSize(value) {
  if (typeof value !== "string") {
    return value;
  }

  const parsed = parseInt(value, 10);

  return Number.isNaN(parsed) || value.endsWith("%") ? value : parsed;
}

// The box the Svg used to lay itself out as, by react-native-svg 15.12 rule.
export function passThroughBoxStyle(style, width, height) {
  const flat = StyleSheet.flatten(style) ?? {};
  let boxWidth = width ?? flat.width;
  let boxHeight = height ?? flat.height;

  if (boxWidth === undefined && boxHeight === undefined) {
    boxWidth = "100%";
    boxHeight = "100%";
  }

  if (!boxWidth || !boxHeight) {
    return style;
  }

  return [
    style,
    { width: toLayoutSize(boxWidth), height: toLayoutSize(boxHeight), flex: 0 },
  ];
}

/**
 * An `Svg` that never takes a touch: decoration drawn over or beside
 * something tappable (a ring around a button, a fade over a list, a glow).
 *
 * Why it exists: on iOS with the new architecture, react-native-svg's root
 * view overrides `hitTest:` and returns itself for any point inside its
 * bounds without ever reading `pointerEvents`, so `<Svg pointerEvents="none">`
 * swallows the tap meant for whatever is under it. Android honours the prop,
 * which is how the workout timer in the bottom bar worked on one phone and
 * did nothing on the other. A plain RN `View` does honour it, so the
 * positioning lives on a `View pointerEvents="none"` and the Svg fills it.
 *
 * Use it exactly like `Svg`. `style`, `width` and `height` describe the box
 * the same way they did on the Svg: explicit sizes win over the style, and
 * with neither the box fills its parent - react-native-svg's own rule,
 * repeated here so nothing moves. Percentages resolve against the parent,
 * as before, because they land on the wrapper and not on the Svg inside it.
 *
 * `npm test` (scripts/test-pass-through-svg.js) fails if an Svg in `src/` is
 * given `pointerEvents` directly again.
 */
export default function PassThroughSvg({ style, width, height, children, ...svgProps }) {
  return (
    <View pointerEvents="none" style={passThroughBoxStyle(style, width, height)}>
      <Svg {...svgProps} width="100%" height="100%">
        {children}
      </Svg>
    </View>
  );
}
