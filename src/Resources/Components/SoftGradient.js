import { StyleSheet } from "react-native";
import { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import PassThroughSvg from "./PassThroughSvg";

// A diagonal wash from one colour to another behind a card's content - the
// Knowledge card on Explore and the featured article. `from` and `to` carry
// their own alpha (withAlpha); `id` keeps two on one screen apart. It is
// drawn through PassThroughSvg so a tap goes to the card, not to the wash.
export default function SoftGradient({ id, from, to }) {
  return (
    <PassThroughSvg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill={`url(#${id})`} />
    </PassThroughSvg>
  );
}
