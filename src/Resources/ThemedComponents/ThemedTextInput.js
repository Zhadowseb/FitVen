// src/Resources/Components/ThemedTextInput.js
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useRef } from "react";
import { Colors } from "../GlobalStyling/colors";
import ThemedText from "./ThemedText";
import { useThemedKeyboardProtection } from "./ThemedKeyboardProtection";

const ThemedTextInput = ({
  value,
  onChangeText,
  placeholder,
  style,
  inputStyle,
  error,
  onFocus,
  innerRef,
  suffix = null, // unit shown inside the field, right of the value
  // A control inside the field, right of the value: { icon, onPress, label }.
  // Separate from `suffix` because that one is pointerEvents="none" on purpose -
  // a unit is not something you tap, and making it tappable would swallow taps
  // meant to focus the field.
  action = null,
  ...props
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const inputRef = useRef(null);
  const { requestScrollToInput } = useThemedKeyboardProtection();

  return (
    <View style={style}>
      <View style={styles.inputWrap}>
        <TextInput
          ref={(node) => {
            inputRef.current = node;

            if (innerRef) {
              innerRef.current = node;
            }
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.iconColor}
          onFocus={(event) => {
            requestScrollToInput(inputRef.current);
            onFocus?.(event);
          }}
          style={[
            styles.input,
            {
              backgroundColor: theme.uiBackground,
              color: theme.text,
              borderColor: error ? theme.danger : theme.cardBorder,
            },
            suffix || action ? styles.inputWithSuffix : null,
            inputStyle,
          ]}
          {...props}
        />

        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            // The icon is 20 px; the slot is the whole height of the field so
            // the tap target clears 44 px without the icon growing.
            style={styles.actionSlot}
            hitSlop={8}
          >
            {action.icon}
          </Pressable>
        ) : null}

        {suffix ? (
          // The wrapper only holds the field, so justifyContent centres this
          // against the field itself and not against the error line below it.
          <View pointerEvents="none" style={styles.suffixSlot}>
            <ThemedText
              style={[styles.suffix, { color: theme.iconColor }]}
              numberOfLines={1}
            >
              {suffix}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {error && (
        <ThemedText style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      )}
    </View>
  );
};

export default ThemedTextInput;

const styles = StyleSheet.create({
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },

  suffixSlot: {
    position: "absolute",
    right: 14,
  },

  actionSlot: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
  },

  suffix: {
    fontSize: 13,
    fontWeight: "700",
  },

  inputWithSuffix: {
    paddingRight: 46,
  },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  error: {
    marginTop: 6,
    fontSize: 12,
  },
});
