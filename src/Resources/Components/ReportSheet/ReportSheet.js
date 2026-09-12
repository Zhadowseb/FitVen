import { useEffect, useState } from "react";
import { TextInput, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./ReportSheetStyle";
import { Colors, withAlpha } from "../../GlobalStyling/colors";
import Checkmark from "../../Icons/UI-icons/Checkmark";
import { ThemedBottomSheet, ThemedText } from "../../ThemedComponents";
import { moderationService, socialService } from "../../../Services";

/**
 * Reporting a post or an account.
 *
 * Apple's guideline 1.2 and Google Play's UGC policy both want this reachable
 * from the content itself rather than buried in settings, which is why it
 * opens from the same menu as everything else you can do to a post.
 *
 * Blocking is offered in the same breath: someone who has just reported a
 * person almost always wants to stop seeing them, and making them find a
 * second screen for it is how the second half goes undone.
 */
export default function ReportSheet({
  visible,
  onClose,
  user,
  target,
  onBlocked,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const fieldSurface = theme.fields ?? theme.uiBackground ?? theme.cardBackground;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const targetUserId = target?.userId ?? null;
  const targetName = target?.name ?? "this account";
  const canBlock = Boolean(targetUserId) && targetUserId !== user?.id;

  useEffect(() => {
    if (!visible) {
      return;
    }

    setReason(null);
    setNote("");
    setAlsoBlock(false);
    setErrorMessage("");
  }, [visible]);

  const submit = async () => {
    if (!reason || isWorking) {
      return;
    }

    setIsWorking(true);
    setErrorMessage("");

    try {
      if (target?.type === "post") {
        await moderationService.reportPost({
          user,
          post: target.post,
          reason,
          note,
        });
      } else {
        await moderationService.reportUser({
          user,
          targetUserId,
          reason,
          note,
        });
      }

      // The block is a second action, and it failing must not take the report
      // down with it - the report is the part the policy is about.
      if (alsoBlock && canBlock) {
        try {
          await socialService.blockUser({
            userId: user.id,
            targetUserId,
          });
          onBlocked?.(targetUserId);
        } catch (blockError) {
          console.warn("Block after report failed:", blockError);
        }
      }

      onClose?.({ reported: true, blocked: alsoBlock && canBlock });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The report could not be sent."
      );
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <ThemedBottomSheet visible={visible} onClose={() => onClose?.({})}>
      <View style={styles.body}>
        <View style={styles.heading}>
          <ThemedText style={styles.title} setColor={titleColor}>
            {target?.type === "post" ? "Report this post" : "Report this account"}
          </ThemedText>
          <ThemedText style={styles.subtitle} setColor={quietText}>
            {`We review every report within 24 hours. ${targetName} is not told who reported them.`}
          </ThemedText>
        </View>

        <View style={styles.reasonList}>
          {moderationService.REPORT_REASONS.map((option) => {
            const isSelected = option.id === reason;

            return (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.label}
                disabled={isWorking}
                onPress={() => setReason(option.id)}
                style={[
                  styles.reason,
                  {
                    borderColor: isSelected ? theme.primary : cardBorder,
                    backgroundColor: isSelected
                      ? withAlpha(theme.primary, 0.1)
                      : "transparent",
                  },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    { borderColor: isSelected ? theme.primary : cardBorder },
                  ]}
                >
                  {isSelected ? (
                    <View
                      style={[
                        styles.radioDot,
                        { backgroundColor: theme.primary },
                      ]}
                    />
                  ) : null}
                </View>

                <ThemedText
                  style={styles.reasonLabel}
                  setColor={isSelected ? primaryTextColor : titleColor}
                >
                  {option.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          editable={!isWorking}
          multiline
          maxLength={moderationService.REPORT_NOTE_MAX_LENGTH}
          placeholder="Anything else we should know? (optional)"
          placeholderTextColor={quietText}
          style={[
            styles.noteInput,
            {
              backgroundColor: fieldSurface,
              borderColor: cardBorder,
              color: titleColor,
            },
          ]}
        />
        {note ? (
          <ThemedText style={styles.noteCounter} setColor={quietText}>
            {`${note.length}/${moderationService.REPORT_NOTE_MAX_LENGTH}`}
          </ThemedText>
        ) : null}

        {canBlock ? (
          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: alsoBlock }}
            accessibilityLabel={`Also block ${targetName}`}
            disabled={isWorking}
            onPress={() => setAlsoBlock((current) => !current)}
            style={[
              styles.blockRow,
              {
                borderColor: alsoBlock ? theme.danger : cardBorder,
                backgroundColor: alsoBlock
                  ? withAlpha(theme.danger, 0.08)
                  : "transparent",
              },
            ]}
          >
            <View
              style={[
                styles.radio,
                {
                  borderRadius: 5,
                  borderColor: alsoBlock ? theme.danger : cardBorder,
                },
              ]}
            >
              {alsoBlock ? (
                <Checkmark width={11} height={11} color={theme.danger} />
              ) : null}
            </View>

            <View style={styles.blockCopy}>
              <ThemedText style={styles.blockTitle} setColor={titleColor}>
                {`Also block ${targetName}`}
              </ThemedText>
              <ThemedText style={styles.blockDetail} setColor={quietText}>
                You stop seeing each other, and the follow is cut both ways.
              </ThemedText>
            </View>
          </TouchableOpacity>
        ) : null}

        {errorMessage ? (
          <ThemedText style={styles.feedback} setColor={theme.danger}>
            {errorMessage}
          </ThemedText>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            disabled={isWorking}
            onPress={() => onClose?.({})}
            style={[
              styles.action,
              { borderColor: cardBorder, backgroundColor: fieldSurface },
            ]}
          >
            <ThemedText style={styles.actionText} setColor={titleColor}>
              Cancel
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: !reason || isWorking }}
            disabled={!reason || isWorking}
            onPress={submit}
            style={[
              styles.action,
              {
                borderColor: withAlpha(theme.danger, 0.5),
                backgroundColor: withAlpha(theme.danger, reason ? 0.16 : 0.06),
                opacity: reason ? 1 : 0.6,
              },
            ]}
          >
            <ThemedText style={styles.actionText} setColor={theme.danger}>
              {isWorking ? "Sending..." : "Send report"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedBottomSheet>
  );
}
