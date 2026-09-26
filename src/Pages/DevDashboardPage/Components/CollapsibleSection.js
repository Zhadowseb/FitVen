import { useCallback, useEffect, useRef, useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import styles from "./CollapsibleSectionStyle";
import { getStatusColor } from "../devDashboardView";
import { Colors } from "@resources/GlobalStyling/colors";
import { ThemedText } from "@resources/ThemedComponents";

const OPEN_SECTIONS_KEY = "devDashboard.openSections";

async function readOpenSections() {
  try {
    const stored = await AsyncStorage.getItem(OPEN_SECTIONS_KEY);
    const parsed = stored ? JSON.parse(stored) : null;

    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : null;
  } catch {
    return null;
  }
}

async function writeOpenSections(keys) {
  try {
    await AsyncStorage.setItem(OPEN_SECTIONS_KEY, JSON.stringify(keys));
  } catch {
    // Only the folding is lost; the next visit opens the default again.
  }
}

/**
 * Which sections are open, remembered between visits. Until the stored choice
 * has been read the defaults apply, and a tap made before it arrives wins over
 * it rather than being undone by it.
 */
export function useOpenSections(defaultOpen) {
  const [openKeys, setOpenKeys] = useState(defaultOpen);
  const hasToggled = useRef(false);

  useEffect(() => {
    let isActive = true;

    readOpenSections().then((stored) => {
      if (isActive && stored && !hasToggled.current) {
        setOpenKeys(stored);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (hasToggled.current) {
      writeOpenSections(openKeys);
    }
  }, [openKeys]);

  const toggle = useCallback((key) => {
    hasToggled.current = true;
    setOpenKeys((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  }, []);

  return [openKeys, toggle];
}

/**
 * A folding card: a 50 high header with the worst status of its rows as a dot,
 * the title, the ids it holds, a summary and + / −; the rows under it when open.
 */
export default function CollapsibleSection({
  title,
  ids,
  summary,
  status,
  isOpen,
  onToggle,
  isFirst = false,
  children,
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <View
      style={[
        styles.card,
        isFirst ? null : styles.cardSpaced,
        { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`${title}, ${ids}, ${summary}`}
        activeOpacity={0.82}
        onPress={onToggle}
        style={styles.header}
      >
        <View
          style={[styles.dot, { backgroundColor: getStatusColor(status.status, theme) }]}
        />

        <ThemedText style={styles.title} setColor={theme.title} numberOfLines={1}>
          {title}
        </ThemedText>

        <ThemedText style={styles.ids} setColor={theme.quietText} numberOfLines={1}>
          {ids}
        </ThemedText>

        <ThemedText style={styles.summary} setColor={theme.quietText} numberOfLines={1}>
          {summary}
        </ThemedText>

        <ThemedText style={styles.toggle} setColor={theme.quietText}>
          {isOpen ? "−" : "+"}
        </ThemedText>
      </TouchableOpacity>

      {isOpen ? (
        <View style={[styles.body, { borderTopColor: theme.hairline }]}>{children}</View>
      ) : null}
    </View>
  );
}
