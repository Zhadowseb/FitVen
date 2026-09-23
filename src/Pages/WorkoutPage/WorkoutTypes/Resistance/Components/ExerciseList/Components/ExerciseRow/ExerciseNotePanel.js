import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./ExerciseNotePanelStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Note from "@resources/Icons/UI-icons/Note";
import ReplayHistory from "@resources/Icons/UI-icons/ReplayHistory";
import { ThemedText, ThemedTextInput } from "@resources/ThemedComponents";

/**
 * This exercise's note, and the one from last time underneath it.
 *
 * Edited where it is read: tap the text and it becomes the field, rather than
 * opening a modal on top of the card. It is saved on Done, when the keyboard
 * goes, and when the panel closes - the same three ways out a set's note is
 * saved in SetList - so there is no way to leave that throws the words away.
 *
 * "Last time" is the previous session's note only, and only when it had one.
 * A note from three sessions back, shown under that heading, would be about
 * a different day.
 */
export default function ExerciseNotePanel({ note, previousNote, onSave, surface, border }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const lastSavedRef = useRef(note ?? "");
  const draftRef = useRef(note ?? "");
  // The save on close runs from a cleanup that captured the first render, so
  // everything it touches has to be read through a ref - the handler too, or
  // a parent that passes a new one would have its old one called.
  const onSaveRef = useRef(onSave);

  onSaveRef.current = onSave;

  // A note that arrives from elsewhere - a sync, the other device - replaces
  // the draft only while it is not being typed into.
  useEffect(() => {
    if (!isEditing) {
      setDraft(note ?? "");
      draftRef.current = note ?? "";
      lastSavedRef.current = note ?? "";
    }
  }, [isEditing, note]);

  const save = () => {
    const next = draftRef.current.trim();

    if (next === lastSavedRef.current.trim()) {
      return;
    }

    lastSavedRef.current = next;
    onSaveRef.current?.(next);
  };

  // Closing the panel is one of the ways out, so it saves too. Read through
  // the ref: by the time this runs the state is from the first render.
  useEffect(() => () => save(), []);

  const finish = () => {
    save();
    setIsEditing(false);
    Keyboard.dismiss();
  };

  const hasNote = draft.trim().length > 0;
  const primaryText = theme.primaryText ?? theme.primary;

  return (
    <View style={[styles.panel, { backgroundColor: surface, borderColor: border }]}>
      <View
        style={[
          styles.box,
          {
            backgroundColor: surface,
            borderColor: isEditing ? withAlpha(theme.primary, 0.5) : withAlpha(theme.title, 0.07),
          },
        ]}
      >
        <View style={styles.overlineRow}>
          <Note width={14} height={14} color={primaryText} />
          <ThemedText style={styles.overline} setColor={primaryText}>
            {t("workout.note.title")}
          </ThemedText>

          <View style={styles.spacer} />

          {isEditing ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("workout.note.done")}
              activeOpacity={0.85}
              onPress={finish}
              hitSlop={8}
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={styles.doneText} setColor={theme.textInverted}>
                {t("workout.note.done")}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>

        {isEditing ? (
          <ThemedTextInput
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              draftRef.current = value;
            }}
            onEndEditing={finish}
            onBlur={save}
            placeholder={t("workout.note.placeholder")}
            multiline
            autoFocus
            textAlignVertical="top"
            inputStyle={[
              styles.input,
              { borderColor: withAlpha(theme.primary, 0.5), color: theme.title },
            ]}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasNote ? t("workout.note.edit") : t("workout.note.placeholder")}
            onPress={() => setIsEditing(true)}
          >
            <ThemedText
              style={styles.noteText}
              setColor={hasNote ? theme.title : theme.quietText}
            >
              {hasNote ? draft : t("workout.note.placeholder")}
            </ThemedText>
          </Pressable>
        )}
      </View>

      {previousNote ? (
        <View style={[styles.box, styles.previousBox, { borderColor: withAlpha(theme.title, 0.1) }]}>
          <View style={styles.overlineRow}>
            <ReplayHistory width={13} height={13} color={theme.quietText} />
            <ThemedText style={styles.overline} setColor={theme.quietText}>
              {t("workout.note.lastTime")}
            </ThemedText>

            <View style={styles.spacer} />

            <ThemedText style={styles.previousDate} setColor={theme.quietText} numberOfLines={1}>
              {previousNote.dateLabel}
            </ThemedText>
          </View>

          <ThemedText style={styles.previousText} setColor={theme.text}>
            {previousNote.note}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}
