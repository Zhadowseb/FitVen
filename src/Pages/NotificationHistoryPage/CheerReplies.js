import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useTranslation } from "@localization";

import { withAlpha } from "../../Resources/GlobalStyling/colors";
import {
  ThemedButton,
  ThemedText,
  ThemedTextInput,
} from "../../Resources/ThemedComponents";
import {
  CHEER_PRESETS,
  CHEER_PRESET_CUSTOM,
  MAX_CHEER_MESSAGE_LENGTH,
  cheerText,
  cleanCheerMessage,
} from "../../Utils/cheers";

// The replies under a "has started a push!" row: the three ready-made cheers
// and "Write a message…", the same ones as the buttons on the notification
// itself (Utils/cheers.js). Once you have cheered the row shows
// "You cheered · 💪 Good workout!" instead. Sits beside the row's touchable,
// never inside it, so pressing a reply does not also open the row.
export default function CheerReplies({
  theme,
  sent,
  sending,
  onSend,
}) {
  const { t } = useTranslation();
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const chipBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const chipSurface = withAlpha(theme.primary, 0.12);
  const message = cleanCheerMessage(draft);

  if (sent) {
    const words = cheerText(sent.preset, sent.message, t);

    return (
      <View style={styles.container}>
        <ThemedText style={styles.sentText} setColor={quietText}>
          {words
            ? t("cheers.youCheeredWith", { text: words })
            : t("cheers.youCheered")}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {CHEER_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            activeOpacity={0.8}
            accessibilityRole="button"
            disabled={sending}
            onPress={() => onSend({ preset: preset.id, message: null })}
            style={[
              styles.chip,
              { backgroundColor: chipSurface, borderColor: chipBorder },
              sending ? styles.disabled : null,
            ]}
          >
            <ThemedText style={styles.chipText}>{t(preset.labelKey)}</ThemedText>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ expanded: writing }}
          disabled={sending}
          onPress={() => setWriting((current) => !current)}
          style={[
            styles.chip,
            { backgroundColor: "transparent", borderColor: chipBorder },
            sending ? styles.disabled : null,
          ]}
        >
          <ThemedText style={styles.chipText} setColor={quietText}>
            {t("cheers.writeMessage")}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {writing ? (
        <View style={styles.writeRow}>
          <ThemedTextInput
            style={styles.writeInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("cheers.placeholder")}
            accessibilityLabel={t("cheers.messageLabel")}
            maxLength={MAX_CHEER_MESSAGE_LENGTH}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() =>
              message && onSend({ preset: CHEER_PRESET_CUSTOM, message })
            }
          />
          <ThemedButton
            title={t("cheers.send")}
            height={44}
            disabled={!message || sending}
            onPress={() => onSend({ preset: CHEER_PRESET_CUSTOM, message })}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: -2,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  writeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  writeInput: {
    flex: 1,
  },
  sentText: {
    fontSize: 13,
    paddingLeft: 4,
  },
});
