import { createContext, useContext } from "react";
import { StyleSheet, View } from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from "react-native-keyboard-controller";

// Kept as an empty shim so ThemedTextInput and ThemedEditableCell can keep
// calling requestScrollToInput while the library owns the scrolling.
const KeyboardProtectionContext = createContext({
  requestScrollToInput: () => {},
});

export const useThemedKeyboardProtection = () =>
  useContext(KeyboardProtectionContext);

const CONTEXT_VALUE = { requestScrollToInput: () => {} };

const ThemedKeyboardProtection = ({
  children,
  scroll = false,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  scrollViewProps,
  style,
  bottomOffset = 24,
  footer = null,
}) => {
  const scrollProps = scrollViewProps ?? {};

  const body = scroll ? (
    <KeyboardAwareScrollView
      {...scrollProps}
      bottomOffset={bottomOffset}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={[
        styles.scrollContent,
        scrollProps.contentContainerStyle,
        contentContainerStyle,
      ]}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    children
  );

  // Without a footer the scroll view handles the keyboard on its own; the
  // avoiding view is only needed to lift pinned buttons.
  if (!footer) {
    return (
      <KeyboardProtectionContext.Provider value={CONTEXT_VALUE}>
        <View style={[styles.container, style]}>{body}</View>
      </KeyboardProtectionContext.Provider>
    );
  }

  return (
    <KeyboardProtectionContext.Provider value={CONTEXT_VALUE}>
      <KeyboardAvoidingView
        style={[styles.container, style]}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {body}
        {footer}
      </KeyboardAvoidingView>
    </KeyboardProtectionContext.Provider>
  );
};

export default ThemedKeyboardProtection;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
});
