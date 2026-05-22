import { View } from "react-native";
import { LocalSvg } from "react-native-svg/css";

import styles from "./BackBodyMapRegionOverlayStyle";

const BODY_WIDTH = 489;
const BODY_HEIGHT = 1263;

const adductorLeftAsset = require(
  "../../BodyMap/Back/Muscle_masks/Adductors/back_adductor_magnus_left_leg.svg"
);
const adductorRightAsset = require(
  "../../BodyMap/Back/Muscle_masks/Adductors/back_adductor_magnus_right_leg.svg"
);
const calvesAsset = require(
  "../../BodyMap/Back/Muscle_masks/Calfs/Calfs.svg"
);
const glutesAsset = require(
  "../../BodyMap/Back/Muscle_masks/Glutes/Glutes.svg"
);
const hamstringsAsset = require(
  "../../BodyMap/Back/Muscle_masks/Hamstrings/Hamstrings.svg"
);
const infraspinatusLeftAsset = require(
  "../../BodyMap/Back/Muscle_masks/Infraspinatus/infraspinatus_left.svg"
);
const infraspinatusRightAsset = require(
  "../../BodyMap/Back/Muscle_masks/Infraspinatus/infraspinatus_right.svg"
);
const leftLatAsset = require(
  "../../BodyMap/Back/Muscle_masks/Lats/left_lat.svg"
);
const rightLatAsset = require(
  "../../BodyMap/Back/Muscle_masks/Lats/right_lat.svg"
);
const lowerBackAsset = require(
  "../../BodyMap/Back/Muscle_masks/Lower_back/Lower_back.svg"
);
const rearDeltLeftAsset = require(
  "../../BodyMap/Back/Muscle_masks/Rear_delts/rear_delt_left_arm.svg"
);
const rearDeltRightAsset = require(
  "../../BodyMap/Back/Muscle_masks/Rear_delts/rear_delt_right_arm.svg"
);
const sideDeltAsset = require(
  "../../BodyMap/Back/Muscle_masks/Side_delts/Side_delt.svg"
);
const teresMajorAsset = require(
  "../../BodyMap/Back/Muscle_masks/Teres_major/Teres_major.svg"
);
const teresMinorLeftAsset = require(
  "../../BodyMap/Back/Muscle_masks/Teres_minor/teres_minor_left.svg"
);
const teresMinorRightAsset = require(
  "../../BodyMap/Back/Muscle_masks/Teres_minor/teres_minor_right.svg"
);
const innerTricepLeftAsset = require(
  "../../BodyMap/Back/Muscle_masks/Triceps/inner_tricep_left_arm.svg"
);
const innerTricepRightAsset = require(
  "../../BodyMap/Back/Muscle_masks/Triceps/inner_tricep_right_arm.svg"
);
const outsideTricepLeftAsset = require(
  "../../BodyMap/Back/Muscle_masks/Triceps/outside_tricep_left_arm.svg"
);
const outsideTricepRightAsset = require(
  "../../BodyMap/Back/Muscle_masks/Triceps/outside_tricep_right_arm.svg"
);
const upperTrapsAsset = require(
  "../../BodyMap/Back/Muscle_masks/Upper_traps/upper_traps.svg"
);

