import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import styles from "./MusicSettingsPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { musicService } from "../../Services";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import MusicNote from "../../Resources/Icons/UI-icons/MusicNote";
import Social from "../../Resources/Icons/UI-icons/Social";
import {
  ThemedHeader,
  ThemedSwitch,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

/**
 * Profile -> Settings -> Music. Connect Spotify, and choose whether what is
 * playing during a workout is shown to followers on the Friends activity
 * tiles. Off by default; off deletes what was shared.
 */
export default function MusicSettingsPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState("error");
  const quietText = theme.quietText ?? theme.text;
  const primaryTextColor = theme.primaryText ?? theme.primary;

  const showFeedback = (text, tone = "error") => {
    setFeedback(text);
    setFeedbackTone(tone);
  };

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      setSettings(await musicService.getMusicSharingSettings({ user }));
      showFeedback("");
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "Could not load music settings.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const connect = async () => {
    setIsConnecting(true);
    showFeedback("");

    try {
      const result = await musicService.connectSpotify();

      if (result.connected) {
        showFeedback(
          result.accountName ? `Connected to Spotify as ${result.accountName}.` : "Connected to Spotify.",
          "success"
        );
        await load();
      }
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "Could not connect Spotify.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    setIsConnecting(true);
    showFeedback("");

    try {
      await musicService.disconnectMusic({ user });
      showFeedback("Spotify disconnected. Nothing more is shared.", "success");
      await load();
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "Could not disconnect Spotify.");
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleSharing = async (enabled) => {
    if (!user?.id) {
      showFeedback("Sign in to share music.");
      return;
    }

    setIsSaving(true);
    showFeedback("");
    setSettings((current) => (current ? { ...current, shareWithFriends: enabled } : current));

    try {
      await musicService.setMusicSharingEnabled({ user, enabled });
      showFeedback(
        enabled
          ? "Followers now see what is playing while you train."
          : "Sharing is off and what was shared has been removed.",
        "success"
      );
    } catch (error) {
      setSettings((current) => (current ? { ...current, shareWithFriends: !enabled } : current));
      showFeedback(error instanceof Error ? error.message : "Could not change music sharing.");
    } finally {
      setIsSaving(false);
    }
  };

  const connection = settings?.connection ?? null;
  const isAvailable = settings?.isAvailable ?? false;
  const isConfigured = (settings?.isConfigured ?? false) && isAvailable;

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText size={12} style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}>
            Settings
          </ThemedText>
          <ThemedTitle type="pageTitle" style={styles.pageHeaderTitleMain} numberOfLines={1}>
            Music
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={styles.row}>
            <View style={[styles.iconTile, { backgroundColor: withAlpha(theme.music, 0.16) }]}>
              <MusicNote width={18} height={18} color={theme.music} thickness={2.2} />
            </View>
            <View style={styles.rowCopy}>
              <ThemedText style={styles.rowTitle} setColor={theme.title}>
                Spotify
              </ThemedText>
              <ThemedText style={styles.rowBody} setColor={quietText} numberOfLines={2}>
                {isLoading
                  ? "Checking…"
                  : connection
                    ? connection.accountName
                      ? `Connected as ${connection.accountName}`
                      : "Connected"
                    : isConfigured
                      ? "Not connected"
                      : "Not available in this build"}
              </ThemedText>
            </View>
            {isLoading || isConnecting ? (
              <ActivityIndicator size="small" color={primaryTextColor} />
            ) : connection ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={disconnect}
                style={[styles.actionButton, { borderWidth: 1, borderColor: withAlpha(theme.title, 0.28) }]}
              >
                <ThemedText style={styles.actionText} setColor={theme.title}>
                  Disconnect
                </ThemedText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={connect}
                disabled={!isConfigured}
                style={[styles.actionButton, { backgroundColor: theme.primary, opacity: isConfigured ? 1 : 0.5 }]}
              >
                <ThemedText style={styles.actionText} setColor={theme.textInverted}>
                  Connect
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <View style={styles.row}>
            <View style={[styles.iconTile, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
              <Social width={18} height={18} color={primaryTextColor} />
            </View>
            <View style={styles.rowCopy}>
              <ThemedText style={styles.rowTitle} setColor={theme.title}>
                Share music with friends
              </ThemedText>
              <ThemedText style={styles.rowBody} setColor={quietText} numberOfLines={3}>
                People you follow back see the track that is playing while you train, and the last one
                after. Off removes what was shared.
              </ThemedText>
            </View>
            {isSaving ? (
              <ActivityIndicator size="small" color={primaryTextColor} />
            ) : (
              <ThemedSwitch
                value={Boolean(settings?.shareWithFriends)}
                onValueChange={toggleSharing}
                disabled={isLoading || !connection}
                accessibilityLabel="Share music with friends"
              />
            )}
          </View>
        </View>

        {feedback ? (
          <ThemedText style={styles.feedback} setColor={feedbackTone === "success" ? theme.secondary : theme.danger}>
            {feedback}
          </ThemedText>
        ) : null}

        <ThemedText style={styles.note} setColor={quietText}>
          Your Spotify login stays on this phone. Only track and artist names leave it, and only while a workout
          is running.
        </ThemedText>

        {!isLoading && !isAvailable ? (
          <ThemedText style={styles.note} setColor={quietText}>
            {musicService.SPOTIFY_NOT_IN_BUILD_MESSAGE}
          </ThemedText>
        ) : !isLoading && !isConfigured ? (
          <ThemedText style={styles.note} setColor={quietText}>
            {`Spotify needs a client id in the app config and this redirect URI registered in the Spotify dashboard: `}
            <ThemedText style={[styles.note, styles.code]} setColor={theme.title}>
              {settings?.redirectUri ?? "fitven://spotify-auth"}
            </ThemedText>
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}
