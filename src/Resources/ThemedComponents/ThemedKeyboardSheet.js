import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useEffect, useState } from "react";

// The keyboard height as the sheet sees it. On Android the Modal's own Dialog
// window is created with SOFT_INPUT_ADJUST_RESIZE and already shrinks, so
// compensating again would double count; there we only report the height so
// callers can size themselves, and leave the lifting to the window.
//
// Uses React Native's own Keyboard events on purpose: the library's
// useKeyboardHandler runs its callbacks as worklets on the UI thread, and a
// React state setter cannot be called from there.
export function useSheetKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setHeight(event?.endCoordinates?.height ?? 0);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return height;
}

/**
 * Keyboard-aware body for content inside a <Modal>. Must be rendered INSIDE the
 * modal — a KeyboardAvoidingView around a Modal has no effect.
 */
export default function ThemedKeyboardSheet({
  children,
  footer = null,
  scroll = true,
  bottomOffset = 24,
  style,
  contentContainerStyle,
}) {
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={
        Platform.OS === "ios" ? "interactive" : "on-drag"
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        { paddingBottom: bottomOffset },
        contentContainerStyle,
      ]}
      style={styles.scroll}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={contentContainerStyle}>{children}</View>
  );

  // No lifting here on purpose. The container (ThemedModal / ThemedBottomSheet)
  // moves itself clear of the keyboard using the measured height, which behaves
  // the same on both platforms. A KeyboardAvoidingView in here as well would
  // double compensate.
  return (
    <View style={[styles.container, style]}>
      {body}
      {footer}
    </View>
  );
}

/** Dismisses the keyboard before closing, so the sheet does not animate out
 *  while the keyboard is still collapsing. */
export function dismissThenClose(onClose) {
  return () => {
    Keyboard.dismiss();
    onClose?.();
  };
}

/** Height available to a sheet with the keyboard up. */
export function useAvailableSheetHeight() {
  const { height } = useWindowDimensions();
  const keyboardHeight = useSheetKeyboardHeight();

  return Math.max(160, height - keyboardHeight);
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
    minHeight: 0,
  },
  scroll: {
    flexShrink: 1,
    minHeight: 0,
  },
});
