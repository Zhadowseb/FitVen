import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LocalSvg } from "react-native-svg/css";

import styles from "./BodyMapPreviewStyle";

const frontBodySvg = require("../../../../Resources/Images/BodyMap/Front_body.svg");

const BODY_VIEW_BOX = "0 0 503 1294";
const PEC_PATHS = [
  {
    key: "right_pec",
    d: "M340.356 357.158C329.156 361.958 308.023 361.825 298.856 361.158C298.356 360.991 290.615 359.113 286.856 357.658C271.356 351.658 268.99 348.05 267.356 346.158C257.856 335.158 256.856 326.658 255.856 320.158L256.356 277.658C256.356 274.658 256.856 260.058 264.856 253.658C274.856 245.658 279.356 246.158 283.356 245.658C287.447 245.147 308.702 243.529 317.356 244.658C331.87 246.551 338.856 255.075 341.356 257.158C343.426 258.883 353.356 271.158 356.856 275.158C362.681 281.815 375.51 300.658 374.856 309.158C373.75 323.538 366.189 336.158 362.356 340.658C359.689 344.158 351.556 352.358 340.356 357.158Z",
  },
  {
    key: "left_pec",
    d: "M211.356 359.158C205.756 361.158 189.689 361.991 182.356 362.158C166.856 361.158 163.856 359.158 153.856 353.158C145.856 348.358 138.523 336.825 135.856 331.658C129.92 320.158 125.119 308.658 132.356 297.658C144.856 278.658 147.356 276.658 157.856 263.158C168.356 249.658 172.356 250.658 177.356 247.158C181.356 244.358 197.023 243.991 204.356 244.158C211.189 244.325 226.356 245.558 232.356 249.158C239.856 253.658 246.356 269.158 247.856 278.158C249.356 287.158 248.356 317.158 247.856 323.658C247.356 330.158 241.856 344.658 233.856 349.658C225.856 354.658 218.356 356.658 211.356 359.158Z",
  },
];

export default function BodyMapPreview({
  pecsHighlighted,
  highlightColor = "#60DAAC",
}) {
  const pecFill = pecsHighlighted ? highlightColor : "transparent";
  const pecOpacity = pecsHighlighted ? 0.72 : 0;

  return (
    <View style={styles.container}>
      <LocalSvg
        asset={frontBodySvg}
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
      />

      <Svg
        pointerEvents="none"
        viewBox={BODY_VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
      >
        {PEC_PATHS.map((path) => (
          <Path
            key={path.key}
            d={path.d}
            fill={pecFill}
            fillOpacity={pecOpacity}
          />
        ))}
      </Svg>
    </View>
  );
}
