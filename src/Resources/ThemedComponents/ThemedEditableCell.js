import { Pressable, TextInput, StyleSheet } from "react-native";
import { useColorScheme } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Colors } from "../GlobalStyling/colors";
import ThemedText from "./ThemedText";
import { useThemedKeyboardProtection } from "./ThemedKeyboardProtection";

const ThemedEditableCell = ({
  value,
  onCommit,
  keyboardType = "numeric",
  suffix = "",
  suffixFormatter,
  displayFormatter,
  showSuffixWhenEmpty = false,
  textAlign = "center",
  placeholder = "",
  placeholderTextColor,
  onFocus,
  onBlur,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { requestScrollToInput } = useThemedKeyboardProtection();

  const inputRef = useRef(null);
  const [localValue, setLocalValue] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const displayValue =
    focused || !displayFormatter
      ? localValue ?? ""
      : displayFormatter(localValue ?? "");
  const hasCustomPlaceholder =
    !focused && !displayValue && Boolean(placeholder);

  const displaySuffix =
    suffixFormatter
      ? suffixFormatter(localValue ?? "")
      : suffix;

  const hasDisplayValue =
    localValue !== "" && localValue !== null && localValue !== undefined;
  const shouldShowSuffix =
    !focused && Boolean(displaySuffix) && (showSuffixWhenEmpty || hasDisplayValue);

  return (
    <Pressable
      style={styles.wrapper}
      onPress={() => inputRef.current?.focus()}
    >
      <TextInput
        ref={inputRef}
        value={displayValue ?? ""}
        onFocus={(event) => {
          setFocused(true);
          requestScrollToInput(inputRef.current);
          onFocus?.(event);
        }}
        onBlur={() => {
          setFocused(false);
          if (localValue !== value) {
            onCommit?.(localValue);
          }
          onBlur?.();
        }}
        onChangeText={setLocalValue}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: theme.text,
            textAlign,
          },
        ]}
        selectionColor={theme.primary}
      />

      {hasCustomPlaceholder && (
        <ThemedText
          pointerEvents="none"
          setColor={
            placeholderTextColor ??
            theme.quietText ??
            theme.iconColor ??
            theme.text
          }
          style={[
            styles.placeholder,
            {
              textAlign,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {placeholder}
        </ThemedText>
      )}

      {shouldShowSuffix && (
        <ThemedText
          style={[
            styles.suffix,
            { color: theme.text },
          ]}
        >
          {displaySuffix}
        </ThemedText>
      )}
    </Pressable>
  );

};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: "100%",
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flexShrink: 1,
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    fontSize: 14,
    fontWeight: "500",
    minWidth: 20,
  },
  placeholder: {
    position: "absolute",
    left: 0,
    right: 0,
    fontSize: 14,
    fontWeight: "500",
  },
  suffix: {
    fontSize: 8,
    marginLeft: 2,
  },
});

export default ThemedEditableCell;
