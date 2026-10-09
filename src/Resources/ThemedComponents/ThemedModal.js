// src/Resources/Components/ThemedModal.js
import { useEffect, useRef } from "react";
import {
  Modal,
  Platform,
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@localization";
import { Colors } from "../GlobalStyling/colors";
import ThemedText from "./ThemedText";
import Cross from "../Icons/UI-icons/Cross";
import ThemedKeyboardSheet, {
  dismissThenClose,
  useAvailableSheetHeight,
  useSheetKeyboardHeight,
} from "./ThemedKeyboardSheet";

const ThemedModal = ({
  visible,
  onClose,
  title,
  children,
  style,               // ✅ used now (outer modal container)
  contentStyle,        // ✅ used now (inner body)
  dismissOnBackdropPress = true,
  footer = null,
  scroll = true,
  bottomOffset = 24,
  onShow,
  // Fires once this modal has gone. It exists because presenting a second
  // modal while the first is still on screen is dropped by UIKit without an
  // error - so anything that opens another modal has to wait for this rather
  // than setting both flags in the same render.
  //
  // On both platforms. React Native's Modal fires its own onDismiss on iOS
  // only (Libraries/Modal/Modal.js: "OnDismiss is implemented on iOS only"),
  // and everything waiting on it never happened on Android: the delete
  // confirm opened from an exercise's settings, "Discard" leaving Edit
  // profile. So on Android it is fired from `visible` turning false, the same
  // way ThemedBottomSheet does it.
  onDismiss,
  showCloseButton = false,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const availableHeight = useAvailableSheetHeight();
  const keyboardHeight = useSheetKeyboardHeight();
  const isKeyboardOpen = keyboardHeight > 0;
  const wasVisibleRef = useRef(visible);
  const onDismissRef = useRef(onDismiss);

  onDismissRef.current = onDismiss;

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;

    wasVisibleRef.current = visible;

    // iOS says so itself, once the modal is really gone.
    if (Platform.OS === "ios" || !wasVisible || visible) {
      return undefined;
    }

    // Android has removed the dialog by the time `visible` is false, and it
    // stacks a second one without complaint; a tick is enough.
    const timer = setTimeout(() => onDismissRef.current?.(), 0);

    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={onShow}
      onDismiss={Platform.OS === "ios" ? onDismiss : undefined}
    >
      <View
        style={[
          styles.overlay,
          // A centred modal has nowhere to go once the keyboard is up.
          isKeyboardOpen && styles.overlayKeyboardOpen,
          isKeyboardOpen && { paddingBottom: keyboardHeight + 12 },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={
            dismissOnBackdropPress ? dismissThenClose(onClose) : undefined
          }
        />

        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.cardBackground,
              // A centred modal is not anchored to the screen edge, so the
              // safe-area inset would just be dead space. It only matters once
              // the keyboard pushes the modal down to the bottom.
              paddingBottom: isKeyboardOpen ? insets.bottom + 16 : 20,
            },
            style, // ✅ apply custom modal style overrides here
            // Last on purpose: several call sites set a maxHeight relative to
            // the full screen, which is wrong once the keyboard takes half of
            // it. With the keyboard up the measured height must win.
            isKeyboardOpen && {
              maxHeight: Math.max(200, availableHeight - 32),
            },
          ]}
        >
          {title && (
            <ThemedText style={styles.title}>
              {title}
            </ThemedText>
          )}

          {showCloseButton ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              hitSlop={8}
              onPress={dismissThenClose(onClose)}
              style={styles.closeButton}
            >
              <Cross width={16} height={16} color={theme.quietText} />
            </TouchableOpacity>
          ) : null}

          <ThemedKeyboardSheet
            scroll={scroll}
            footer={footer}
            bottomOffset={bottomOffset}
            contentContainerStyle={[styles.body, contentStyle]}
          >
            {children}
          </ThemedKeyboardSheet>
        </View>
      </View>
    </Modal>
  );
};

export default ThemedModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  overlayKeyboardOpen: {
    justifyContent: "flex-end",
    paddingBottom: 12,
  },

  modal: {
    width: "90%",
    borderRadius: 14,
    padding: 20,
    maxHeight: "86%",
    overflow: "hidden",
  },

  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },

  body: {
    gap: 12,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
});
