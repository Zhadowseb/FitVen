import { View, useColorScheme } from "react-native";
import { useEffect, useMemo, useState } from "react";

import styles from "./FeedbackModalStyle";
import { Colors } from "../../GlobalStyling/colors";
import {
  ThemedButton,
  ThemedModal,
  ThemedText,
  ThemedTextInput,
} from "../../ThemedComponents";
import { feedbackService } from "../../../Services";
import { useTranslation } from "@localization";

const MAX_FEEDBACK_LENGTH = 1000;

export default function FeedbackModal({ visible, onClose, userId }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setErrorMessage("");
      setSuccessMessage("");
      setIsSubmitting(false);
    }
  }, [visible]);

  const trimmedLength = useMemo(() => message.trim().length, [message]);
  const accentPrimary = theme.primary;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const innerSurface = theme.uiBackground ?? theme.cardBackground ?? theme.background;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setErrorMessage(t("profile.feedbackModal.writeNoteFirst"));
      setSuccessMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await feedbackService.submitFeedback({
        message: trimmedMessage,
        userId,
      });

      setMessage("");
      setSuccessMessage(t("profile.feedbackModal.sent"));
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      setErrorMessage(t("profile.feedbackModal.couldNotSend"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={onClose}
      title={t("profile.feedbackModal.title")}
      style={styles.modal}
      contentStyle={styles.content}
    >
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: innerSurface,
            borderColor: errorMessage ? theme.danger : cardBorder,
          },
        ]}
      >
        <ThemedText style={styles.inputLabel} setColor={quietText}>
          {t("profile.feedbackModal.inputLabel")}
        </ThemedText>

        <ThemedTextInput
          value={message}
          onChangeText={(nextValue) => {
            setMessage(nextValue.slice(0, MAX_FEEDBACK_LENGTH));
            if (errorMessage) {
              setErrorMessage("");
            }
          }}
          placeholder={t("profile.feedbackModal.placeholder")}
          multiline
          textAlignVertical="top"
          inputStyle={styles.input}
        />
      </View>

      <View style={styles.metaRow}>
        <ThemedText style={styles.metaText} setColor={quietText}>
          {trimmedLength}/{MAX_FEEDBACK_LENGTH}
        </ThemedText>

        <ThemedText style={styles.metaText} setColor={quietText}>
          {userId
            ? t("profile.feedbackModal.signedIn")
            : t("profile.feedbackModal.noUserLinked")}
        </ThemedText>
      </View>

      {errorMessage ? (
        <View
          style={[
            styles.feedbackBanner,
            {
              backgroundColor: "rgba(186, 0, 0, 0.12)",
              borderColor: theme.danger,
            },
          ]}
        >
          <ThemedText
            style={styles.feedbackBannerText}
            setColor={theme.danger}
          >
            {errorMessage}
          </ThemedText>
        </View>
      ) : null}

      {successMessage ? (
        <View
          style={[
            styles.feedbackBanner,
            {
              backgroundColor:
                theme.secondaryLight,
              borderColor: theme.secondary,
            },
          ]}
        >
          <ThemedText
            style={styles.feedbackBannerText}
            setColor={theme.secondaryDark ?? theme.secondary}
          >
            {successMessage}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <ThemedButton
          title={t("common.close")}
          variant="secondary"
          onPress={onClose}
          style={styles.secondaryButton}
        />

        <ThemedButton
          title={
            isSubmitting
              ? t("profile.feedbackModal.sending")
              : t("profile.feedbackModal.send")
          }
          variant="primary"
          onPress={handleSubmit}
          disabled={isSubmitting || trimmedLength === 0}
          style={[
            styles.primaryButton,
            {
              backgroundColor: accentPrimary,
            },
          ]}
        />
      </View>
    </ThemedModal>
  );
}
