import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import Book from "@resources/Icons/UI-icons/Book";
import Sparkle from "@resources/Icons/UI-icons/Sparkle";
import ChartBlock from "./ChartBlock";
import SuggestionBlock from "./SuggestionBlock";
import styles from "../AskPageStyle";

function SourceLine({ sources, onOpen }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const hasCount = Number.isFinite(sources.count) && sources.count > 0;
  // The app's own sentence when it has the numbers; the function's label otherwise.
  const line = hasCount
    ? sources.range
      ? t("ask.sources.line", { count: sources.count, range: sources.range })
      : t("ask.sources.lineNoRange", { count: sources.count })
    : sources.label;

  if (!line) {
    return null;
  }

  return (
    <View style={styles.sourceRow}>
      <Book width={12} height={12} color={theme.quietText} thickness={2.2} />
      <ThemedText style={styles.sourceText} setColor={theme.quietText}>
        {line}
      </ThemedText>

      {sources.link ? (
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel={t("ask.sources.see")}
          accessibilityHint={t("ask.sources.seeHint")}
          activeOpacity={0.8}
          onPress={() => onOpen(sources.link)}
          style={styles.sourceLink}
        >
          <ThemedText style={styles.sourceText} setColor={theme.primaryText}>
            {t("ask.sources.see")}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * One answer: the sparkle tile, the text, the blocks the function sent (a
 * chart, a suggested change) and the line saying what it rests on. Plain text
 * in 15/22; the whole answer is read in order, once it is complete (it is not
 * streamed in, so there is nothing that changes under a screen reader).
 */
export default function AnswerMessage({
  message,
  suggestionStates,
  onApply,
  onDismiss,
  onUndo,
  onOpenSource,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={styles.answerRow}>
      <View style={[styles.avatarTile, { backgroundColor: theme.aiBox.surface }]}>
        <Sparkle width={15} height={15} color={theme.aiBox.icon} thickness={2} />
      </View>

      <View style={styles.answerBody}>
        {message.text ? (
          <ThemedText selectable style={styles.answerText} setColor={theme.title}>
            {message.text}
          </ThemedText>
        ) : null}

        {message.blocks.map((block, index) =>
          block.type === "chart" ? (
            <ChartBlock key={`${message.id}:${index}`} block={block} />
          ) : (
            <SuggestionBlock
              key={`${message.id}:${index}`}
              block={block}
              state={suggestionStates[`${message.id}:${index}`]}
              onApply={() => onApply(message.id, index, block)}
              onDismiss={() => onDismiss(message.id, index)}
              onUndo={() => onUndo(message.id, index)}
            />
          )
        )}

        {message.sources ? <SourceLine sources={message.sources} onOpen={onOpenSource} /> : null}
      </View>
    </View>
  );
}
