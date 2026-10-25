import { TextInput, TouchableOpacity, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { useSheetKeyboardHeight } from "@resources/ThemedComponents/ThemedKeyboardSheet";
import ArrowUp from "@resources/Icons/UI-icons/ArrowUp";
import Mic from "@resources/Icons/UI-icons/Mic";
import styles from "../AskPageStyle";

/**
 * The field, a mic and Send, with the small line about mistakes under it. The
 * mic only puts the cursor in the field: the phone's keyboard has dictation,
 * and that is what speaks. The buttons are 44 wide and tall; the circle drawn
 * in them is smaller, as in the design.
 */
export default function InputBar({ value, onChange, onSend, onMic, inputRef, busy, children }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const keyboardHeight = useSheetKeyboardHeight();
  const canSend = value.trim().length > 0 && !busy;

  return (
    <View
      style={[
        styles.inputBar,
        {
          backgroundColor: theme.navBackground ?? theme.cardBackground,
          borderTopColor: theme.hairline,
          paddingBottom: (keyboardHeight > 0 ? 0 : insets.bottom) + 12,
        },
      ]}
    >
      {children}

      <View
        style={[
          styles.inputField,
          { backgroundColor: theme.cardBackground, borderColor: theme.border, marginTop: children ? 8 : 0 },
        ]}
      >
        <TextInput
          ref={inputRef}
          accessibilityLabel={t("ask.input.label")}
          multiline
          value={value}
          onChangeText={onChange}
          placeholder={t("ask.placeholder")}
          placeholderTextColor={theme.quietText}
          selectionColor={theme.primary}
          maxLength={2000}
          style={[styles.input, { color: theme.title }]}
        />

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("ask.input.speak")}
          activeOpacity={0.8}
          onPress={onMic}
          style={styles.inputIconButton}
        >
          <Mic width={17} height={17} color={theme.quietText} thickness={2} />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("ask.input.send")}
          accessibilityState={{ disabled: !canSend }}
          activeOpacity={0.85}
          disabled={!canSend}
          onPress={onSend}
          style={styles.inputIconButton}
        >
          <View
            style={[
              styles.sendCircle,
              { backgroundColor: theme.primary, opacity: canSend ? 1 : 0.4 },
            ]}
          >
            <ArrowUp width={16} height={16} color={theme.ink} thickness={2.6} />
          </View>
        </TouchableOpacity>
      </View>

      <ThemedText style={styles.disclaimer} setColor={theme.quietText}>
        {t("ask.disclaimer")}
      </ThemedText>
    </View>
  );
}
