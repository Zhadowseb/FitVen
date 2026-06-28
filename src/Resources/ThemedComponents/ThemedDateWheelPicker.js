import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "../GlobalStyling/colors";
import ThemedButton from "./ThemedButton";
import ThemedText from "./ThemedText";

const ITEM_HEIGHT = 42;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const WHEEL_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

const getDaysInMonth = (year, month) =>
  new Date(year, month + 1, 0).getDate();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function getDateParts(date, minYear, maxDate) {
  const fallbackDate = new Date(maxDate);
  fallbackDate.setFullYear(fallbackDate.getFullYear() - 18);
  const sourceDate =
    date instanceof Date && !Number.isNaN(date.getTime()) ? date : fallbackDate;
  const year = clamp(sourceDate.getFullYear(), minYear, maxDate.getFullYear());
  const maxMonth = year === maxDate.getFullYear() ? maxDate.getMonth() : 11;
  const month = clamp(sourceDate.getMonth(), 0, maxMonth);
  const maxDay =
    year === maxDate.getFullYear() && month === maxDate.getMonth()
      ? maxDate.getDate()
      : getDaysInMonth(year, month);

  return {
    day: clamp(sourceDate.getDate(), 1, maxDay),
    month,
    year,
  };
}

function WheelColumn({
  accessibilityLabel,
  items,
  selectedIndex,
  onChange,
  width,
  titleColor,
  quietText,
}) {
  const listRef = useRef(null);
  const scrollY = useRef(new Animated.Value(selectedIndex * ITEM_HEIGHT)).current;
  const currentIndexRef = useRef(selectedIndex);

  useEffect(() => {
    const nextIndex = clamp(selectedIndex, 0, items.length - 1);

    if (currentIndexRef.current === nextIndex) {
      return;
    }

    currentIndexRef.current = nextIndex;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: nextIndex * ITEM_HEIGHT,
        animated: false,
      });
      scrollY.setValue(nextIndex * ITEM_HEIGHT);
    });
  }, [items.length, scrollY, selectedIndex]);

  const selectIndex = (index) => {
    const nextIndex = clamp(index, 0, items.length - 1);
    currentIndexRef.current = nextIndex;
    listRef.current?.scrollToOffset({
      offset: nextIndex * ITEM_HEIGHT,
      animated: true,
    });
    onChange(nextIndex);
  };

  const handleScrollEnd = (event) => {
    const nextIndex = clamp(
      Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT),
      0,
      items.length - 1
    );

    currentIndexRef.current = nextIndex;

    if (nextIndex !== selectedIndex) {
      onChange(nextIndex);
    }
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 1,
        max: items.length,
        now: selectedIndex + 1,
        text: String(items[selectedIndex] ?? ""),
      }}
      accessibilityActions={[
        { name: "increment", label: `Next ${accessibilityLabel}` },
        { name: "decrement", label: `Previous ${accessibilityLabel}` },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") {
          selectIndex(selectedIndex + 1);
        }

        if (event.nativeEvent.actionName === "decrement") {
          selectIndex(selectedIndex - 1);
        }
      }}
      style={[styles.wheelColumn, { width }]}
    >
      <Animated.FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, index) => `${item}:${index}`}
        initialScrollIndex={selectedIndex}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        contentContainerStyle={styles.wheelContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        nestedScrollEnabled
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(event) => {
          if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.05) {
            handleScrollEnd(event);
          }
        }}
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({
            offset: index * ITEM_HEIGHT,
            animated: false,
          });
        }}
        renderItem={({ item, index }) => {
          const inputRange = [
            (index - 2) * ITEM_HEIGHT,
            (index - 1) * ITEM_HEIGHT,
            index * ITEM_HEIGHT,
            (index + 1) * ITEM_HEIGHT,
            (index + 2) * ITEM_HEIGHT,
          ];
          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.22, 0.52, 1, 0.52, 0.22],
            extrapolate: "clamp",
          });
          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.84, 0.93, 1, 0.93, 0.84],
            extrapolate: "clamp",
          });
          const rotateX = scrollY.interpolate({
            inputRange,
            outputRange: ["42deg", "22deg", "0deg", "-22deg", "-42deg"],
            extrapolate: "clamp",
          });

          return (
            <TouchableOpacity
              activeOpacity={0.72}
              onPress={() => selectIndex(index)}
              style={styles.wheelItem}
            >
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.wheelItemText,
                  {
                    color: index === selectedIndex ? titleColor : quietText,
                    opacity,
                    transform: [
                      { perspective: 800 },
                      { rotateX },
                      { scale },
                    ],
                  },
                ]}
              >
                {item}
              </Animated.Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

