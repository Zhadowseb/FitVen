import { useCallback, useMemo, useState } from "react";
import { ScrollView, TextInput, TouchableOpacity, View, useColorScheme } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getLocaleTag, useTranslation } from "@localization";

import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import { ThemedText, ThemedView } from "../../Resources/ThemedComponents";
import SoftGradient from "../../Resources/Components/SoftGradient";
import Book from "../../Resources/Icons/UI-icons/Book";
import ChevronLeft from "../../Resources/Icons/UI-icons/ChevronLeft";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import Search from "../../Resources/Icons/UI-icons/Search";
import { ARTICLES } from "../../Resources/Knowledge";
import { useAuth } from "../../Contexts/AuthContext";
import { knowledgeService } from "../../Services";
import {
  categoriesWithArticles,
  categoryLabelKey,
  categoryTone,
  filterArticles,
  isNewArticle,
  localizeArticle,
  pickFeatured,
  sortArticles,
} from "../../Utils/knowledge";
import { formatArticleDate } from "../../Utils/knowledgeFormat";
import styles from "./KnowledgePageStyle";

// Knowledge (design: Knowledge.dc.html), opened from Explore: a search over
// title and summary, one chip for each category that has an article, the newest
// article featured, and the list. An article is NEW for 14 days until it has
// been opened, and READ after that.

function Pill({ label, color, background, check }) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {check ? <ThemedText style={styles.pillText} setColor={color}>{"✓"}</ThemedText> : null}
      <ThemedText style={styles.pillText} setColor={color}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function KnowledgePage() {
  const { t, language } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const locale = getLocaleTag();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [readIds, setReadIds] = useState(() => new Set());

  // Opening an article and coming back changes what is NEW and READ.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      knowledgeService.getReadArticleIds(user?.id ?? null).then((ids) => {
        if (!cancelled) {
          setReadIds(ids);
        }
      });

      return () => {
        cancelled = true;
      };
    }, [user?.id])
  );

  const articles = useMemo(() => sortArticles(ARTICLES).map((article) => localizeArticle(article, language)), [language]);
  const categories = useMemo(() => categoriesWithArticles(articles), [articles]);
  const shown = useMemo(() => filterArticles(articles, { category, query }), [articles, category, query]);
  const featured = useMemo(() => (shown.length > 0 ? pickFeatured(shown) : null), [shown]);
  const rest = shown.filter((article) => article.id !== featured?.id);
  const now = Date.now();

  const green = theme.secondary ?? theme.primary;
  const toneColor = (article) => (categoryTone(article) === "strength" ? theme.primaryText ?? theme.primary : green);

  const open = (article) => navigation.navigate("KnowledgeArticlePage", { articleId: article.id });

  const meta = (article) =>
    [
      t("knowledge.minRead", { minutes: article.readMinutes }),
      t("knowledge.sourceCount", { count: article.sources.length }),
      formatArticleDate(article.date, locale),
    ].join(" · ");

  const chipOptions = [{ value: "all", label: t("knowledge.categories.all") }].concat(
    categories.map((value) => ({ value, label: t(`knowledge.categories.${value}`) }))
  );

  return (
    <ThemedView safe={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* header */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
          >
            <ChevronLeft width={18} height={18} color={theme.title} thickness={2} />
          </TouchableOpacity>

          <View style={styles.headerTitles}>
            <ThemedText style={styles.eyebrow} setColor={theme.quietText} numberOfLines={1}>
              {t("knowledge.eyebrow")}
            </ThemedText>
            <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1} accessibilityRole="header">
              {t("knowledge.title")}
            </ThemedText>
          </View>
        </View>

        {/* search */}
        <View style={[styles.search, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Search width={18} height={18} color={theme.quietText} thickness={2} />
          <TextInput
            accessibilityLabel={t("knowledge.searchLabel")}
            placeholder={t("knowledge.searchPlaceholder")}
            placeholderTextColor={theme.quietText}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.title }]}
          />
        </View>

        {/* categories: only those that have an article */}
        {categories.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
            {chipOptions.map((option) => {
              const active = category === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setCategory(option.value)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? withAlpha(theme.primary, 0.14) : theme.cardBackground,
                    },
                  ]}
                >
                  <ThemedText style={styles.chipText} setColor={active ? theme.primaryText ?? theme.primary : theme.text}>
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {shown.length === 0 ? (
          <ThemedText style={styles.empty} setColor={theme.quietText}>
            {t("knowledge.noResults")}
          </ThemedText>
        ) : null}

        {/* featured: the newest */}
        {featured ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${featured.title}. ${meta(featured)}`}
            activeOpacity={0.9}
            onPress={() => open(featured)}
            style={[styles.featured, { borderColor: theme.border }]}
          >
            <SoftGradient id="knowledgeFeatured" from={withAlpha(theme.primary, 0.22)} to={withAlpha(green, 0.16)} />
            <View style={styles.featuredTop}>
              <ThemedText style={styles.featuredLabel} setColor={theme.primaryText ?? theme.primary} numberOfLines={1}>
                {t("knowledge.featured", { category: t(categoryLabelKey(featured)) })}
              </ThemedText>
              {isNewArticle(featured, readIds, now) ? (
                <Pill label={t("knowledge.new")} color={theme.textInverted} background={theme.primary} />
              ) : null}
            </View>
            <ThemedText style={styles.featuredTitle} setColor={theme.title}>
              {featured.title}
            </ThemedText>
            <ThemedText style={styles.featuredSummary} setColor={theme.text}>
              {featured.summary}
            </ThemedText>
            <View style={styles.metaRow}>
              <Book width={14} height={14} color={theme.quietText} thickness={2} />
              <ThemedText style={styles.meta} setColor={theme.quietText}>
                {meta(featured)}
              </ThemedText>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* the rest */}
        {rest.length > 0 ? (
          <View style={styles.list}>
            <ThemedText style={styles.listTitle} setColor={theme.quietText}>
              {t("knowledge.articles")}
            </ThemedText>
            {rest.map((article) => {
              const isNew = isNewArticle(article, readIds, now);
              const isRead = readIds.has(article.id);

              return (
                <TouchableOpacity
                  key={article.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${article.title}. ${meta(article)}${isNew ? `. ${t("knowledge.new")}` : isRead ? `. ${t("knowledge.read")}` : ""}`}
                  activeOpacity={0.85}
                  onPress={() => open(article)}
                  style={[styles.row, { borderTopColor: theme.border }]}
                >
                  <View style={styles.rowTexts}>
                    <View style={styles.rowTop}>
                      <ThemedText style={styles.category} setColor={toneColor(article)}>
                        {t(categoryLabelKey(article))}
                      </ThemedText>
                      {isNew ? (
                        <Pill label={t("knowledge.new")} color={theme.textInverted} background={theme.primary} />
                      ) : isRead ? (
                        <Pill label={t("knowledge.read")} color={theme.text} background={theme.border} check />
                      ) : null}
                    </View>
                    <ThemedText style={styles.rowTitle} setColor={theme.title}>
                      {article.title}
                    </ThemedText>
                    <ThemedText style={styles.rowMeta} setColor={theme.quietText}>
                      {meta(article)}
                    </ThemedText>
                  </View>
                  <ChevronRight width={14} height={14} color={theme.quietText} thickness={2.2} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}
