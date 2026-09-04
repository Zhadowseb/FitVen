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
  // Status, not buttons: no surface, no border, no shadow. Today is marked by
  // an underline and colour instead of a raised card.
  return (
    <View style={styles.cell}>
      <Text
        style={[
          styles.weekdayLabel,
          // theme.text, not quietText: quietText is only 3.7:1 on the dark
          // background, below the 4.5:1 minimum.
          { color: cell.isToday ? theme.primary : theme.text },
        ]}
      >
        {cell.weekday}
      </Text>
      <Text
        style={[
          styles.dayNumber,
          cell.isToday && styles.dayNumberToday,
          {
            color: cell.isToday
              ? theme.primary
              : cell.done
                ? theme.textStrong
                : theme.text,
          },
        ]}
      >
        {cell.day}
      </Text>

      {cell.done ? (
        <Checkmark width={10} height={10} color={theme.secondary} thickness={3} />
      ) : (
        <View style={[styles.dotMarker, { backgroundColor: restDotColor }]} />
      )}

      <View
        style={[
          styles.todayUnderline,
          {
            backgroundColor: cell.isToday ? theme.primary : "transparent",
          },
        ]}
      />
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
