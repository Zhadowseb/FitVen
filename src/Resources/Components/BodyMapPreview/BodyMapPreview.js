import { Image, View, useColorScheme } from "react-native";
import { LocalSvg } from "react-native-svg/css";

import { Colors } from "../../GlobalStyling/colors";

import BackBodyMapRegionOverlay from "./BackBodyMapRegionOverlay";
import FrontBodyMapRegionOverlay from "./FrontBodyMapRegionOverlay";
import styles from "./BodyMapPreviewStyle";

const backBodyImage = require("../../BodyMap/Back/Back_body_compressed.png");
const frontBodyImage = require("../../BodyMap/Front/Front_body_compressed.png");
const frontMuscleMasksSvg = require(
  "../../BodyMap/Front/MuscleMasks/Front_muscle_masks.svg"
);

export default function BodyMapPreview({
  bodyView = "front",
  crop = "full",
  masksHighlighted = false,
  primaryRegionKeys = [],
  secondaryRegionKeys = [],
  style,
}) {
  // The body is drawn the way the muscle map draws it: the artwork tinted
  // down to a quiet silhouette, so the only thing with colour is the muscle
  // the exercise works. Without the tint the same PNG reads as orange line
  // art, which is what made a row look nothing like the map above it.
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
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
        style={[frameStyle, { tintColor: theme.quietText, opacity: 0.3 }]}
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
