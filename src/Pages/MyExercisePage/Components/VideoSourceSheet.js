import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./VideoSourceSheetStyle";
import { useTranslation } from "@localization";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import CameraPlus from "@resources/Icons/UI-icons/CameraPlus";
import Play from "@resources/Icons/UI-icons/Play";
import { ThemedBottomSheet, ThemedText } from "@resources/ThemedComponents";

/**
 * Where the clip comes from: the camera or the library. It only says which -
 * `onChoose("camera" | "library")` - and the page opens the picker once this
 * sheet has gone (`onDismiss`), because iOS drops a picker presented while
 * another modal is still on screen.
 *
 * Props: visible, isReplacing (a video is there already), maxSeconds,
 *        onChoose(source), onClose(), onDismiss()
 */
export default function VideoSourceSheet({
  visible,
  isReplacing = false,
  maxSeconds,
  onChoose,
  onClose,
  onDismiss,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const iconSurface = withAlpha(theme.primary, colorScheme === "light" ? 0.12 : 0.14);
  const options = [
    {
      key: "camera",
      title: t("myExercise.video.sheet.record"),
      body: t("myExercise.video.sheet.recordBody", { seconds: maxSeconds }),
      icon: <CameraPlus width={19} height={19} color={theme.primaryText} thickness={1.8} />,
    },
    {
      key: "library",
      title: t("myExercise.video.sheet.library"),
      body: t("myExercise.video.sheet.libraryBody", { seconds: maxSeconds }),
      icon: <Play width={16} height={16} color={theme.primaryText} />,
    },
  ];

  return (
    <ThemedBottomSheet visible={visible} onClose={onClose} onDismiss={onDismiss}>
      <View style={styles.header}>
        <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
          {isReplacing ? t("myExercise.video.change") : t("myExercise.video.add")}
        </ThemedText>
        <ThemedText style={styles.body} setColor={theme.quietText}>
          {t("myExercise.video.sheet.body", { seconds: maxSeconds })}
        </ThemedText>
      </View>

      {options.map((option) => (
        <TouchableOpacity
          key={option.key}
          accessibilityRole="button"
          accessibilityLabel={option.title}
          accessibilityHint={option.body}
          activeOpacity={0.85}
          onPress={() => onChoose?.(option.key)}
          style={[
            styles.option,
            { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder },
          ]}
        >
          <View style={[styles.optionIcon, { backgroundColor: iconSurface }]}>
            {option.icon}
          </View>
          <View style={styles.optionCopy}>
            <ThemedText style={styles.optionTitle} setColor={theme.title}>
              {option.title}
            </ThemedText>
            <ThemedText style={styles.optionBody} setColor={theme.quietText}>
              {option.body}
            </ThemedText>
          </View>
        </TouchableOpacity>
      ))}
    </ThemedBottomSheet>
  );
}
