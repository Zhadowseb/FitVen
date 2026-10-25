import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { ASK_TIERS, questionsLeft } from "@utils/askTiers";
import styles from "../AskPageStyle";

/**
 * The three models and how many questions each has left this month. The one
 * FitVen recommends for the question is marked; the one chosen is filled. A
 * model with none left can still be looked at but not chosen. The person can
 * always change the choice.
 */
export default function TierPicker({ usage, selected, recommended, onSelect, disabled }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("ask.tier.pickerLabel")}
      style={styles.tiers}
    >
      {ASK_TIERS.map((tier) => {
        const left = questionsLeft(usage, tier);
        const name = t(`ask.tier.${tier}`);
        const isSelected = selected === tier;
        const isRecommended = recommended === tier;
        const exhausted = left === 0;
        const caption = left === null ? "" : t("ask.tier.left", { count: left });
        const spoken = [
          left === null ? t("ask.tier.a11yUnknown", { name }) : t("ask.tier.a11y", { name, count: left }),
          isRecommended ? t("ask.tier.recommended") : null,
        ]
          .filter(Boolean)
          .join(". ");

        return (
          <TouchableOpacity
            key={tier}
            accessibilityRole="radio"
            accessibilityLabel={spoken}
            accessibilityState={{ selected: isSelected, disabled: disabled || exhausted }}
            activeOpacity={0.85}
            disabled={disabled || exhausted}
            onPress={() => onSelect(tier)}
            style={[
              styles.tierChip,
              {
                backgroundColor: isSelected ? withAlpha(theme.primary, 0.16) : theme.cardBackground,
                borderColor: isSelected ? theme.primary : theme.cardBorder,
                opacity: exhausted ? 0.5 : 1,
              },
            ]}
          >
            <ThemedText style={styles.tierName} setColor={theme.title}>
              {name}
            </ThemedText>
            {caption ? (
              <ThemedText style={styles.tierLeft} setColor={theme.quietText} numberOfLines={1}>
                {caption}
              </ThemedText>
            ) : null}
            {isRecommended ? (
              <ThemedText style={styles.tierLeft} setColor={theme.primaryText} numberOfLines={1}>
                {t("ask.tier.recommended")}
              </ThemedText>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
