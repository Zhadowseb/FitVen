import { TouchableOpacity, View, useColorScheme } from "react-native";
import { formatNumber, useTranslation } from "@localization";

import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import styles from "../AskPageStyle";

/**
 * A suggested change: a card with a dashed edge, what would change, and two
 * buttons. Nothing is written until "Add to next ..." is pressed; after that
 * the card says what it did and offers Undo. `state` is
 * { status: "idle" | "applying" | "applied" | "undone" | "dismissed" |
 *   "noWorkout" | "failed" | "undoFailed" | "undoing", workoutLabel }.
 */
export default function SuggestionBlock({ block, state, onApply, onDismiss, onUndo }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const status = state?.status ?? "idle";
  const label = block.target.label;
  const text =
    block.text ||
    t("ask.suggestion.line", {
      exercise: block.change.exercise,
      sets: block.change.sets
        .map((set) =>
          t("ask.suggestion.setPart", {
            count: set.count,
            reps: set.reps,
            weight: formatNumber(set.weight, { maximumFractionDigits: 2 }),
          })
        )
        .join(", "),
    });
  const busy = status === "applying" || status === "undoing";
  const showButtons = status === "idle" || status === "applying" || status === "failed";
  const statusText =
    status === "applied" || status === "undoFailed" || status === "undoing"
      ? t("ask.suggestion.added", { workout: state?.workoutLabel ?? label })
      : status === "undone"
        ? t("ask.suggestion.undone")
        : status === "dismissed"
          ? t("ask.suggestion.dismissed")
          : status === "noWorkout"
            ? t("ask.suggestion.noWorkout", { workout: label })
            : null;
  const problem =
    status === "failed"
      ? t("ask.suggestion.failed")
      : status === "undoFailed"
        ? t("ask.suggestion.undoFailed")
        : null;
  const canUndo = status === "applied" || status === "undoFailed" || status === "undoing";

  return (
    <View
      style={[
        styles.suggestion,
        {
          borderColor: withAlpha(theme.primary, 0.5),
          backgroundColor: withAlpha(theme.primary, 0.06),
        },
      ]}
    >
      <View
        accessible
        accessibilityLabel={t("ask.suggestion.group", { workout: label, text })}
      >
        <ThemedText style={styles.suggestionEyebrow} setColor={theme.primaryText}>
          {t("ask.suggestion.eyebrow", { workout: label })}
        </ThemedText>
        <ThemedText style={styles.suggestionText} setColor={theme.title}>
          {text}
        </ThemedText>
      </View>

      {showButtons ? (
        <View style={styles.suggestionButtons}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            activeOpacity={0.85}
            disabled={busy}
            onPress={onApply}
            style={[
              styles.suggestionButton,
              { backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 },
            ]}
          >
            <ThemedText style={styles.suggestionButtonText} setColor={theme.ink}>
              {t("ask.suggestion.add", { workout: label })}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            disabled={busy}
            onPress={onDismiss}
            style={[styles.suggestionButton, { borderWidth: 1, borderColor: theme.border }]}
          >
            <ThemedText style={styles.suggestionButtonText} setColor={theme.title}>
              {t("ask.suggestion.notNow")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : null}

      {statusText || problem ? (
        <View style={styles.suggestionStatus}>
          {statusText ? (
            <ThemedText style={styles.suggestionStatusText} setColor={theme.title}>
              {statusText}
            </ThemedText>
          ) : null}

          {canUndo ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: status === "undoing" }}
              activeOpacity={0.85}
              disabled={status === "undoing"}
              onPress={onUndo}
              style={[styles.suggestionButton, { borderWidth: 1, borderColor: theme.border }]}
            >
              <ThemedText style={styles.suggestionButtonText} setColor={theme.primaryText}>
                {t("ask.suggestion.undo")}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {problem ? (
        <ThemedText style={[styles.suggestionStatusText, { marginTop: 6 }]} setColor={theme.danger}>
          {problem}
        </ThemedText>
      ) : null}
    </View>
  );
}
