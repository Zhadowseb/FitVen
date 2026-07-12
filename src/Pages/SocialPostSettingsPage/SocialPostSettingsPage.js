import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import styles from "./SocialPostSettingsPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import Library from "../../Resources/Icons/UI-icons/Library";
import Social from "../../Resources/Icons/UI-icons/Social";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import { socialPostService } from "../../Services";
import {
  ThemedCard,
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const POST_MODE_OPTIONS = [
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_MODES.FULL_INFO,
    title: "Full info",
    body: "Automatically post workout summaries with stats, top sets and PR badges.",
  },
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_MODES.SUMMARY_ONLY,
    title: "Summary only",
    body: "Automatically post workout summaries with duration, sets and exercises only.",
  },
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_MODES.OFF,
    title: "Off",
    body: "Do not create workout summary posts automatically.",
  },
];

const POST_VISIBILITY_OPTIONS = [
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.EVERYONE,
    title: "Everyone",
    body: "Everyone can see your workout summary posts.",
  },
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.FOLLOWING,
    title: "People I follow",
    body: "Only profiles you follow can see your workout summary posts.",
  },
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.PRIVATE,
    title: "Only me",
    body: "Only you can see your workout summary posts.",
  },
];

export default function SocialPostSettingsPage() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [selectedMode, setSelectedMode] = useState(
    socialPostService.DEFAULT_WORKOUT_SUMMARY_POST_MODE
  );
  const [selectedVisibility, setSelectedVisibility] = useState(
    socialPostService.DEFAULT_WORKOUT_SUMMARY_POST_VISIBILITY
  );
  const [loadingMode, setLoadingMode] = useState(true);
  const [savingMode, setSavingMode] = useState(null);
  const [savingVisibility, setSavingVisibility] = useState(null);
  const [modeError, setModeError] = useState("");
  const [visibilityError, setVisibilityError] = useState("");
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const panelSurface = theme.uiBackground ?? theme.background;
  const primaryColor = theme.primary ?? "#f7742e";
  const choiceSurface = colorScheme === "dark" ? "#221f1d" : "#f1eff2";
  const selectedChoiceSurface = withAlpha(
    theme.primary,
    colorScheme === "dark" ? 0.12 : 0.14
  );
  const dangerColor = theme.danger ?? "#da1212";

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      const loadPostSettings = async () => {
        try {
          setLoadingMode(true);
          setModeError("");
          setVisibilityError("");
          const [mode, visibility] = await Promise.all([
            socialPostService.getWorkoutSummaryPostMode({
              user,
            }),
            socialPostService.getWorkoutSummaryPostVisibility({
              user,
            }),
          ]);

          if (!isCancelled) {
            setSelectedMode(mode);
            setSelectedVisibility(visibility);
          }
        } catch (error) {
          if (!isCancelled) {
            setModeError(
              error instanceof Error
                ? error.message
                : "Could not load social post settings."
            );
          }
        } finally {
          if (!isCancelled) {
            setLoadingMode(false);
          }
        }
      };

      loadPostSettings();

      return () => {
        isCancelled = true;
      };
    }, [user])
  );

  const selectPostMode = useCallback(
    async (mode) => {
      if (!user?.id || savingMode || mode === selectedMode) {
        return;
      }

      const previousMode = selectedMode;
      setSelectedMode(mode);
      setSavingMode(mode);
      setModeError("");

      try {
        const savedMode = await socialPostService.setWorkoutSummaryPostMode({
          user,
          mode,
        });
        setSelectedMode(savedMode);
      } catch (error) {
        setSelectedMode(previousMode);
        setModeError(
          error instanceof Error
            ? error.message
            : "Could not save social post settings."
        );
      } finally {
        setSavingMode(null);
      }
    },
    [savingMode, selectedMode, user]
  );

  const selectPostVisibility = useCallback(
    async (visibility) => {
      if (
        !user?.id ||
        savingVisibility ||
        visibility === selectedVisibility
      ) {
        return;
      }

      const previousVisibility = selectedVisibility;
      setSelectedVisibility(visibility);
      setSavingVisibility(visibility);
      setVisibilityError("");

      try {
        const savedVisibility =
          await socialPostService.setWorkoutSummaryPostVisibility({
            user,
            visibility,
          });
        setSelectedVisibility(savedVisibility);
      } catch (error) {
        setSelectedVisibility(previousVisibility);
        setVisibilityError(
          error instanceof Error
            ? error.message
            : "Could not save post visibility."
        );
      } finally {
        setSavingVisibility(null);
      }
    },
    [savingVisibility, selectedVisibility, user]
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            Settings
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Social posts
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedCard
          style={[
            styles.card,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={styles.heroRow}>
            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor: panelSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <Social width={26} height={26} color={primaryColor} />
            </View>

            <View style={styles.heroCopy}>
              <ThemedTitle type="h3" style={styles.cardTitle}>
                Workout summaries
              </ThemedTitle>
              <ThemedText style={styles.cardBody} setColor={quietText}>
                Current posting behavior for completed workouts.
              </ThemedText>
            </View>
          </View>

          {loadingMode ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.settingList}>
              {POST_MODE_OPTIONS.map((option) => {
                const selected = selectedMode === option.value;
                const saving = savingMode === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.82}
                    disabled={Boolean(savingMode)}
                    onPress={() => selectPostMode(option.value)}
                    style={[
                      styles.choiceRow,
                      {
                        backgroundColor: selected
                          ? selectedChoiceSurface
                          : choiceSurface,
                        borderColor: selected ? primaryColor : cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.choiceCopy}>
                      <ThemedText style={styles.choiceTitle} setColor={titleColor}>
                        {option.title}
                      </ThemedText>
                      <ThemedText style={styles.choiceBody} setColor={quietText}>
                        {option.body}
                      </ThemedText>
                    </View>

                    <View
                      style={[
                        styles.choiceControl,
                        {
                          borderColor: selected ? primaryColor : cardBorder,
                          backgroundColor: selected
                            ? primaryColor
                            : "transparent",
                        },
                      ]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" />
                      ) : selected ? (
                        <Checkmark
                          width={16}
                          height={16}
                          color={theme.textInverted ?? theme.background}
                          thickness={2.2}
                        />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {modeError ? (
            <ThemedText style={styles.errorText} setColor={dangerColor}>
              {modeError}
            </ThemedText>
          ) : null}
        </ThemedCard>

        <ThemedCard
          style={[
            styles.card,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText
            size={12}
            style={styles.cardEyebrow}
            setColor={quietText}
          >
            Visibility
          </ThemedText>

          {loadingMode ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.settingListCompact}>
              {POST_VISIBILITY_OPTIONS.map((option) => {
                const selected = selectedVisibility === option.value;
                const saving = savingVisibility === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    activeOpacity={0.82}
                    disabled={Boolean(savingVisibility)}
                    onPress={() => selectPostVisibility(option.value)}
                    style={[
                      styles.choiceRow,
                      {
                        backgroundColor: selected
                          ? selectedChoiceSurface
                          : choiceSurface,
                        borderColor: selected ? primaryColor : cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.choiceCopy}>
                      <ThemedText style={styles.choiceTitle} setColor={titleColor}>
                        {option.title}
                      </ThemedText>
                      <ThemedText style={styles.choiceBody} setColor={quietText}>
                        {option.body}
                      </ThemedText>
                    </View>

                    <View
                      style={[
                        styles.choiceControl,
                        {
                          borderColor: selected ? primaryColor : cardBorder,
                          backgroundColor: selected
                            ? primaryColor
                            : "transparent",
                        },
                      ]}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" />
                      ) : selected ? (
                        <Checkmark
                          width={16}
                          height={16}
                          color={theme.textInverted ?? theme.background}
                          thickness={2.2}
                        />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {visibilityError ? (
            <ThemedText style={styles.errorText} setColor={dangerColor}>
              {visibilityError}
            </ThemedText>
          ) : null}
        </ThemedCard>

        <ThemedCard
          style={[
            styles.card,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText
            size={12}
            style={styles.cardEyebrow}
            setColor={quietText}
          >
            Exercises
          </ThemedText>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => navigation.navigate("ExerciseSocialPostSettingsPage")}
            style={[
              styles.settingsButton,
              {
                backgroundColor: choiceSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.settingsButtonContent}>
              <Library width={22} height={22} color={primaryColor} />
              <View style={styles.settingsButtonCopy}>
                <ThemedText
                  style={styles.settingsButtonTitle}
                  setColor={titleColor}
                >
                  Exercise visibility
                </ThemedText>
                <ThemedText
                  style={styles.settingsButtonBody}
                  setColor={quietText}
                >
                  Choose which exercises can appear in top sets and PR badges.
                </ThemedText>
              </View>
            </View>

            <TailArrowUpRight
              width={18}
              height={18}
              stroke={quietText}
              color={quietText}
            />
          </TouchableOpacity>
        </ThemedCard>
      </ScrollView>
    </ThemedView>
  );
}
