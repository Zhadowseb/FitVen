import { createContext, useContext, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from "react-native-keyboard-controller";

import { setEditorBar } from "@utils/setEditorBar";

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
  const scrollRef = useRef(null);
  const ownScrollEnabled = scrollProps.scrollEnabled !== false;

  // A finger dragging the reps carousel over the keyboard turns this page's
  // scrolling off - straight on the native scroll view, not through a render.
  // A render of the whole page takes longer than the first few millimetres of
  // a drag, and by then the scroll view had taken the touch from the carousel
  // (Android cancels the child's gesture when a parent scroller intercepts).
  useEffect(() => {
    if (!scroll) {
      return undefined;
    }

    const apply = () =>
      scrollRef.current?.setNativeProps?.({
        scrollEnabled: ownScrollEnabled && !setEditorBar.isDragging(),
      });

    return setEditorBar.subscribe(apply);
  }, [scroll, ownScrollEnabled]);

  const body = scroll ? (
    <KeyboardAwareScrollView
      {...scrollProps}
      ref={scrollRef}
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
