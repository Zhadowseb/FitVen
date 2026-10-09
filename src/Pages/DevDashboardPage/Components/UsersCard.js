import { View, useColorScheme } from "react-native";

import styles from "./UsersCardStyle";
import { getBarColors } from "./DownloadsCard";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

// The squares are the platforms' own colours in the S7 chart, so the two read
// as the same thing.
const COLUMNS = [
  { key: "ios", label: "APPLE", swatch: "ios" },
  { key: "android", label: "ANDROID", swatch: "android" },
  { key: "total", label: "TOTAL", swatch: null },
];

function toneColor(tone, theme) {
  if (tone === "good") {
    return theme.secondary;
  }

  if (tone === "alarm") {
    return theme.danger;
  }

  return theme.quietText;
}

function Cell({ value, note, valueColor, theme }) {
  return (
    <View style={styles.valueCell}>
      <ThemedText
        style={styles.number}
        setColor={valueColor}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </ThemedText>

      {note ? (
        <ThemedText
          style={note.tone === "quiet" ? styles.noteQuiet : styles.noteStrong}
          setColor={toneColor(note.tone, theme)}
          numberOfLines={1}
        >
          {note.text}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * §3, the top of the page: downloads and active users per platform.
 *
 * A number nobody has sent is an em dash with "ikke koblet på" under it, never
 * a 0. `table` comes from `buildUsersTable`.
 */
export default function UsersCard({ table }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const bars = getBarColors(theme);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.labelCell} />

        {COLUMNS.map((column) => (
          <View key={column.key} style={styles.headCell}>
            {column.swatch ? (
              <View style={[styles.swatch, { backgroundColor: bars[column.swatch] }]} />
            ) : null}

            <ThemedText style={styles.headText} setColor={theme.quietText} numberOfLines={1}>
              {column.label}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={[styles.row, styles.dataRow]}>
        <ThemedText
          style={[styles.labelCell, styles.rowName]}
          setColor={theme.mutedStrong}
          numberOfLines={1}
        >
          Downloads
        </ThemedText>

        {table.columns.map((column) => (
          <Cell
            key={column.key}
            value={column.downloads}
            note={column.downloadsNote}
            valueColor={theme.title}
            theme={theme}
          />
        ))}
      </View>

      <View style={[styles.hairline, { backgroundColor: theme.hairline }]} />

      <View style={[styles.row, styles.dataRow]}>
        <ThemedText
          style={[styles.labelCell, styles.rowName]}
          setColor={theme.mutedStrong}
          numberOfLines={1}
        >
          Aktive
        </ThemedText>

        {table.columns.map((column) => (
          <Cell
            key={column.key}
            value={column.active}
            note={column.activeNote}
            valueColor={column.key === "total" ? theme.primaryText ?? theme.primary : theme.title}
            theme={theme}
          />
        ))}
      </View>

      {/* Until the app writes when it was opened, "active" is read off push
          tokens, which only exist for people who allowed notifications. */}
      {table.pushOnly ? (
        <View style={styles.row}>
          <View style={styles.labelCell} />
          <ThemedText style={styles.spanNote} setColor={theme.quietText} numberOfLines={1}>
            kun med push
          </ThemedText>
        </View>
      ) : null}

      {table.note ? (
        <ThemedText style={styles.footer} setColor={theme.quietText} numberOfLines={1}>
          {table.note}
        </ThemedText>
      ) : null}
    </View>
  );
}
