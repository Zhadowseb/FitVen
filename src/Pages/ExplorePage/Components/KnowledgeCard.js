import { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../Resources/ThemedComponents/ThemedText";
import SoftGradient from "../../../Resources/Components/SoftGradient";
import Book from "../../../Resources/Icons/UI-icons/Book";
import ChevronRight from "../../../Resources/Icons/UI-icons/ChevronRight";
import { ARTICLES } from "../../../Resources/Knowledge";
import { useAuth } from "../../../Contexts/AuthContext";
import { knowledgeService } from "../../../Services";
import { hasNewArticles } from "../../../Utils/knowledge";

// The way into Knowledge, under the tiles on Explore: a soft wash from the
// accent to the secondary, the book, the name - with a small NEW badge while
// there are articles nobody has opened yet - and one line of what is inside.

export default function KnowledgeCard() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const green = theme.secondary ?? theme.primary;
  const [showNew, setShowNew] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      knowledgeService.getReadArticleIds(user?.id ?? null).then((ids) => {
        if (!cancelled) {
          setShowNew(hasNewArticles(ARTICLES, ids));
        }
      });

      return () => {
        cancelled = true;
      };
    }, [user?.id])
  );

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t("knowledge.explore.a11y")}
      activeOpacity={0.9}
      onPress={() => navigation.navigate("KnowledgePage")}
      style={[styles.card, { borderColor: theme.cardBorder }]}
    >
      <SoftGradient id="exploreKnowledge" from={withAlpha(theme.primary, 0.16)} to={withAlpha(green, 0.12)} />

      <View style={[styles.iconBox, { backgroundColor: withAlpha(green, 0.16) }]}>
        <Book width={20} height={20} color={green} thickness={2} />
      </View>

      <View style={styles.texts}>
        <View style={styles.nameRow}>
          <ThemedText style={styles.name} setColor={theme.title}>
            {t("knowledge.explore.title")}
          </ThemedText>
          {showNew ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.badgeText} setColor={theme.textInverted}>
                {t("knowledge.explore.new")}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText style={styles.subtitle} setColor={theme.quietText}>
          {t("knowledge.explore.subtitle")}
        </ThemedText>
      </View>

      <ChevronRight width={16} height={16} color={theme.quietText} thickness={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 8,
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  name: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "800",
  },
  badge: {
    borderRadius: 5,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "600",
  },
});
