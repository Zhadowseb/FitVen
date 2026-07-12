import { Text, View, useColorScheme } from "react-native";

import styles from "./WeekStripStyle";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import Checkmark from "../../../../Resources/Icons/UI-icons/Checkmark";

// Spec one-off: rest/empty-day marker dot alpha (not a token — distinct from
// the 0.06 hairline/chip alphas already tokenized).
const REST_DOT_DARK = "rgba(255, 255, 255, 0.14)";
const REST_DOT_LIGHT = "rgba(15, 17, 22, 0.14)";

// One cell: weekday label, date number, and a status marker (check / dot).
function WeekStripCell({ cell, theme, restDotColor }) {
  if (cell.isToday) {
    return (
      <View
        style={[
          styles.cell,
          styles.todayCell,
          {
            backgroundColor: theme.primary,
            shadowColor: theme.primary,
          },
        ]}
      >
        <Text style={[styles.weekdayLabel, { color: "rgba(20,16,12,0.7)" }]}>
          {cell.weekday}
        </Text>
        <Text style={[styles.dayNumber, { color: theme.textInverted }]}>
          {cell.day}
        </Text>
        <View style={[styles.dotMarker, { backgroundColor: theme.textInverted }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.cell,
        {
          backgroundColor: theme.cardBackground,
          borderWidth: 1,
          borderColor: theme.hairline,
        },
      ]}
    >
      <Text style={[styles.weekdayLabel, { color: theme.quietText }]}>
        {cell.weekday}
      </Text>
      <Text
        style={[
          styles.dayNumber,
          { color: cell.done ? theme.textStrong : theme.quietText },
        ]}
      >
        {cell.day}
      </Text>
      {cell.done ? (
        <Checkmark width={10} height={10} color={theme.secondary} thickness={3} />
      ) : (
        <View style={[styles.dotMarker, { backgroundColor: restDotColor }]} />
      )}
    </View>
  );
}

export default function WeekStrip({ days = [] }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const restDotColor = colorScheme === "light" ? REST_DOT_LIGHT : REST_DOT_DARK;

  return (
    <View style={styles.container}>
      {days.map((cell) => (
        <WeekStripCell
          key={cell.dateIso ?? cell.weekday}
          cell={cell}
          theme={theme}
          restDotColor={restDotColor}
        />
      ))}
    </View>
  );
}