const BACK_REGION_ASSETS = {
  adductors: [
    { asset: adductorLeftAsset, x: 193, y: 690, width: 35, height: 179 },
    { asset: adductorRightAsset, x: 261, y: 690, width: 37, height: 180 },
  ],
  calves: [
    { asset: calvesAsset, x: 111, y: 905, width: 268, height: 168 },
  ],
  glutes: [
    { asset: glutesAsset, x: 131, y: 541, width: 228, height: 161 },
  ],
  hamstrings: [
    { asset: hamstringsAsset, x: 129, y: 685, width: 231, height: 243 },
  ],
  infraspinatus: [
    {
      asset: infraspinatusLeftAsset,
      x: 152,
      y: 273,
      width: 52,
      height: 81,
    },
    {
      asset: infraspinatusRightAsset,
      x: 285,
      y: 273,
      width: 53,
      height: 82,
    },
  ],
  lats: [
    { asset: leftLatAsset, x: 126, y: 342, width: 96, height: 167 },
    { asset: rightLatAsset, x: 267, y: 337, width: 96, height: 172 },
  ],
  lower_back: [
    { asset: lowerBackAsset, x: 185, y: 394, width: 119, height: 234 },
  ],
  rear_delts: [
    { asset: rearDeltLeftAsset, x: 94, y: 224, width: 86, height: 78 },
    { asset: rearDeltRightAsset, x: 309, y: 224, width: 86, height: 80 },
  ],
  side_delts: [
    { asset: sideDeltAsset, x: 70, y: 224, width: 348, height: 102 },
  ],
  teres_major: [
    { asset: teresMajorAsset, x: 122, y: 313, width: 244, height: 38 },
  ],
  teres_minor: [
    { asset: teresMinorLeftAsset, x: 159, y: 305, width: 20, height: 18 },
    { asset: teresMinorRightAsset, x: 307, y: 306, width: 24, height: 16 },
  ],
  triceps: [
    { asset: innerTricepLeftAsset, x: 57, y: 335, width: 46, height: 152 },
    { asset: innerTricepRightAsset, x: 386, y: 335, width: 45, height: 148 },
    { asset: outsideTricepLeftAsset, x: 97, y: 326, width: 47, height: 96 },
    { asset: outsideTricepRightAsset, x: 342, y: 326, width: 49, height: 130 },
  ],
  upper_traps: [
    { asset: upperTrapsAsset, x: 136, y: 181, width: 217, height: 102 },
  ],
};

const DEFAULT_PRIMARY_OPACITY = 1;
const DEFAULT_SECONDARY_OPACITY = 0.74;

function normalizeRegionKey(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "_")
    : "";
}

function toPercent(value, total) {
  return `${(value / total) * 100}%`;
}

function getUniqueRegionKeys(regionKeys) {
  const seenKeys = new Set();

  return (regionKeys ?? []).reduce((keys, regionKey) => {
    const normalizedKey = normalizeRegionKey(regionKey);

    if (!normalizedKey || seenKeys.has(normalizedKey)) {
      return keys;
    }

    if (!BACK_REGION_ASSETS[normalizedKey]) {
      return keys;
    }

    seenKeys.add(normalizedKey);
    keys.push(normalizedKey);
    return keys;
  }, []);
}

function renderRegionAssets(regionKeys, { layer, opacity }) {
  return regionKeys.flatMap((regionKey) =>
    BACK_REGION_ASSETS[regionKey].map((placement, index) => (
      <View
        key={`${layer}-${regionKey}-${index}`}
        style={[
          styles.regionMaskFrame,
          {
            left: toPercent(placement.x, BODY_WIDTH),
            height: toPercent(placement.height, BODY_HEIGHT),
            opacity,
            top: toPercent(placement.y, BODY_HEIGHT),
            width: toPercent(placement.width, BODY_WIDTH),
          },
        ]}
      >
        <LocalSvg
          asset={placement.asset}
          height="100%"
          preserveAspectRatio="none"
          style={styles.regionMask}
          width="100%"
        />
      </View>
    ))
  );
}

export default function BackBodyMapRegionOverlay({
  primaryOpacity = DEFAULT_PRIMARY_OPACITY,
  primaryRegionKeys = [],
  secondaryOpacity = DEFAULT_SECONDARY_OPACITY,
  secondaryRegionKeys = [],
  style,
}) {
  const primaryKeys = getUniqueRegionKeys(primaryRegionKeys);
  const primaryKeySet = new Set(primaryKeys);
  const secondaryKeys = getUniqueRegionKeys(secondaryRegionKeys).filter(
    (regionKey) => !primaryKeySet.has(regionKey)
  );

  if (primaryKeys.length === 0 && secondaryKeys.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.overlay, style]}>
      {renderRegionAssets(secondaryKeys, {
        layer: "secondary",
        opacity: secondaryOpacity,
      })}
      {renderRegionAssets(primaryKeys, {
        layer: "primary",
        opacity: primaryOpacity,
      })}
    </View>
  );
}
