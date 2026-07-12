// src/Resources/Components/ThemedButton.js
import { Pressable, StyleSheet } from "react-native";
import { useColorScheme } from "react-native";
import { Colors } from "../GlobalStyling/colors";
import ThemedText from "./ThemedText";

const ThemedButton = ({
  title,
  textSize,
  onPress,
  style,

  variant = "primary", // primary | secondary | danger
  disabled = false, 

  width,
  height = 48,
  fullWidth = false,
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
        secondary: {
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
                ? theme.inkOnSecondary ?? theme.textInverted ?? "#0C1410"
                : theme.textInverted ?? "#14100C",
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
