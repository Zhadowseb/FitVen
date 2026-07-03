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

const MAX_FEEDBACK_LENGTH = 1000;

export default function FeedbackModal({ visible, onClose, userId }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
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
  const accentPrimary = theme.primary ?? "#f7742e";
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const innerSurface = theme.uiBackground ?? theme.cardBackground ?? theme.background;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setErrorMessage("Write a short note first.");
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
      setSuccessMessage("Feedback sent. Thank you.");
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      setErrorMessage("Could not send feedback right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={onClose}
      title="Send us feedback"
      style={styles.modal}
      contentStyle={styles.content}
    >
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: innerSurface,
            borderColor: errorMessage ? theme.danger ?? "#ba0000" : cardBorder,
          },
        ]}
      >
        <ThemedText style={styles.inputLabel} setColor={quietText}>
          What should we know?
        </ThemedText>

        <ThemedTextInput
          value={message}
          onChangeText={(nextValue) => {
            setMessage(nextValue.slice(0, MAX_FEEDBACK_LENGTH));
            if (errorMessage) {
              setErrorMessage("");
            }
          }}
          placeholder="Tell us what happened, what you expected, or what would make the app better."
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
          {userId ? "Signed in" : "No user linked"}
        </ThemedText>
      </View>

      {errorMessage ? (
        <View
          style={[
            styles.feedbackBanner,
            {
              backgroundColor: "rgba(186, 0, 0, 0.12)",
              borderColor: theme.danger ?? "#ba0000",
            },
          ]}
        >
          <ThemedText
            style={styles.feedbackBannerText}
            setColor={theme.danger ?? "#ba0000"}
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
                theme.secondaryLight ?? "rgba(96, 218, 172, 0.16)",
              borderColor: theme.secondary ?? "#60daac",
            },
          ]}
        >
          <ThemedText
            style={styles.feedbackBannerText}
            setColor={theme.secondaryDark ?? theme.secondary ?? "#60daac"}
          >
            {successMessage}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <ThemedButton
          title="Close"
          variant="secondary"
          onPress={onClose}
          style={styles.secondaryButton}
        />

        <ThemedButton
          title={isSubmitting ? "Sending..." : "Send Feedback"}
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
