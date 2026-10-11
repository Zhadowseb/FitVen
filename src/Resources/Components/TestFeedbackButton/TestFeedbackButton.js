import { useState } from "react";
import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../../GlobalStyling/colors";
import {
  ThemedButton,
  ThemedModal,
  ThemedSegmentedControl,
  ThemedText,
  ThemedTextInput,
} from "../../ThemedComponents";
import { useAuth } from "../../../Contexts/AuthContext";
import { feedbackService } from "../../../Services";

// TEMPORARY. A small "Test" tab on the edge of every screen, for the people
// trying an internal test build: pick what they were trying, say whether it
// worked, and send. It goes into the same Feedback table as the profile
// page's feedback sheet - as a bug when it did not work and as praise when it
// did, with "[TEST · feature]" first in the message so the developer can pick
// the test reports out - and nothing else is sent (the app version is added by
// the service, as always).
//
// It is only there when the build says so (EXPO_PUBLIC_TEST_BUILD=1, set by the
// "internal-test" profile in eas.json), so a production build never shows it.
// It is meant to be taken out again with the test branch; nothing else depends
// on it.

export const IS_TEST_BUILD = process.env.EXPO_PUBLIC_TEST_BUILD === "1";

const FEATURES = [
  "steps",
  "healthConnect",
  "watchWalks",
  "walk",
  "walkPost",
  "knowledge",
  "other",
];

const MAX_LENGTH = 800;

export default function TestFeedbackButton() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState(null);
  const [works, setWorks] = useState("works");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  if (!IS_TEST_BUILD) {
    return null;
  }

  const close = () => {
    setOpen(false);
    setMessage(null);
  };

  const send = async () => {
    if (!feature) {
      setMessage({ tone: "error", text: t("testFeedback.pickFeature") });
      return;
    }

    if (works === "broken" && !note.trim()) {
      setMessage({ tone: "error", text: t("testFeedback.saySomething") });
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      const verdict = t(works === "works" ? "testFeedback.worksShort" : "testFeedback.brokenShort");

      // English labels on purpose: this is read by the developer, not shown.
      const report = `[TEST · ${feature}] ${verdict}${note.trim() ? `: ${note.trim()}` : ""}`;

      await feedbackService.submitFeedback({
        message: report,
        userId: user?.id ?? null,
        kind: works === "works" ? "praise" : "bug",
      });

      setNote("");
      setFeature(null);
      setWorks("works");
      setMessage({ tone: "ok", text: t("testFeedback.sent") });
    } catch (error) {
      console.warn("Could not send the test feedback:", error);
      setMessage({ tone: "error", text: t("testFeedback.couldNotSend") });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("testFeedback.open")}
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
        style={[styles.tab, { backgroundColor: theme.primary }]}
      >
        <ThemedText style={styles.tabText} setColor={theme.textInverted ?? "#fff"}>
          {t("testFeedback.tab")}
        </ThemedText>
      </TouchableOpacity>

      <ThemedModal visible={open} onClose={close} title={t("testFeedback.title")} style={styles.modal}>
        <ThemedText style={styles.hint} setColor={theme.quietText}>
          {t("testFeedback.hint")}
        </ThemedText>

        <View style={styles.chips}>
          {FEATURES.map((id) => {
            const selected = feature === id;

            return (
              <TouchableOpacity
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                activeOpacity={0.8}
                onPress={() => setFeature(id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? withAlpha(theme.primary, 0.16) : theme.uiBackground,
                    borderColor: selected ? theme.primary : theme.cardBorder,
                  },
                ]}
              >
                <ThemedText style={styles.chipText} setColor={selected ? theme.primaryText : theme.title}>
                  {t(`testFeedback.features.${id}`)}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <ThemedSegmentedControl
          options={[
            { value: "works", label: t("testFeedback.works") },
            { value: "broken", label: t("testFeedback.broken") },
          ]}
          value={works}
          onChange={setWorks}
          style={styles.verdict}
        />

        <ThemedTextInput
          value={note}
          onChangeText={(next) => setNote(next.slice(0, MAX_LENGTH))}
          placeholder={t(works === "works" ? "testFeedback.notePlaceholderWorks" : "testFeedback.notePlaceholderBroken")}
          multiline
          textAlignVertical="top"
          inputStyle={styles.note}
        />

        {message ? (
          <ThemedText
            style={styles.message}
            setColor={message.tone === "ok" ? theme.secondary : theme.danger}
          >
            {message.text}
          </ThemedText>
        ) : null}

        <View style={styles.buttons}>
          <ThemedButton title={t("common.close")} variant="secondary" onPress={close} style={styles.button} />
          <ThemedButton
            title={sending ? t("testFeedback.sending") : t("testFeedback.send")}
            variant="primary"
            onPress={send}
            disabled={sending}
            style={[styles.button, { backgroundColor: theme.primary }]}
          />
        </View>
      </ThemedModal>
    </>
  );
}

const styles = StyleSheet.create({
  tab: {
    position: "absolute",
    left: 0,
    top: "38%",
    paddingVertical: 10,
    paddingHorizontal: 9,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    opacity: 0.92,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  modal: {
    width: "94%",
    maxHeight: 640,
    borderRadius: 26,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  verdict: {
    marginBottom: 12,
  },
  note: {
    minHeight: 96,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  message: {
    fontSize: 12.5,
    fontWeight: "700",
    marginTop: 10,
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  button: {
    flex: 1,
  },
});
