import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";

import { useTranslation } from "@localization";
import { Colors, withAlpha } from "../GlobalStyling/colors";
import ThemedModal from "./ThemedModal";
import ThemedText from "./ThemedText";

/**
 * In-app replacement for Alert.alert on confirmations, so the prompt follows the
 * app's theme instead of the OS dialog.
 */
export default function ThemedConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "default", // "default" | "danger" | "positive"
  isWorking = false,
  // Greys out the confirm button alone. isWorking would do it too, but it also
  // disables Cancel and the backdrop, which is right while something is in
  // flight and wrong when the dialog is simply waiting for an answer.
  confirmDisabled = false,
  onConfirm,
  onClose,
  children, // optional extra content between the message and the buttons
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  // Defaults in the user's language. `cancelLabel={null}` still means "no
  // cancel button"; only leaving it out gets the default.
  const resolvedConfirmLabel = confirmLabel ?? t("common.confirm");
  const resolvedCancelLabel =
    cancelLabel === undefined ? t("common.cancel") : cancelLabel;

  const confirmColor =
    tone === "danger"
      ? theme.danger
      : tone === "positive"
        ? theme.secondary
        : theme.primary;

  return (
    <ThemedModal
      visible={visible}
      onClose={onClose}
      title={title}
      scroll={Boolean(children)}
      dismissOnBackdropPress={!isWorking}
      style={styles.modal}
    >
      {message ? (
        <ThemedText style={styles.message} setColor={theme.quietText}>
          {message}
        </ThemedText>
      ) : null}

      {children}

      <View style={styles.actions}>
        {/* An acknowledgement has nothing to cancel, so an empty label drops
            the button rather than drawing a blank one. */}
        {resolvedCancelLabel ? (
          <TouchableOpacity
            activeOpacity={0.84}
            accessibilityRole="button"
            disabled={isWorking}
            onPress={onClose}
            style={[
              styles.button,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <ThemedText style={styles.buttonText} setColor={theme.title}>
              {resolvedCancelLabel}
            </ThemedText>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.84}
          accessibilityRole="button"
          accessibilityState={{ disabled: isWorking || confirmDisabled }}
          disabled={isWorking || confirmDisabled}
          onPress={onConfirm}
          style={[
            styles.button,
            {
              backgroundColor: withAlpha(confirmColor, 0.16),
              borderColor: withAlpha(confirmColor, 0.5),
              opacity: isWorking || confirmDisabled ? 0.6 : 1,
            },
          ]}
        >
          <ThemedText style={styles.buttonText} setColor={confirmColor}>
            {resolvedConfirmLabel}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedModal>
  );
}

const styles = StyleSheet.create({
  modal: {
    width: "84%",
    maxWidth: 380,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
