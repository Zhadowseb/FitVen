import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import styles from "./SocialPostEditPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { Colors } from "../../Resources/GlobalStyling/colors";
import {
  ThemedButton,
  ThemedHeader,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { socialPostService } from "../../Services";

const MAX_NOTE_LENGTH = 220;

export default function SocialPostEditPage({ route }) {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const postId = route?.params?.postId ?? null;
  const initialNote = route?.params?.initialNote ?? "";
  const postTitle = route?.params?.postTitle ?? "Workout summary";
  const [note, setNote] = useState(initialNote);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const characterCount = useMemo(() => note.length, [note]);

  useEffect(() => {
    let cancelled = false;

    const loadPost = async () => {
      if (!postId || !user?.id) {
        setLoading(false);
        setErrorMessage("Could not load this post.");
        return;
      }

      try {
        setLoading(true);
        setErrorMessage("");
        const post = await socialPostService.getWorkoutSummaryPostById({
          user,
          postId,
        });

        if (!cancelled) {
          setNote(post.body ?? "");
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
      navigation.goBack();
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
  }, [navigation, note, postId, saving, user]);

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <ThemedTitle type="h3" style={styles.headerTitle}>
          Edit post
        </ThemedTitle>
      </ThemedHeader>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.cardBorder ?? theme.border,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.eyebrow,
                { color: theme.quietText ?? theme.iconColor },
              ]}
            >
              Workout summary
            </ThemedText>

            <ThemedTitle type="h3" style={styles.postTitle} numberOfLines={2}>
              {postTitle}
            </ThemedTitle>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator />
              </View>
            ) : (
              <>
                {errorMessage ? (
                  <ThemedText
                    style={[styles.errorText, { color: theme.danger }]}
                  >
                    {errorMessage}
                  </ThemedText>
                ) : null}

                <ThemedTextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Write a note..."
                  multiline
                  maxLength={MAX_NOTE_LENGTH}
                  textAlignVertical="top"
                  inputStyle={styles.noteInput}
                  editable={!saving && !errorMessage}
                />

                <ThemedText
                  style={[
                    styles.characterCount,
                    { color: theme.quietText ?? theme.iconColor },
                  ]}
                >
                  {characterCount}/{MAX_NOTE_LENGTH}
                </ThemedText>
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <ThemedButton
            title="Cancel"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.footerButton}
            disabled={saving}
          />
          <ThemedButton
            title={saving ? "Saving..." : "Save"}
            onPress={savePost}
            style={styles.footerButton}
            disabled={saving || loading || !!errorMessage}
          />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
