import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../GlobalStyling/colors";
import ThemedText from "../ThemedComponents/ThemedText";
import Book from "../Icons/UI-icons/Book";
import { getArticleById } from "../Knowledge";
import { localizeArticle } from "../../Utils/knowledge";

// "Read the science": one link, placed right next to the topic it explains -
// under the step chart, beside the training switch, on Statistics and at the end
// of an article. The title and the minutes come from the article, so they never
// drift from it. The wording is always "Read the science", never "Read the
// article".
//
// Without an `onPress` it opens the article.

export default function ScienceLink({ articleId, onPress, style }) {
  const { t, language } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const article = localizeArticle(getArticleById(articleId), language);

  if (!article) {
    return null;
  }

  const green = theme.secondary ?? theme.primary;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("knowledge.scienceLink.a11y", {
        title: article.title,
        minutes: article.readMinutes,
      })}
      activeOpacity={0.85}
      onPress={onPress ?? (() => navigation.navigate("KnowledgeArticlePage", { articleId }))}
      style={[
        styles.link,
        { backgroundColor: withAlpha(green, 0.08), borderColor: withAlpha(green, 0.32) },
        style,
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: withAlpha(green, 0.16) }]}>
        <Book width={16} height={16} color={green} thickness={2} />
      </View>

      <View style={styles.texts}>
        <ThemedText style={styles.label} setColor={green}>
          {t("knowledge.scienceLink.label", { minutes: article.readMinutes })}
        </ThemedText>
        <ThemedText style={styles.title} setColor={theme.title}>
          {article.title}
        </ThemedText>
      </View>

      <ThemedText style={styles.arrow} setColor={green}>
        →
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: "stretch",
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  arrow: {
    fontSize: 18,
    fontWeight: "800",
  },
});
