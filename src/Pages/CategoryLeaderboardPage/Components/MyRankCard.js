import { View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./MyRankCardStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText, UserAvatar } from "@resources/ThemedComponents";
import { NO_VALUE, formatValue, unitBesideValue, unitLabel } from "@utils/categoryFormat";

/**
 * Your own place, pinned under the list so it is always in sight - also when
 * you are in the top three. Four ways it can read:
 *  - "row": your rank, "Dig", how far it is to the place above, your value;
 *  - "notInFilter": the filter that leaves you out, named, instead of a rank;
 *  - "noValue": you train here but nothing of yours counts in the category
 *    yet - and what would;
 *  - "notMember": you have not trained at this level, said calmly, with who
 *    the list counts.
 * Every mode but "row" is a `message` and an optional `detail`.
 */
export default function MyRankCard({ mode, me, kind, subtitle, message, detail }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <View
        style={[
          styles.inner,
          { backgroundColor: withAlpha(theme.primary, 0.08), borderLeftColor: theme.primary },
        ]}
      >
        {mode === "row" ? (
          <View style={styles.row} accessible>
            <ThemedText style={styles.rank} setColor={theme.primaryText} numberOfLines={1}>
              {me?.rank ? `#${me.rank}` : NO_VALUE}
            </ThemedText>

            <UserAvatar
              uri={me?.person?.avatarUrl}
              size={34}
              iconSize={16}
              borderWidth={2}
              borderColor={theme.primary}
            />

            <View style={styles.copy}>
              <ThemedText style={styles.name} setColor={theme.primaryText} numberOfLines={1}>
                {t("common.you")}
              </ThemedText>
              {subtitle ? (
                <ThemedText style={styles.subtitle} setColor={theme.quietText} numberOfLines={1}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>

            <View style={unitBesideValue(kind) ? styles.valueGroupInline : styles.valueGroup}>
              <ThemedText style={styles.value} setColor={theme.title} numberOfLines={1}>
                {formatValue(kind, me?.value)}
              </ThemedText>
              <ThemedText style={styles.unit} setColor={theme.quietText} numberOfLines={1}>
                {unitLabel(kind, me?.value, t)}
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={styles.message} accessible>
            <ThemedText style={styles.messageTitle} setColor={theme.title}>
              {message}
            </ThemedText>
            {detail ? (
              <ThemedText style={styles.messageDetail} setColor={theme.quietText}>
                {detail}
              </ThemedText>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}