export default function ThemedDateWheelPicker({
  visible,
  value,
  onClose,
  onConfirm,
  minYear = 1900,
  maxDate,
  locale = "en",
  title = "Select date",
  isConfirming = false,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const [defaultMaxDate] = useState(() => new Date());
  const resolvedMaxDate =
    maxDate instanceof Date && !Number.isNaN(maxDate.getTime())
      ? maxDate
      : defaultMaxDate;
  const valueTimestamp =
    value instanceof Date && !Number.isNaN(value.getTime())
      ? value.getTime()
      : null;
  const [dateParts, setDateParts] = useState(() =>
    getDateParts(value, minYear, resolvedMaxDate)
  );
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.iconColor ?? theme.quietText ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const selectedSurface = theme.fields ?? theme.uiBackground ?? cardSurface;
  const primaryColor = theme.primary ?? "#f7742e";
  const months = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { month: "long" });
    return Array.from({ length: 12 }, (_, month) =>
      formatter.format(new Date(2000, month, 1))
    );
  }, [locale]);
  const years = useMemo(() => {
    const values = [];

    for (let year = resolvedMaxDate.getFullYear(); year >= minYear; year -= 1) {
      values.push(year);
    }

    return values;
  }, [minYear, resolvedMaxDate]);
  const availableMonths =
    dateParts.year === resolvedMaxDate.getFullYear()
      ? months.slice(0, resolvedMaxDate.getMonth() + 1)
      : months;
  const naturalDaysInMonth = getDaysInMonth(dateParts.year, dateParts.month);
  const availableDayCount =
    dateParts.year === resolvedMaxDate.getFullYear() &&
    dateParts.month === resolvedMaxDate.getMonth()
      ? Math.min(naturalDaysInMonth, resolvedMaxDate.getDate())
      : naturalDaysInMonth;
  const days = Array.from({ length: availableDayCount }, (_, index) => index + 1);

  useEffect(() => {
    if (visible) {
      setDateParts(getDateParts(value, minYear, resolvedMaxDate));
    }
  }, [minYear, resolvedMaxDate, valueTimestamp, visible]);

  const updateDateParts = (nextParts) => {
    const maxMonth =
      nextParts.year === resolvedMaxDate.getFullYear()
        ? resolvedMaxDate.getMonth()
        : 11;
    const month = clamp(nextParts.month, 0, maxMonth);
    const maxDay =
      nextParts.year === resolvedMaxDate.getFullYear() &&
      month === resolvedMaxDate.getMonth()
        ? resolvedMaxDate.getDate()
        : getDaysInMonth(nextParts.year, month);

    setDateParts({
      year: nextParts.year,
      month,
      day: clamp(nextParts.day, 1, maxDay),
    });
  };

  const selectedDate = new Date(
    dateParts.year,
    dateParts.month,
    dateParts.day
  );
  const selectedDateLabel = selectedDate.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close date picker"
          onPress={onClose}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <ThemedText style={styles.eyebrow} setColor={primaryColor}>
                DATE
              </ThemedText>
              <ThemedText style={styles.title} setColor={titleColor}>
                {title}
              </ThemedText>
            </View>
            <ThemedText style={styles.selectedDate} setColor={quietText}>
              {selectedDateLabel}
            </ThemedText>
          </View>

          <View style={styles.columnLabels}>
            <ThemedText style={styles.dayLabel} setColor={quietText}>
              DAY
            </ThemedText>
            <ThemedText style={styles.monthLabel} setColor={quietText}>
              MONTH
            </ThemedText>
            <ThemedText style={styles.yearLabel} setColor={quietText}>
              YEAR
            </ThemedText>
          </View>

          <View style={styles.wheels}>
            <View
              pointerEvents="none"
              style={[
                styles.selectionBand,
                {
                  backgroundColor: selectedSurface,
                  borderColor: cardBorder,
                },
              ]}
            />
            <WheelColumn
              accessibilityLabel="day"
              items={days}
              selectedIndex={dateParts.day - 1}
              onChange={(index) =>
                updateDateParts({ ...dateParts, day: index + 1 })
              }
              width="24%"
              titleColor={titleColor}
              quietText={quietText}
            />
            <WheelColumn
              accessibilityLabel="month"
              items={availableMonths}
              selectedIndex={dateParts.month}
              onChange={(index) =>
                updateDateParts({ ...dateParts, month: index })
              }
              width="44%"
              titleColor={titleColor}
              quietText={quietText}
            />
            <WheelColumn
              accessibilityLabel="year"
              items={years}
              selectedIndex={Math.max(0, years.indexOf(dateParts.year))}
              onChange={(index) =>
                updateDateParts({
                  ...dateParts,
                  year: years[index] ?? dateParts.year,
                })
              }
              width="28%"
              titleColor={titleColor}
              quietText={quietText}
            />
          </View>

          <View style={styles.actions}>
            <ThemedButton
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              disabled={isConfirming}
              style={styles.action}
            />
            <ThemedButton
              title={isConfirming ? "Saving..." : "Apply"}
              onPress={() => onConfirm(selectedDate)}
              disabled={isConfirming}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
  },
  sheet: {
    width: "100%",
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  handle: {
    width: 38,
    height: 4,
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor: "#777",
    alignSelf: "center",
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  eyebrow: {
    marginBottom: 2,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "900",
  },
  selectedDate: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  columnLabels: {
    marginTop: 9,
    paddingHorizontal: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayLabel: {
    width: "24%",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  monthLabel: {
    width: "44%",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  yearLabel: {
    width: "28%",
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "900",
    textAlign: "center",
  },
  wheels: {
    height: WHEEL_HEIGHT,
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: WHEEL_PADDING,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  wheelColumn: {
    height: WHEEL_HEIGHT,
    overflow: "hidden",
  },
  wheelContent: {
    paddingVertical: WHEEL_PADDING,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelItemText: {
    width: "100%",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  actions: {
    marginTop: 13,
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
    borderRadius: 16,
  },
});
