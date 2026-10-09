import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./DetailTopBarStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import ThreeDots from "@resources/Icons/UI-icons/ThreeDots";

// 36 dp buttons, 44 dp to the finger.
const HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

/**
 * Back, and the menu when there is one, across the top of the exercise page.
 *
 * `surface` is what the two sit on:
 * - "video": the clip. Dark in both themes, so the dark palette on purpose -
 *   a veil of the dark background and light icons.
 * - "block": the card-coloured stand-in for a missing clip, or the skeleton.
 * - "page": the page itself, as on the error and unavailable states.
 */
export default function DetailTopBar({ surface = "page", onBack, onMenu = null, style }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const overVideo = surface === "video";
  const buttonColors = overVideo
    ? { backgroundColor: withAlpha(Colors.dark.background, 0.6), borderColor: "transparent" }
    : {
        // On the card-coloured block a card-coloured button would vanish, so
        // it takes the page's colour there, and the card's on the page.
        backgroundColor: surface === "block" ? theme.background : theme.cardBackground,
        borderColor: theme.cardBorder,
      };
  const backColor = overVideo ? Colors.dark.title : theme.title;
  const menuColor = overVideo ? Colors.dark.title : theme.mutedStrong;

  return (
    <View pointerEvents="box-none" style={[styles.bar, style]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("common.goBack")}
        activeOpacity={0.8}
        hitSlop={HIT_SLOP}
        onPress={onBack}
        style={[styles.button, buttonColors]}
      >
        <ArrowLeft width={20} height={20} color={backColor} />
      </TouchableOpacity>

      {onMenu ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("customExerciseDetail.menu.open")}
          activeOpacity={0.8}
          hitSlop={HIT_SLOP}
          onPress={onMenu}
          style={[styles.button, buttonColors]}
        >
          <ThreeDots width={17} height={17} color={menuColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
