import { useEffect, useState } from "react";
import { Alert, Pressable, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./ReportPostModalStyle";
import { useAuth } from "@contexts/AuthContext";
import { socialService } from "@services";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedConfirmModal, ThemedText, ThemedTextInput } from "@resources/ThemedComponents";

/**
 * Reporting a workout post: a reason, an optional note, and the same report
 * the feed sends. Anywhere somebody else's post is shown, it can be reported
 * from - the centre posts as much as the feed.
 */
export default function ReportPostModal({ post, onClose, onReported }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (post) {
      setReason(null);
      setNote("");
    }
  }, [post]);

  const submit = async () => {
    if (!post?.id || !post.author?.id || !reason || !user?.id) {
      return;
    }

    setIsWorking(true);

    try {
      await socialService.reportUser({
        userId: user.id,
        targetUserId: post.author.id,
        postId: post.id,
        reason,
        note,
      });

      onReported?.(post);
      onClose?.();
      Alert.alert(t("social.report.sentTitle"), t("calendar.feed.reportSentMessage"));
    } catch (error) {
      Alert.alert(
        t("calendar.feed.reportFailedTitle"),
        error instanceof Error ? error.message : t("calendar.feed.reportNotSent")
      );
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <ThemedConfirmModal
      visible={Boolean(post)}
      title={t("calendar.feed.reportPostTitle")}
      message={t("social.report.message")}
      confirmLabel={t("social.report.send")}
      cancelLabel={t("common.cancel")}
      tone="danger"
      isWorking={isWorking}
      confirmDisabled={!reason}
      onConfirm={submit}
      onClose={onClose}
    >
      <View style={styles.reasonList}>
        {socialService.REPORT_REASONS.map((option) => {
          const selected = reason === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => setReason(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(option.labelKey)}
              style={[
                styles.reason,
                {
                  borderColor: selected ? theme.danger : theme.hairline,
                  backgroundColor: theme.chipBackground,
                },
              ]}
            >
              <ThemedText style={styles.reasonText} setColor={selected ? theme.danger : theme.text}>
                {t(option.labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedTextInput
        value={note}
        onChangeText={setNote}
        placeholder={t("social.report.notePlaceholder")}
        multiline
        maxLength={socialService.REPORT_NOTE_MAX_LENGTH}
        style={styles.note}
      />
    </ThemedConfirmModal>
  );
}
