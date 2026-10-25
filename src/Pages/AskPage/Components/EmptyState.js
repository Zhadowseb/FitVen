import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import Sparkle from "@resources/Icons/UI-icons/Sparkle";
import styles from "../AskPageStyle";

// Nothing asked yet: what this is, and four questions to start from. The rows
// are made from the person's own data where there is any (see askPrompts).
export default function EmptyState({ rows, onPick }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={styles.empty}>
      <View style={styles.emptyHead}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.aiBox.surface }]}>
          <Sparkle width={22} height={22} color={theme.aiBox.icon} thickness={2} />
        </View>
        <ThemedText style={styles.emptyTitle} setColor={theme.title}>
          {t("ask.empty.title")}
        </ThemedText>
        <ThemedText style={styles.emptyIntro} setColor={theme.text}>
          {t("ask.empty.intro")}
        </ThemedText>
      </View>

      <View style={styles.suggestRows}>
        {rows.map((row) => (
          <TouchableOpacity
            key={row.id}
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => onPick(row.text)}
            style={[
              styles.suggestRow,
              { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
            ]}
          >
            <ThemedText style={styles.suggestRowText} setColor={theme.title}>
              {row.text}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
