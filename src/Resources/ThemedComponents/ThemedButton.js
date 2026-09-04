// src/Resources/Components/ThemedButton.js
import { Pressable, StyleSheet } from "react-native";
import { useColorScheme } from "react-native";
import { Colors, withAlpha } from "../GlobalStyling/colors";
import ThemedText from "./ThemedText";

const ThemedButton = ({
  title,
  textSize,
  onPress,
  style,

  variant = "primary", // primary | secondary | success | danger
  disabled = false, 

  width,
  height = 48,
  fullWidth = false,
  ...props
}) => {


    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme] ?? Colors.light;

    const variants = {
        primary: {
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 6,
        },
        // A Cancel or Close must not outshine the action beside it, so the
        // secondary button is an outline. The filled colour field it used to
        // be now lives in "success", for the few places that want it.
        secondary: {
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: withAlpha(theme.title, 0.28),
        },
        success: {
            backgroundColor: theme.secondary,
            borderWidth: 1,
            borderColor: theme.border,
        },
        danger: {
            backgroundColor: theme.danger,
        },
    };

    const layoutStyle = {
    ...(fullWidth && { width: "100%" }),
    ...(width && { width, alignSelf: "center" }),
    ...(height && { height }),
    };

  return (
    <Pressable
      accessibilityRole="button"
      // Spread first, so onPress, disabled and style below cannot be
      // overwritten by accident; everything else - accessibilityLabel,
      // testID, onLongPress - now reaches Pressable.
      {...props}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        layoutStyle,
        variants[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <ThemedText
        style={[
          styles.text,
          {
            color:
              variant === "secondary"
                ? theme.title
                : variant === "success"
                  ? theme.inkOnSecondary
                  : theme.textInverted,
          },
        ]}
        size={textSize ? textSize : 14}>

        {title}
      </ThemedText>
    </Pressable>
  );
};

export default ThemedButton;

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  text: {
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.85,
  },

  disabled: {
    opacity: 0.4,
  },
});
