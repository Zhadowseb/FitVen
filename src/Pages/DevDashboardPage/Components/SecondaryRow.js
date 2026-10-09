import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./SecondaryRowStyle";
import { getStatusColor } from "../devDashboardView";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

/**
 * One S-row: its id, name, a note saying what is counted, the status under it,
 * and the value on the right in the status colour.
 *
 * With `onPress` the row folds something open under itself (S7's downloads
 * chart); `children` is drawn under the row either way (S10's field).
 */
export default function SecondaryRow({
  row,
  isFirst = false,
  onPress = null,
  isExpanded = false,
  children = null,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const color = getStatusColor(row.status.status, theme);
  const content = (
    <>
      <ThemedText style={styles.id} setColor={theme.quietText} numberOfLines={1}>
        {row.id}
      </ThemedText>

      <View style={styles.text}>
        <ThemedText style={styles.name} setColor={theme.title}>
          {row.name}
        </ThemedText>

        {row.note ? (
          <ThemedText style={styles.note} setColor={theme.quietText}>
            {row.note}
          </ThemedText>
        ) : null}

        <ThemedText style={styles.status} setColor={color} numberOfLines={1}>
          {row.status.label}
        </ThemedText>
      </View>

      <View style={styles.valueBox}>
        <ThemedText style={styles.value} setColor={color} numberOfLines={1}>
          {row.value}
        </ThemedText>

        {onPress ? (
          <ThemedText style={styles.toggle} setColor={theme.quietText}>
            {isExpanded ? "−" : "+"}
          </ThemedText>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={isFirst ? null : [styles.divided, { borderTopColor: theme.hairline }]}>
      {onPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={`${row.id} ${row.name}, ${row.value}, ${row.status.label}`}
          activeOpacity={0.82}
          onPress={onPress}
          style={styles.row}
        >
          {content}
        </TouchableOpacity>
      ) : (
        <View
          accessible
          accessibilityLabel={`${row.id} ${row.name}, ${row.value}, ${row.status.label}`}
          style={styles.row}
        >
          {content}
        </View>
      )}

      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}
