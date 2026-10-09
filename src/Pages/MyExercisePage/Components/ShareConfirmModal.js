import { View, useColorScheme } from "react-native";

import styles from "./ShareConfirmModalStyle";
import { useTranslation } from "@localization";
import { Colors } from "@resources/GlobalStyling/colors";
import Eye from "@resources/Icons/UI-icons/Eye";
import Lock from "@resources/Icons/UI-icons/Lock";
import { ThemedConfirmModal, ThemedText } from "@resources/ThemedComponents";

function Item({ icon, text, theme }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemIcon}>{icon}</View>
      <ThemedText style={styles.itemText} setColor={theme.title}>
        {text}
      </ThemedText>
    </View>
  );
}

/**
 * Asked before an exercise is shared, because sharing puts things in front of
 * people who do not know you: exactly what everyone signed in will see, and
 * what they never will. The centre is on the list because the exercise's page
 * shows its maker's centre (CustomExerciseDetail.ownerGymName).
 *
 * Props: visible, nudge (the "add a video" line, or null), onConfirm, onClose.
 */
export default function ShareConfirmModal({ visible, nudge = null, onConfirm, onClose }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const seen = [
    t("myExercise.share.confirm.seeName"),
    t("myExercise.share.confirm.seeWhat"),
    t("myExercise.share.confirm.seeVideo"),
    t("myExercise.share.confirm.seeOwner"),
  ];

  return (
    <ThemedConfirmModal
      visible={visible}
      title={t("myExercise.share.confirm.title")}
      message={t("myExercise.share.confirm.body")}
      confirmLabel={t("myExercise.share.confirm.confirm")}
      cancelLabel={t("common.cancel")}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <View
        style={[
          styles.box,
          { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder },
        ]}
      >
        <ThemedText style={styles.label} setColor={theme.quietText}>
          {t("myExercise.share.confirm.seeLabel")}
        </ThemedText>
        {seen.map((text) => (
          <Item
            key={text}
            icon={<Eye width={15} height={15} color={theme.primaryText} thickness={1.8} />}
            text={text}
            theme={theme}
          />
        ))}

        <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

        <ThemedText style={styles.label} setColor={theme.quietText}>
          {t("myExercise.share.confirm.neverLabel")}
        </ThemedText>
        <Item
          icon={<Lock width={15} height={15} color={theme.secondary} />}
          text={t("myExercise.share.confirm.neverSets")}
          theme={theme}
        />
        {/* The page's figures - users, "typically 3 × 10", what others lift -
            are worked out on the server across everyone who has it, yours
            included; said here so "never" is not read as more than it is. */}
        <ThemedText style={styles.note} setColor={theme.quietText}>
          {t("myExercise.share.confirm.neverNote")}
        </ThemedText>
      </View>

      {nudge ? (
        <ThemedText style={styles.nudge} setColor={theme.quietText}>
          {nudge}
        </ThemedText>
      ) : null}
    </ThemedConfirmModal>
  );
}
