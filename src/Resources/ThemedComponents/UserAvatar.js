import { useEffect, useState } from "react";
import { Image, StyleSheet, View, useColorScheme } from "react-native";

import { Colors } from "../GlobalStyling/colors";
import Male from "../Icons/UI-icons/Male";

export default function UserAvatar({
  uri,
  size = 64,
  iconSize,
  iconColor,
  backgroundColor,
  borderColor,
  borderWidth = 0,
  style,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedBackgroundColor =
    backgroundColor ??
    theme.fields ??
    theme.uiBackground ??
    theme.cardBackground ??
    theme.background;
  const resolvedIconColor = iconColor ?? theme.primary ?? theme.text;
  const resolvedIconSize = iconSize ?? Math.round(size * 0.42);
  const shouldShowImage = Boolean(uri) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: resolvedBackgroundColor,
          borderColor: borderColor ?? "transparent",
          borderWidth,
        },
        style,
      ]}
    >
      {shouldShowImage ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              borderRadius: size / 2,
            },
          ]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Male
          width={resolvedIconSize}
          height={resolvedIconSize}
          color={resolvedIconColor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
