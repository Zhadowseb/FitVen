import { StyleSheet, View } from "react-native";
import { LocalSvg } from "react-native-svg/css";

import styles from "./BodyMapPreviewStyle";

const frontBodySvg = require("../../BodyMap/Front/Front_body.svg");
const frontBodyMasksSvg = require("../../BodyMap/Front/Muscle_masks/Front_body_masks.svg");

export default function BodyMapPreview({
  crop = "full",
  masksHighlighted,
  style,
}) {
  const shouldShowMasks = Boolean(masksHighlighted);
  const frontBodyAsset = shouldShowMasks ? frontBodyMasksSvg : frontBodySvg;
  const isUpperCrop = crop === "upper";
  const svgFrameStyle = isUpperCrop
    ? styles.upperCropSvgFrame
    : StyleSheet.absoluteFill;
  const svgFrameHeight = isUpperCrop ? "200%" : "100%";

  return (
    <View
      style={[
        styles.container,
        isUpperCrop && styles.upperCropContainer,
        style,
      ]}
    >
      <LocalSvg
        asset={frontBodyAsset}
        width="100%"
        height={svgFrameHeight}
        style={svgFrameStyle}
      />
    </View>
  );
}
