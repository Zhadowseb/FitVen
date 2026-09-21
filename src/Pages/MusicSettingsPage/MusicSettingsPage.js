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
import { useAuth } from "@contexts/AuthContext";
import { musicService } from "@services";
import { useTranslation } from "@localization";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import MusicNote from "@resources/Icons/UI-icons/MusicNote";
import Social from "@resources/Icons/UI-icons/Social";
import {
  ThemedHeader,
  ThemedSwitch,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "@resources/ThemedComponents";

/**
 * Profile -> Settings -> Music. Connect Spotify, and choose whether what is
 * playing during a workout is shown to followers on the Friends activity
 * tiles. Off by default; off deletes what was shared.
 */
export default function MusicSettingsPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
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
      showFeedback(
        error instanceof Error ? error.message : t("music.settings.couldNotLoad")
      );
    } finally {
      setIsLoading(false);
    }
  }, [t, user]);

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
          result.accountName
            ? t("music.connection.connectedAs", { name: result.accountName })
            : t("music.connection.connected"),
          "success"
        );
        await load();
      }
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : t("music.connection.couldNotConnect")
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    setIsConnecting(true);
    showFeedback("");

    try {
      await musicService.disconnectMusic({ user });
      showFeedback(t("music.connection.disconnected"), "success");
      await load();
    } catch (error) {
      showFeedback(
        error instanceof Error
          ? error.message
          : t("music.connection.couldNotDisconnect")
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleSharing = async (enabled) => {
    if (!user?.id) {
      showFeedback(t("music.shareWithFriends.signInToShare"));
      return;
    }

    setIsSaving(true);
    showFeedback("");
    setSettings((current) => (current ? { ...current, shareWithFriends: enabled } : current));

    try {
      await musicService.setMusicSharingEnabled({ user, enabled });
      showFeedback(
        enabled
          ? t("music.shareWithFriends.turnedOn")
          : t("music.shareWithFriends.turnedOff"),
        "success"
      );
    } catch (error) {
      setSettings((current) => (current ? { ...current, shareWithFriends: !enabled } : current));
      showFeedback(
        error instanceof Error
          ? error.message
          : t("music.shareWithFriends.couldNotChange")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const connection = settings?.connection ?? null;
  const isAvailable = settings?.isAvailable ?? false;
  const isConfigured = (settings?.isConfigured ?? false) && isAvailable;
  const connectionStatus = isLoading
    ? t("music.status.checking")
    : connection
      ? connection.accountName
        ? t("music.status.connectedAs", { name: connection.accountName })
        : t("music.status.connected")
      : isConfigured
        ? t("music.status.notConnected")
        : t("music.status.notAvailable");

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText size={12} style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}>
            {t("music.settings.eyebrow")}
          </ThemedText>
          <ThemedTitle type="pageTitle" style={styles.pageHeaderTitleMain} numberOfLines={1}>
            {t("music.settings.title")}
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
                {connectionStatus}
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
                  {t("music.disconnect")}
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
                  {t("music.connect")}
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
                {t("music.shareWithFriends.title")}
              </ThemedText>
              <ThemedText style={styles.rowBody} setColor={quietText} numberOfLines={3}>
                {t("music.shareWithFriends.body")}
              </ThemedText>
            </View>
            {isSaving ? (
              <ActivityIndicator size="small" color={primaryTextColor} />
            ) : (
              <ThemedSwitch
                value={Boolean(settings?.shareWithFriends)}
                onValueChange={toggleSharing}
                disabled={isLoading || !connection}
                accessibilityLabel={t("music.shareWithFriends.title")}
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
          {t("music.settings.note")}
        </ThemedText>

        {!isLoading && !isAvailable ? (
          <ThemedText style={styles.note} setColor={quietText}>
            {t("music.errors.notInBuild")}
          </ThemedText>
        ) : !isLoading && !isConfigured ? (
          // Developer-facing, like SPOTIFY_NOT_CONFIGURED_MESSAGE in the
          // service: it names the app config and the Spotify dashboard, and
          // only shows on a build somebody is setting up. Not translated.
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
