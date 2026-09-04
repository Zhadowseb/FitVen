import React from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { Svg, Circle } from "react-native-svg";
import { Colors } from "../GlobalStyling/colors";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const CircularProgress = ({
  size = 110,
  strokeWidth = 12,
  text,
  label,
  caption,
  textSize,
  progressPercent = 0,
  bgColor,
  pgColor,
  centerColor,
  style,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const progress = clamp(
    Number.isFinite(progressPercent) ? progressPercent : 0,
    0,
    100
  );
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress / 100);
  const centerSize = Math.max(size - strokeWidth * 2.8, 0);

  return (
    <View style={[styles.wrapper, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Circle
          stroke={bgColor ?? theme.uiBackground ?? theme.background}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />

        <Circle
          stroke={pgColor ?? theme.secondary}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
          strokeWidth={strokeWidth}
        />
      </Svg>

      <View
        style={[
          styles.centerSurface,
          {
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
            backgroundColor: centerColor ?? theme.cardBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        {label ? (
          <Text style={[styles.label, { color: theme.quietText ?? theme.text }]}>
            {label}
          </Text>
        ) : null}

        <Text
          style={[
            styles.value,
            {
              color: theme.title ?? theme.text,
              fontSize: textSize ?? 20,
            },
          ]}
        >
          {text}
        </Text>

        {caption ? (
          <Text
            style={[
              styles.caption,
              { color: theme.quietText ?? theme.text },
            ]}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default CircularProgress;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  centerSurface: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },

  value: {
    fontWeight: "800",
    letterSpacing: 0.2,
    fontVariant: ["tabular-nums"],
  },

  caption: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});
