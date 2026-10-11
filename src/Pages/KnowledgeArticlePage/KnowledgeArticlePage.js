import { useEffect } from "react";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { formatNumber, getLocaleTag, useTranslation } from "@localization";

import { Colors } from "../../Resources/GlobalStyling/colors";
import { ThemedText, ThemedView } from "../../Resources/ThemedComponents";
import ScienceLink from "../../Resources/Components/ScienceLink";
import ChevronLeft from "../../Resources/Icons/UI-icons/ChevronLeft";
import { getArticleById } from "../../Resources/Knowledge";
import { useAuth } from "../../Contexts/AuthContext";
import { knowledgeService } from "../../Services";
import { categoryLabelKey, categoryTone, localizeArticle } from "../../Utils/knowledge";
import { footnoteMarker, formatArticleDate, paragraphToPlainText } from "../../Utils/knowledgeFormat";
import { STEP_ZONES } from "../../Utils/stepZones";
import StepCurve from "./StepCurve";
import styles from "./KnowledgeArticlePageStyle";

// One article (designs: KnowledgeArticle.dc.html and KnowledgeZones.dc.html):
// what it is, an "In short", sections with footnotes, the blocks some articles
// carry (the curve of benefit, the five zones), "Read the science" links to
// related articles, the sources, and - last, after the sources - the box that
// says it was written by AI. Opening it marks it read.

