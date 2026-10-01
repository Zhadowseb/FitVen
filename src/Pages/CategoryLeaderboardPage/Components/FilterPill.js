import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./FilterPillStyle";
import Caret from "./Caret";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";
import { readableTone } from "@utils/categoryFormat";
import { mixHexColors } from "@utils/colorMix";

/**
 * One filter under the tabs. Two kinds:
 *  - a value that opens a sheet ("Alle aldre", with a caret);
 *  - a fixed label (`isStatic`: "Alle vægte" while there is no body weight to
 *    sort anybody by - it cannot be pressed, and says why to a screen reader).
 * `active` is a filter that narrows the list: an age group, say.
 */
export default function FilterPill({
  label,
  active = false,
  onPress,
  isStatic = false,
  accessibilityLabel,
  accessibilityHint,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // On its own tint the accent's text colour can land a hair under 4.5:1
  // (Volt, light), so it is checked against the tint it actually sits on.
  const textColor = active
    ? readableTone(theme.primaryText, [mixHexColors(theme.cardBackground, theme.primary, 0.14)], theme.title)
    : theme.mutedStrong;
  const surface = active
    ? { backgroundColor: withAlpha(theme.primary, 0.14), borderColor: withAlpha(theme.primary, 0.5) }
    : { backgroundColor: theme.cardBackground, borderColor: withAlpha(theme.title, 0.09) };
  const content = (
    <>
      <ThemedText style={styles.label} setColor={textColor} numberOfLines={1}>
        {label}
      </ThemedText>
      {!isStatic ? <Caret color={textColor} size={12} /> : null}
    </>
  );

  if (isStatic) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        style={[styles.pill, surface]}
      >
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.82}
      onPress={onPress}
      style={[styles.pill, surface]}
    >
      {content}
    </TouchableOpacity>
  );
}
