import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./SortSheetStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import { ThemedBottomSheet, ThemedText } from "@resources/ThemedComponents";
import { CUSTOM_EXERCISE_SORTS, sortLabelKey } from "@utils/customExercises";

// One line under each sort, because three of them are orders and three are
// filters - "Has video" leaves out the rest, "Most used" only reorders them.
const SORT_HINT_KEYS = {
  popular: "customExercises.sortHints.popular",
  newest: "customExercises.sortHints.newest",
  gym: "customExercises.sortHints.gym",
  following: "customExercises.sortHints.following",
  video: "customExercises.sortHints.video",
  saved: "customExercises.sortHints.saved",
};

/**
 * The library's sort, as a sheet: the same six choices as the chips under
 * the button, in the same order, so the two can never disagree. Choosing one
 * hands it to `onSelect`; the page closes the sheet and the chips follow.
 */
export default function SortSheet({ visible, value, onSelect, onClose }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <ThemedText style={styles.overline} setColor={theme.quietText}>
          {t("customExercises.library.sortEyebrow")}
        </ThemedText>
        <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
          {t("customExercises.library.sortTitle")}
        </ThemedText>
      </View>

      <View style={styles.rows} accessibilityRole="radiogroup">
        {CUSTOM_EXERCISE_SORTS.map((sort) => {
          const selected = sort === value;

          return (
            <TouchableOpacity
              key={sort}
              activeOpacity={0.84}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t(sortLabelKey(sort))}, ${t(SORT_HINT_KEYS[sort])}`}
              onPress={() => onSelect?.(sort)}
              style={[
                styles.row,
                selected
                  ? {
                      backgroundColor: withAlpha(theme.primary, 0.1),
                      borderColor: withAlpha(theme.primary, 0.4),
                    }
                  : { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.rowCopy}>
                <ThemedText style={styles.rowTitle} setColor={selected ? theme.primaryText : theme.title}>
                  {t(sortLabelKey(sort))}
                </ThemedText>
                <ThemedText style={styles.rowDetail} setColor={theme.quietText} numberOfLines={2}>
                  {t(SORT_HINT_KEYS[sort])}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.check,
                  selected
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { borderColor: theme.overlayStrong },
                ]}
              >
                {selected ? <Checkmark width={13} height={13} color={theme.textInverted} thickness={3} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ThemedBottomSheet>
  );
}
