import { Image, View } from "react-native";
import { LocalSvg } from "react-native-svg/css";

import BackBodyMapRegionOverlay from "./BackBodyMapRegionOverlay";
import FrontBodyMapRegionOverlay from "./FrontBodyMapRegionOverlay";
import styles from "./BodyMapPreviewStyle";

const backBodyImage = require("../../BodyMap/Back/Back_body_compressed.png");
const frontBodyImage = require("../../BodyMap/Front/Front_body_compressed.png");
const frontMuscleMasksSvg = require(
  "../../BodyMap/Front/Muscle_masks/Front_muscle_masks.svg"
);

export default function BodyMapPreview({
  bodyView = "front",
  crop = "full",
  masksHighlighted = false,
  primaryRegionKeys = [],
  secondaryRegionKeys = [],
  style,
}) {
  const isBackView = bodyView === "back";
  const isUpperCrop = crop === "upper";
  const isLowerCrop = crop === "lower";
  const isCropped = isUpperCrop || isLowerCrop;
  const frameStyle = isLowerCrop
    ? styles.lowerCropFrame
    : isUpperCrop
      ? styles.upperCropFrame
      : styles.fullFrame;
  const frameHeight = isCropped ? "200%" : "100%";
  const bodyImage = isBackView ? backBodyImage : frontBodyImage;

  return (
    <View
      style={[
        styles.container,
        isBackView && styles.backContainer,
        isCropped && styles.upperCropContainer,
        isBackView && isCropped && styles.backUpperCropContainer,
        style,
      ]}
    >
      <Image
        source={bodyImage}
        resizeMode="stretch"
        style={frameStyle}
      />
      {!isBackView ? (
        <FrontBodyMapRegionOverlay
          height={frameHeight}
          primaryRegionKeys={primaryRegionKeys}
          secondaryRegionKeys={secondaryRegionKeys}
          style={frameStyle}
        />
      ) : (
        <BackBodyMapRegionOverlay
          height={frameHeight}
          primaryRegionKeys={primaryRegionKeys}
          secondaryRegionKeys={secondaryRegionKeys}
          style={frameStyle}
        />
      )}
      {!isBackView && masksHighlighted ? (
        <LocalSvg
          asset={frontMuscleMasksSvg}
          width="100%"
          height={frameHeight}
          preserveAspectRatio="none"
          style={frameStyle}
        />
      ) : null}
    </View>
  );
}
