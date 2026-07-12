import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useColorScheme,
} from "react-native";

import { Colors } from "../../../Resources/GlobalStyling/colors";
import {
  ThemedButton,
  ThemedModal,
  ThemedText,
  ThemedTitle,
} from "../../../Resources/ThemedComponents";
import { formatDate } from "../../../Utils/dateUtils";
import {
  buildWeekOptions,
  getIsoWeekInfo,
  getWeekStart,
} from "../../../Utils/weekUtils";
import styles from "./StartProgramModalStyle";

function isSameDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

const StartProgramModal = ({
  visible,
  onClose,
  onStart,
  isStarting = false,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const currentWeek = getWeekStart(new Date());
  const currentWeekInfo = getIsoWeekInfo(currentWeek);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [pickerYear, setPickerYear] = useState(currentWeekInfo.weekYear);
  const weekListRef = useRef(null);
  const shouldScrollToCurrentWeek = useRef(false);

  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const dateRangeColor = quietText;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const innerSurface =
    theme.fields ?? theme.cardBackground ?? theme.background;
  const accentColor = theme.primary ?? "#f7742e";
  const selectedWeekInfo = getIsoWeekInfo(selectedWeek);
  const weekOptions = buildWeekOptions(pickerYear);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextCurrentWeek = getWeekStart(new Date());
    shouldScrollToCurrentWeek.current = true;
    setSelectedWeek(nextCurrentWeek);
    setPickerYear(getIsoWeekInfo(nextCurrentWeek).weekYear);
  }, [visible]);

  const scrollToCurrentWeek = (event) => {
    if (
      !shouldScrollToCurrentWeek.current ||
      pickerYear !== currentWeekInfo.weekYear
    ) {
      return;
    }

    shouldScrollToCurrentWeek.current = false;
    weekListRef.current?.scrollTo({
      y: Math.max(0, event.nativeEvent.layout.y - 8),
      animated: false,
    });
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={onClose}
      dismissOnBackdropPress={!isStarting}
      style={styles.modal}
      contentStyle={styles.content}
    >
      <View style={styles.hero}>
        <ThemedText style={styles.eyebrow} setColor={accentColor}>
          Start program
        </ThemedText>
        <ThemedTitle type="h3" style={styles.title}>
          Choose a start week
        </ThemedTitle>
        <ThemedText style={styles.description} setColor={quietText}>
          The full program schedule will move to the selected week.
        </ThemedText>
      </View>

      <View style={styles.weekPickerHeader}>
        <Pressable
          onPress={() => setPickerYear((year) => year - 1)}
          style={[
            styles.yearButton,
            {
              backgroundColor: innerSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.yearButtonText} setColor={accentColor}>
            Previous
          </ThemedText>
        </Pressable>

        <ThemedTitle type="h3" style={styles.yearTitle}>
          {pickerYear}
        </ThemedTitle>

        <Pressable
          onPress={() => setPickerYear((year) => year + 1)}
          style={[
            styles.yearButton,
            {
              backgroundColor: innerSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.yearButtonText} setColor={accentColor}>
            Next
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView ref={weekListRef} style={styles.weekOptionList}>
        {weekOptions.map((option) => {
          const selected = isSameDate(option.weekStart, selectedWeek);
          const isCurrentWeek = isSameDate(option.weekStart, currentWeek);

          return (
            <Pressable
              key={`${pickerYear}-${option.weekNumber}`}
              onPress={() => setSelectedWeek(option.weekStart)}
              onLayout={isCurrentWeek ? scrollToCurrentWeek : undefined}
              style={[
                styles.weekOption,
                {
                  backgroundColor: innerSurface,
                  borderColor: selected ? accentColor : cardBorder,
                },
              ]}
            >
              <View style={styles.weekOptionTextContent}>
                <View style={styles.weekOptionTitleRow}>
                  <ThemedText
                    style={styles.weekOptionTitle}
                    setColor={selected ? accentColor : titleColor}
                  >
                    Week {option.weekNumber}
                  </ThemedText>

                  {isCurrentWeek && (
                    <View
                      style={[
                        styles.currentWeekBadge,
                        { borderColor: accentColor },
                      ]}
                    >
                      <ThemedText
                        style={styles.currentWeekBadgeText}
                        setColor={accentColor}
                      >
                        This week
                      </ThemedText>
                    </View>
                  )}
                </View>

                <ThemedText
                  style={styles.weekOptionRange}
                  setColor={dateRangeColor}
                >
                  {formatDate(option.weekStart)} - {formatDate(option.weekEnd)}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.statusDot,
                  {
                    borderColor: selected ? accentColor : cardBorder,
                    backgroundColor: selected ? accentColor : "transparent",
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.selectionSummary}>
        <ThemedText style={styles.selectionLabel} setColor={quietText}>
          Selected
        </ThemedText>
        <ThemedText style={styles.selectionValue} setColor={titleColor}>
          Week {selectedWeekInfo.weekNumber}, {selectedWeekInfo.weekYear}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={isStarting}
          onPress={onClose}
          style={[
            styles.cancelButton,
            {
              backgroundColor: innerSurface,
              borderColor: cardBorder,
              opacity: isStarting ? 0.5 : 1,
            },
          ]}
        >
          <ThemedText style={styles.cancelButtonText} setColor={titleColor}>
            Cancel
          </ThemedText>
        </Pressable>

        <ThemedButton
          title={isStarting ? "Starting..." : "Start program"}
          disabled={isStarting}
          onPress={() => onStart(selectedWeek)}
          style={[styles.startButton, { backgroundColor: accentColor }]}
        />
      </View>
    </ThemedModal>
  );
};

export default StartProgramModal;
