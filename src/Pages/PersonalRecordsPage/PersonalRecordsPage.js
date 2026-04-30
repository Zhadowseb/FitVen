import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";

import styles from "./PersonalRecordsPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import Calender from "../../Resources/Icons/UI-icons/Calender";
import TradeUp from "../../Resources/Icons/UI-icons/TradeUp";
import {
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { weightliftingService } from "../../Services";

const PersonalRecordsPage = () => {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [summaries, setSummaries] = useState([]);
  const [selectedExerciseName, setSelectedExerciseName] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hideEmptyRepRanges, setHideEmptyRepRanges] = useState(false);

  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const primarySoft = "rgba(247, 116, 46, 0.16)";
  const primaryRowSurface = "rgba(247, 116, 46, 0.09)";
  const secondarySoft = "rgba(96, 218, 172, 0.22)";
  const backgroundColor = theme.background ?? "#0e0f12";
  const cardSurface = theme.cardBackground ?? backgroundColor;
  const panelSurface = theme.uiBackground ?? cardSurface;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;
  const invertedText = theme.cardBackground ?? theme.textInverted ?? "#1b1918";

  const loadSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const nextSummaries =
        await weightliftingService.getPersonalRecordExerciseSummaries(db);
      setSummaries(nextSummaries);

      if (selectedExerciseName) {
        const nextDetail =
          await weightliftingService.getPersonalRecordExerciseDetail(
            db,
            selectedExerciseName
          );
        setSelectedDetail(nextDetail);
      }
    } catch (error) {
      console.error("Failed to load personal records:", error);
      setSummaries([]);
      setSelectedDetail(null);
    } finally {
      setLoading(false);
    }
  }, [db, selectedExerciseName]);

  const openExerciseDetail = async (exerciseName) => {
    try {
      setDetailLoading(true);
      setSelectedExerciseName(exerciseName);

      const detail =
        await weightliftingService.getPersonalRecordExerciseDetail(
          db,
          exerciseName
        );
      setSelectedDetail(detail);
    } catch (error) {
      console.error("Failed to load personal record detail:", error);
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeExerciseDetail = () => {
    setSelectedExerciseName(null);
    setSelectedDetail(null);
  };

  useFocusEffect(
    useCallback(() => {
      loadSummaries();
    }, [loadSummaries])
  );

  const renderExerciseList = () => (
    <View style={styles.exerciseList}>
      {loading && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={primaryColor} />
        </View>
      )}

      {!loading && summaries.length === 0 && (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.emptyStateTitle} setColor={titleColor}>
            No records yet
          </ThemedText>
          <ThemedText style={styles.emptyStateText} setColor={quietText}>
            Completed strength sets will appear here when they have weight and reps.
          </ThemedText>
        </View>
      )}

      {!loading &&
        summaries.map((summary) => (
          <TouchableOpacity
            key={summary.exerciseName}
            activeOpacity={0.88}
            onPress={() => openExerciseDetail(summary.exerciseName)}
            style={[
              styles.exerciseListItem,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View
              style={[
                styles.exerciseListIcon,
                { backgroundColor: primarySoft },
              ]}
            >
              <TradeUp
                width={21}
                height={21}
                stroke={primaryColor}
                color={primaryColor}
              />
            </View>

            <View style={styles.exerciseListText}>
              <ThemedText
                style={styles.exerciseListTitle}
                setColor={titleColor}
                numberOfLines={1}
              >
                {summary.exerciseName}
              </ThemedText>
              <ThemedText style={styles.exerciseListMeta} setColor={quietText}>
                {summary.latestRecordRelativeDateLabel
                  ? `Last PR ${summary.latestRecordDateDisplay} - ${summary.latestRecordRelativeDateLabel}`
                  : `Last PR ${summary.latestRecordDateDisplay}`}
              </ThemedText>
            </View>

            <View style={styles.exerciseListStats}>
              <ThemedText style={styles.exerciseListStatValue} setColor={titleColor}>
                {summary.setCount}
              </ThemedText>
              <ThemedText style={styles.exerciseListStatLabel} setColor={quietText}>
                sets
              </ThemedText>
            </View>
          </TouchableOpacity>
        ))}
    </View>
  );

  const renderRecordDetail = () => {
    const detail = selectedDetail;
    const visibleRecordRows =
      detail && hideEmptyRepRanges
        ? detail.rows.filter((row) => row.hasRecord)
        : detail?.rows ?? [];

    if (detailLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator color={primaryColor} />
        </View>
      );
    }

    if (!detail) {
      return (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.emptyStateTitle} setColor={titleColor}>
            No records found
          </ThemedText>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={closeExerciseDetail}
            style={[styles.backToListButton, { borderColor: cardBorder }]}
          >
            <ThemedText style={styles.backToListText} setColor={primaryColor}>
              All records
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View>
        <View style={styles.recordToolbar}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={closeExerciseDetail}
            style={[styles.backToListButton, { borderColor: cardBorder }]}
          >
            <ThemedText style={styles.backToListText} setColor={primaryColor}>
              All records
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setHideEmptyRepRanges((current) => !current)}
            style={[
              styles.recordFilterButton,
              {
                backgroundColor: hideEmptyRepRanges ? primaryColor : cardSurface,
                borderColor: hideEmptyRepRanges ? primaryColor : cardBorder,
              },
            ]}
          >
            <ThemedText
              style={styles.recordFilterText}
              setColor={hideEmptyRepRanges ? invertedText : quietText}
              numberOfLines={1}
            >
              {hideEmptyRepRanges ? "Show all" : "Hide empty"}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.recordCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[styles.recordCardAccent, { backgroundColor: primaryColor }]}
          />

          <View style={styles.recordCardHeader}>
            <View
              style={[
                styles.recordIconTile,
                { backgroundColor: primarySoft },
              ]}
            >
              <TradeUp
                width={25}
                height={25}
                stroke={primaryColor}
                color={primaryColor}
              />
            </View>

            <View style={styles.recordHeaderText}>
              <ThemedText style={styles.recordEyebrow} setColor={primaryColor}>
                PERSONAL RECORDS
              </ThemedText>
              <ThemedTitle
                type="h3"
                style={[styles.recordTitle, { color: titleColor }]}
                numberOfLines={1}
              >
                {detail.exerciseName}
              </ThemedTitle>
            </View>
          </View>

          <View style={[styles.tableHeader, { backgroundColor: backgroundColor }]}>
            <ThemedText style={styles.tableHeaderText} setColor={quietText}>
              REPS
            </ThemedText>
            <ThemedText
              style={[styles.tableHeaderText, styles.tableHeaderWeight]}
              setColor={quietText}
            >
              WEIGHT
            </ThemedText>
            <ThemedText
              style={[styles.tableHeaderText, styles.tableHeaderDate]}
              setColor={quietText}
            >
              DATE
            </ThemedText>
          </View>

          {visibleRecordRows.map((row) => (
            <View
              key={row.reps}
              style={[
                styles.recordRow,
                {
                  borderTopColor: cardBorder,
                  backgroundColor:
                    row.isNew && row.hasRecord
                      ? primaryRowSurface
                      : cardSurface,
                },
              ]}
            >
              {row.isNew && row.hasRecord && (
                <View
                  pointerEvents="none"
                  style={[styles.recordRowAccent, { backgroundColor: primaryColor }]}
                />
              )}

              <View
                style={[
                  styles.repsBadge,
                  {
                    backgroundColor: panelSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <ThemedText style={styles.repsBadgeText} setColor={titleColor}>
                  {row.reps}
                </ThemedText>
              </View>

              <View style={styles.recordWeightCell}>
                <View style={styles.recordWeightLine}>
                  <ThemedText
                    style={[
                      styles.recordWeightValue,
                      !row.hasRecord && styles.mutedRecordValue,
                    ]}
                    setColor={row.hasRecord ? titleColor : quietText}
                  >
                    {row.weightDisplay}
                  </ThemedText>
                  {row.hasRecord && (
                    <ThemedText style={styles.recordWeightUnit} setColor={quietText}>
                      KG
                    </ThemedText>
                  )}
                  {!!row.gainDisplay && (
                    <View
                      style={[
                        styles.gainBadge,
                        { backgroundColor: secondarySoft },
                      ]}
                    >
                      <ThemedText style={styles.gainBadgeText} setColor={secondaryColor}>
                        {row.gainDisplay}
                      </ThemedText>
                    </View>
                  )}
                  {row.isNew && row.hasRecord && (
                    <View
                      style={[
                        styles.newBadge,
                        { backgroundColor: primarySoft },
                      ]}
                    >
                      <ThemedText style={styles.newBadgeText} setColor={primaryColor}>
                        NEW
                      </ThemedText>
                    </View>
                  )}
                </View>

                <View style={[styles.progressTrack, { backgroundColor: panelSurface }]}>
                  {row.hasRecord && (
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${row.progressPercent}%`,
                          backgroundColor: row.isNew ? primaryColor : quietText,
                        },
                      ]}
                    />
                  )}
                </View>
              </View>

              <View style={styles.recordDateCell}>
                <View style={styles.recordDateLine}>
                  {row.hasRecord && (
                    <Calender
                      width={13}
                      height={13}
                      color={quietText}
                      thickness={1.7}
                    />
                  )}
                  <ThemedText
                    style={[
                      styles.recordDateText,
                      !row.hasRecord && styles.mutedRecordValue,
                    ]}
                    setColor={row.hasRecord ? titleColor : quietText}
                    numberOfLines={1}
                  >
                    {row.hasRecord ? row.dateDisplay : "No set"}
                  </ThemedText>
                </View>
                {!!row.relativeDateLabel && (
                  <ThemedText style={styles.recordRelativeDate} setColor={quietText}>
                    {row.relativeDateLabel}
                  </ThemedText>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText size={10} style={styles.pageHeaderTitleEyebrow} setColor={quietText}>
            Library
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Personal Records
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {selectedExerciseName ? renderRecordDetail() : renderExerciseList()}
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default PersonalRecordsPage;
