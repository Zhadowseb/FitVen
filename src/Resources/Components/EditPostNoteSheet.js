import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";

import { Colors } from "../GlobalStyling/colors";
import { useAuth } from "../../Contexts/AuthContext";
import { socialPostService } from "../../Services";
import {
  ThemedBottomSheet,
  ThemedButton,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
} from "../ThemedComponents";

export const MAX_POST_NOTE_LENGTH = 220;

/**
 * Editing the note of one post, as a panel over the post itself. A full screen
 * for a single field hid the thing being written about.
 *
 * `post` carries { id, title, note } and doubles as the visible flag.
 */
export default function EditPostNoteSheet({ post, onClose, onSaved }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const postId = post?.id ?? null;

  // Seeded from the row that opened the sheet so there is something to read at
  // once, then refreshed from the server in case it was edited elsewhere.
  useEffect(() => {
    if (!postId) {
      return undefined;
    }

    let cancelled = false;
    setNote(post?.note ?? "");
    setErrorMessage("");

    if (!user?.id) {
      setErrorMessage("Sign in to edit this post.");
      return undefined;
    }

    const loadPost = async () => {
      try {
        setLoading(true);
        const loadedPost = await socialPostService.getWorkoutSummaryPostById({
          user,
          postId,
        });

        if (!cancelled) {
          setNote(loadedPost.body ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load this post."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPost();

    return () => {
      cancelled = true;
    };
    // The seed note is only for the first paint of a given post.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user]);

  const savePost = useCallback(async () => {
    if (saving || !postId || !user?.id) {
      return;
    }

    try {
      setSaving(true);
      await socialPostService.updateWorkoutSummaryPostNote({
        user,
        postId,
        note,
      });
      onSaved?.();
      onClose?.();
    } catch (error) {
      Alert.alert(
        "Could not save post",
        error instanceof Error
          ? error.message
          : "The post note could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }, [note, onClose, onSaved, postId, saving, user]);

  return (
    <ThemedBottomSheet
      visible={Boolean(post)}
      onClose={saving ? () => {} : onClose}
      footer={
        <View style={styles.footer}>
          <ThemedButton
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            style={styles.footerButton}
            disabled={saving}
          />
          <ThemedButton
            title={saving ? "Saving..." : "Save"}
            onPress={savePost}
            style={styles.footerButton}
            disabled={saving || loading || Boolean(errorMessage)}
          />
        </View>
      }
    >
      <ThemedText style={styles.eyebrow} setColor={quietText}>
        Editing note on
      </ThemedText>

      <ThemedTitle type="h3" style={styles.postTitle} numberOfLines={2}>
        {post?.title ?? "Workout summary"}
      </ThemedTitle>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={primaryTextColor} />
        </View>
      ) : (
        <>
          {errorMessage ? (
            <ThemedText style={styles.errorText} setColor={theme.danger}>
              {errorMessage}
            </ThemedText>
          ) : null}

          <ThemedTextInput
            value={note}
            onChangeText={setNote}
            placeholder="Write a note..."
            multiline
            maxLength={MAX_POST_NOTE_LENGTH}
            textAlignVertical="top"
            inputStyle={styles.noteInput}
            editable={!saving && !errorMessage}
          />

          <ThemedText style={styles.characterCount} setColor={quietText}>
            {note.length}/{MAX_POST_NOTE_LENGTH}
          </ThemedText>
        </>
      )}
    </ThemedBottomSheet>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  postTitle: {
    marginTop: 2,
    marginBottom: 14,
  },

  loadingRow: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },

  errorText: {
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
  },

  noteInput: {
    minHeight: 130,
    paddingTop: 12,
    fontSize: 15,
    lineHeight: 21,
  },

  characterCount: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "right",
  },

  footer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  footerButton: {
    flex: 1,
  },
});
