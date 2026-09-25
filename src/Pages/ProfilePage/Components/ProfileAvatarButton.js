import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import { Colors } from "@resources/GlobalStyling/colors";
import CameraPlus from "@resources/Icons/UI-icons/CameraPlus";
import { UserAvatar } from "@resources/ThemedComponents";

const RING_WIDTH = 2.5;
const RING_PADDING = 4;

// Your photo in the accent ring, with the camera badge that says it can be
// changed. One press target for both, on Profile (92) and Edit profile (108):
// either one opens the photo library straight away. While a photo uploads the
// badge turns into a spinner and the button stops taking presses.
export default function ProfileAvatarButton({
  uri,
  size,
  badgeSize,
  badgeIconSize,
  isUploading = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const avatarSize = size - 2 * (RING_WIDTH + RING_PADDING);
  const isInactive = disabled || isUploading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isInactive, busy: isUploading }}
      disabled={isInactive}
      onPress={onPress}
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: theme.primary,
        },
      ]}
    >
      <UserAvatar
        uri={uri}
        size={avatarSize}
        iconSize={Math.round(avatarSize * 0.45)}
        iconColor={theme.text}
        backgroundColor={theme.uiBackground}
      />

      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: theme.primary,
            borderColor: theme.background,
          },
        ]}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color={theme.textInverted} />
        ) : (
          <CameraPlus
            width={badgeIconSize}
            height={badgeIconSize}
            color={theme.textInverted}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: RING_WIDTH,
    padding: RING_PADDING,
    flexShrink: 0,
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
