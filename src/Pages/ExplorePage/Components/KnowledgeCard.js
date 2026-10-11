import { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "../../../Resources/GlobalStyling/colors";
import ThemedText from "../../../Resources/ThemedComponents/ThemedText";
import Book from "../../../Resources/Icons/UI-icons/Book";
import ChevronRight from "../../../Resources/Icons/UI-icons/ChevronRight";
import { ARTICLES } from "../../../Resources/Knowledge";
import { useAuth } from "../../../Contexts/AuthContext";
import { knowledgeService } from "../../../Services";
import { hasNewArticles } from "../../../Utils/knowledge";

// The way into Knowledge, as one more tile under the others on Explore: the
// same card, border and icon square as they have, the same type sizes, and a
// small NEW badge while there are articles nobody has opened yet.

export default function KnowledgeCard() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const isLight = colorScheme === "light";
  const tone = theme.secondary ?? theme.primary;
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
      activeOpacity={0.85}
      onPress={() => navigation.navigate("KnowledgePage")}
      style={[styles.tile, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
    >
      <View style={[styles.icon, { backgroundColor: withAlpha(tone, isLight ? 0.12 : 0.14) }]}>
        <Book width={18} height={18} color={tone} thickness={1.6} />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1}>
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
        <ThemedText style={styles.detail} setColor={theme.quietText} numberOfLines={1}>
          {t("knowledge.explore.subtitle")}
        </ThemedText>
      </View>

      <ChevronRight width={16} height={16} color={theme.quietText} thickness={2} />
    </TouchableOpacity>
  );
}

// The sizes are the tiles' own (ExplorePageStyle: tile, tileIcon, tileTitle,
// tileDetail), laid out as a row because this one spans the width.
const styles = StyleSheet.create({
  tile: {
    marginHorizontal: 20,
    marginTop: 8,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  title: {
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
  detail: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "700",
  },
});
