import { Image, View } from "react-native";
import { LocalSvg } from "react-native-svg/css";

import FrontBodyMapRegionOverlay from "./FrontBodyMapRegionOverlay";
import styles from "./BodyMapPreviewStyle";

const frontBodyImage = require("../../BodyMap/Front/Front_body_compressed.png");
const frontMuscleMasksSvg = require(
  "../../BodyMap/Front/Muscle_masks/Front_muscle_masks.svg"
);

export default function BodyMapPreview({
  crop = "full",
  masksHighlighted = false,
  primaryRegionKeys = [],
  secondaryRegionKeys = [],
  style,
}) {
  const isUpperCrop = crop === "upper";
  const frameStyle = isUpperCrop
    ? styles.upperCropFrame
    : styles.fullFrame;
  const frameHeight = isUpperCrop ? "200%" : "100%";

  return (
    <View
      style={[
        styles.container,
        isUpperCrop && styles.upperCropContainer,
        style,
      ]}
    >
      <Image
        source={frontBodyImage}
        resizeMode="stretch"
        style={frameStyle}
      />
      <FrontBodyMapRegionOverlay
        height={frameHeight}
        primaryRegionKeys={primaryRegionKeys}
        secondaryRegionKeys={secondaryRegionKeys}
        style={frameStyle}
      />
      {masksHighlighted ? (
        <LocalSvg
          asset={frontMuscleMasksSvg}
          width="100%"
          height={frameHeight}
          style={frameStyle}
        />
      ) : null}
    </View>
  );
}