// The five zones as rows: the name, the range and the colour come from
// Utils/stepZones.js, so they cannot drift from the rest of the app; only the
// line under each is the article's own.
function ZoneRows({ notes, theme, t }) {
  return (
    <View style={[styles.card, styles.zoneRows, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      {STEP_ZONES.map((zone, index) => {
        const range =
          zone.max === null
            ? t("knowledge.zoneRange.from", { min: formatNumber(zone.min) })
            : zone.min === 0
              ? t("knowledge.zoneRange.under", { max: formatNumber(zone.max + 1) })
              : t("knowledge.zoneRange.between", { min: formatNumber(zone.min), max: formatNumber(zone.max + 1) });

        return (
          <View
            key={zone.id}
            accessible
            accessibilityLabel={`${t(zone.labelKey)}, ${range}. ${notes[zone.id]}`}
            style={[styles.zoneRow, index > 0 ? { borderTopWidth: 1, borderTopColor: theme.border } : null]}
          >
            <View style={[styles.zoneDot, { backgroundColor: theme.stepZones[zone.id] }]} />
            <View style={styles.zoneTexts}>
              <View style={styles.zoneHead}>
                <ThemedText style={styles.zoneName} setColor={theme.title}>
                  {t(zone.labelKey)}
                </ThemedText>
                <ThemedText style={styles.zoneRange} setColor={theme.quietText}>
                  {range}
                </ThemedText>
              </View>
              <ThemedText style={styles.zoneNote} setColor={theme.text}>
                {notes[zone.id]}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function KnowledgeArticlePage({ route }) {
  const { t, language } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const locale = getLocaleTag();
  const articleId = route?.params?.articleId;
  const article = localizeArticle(getArticleById(articleId), language);

  // Opened is read.
  useEffect(() => {
    if (article) {
      void knowledgeService.markArticleRead(user?.id ?? null, article.id);
    }
  }, [article?.id, user?.id]);

  const green = theme.secondary ?? theme.primary;
  const toneColor = article && categoryTone(article) === "strength" ? theme.primaryText ?? theme.primary : green;
  const sourceLabel = (numbers) => t("knowledge.sourceRef", { numbers: numbers.join(", ") });

  return (
    <ThemedView safe={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              {t("knowledge.article.eyebrow")}
            </ThemedText>
            <ThemedText style={styles.headerTitle} setColor={theme.title} numberOfLines={1}>
              {t("knowledge.article.title")}
            </ThemedText>
          </View>
        </View>

        {!article ? (
          <ThemedText style={styles.missing} setColor={theme.quietText}>
            {t("knowledge.article.missing")}
          </ThemedText>
        ) : (
          <View style={styles.body}>
            <View style={styles.metaRow}>
              <ThemedText style={styles.category} setColor={toneColor}>
                {t(categoryLabelKey(article))}
              </ThemedText>
              <ThemedText style={styles.meta} setColor={theme.quietText}>
                {`${t("knowledge.minRead", { minutes: article.readMinutes })} · ${t("knowledge.written", {
                  date: formatArticleDate(article.date, locale),
                })}`}
              </ThemedText>
            </View>

            <ThemedText style={styles.h1} setColor={theme.title} accessibilityRole="header">
              {article.title}
            </ThemedText>

            {/* in short */}
            <View style={[styles.card, styles.inShort, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <ThemedText style={styles.inShortTitle} setColor={green}>
                {t("knowledge.article.inShort")}
              </ThemedText>
              {article.inShort.map((point) => (
                <View key={point} style={styles.bullet}>
                  <View style={[styles.bulletDot, { backgroundColor: green }]} />
                  <ThemedText style={styles.bulletText} setColor={theme.title}>
                    {point}
                  </ThemedText>
                </View>
              ))}
            </View>

            {/* the body */}
            {article.sections.map((section) => (
              <View key={section.heading} style={{ gap: 12 }}>
                <ThemedText style={styles.h2} setColor={theme.title} accessibilityRole="header">
                  {section.heading}
                </ThemedText>

                {section.paragraphs.map((parts, index) => (
                  <ThemedText
                    key={index}
                    style={styles.paragraph}
                    setColor={theme.text}
                    accessibilityLabel={paragraphToPlainText(parts, sourceLabel)}
                  >
                    {parts.map((part, position) =>
                      typeof part === "string" ? (
                        part
                      ) : (
                        <ThemedText key={position} style={styles.footnote} setColor={theme.quietText}>
                          {footnoteMarker(part.ref)}
                        </ThemedText>
                      )
                    )}
                  </ThemedText>
                ))}

                {section.block === "curve" ? (
                  <View style={[styles.card, styles.block, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <StepCurve />
                  </View>
                ) : null}

                {section.block === "zones" ? <ZoneRows notes={article.zoneNotes} theme={theme} t={t} /> : null}
              </View>
            ))}

            {/* related */}
            {article.related.map((relatedId) => (
              <ScienceLink key={relatedId} articleId={relatedId} />
            ))}

            {/* sources */}
            <View style={[styles.card, styles.sources, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <ThemedText style={styles.sourcesTitle} setColor={theme.quietText}>
                {t("knowledge.article.sources")}
              </ThemedText>
              {article.sources.map((source, index) => (
                <View key={source.title} style={[styles.source, { borderTopColor: theme.border }]}>
                  <ThemedText style={styles.sourceNumber} setColor={theme.quietText}>
                    {index + 1}
                  </ThemedText>
                  <View style={styles.sourceTexts}>
                    <ThemedText style={styles.sourceTitle} setColor={theme.title}>
                      {source.title}
                    </ThemedText>
                    <ThemedText style={styles.sourceByline} setColor={theme.quietText}>
                      {source.byline}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>

            {/* written by AI: last, after the sources */}
            <View style={[styles.aiBox, { backgroundColor: theme.aiBox.surface, borderColor: theme.aiBox.border }]}>
              <Svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.aiBox.icon}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginTop: 2 }}
              >
                <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
                <Path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
              </Svg>
              <ThemedText style={styles.aiText} setColor={theme.aiBox.text}>
                <ThemedText style={[styles.aiText, styles.aiStrong]} setColor={theme.aiBox.strong}>
                  {t("knowledge.article.aiTitle")}
                </ThemedText>
                {` ${t("knowledge.article.aiBody")}`}
              </ThemedText>
            </View>
            <ThemedText style={styles.footer} setColor={theme.quietText}>
              {t("knowledge.article.aiFooter", { date: formatArticleDate(article.date, locale) })}
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
