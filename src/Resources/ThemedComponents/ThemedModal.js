// src/Resources/Components/ThemedModal.js
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  showCloseButton = false,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const availableHeight = useAvailableSheetHeight();
  const keyboardHeight = useSheetKeyboardHeight();
  const isKeyboardOpen = keyboardHeight > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={onShow}
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
              accessibilityLabel="Close"
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
