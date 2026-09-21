import React, { useRef, useEffect, useMemo } from "react";
import {
  Modal,
  Platform,
  View,
  StyleSheet,
  Pressable,
  useColorScheme,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../GlobalStyling/colors";
import ThemedSheetHandle from "./ThemedSheetHandle";
import ThemedKeyboardSheet, {
  dismissThenClose,
  useSheetKeyboardHeight,
} from "./ThemedKeyboardSheet";

// iOS drops a modal presented while another is still on screen, without an
// error, so anything that opens a second one has to wait for this sheet to be
// gone. Modal's own onDismiss cannot carry it: React Native only fires that on
// iOS, and this component returns null before the Modal when it closes, so the
// subtree unmounts rather than dismissing. The effect below watches the flag
// instead, which is true on both platforms, and waits out the fade on iOS.
const IOS_DISMISS_SETTLE_MS = 320;

const ThemedBottomSheet = ({
  visible,
  onClose,
  onDismiss,
  children,
  footer = null,
}) => {
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useSheetKeyboardHeight();

  const wasVisibleRef = useRef(visible);
  const onDismissRef = useRef(onDismiss);

  onDismissRef.current = onDismiss;

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;

    wasVisibleRef.current = visible;

    if (!wasVisible || visible) {
      return undefined;
    }

    const timer = setTimeout(
      () => onDismissRef.current?.(),
      Platform.OS === "ios" ? IOS_DISMISS_SETTLE_MS : 0
    );

    return () => clearTimeout(timer);
  }, [visible]);


  // Height follows the content up to a cap, so a sheet with two options is not
  // padded out to 60% of the screen. Measured per render so folds, display-zoom
  // changes and a shrunken window are all handled.
  const maxSheetHeight = useMemo(
    () => Math.max(200, (windowHeight - keyboardHeight) * 0.85),
    [keyboardHeight, windowHeight]
  );

  // 0 is fully open. Dragging down raises the value; releasing far enough
  // closes, otherwise it springs back.
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,

      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          translateY.setValue(g.dy);
        }
      },

      onPanResponderRelease: (_, g) => {
        // Swipe down -> close
        if (g.dy > 140) {
          dismissThenClose(onClose)();
          return;
        }

        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  if (!visible) return null;

  return (
    // onRequestClose is what Android's back gesture calls. Without it the
    // sheet simply ignored the system back button, and the only way out was
    // to find the backdrop - the calendar's day sheet has no close button at
    // all, so it read as a screen the app would not leave.
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={dismissThenClose(onClose)}
    >
      {/* Overlay */}
      <Pressable style={styles.overlay} onPress={dismissThenClose(onClose)} />

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            maxHeight: maxSheetHeight,
            bottom: keyboardHeight,
            backgroundColor: theme.cardBackground,
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.dragZone}>
          <ThemedSheetHandle />
        </View>

        {/* Scrollable content */}
        <ThemedKeyboardSheet footer={footer} style={styles.sheetBody}>
          {children}
        </ThemedKeyboardSheet>
      </Animated.View>
    </Modal>
  );
};

export default ThemedBottomSheet;

const styles = StyleSheet.create({
  sheetBody: {
    // Shrinks under the sheet's maxHeight but never stretches the sheet past
    // its content.
    flexShrink: 1,
    minHeight: 0,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  sheet: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  dragZone: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

});
