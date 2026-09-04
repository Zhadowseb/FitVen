// src/Resources/Components/ThemedTextInput.js
import { TextInput, View, StyleSheet, useColorScheme } from "react-native";
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
            suffix ? styles.inputWithSuffix : null,
            inputStyle,
          ]}
          {...props}
        />

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
