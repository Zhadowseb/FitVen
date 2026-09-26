import { TouchableOpacity, View, useColorScheme } from "react-native";
import { formatDate, useTranslation } from "@localization";

import styles from "./CategoryCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import RadialGlow from "@resources/Components/GymLeaderboard/RadialGlow";
import MedalAvatar from "@resources/Components/MedalAvatar";
import { ThemedText } from "@resources/ThemedComponents";
import { categoryTone, formatValue, rowSubtitle, unitLabel, valueKind } from "@utils/categoryFormat";
import { categoryDescriptionKey, categoryNameKey } from "@utils/gymCategories";

// Where "you" stand on a card: ranked, outside the level ("not on Zealand"),
// in it without a place yet, or not there at all.
function meStateOf(me) {
  if (!me) {
    return "none";
  }

  if (me.inScope === false) {
    return "out";
  }

  return me.rank ? "ranked" : "unranked";
}

/**
 * One category on a centre level (4a, 4c) or in one centre (4d): its name in
 * its colour, who is #1 and with what, and where you stand. The whole card is
 * one target and opens the category; the names on it open nothing of their
 * own, because on the category page they do.
 *
 * `card` is a CategoryCard from categoryLeaderboardService.getCategoryCards.
 * `where` is the level with its preposition - "in Denmark", "on Zealand", "at
 * PureGym Kildeskovshallen" - for "#4 on Zealand" and "not on Zealand".
 * `levelLabel` is the level's plain name, for the screen reader.
 * `variant` "level" puts #1's centre under the name; "gym" puts #1's line
 * from the category page there instead, counts your place out of everyone,
 * and draws how far you are from #1.
 *
 * Every number, unit, line and colour comes from Utils/categoryFormat.js,
 * the same as on the page the card opens.
 */
export default function CategoryCard({ card, levelLabel, where, variant = "level", onPress, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const category = card?.category;
  const { tone, toneText } = categoryTone(theme, category);
  // The page opens on its first tab, which is what a card counts.
  const kind = valueKind(category);
  const isGym = variant === "gym";
  const top = card?.top ?? null;
  const me = card?.me ?? null;
  const meState = meStateOf(me);
  const title = t(categoryNameKey(category));
  // Consistency counts this month; the name of the month is the language's.
  const description = t(categoryDescriptionKey(category), {
    period: formatDate(new Date(), { month: "long" }),
  });

  const topName = top
    ? top.person?.isMe
      ? t("common.you")
      : top.person?.displayName || top.person?.username || t("common.member")
    : null;
  const topValue = top ? formatValue(kind, top.value) : null;
  const topUnit = top ? unitLabel(kind, top.value, t) : null;
  const topDetail = top && isGym ? rowSubtitle({ category, row: top, scopeLevel: "gym", t }) : null;
  const topMeta = top
    ? isGym
      ? topDetail
        ? t("gyms.card.topDetail", { detail: topDetail })
        : t("gyms.card.topRank")
      : top.gymName
        ? t("gyms.card.topAt", { gym: top.gymName })
        : t("gyms.card.topRank")
    : null;

  const rankLine =
    meState === "ranked"
      ? isGym
        ? t("gyms.card.rankOf", { rank: me.rank, total: me.total ?? card?.participantCount ?? me.rank })
        : t("gyms.card.rankWhere", { rank: me.rank, where })
      : meState === "out"
        ? t("category.notIn", { where })
        : t("gyms.card.notRanked");
  // Nobody on the list and nothing to say about you: the calm line alone.
  const showMe = Boolean(top) || meState === "out" || meState === "ranked";
  const progress =
    meState === "ranked" && me.progress !== null && me.progress !== undefined && Number.isFinite(Number(me.progress))
      ? Math.max(0.04, Math.min(1, Number(me.progress)))
      : null;

  const accessibilityLabel = [
    levelLabel ? `${title}, ${levelLabel}` : title,
    top
      ? t("gyms.card.a11yTop", { name: topName, value: `${topValue} ${topUnit}` })
      : t("gyms.card.empty"),
    showMe ? `${t("common.you")}: ${rankLine}` : null,
  ]
    .filter(Boolean)
    .map((part) => part.replace(/\.\s*$/, ""))
    .join(". ");

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={t("gyms.card.a11yHint")}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }, style]}
    >
      <RadialGlow color={tone} centerOpacity={0.26} midOpacity={0.07} />

      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.title} setColor={toneText} numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText style={styles.description} setColor={theme.quietText} numberOfLines={1}>
            {description}
          </ThemedText>
        </View>
        <View style={styles.chevron}>
          <ChevronRight width={18} height={18} color={theme.chevron} />
        </View>
      </View>

      {top ? (
        <View style={styles.topRow}>
          <MedalAvatar uri={top.person?.avatarUrl} size={40} medal="gold" />
          <View style={styles.topCopy}>
            <ThemedText style={styles.topName} setColor={theme.title} numberOfLines={1}>
              {topName}
            </ThemedText>
            <View style={styles.topMetaRow}>
              {!isGym && top.gymName ? (
                <MapPin width={10} height={10} color={theme.quietText} thickness={2.6} />
              ) : null}
              <ThemedText style={styles.topMeta} setColor={theme.quietText} numberOfLines={1}>
                {topMeta}
              </ThemedText>
            </View>
          </View>
          <View style={styles.valueGroup}>
            <ThemedText style={styles.topValue} setColor={toneText} numberOfLines={1}>
              {topValue}
            </ThemedText>
            <ThemedText style={styles.topUnit} setColor={theme.quietText} numberOfLines={1}>
              {topUnit}
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={[styles.empty, showMe ? null : styles.emptyOnly]}>
          <ThemedText style={styles.emptyText} setColor={theme.quietText}>
            {t("gyms.card.empty")}
          </ThemedText>
        </View>
      )}

      {showMe ? (
        <>
          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
          <View style={styles.meRow}>
            <View style={styles.meLine}>
              <ThemedText style={styles.meLabel} setColor={theme.primaryText}>
                {t("common.you")}
              </ThemedText>
              <ThemedText style={styles.meRank} setColor={theme.mutedStrong} numberOfLines={1}>
                {rankLine}
              </ThemedText>
              <View style={styles.meSpacer} />
              {meState === "ranked" ? (
                <View style={styles.meValueGroup}>
                  <ThemedText style={styles.meValue} setColor={theme.title} numberOfLines={1}>
                    {formatValue(kind, me.value)}
                  </ThemedText>
                  <ThemedText style={styles.meUnit} setColor={theme.quietText} numberOfLines={1}>
                    {unitLabel(kind, me.value, t)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            {isGym && progress !== null ? (
              <View style={[styles.barTrack, { backgroundColor: withAlpha(theme.title, 0.055) }]}>
                <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: tone }]} />
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </TouchableOpacity>
  );
}
