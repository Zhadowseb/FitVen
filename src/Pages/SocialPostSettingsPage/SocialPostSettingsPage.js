import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "@localization";

import styles from "./SocialPostSettingsPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import Library from "../../Resources/Icons/UI-icons/Library";
import Social from "../../Resources/Icons/UI-icons/Social";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import { socialPostService } from "../../Services";
import Star from "../../Resources/Icons/UI-icons/Star";
import {
  ThemedCard,
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

// The preview text is translated when it is drawn; the lists hold keys.
const PREVIEW_STATS = [
  { key: "duration", textKey: "settings.socialPosts.preview.duration" },
  { key: "volume", text: "4 200 kg" },
  { key: "exercises", textKey: "common.exercises", params: { count: 5 } },
];

const PREVIEW_TOP_SETS = [
  { key: "bench", nameKey: "settings.socialPosts.preview.benchPress", set: "5 x 90 kg", record: true },
  { key: "row", nameKey: "settings.socialPosts.preview.barbellRow", set: "8 x 70 kg", record: false },
];

const POST_MODE_OPTIONS = [
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_MODES.FULL_INFO,
    titleKey: "settings.socialPosts.modes.fullInfo",
    preview: {
      stats: PREVIEW_STATS,
      topSets: PREVIEW_TOP_SETS,
    },
  },
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_MODES.SUMMARY_ONLY,
    titleKey: "settings.socialPosts.modes.summaryOnly",
    preview: {
      stats: PREVIEW_STATS,
      topSets: [],
    },
  },
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_MODES.OFF,
    titleKey: "settings.socialPosts.modes.off",
    preview: null,
  },
];

const POST_VISIBILITY_OPTIONS = [
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.EVERYONE,
    titleKey: "settings.socialPosts.visibility.everyone",
  },
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.FOLLOWING,
    titleKey: "settings.socialPosts.visibility.following",
  },
  {
    value: socialPostService.WORKOUT_SUMMARY_POST_VISIBILITIES.PRIVATE,
    titleKey: "settings.socialPosts.visibility.private",
  },
];

// A sample of the post itself, so the choice is not a word to be interpreted.
function PostModePreview({ preview, theme }) {
  const { t } = useTranslation();
  const quietText = theme.quietText ?? theme.text;
  const titleColor = theme.title ?? theme.text;

  if (!preview) {
    return (
      <ThemedText style={styles.previewEmptyText} setColor={quietText}>
        {t("settings.socialPosts.nothingPosted")}
      </ThemedText>
    );
  }

  return (
    <View style={styles.previewBody}>
      <View style={styles.previewStatRow}>
        {preview.stats.map((stat) => (
          <ThemedText
            key={stat.key}
            style={styles.previewStat}
            setColor={titleColor}
          >
            {stat.textKey ? t(stat.textKey, stat.params) : stat.text}
          </ThemedText>
        ))}
      </View>

      {preview.topSets.map((topSet) => (
        <View key={topSet.key} style={styles.previewTopSetRow}>
          <View style={styles.previewStarSlot}>
            {topSet.record ? (
              <Star
                width={11}
                height={11}
                color={theme.record ?? theme.secondary}
                filled
              />
            ) : null}
          </View>
          <ThemedText
            style={styles.previewTopSetName}
            setColor={quietText}
            numberOfLines={1}
          >
            {t(topSet.nameKey)}
          </ThemedText>
          <ThemedText style={styles.previewTopSetValue} setColor={titleColor}>
            {topSet.set}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

export default function SocialPostSettingsPage() {
  const { t } = useTranslation();
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
  const primaryColor = theme.primary;
  const primaryTextColor = theme.primaryText ?? theme.primary;
  const choiceSurface = colorScheme === "dark" ? "#221f1d" : "#f1eff2";
  const selectedChoiceSurface = withAlpha(
    theme.primary,
    colorScheme === "dark" ? 0.12 : 0.14
  );
  const dangerColor = theme.danger;

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
                : t("settings.socialPosts.errors.load")
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
    }, [t, user])
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
            : t("settings.socialPosts.errors.save")
        );
      } finally {
        setSavingMode(null);
      }
    },
    [savingMode, selectedMode, t, user]
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
            : t("settings.socialPosts.errors.saveVisibility")
        );
      } finally {
        setSavingVisibility(null);
      }
    },
    [savingVisibility, selectedVisibility, t, user]
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={12}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            {t("settings.eyebrow")}
          </ThemedText>
          <ThemedTitle
            type="pageTitle"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            {t("settings.socialPosts.title")}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.scopeNote} setColor={quietText}>
          {t("settings.socialPosts.scopeNote")}
        </ThemedText>

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
              <Social width={26} height={26} color={primaryTextColor} />
            </View>

            <View style={styles.heroCopy}>
              <ThemedTitle type="h3" style={styles.cardTitle}>
                {t("settings.socialPosts.summariesTitle")}
              </ThemedTitle>
              <ThemedText style={styles.cardBody} setColor={quietText}>
                {t("settings.socialPosts.summariesBody")}
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
                        {t(option.titleKey)}
                      </ThemedText>
                      <View
                        style={[
                          styles.previewFrame,
                          {
                            backgroundColor: panelSurface,
                            borderColor: cardBorder,
                          },
                        ]}
                      >
                        <PostModePreview preview={option.preview} theme={theme} />
                      </View>
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
            {t("settings.socialPosts.visibilityEyebrow")}
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
                        {t(option.titleKey)}
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

          <ThemedText style={styles.groupNote} setColor={quietText}>
            {t("settings.socialPosts.visibilityNote")}
          </ThemedText>

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
            {t("settings.socialPosts.exercisesEyebrow")}
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
              <Library width={22} height={22} color={primaryTextColor} />
              <View style={styles.settingsButtonCopy}>
                <ThemedText
                  style={styles.settingsButtonTitle}
                  setColor={titleColor}
                >
                  {t("settings.socialPosts.exerciseVisibility")}
                </ThemedText>
                <ThemedText
                  style={styles.settingsButtonBody}
                  setColor={quietText}
                >
                  {t("settings.socialPosts.exerciseVisibilityBody")}
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
