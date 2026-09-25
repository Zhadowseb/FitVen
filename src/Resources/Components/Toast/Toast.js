import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "../../GlobalStyling/colors";
import Checkmark from "../../Icons/UI-icons/Checkmark";
import ThemedText from "../../ThemedComponents/ThemedText";

// A short line that says something worked, over whatever screen you landed on:
// "Added to your exercises" after you went back from the exercise you added.
// One host, mounted once in App.js; anything can call showToast. A toast that
// arrives while another shows replaces it.
//
// Not for errors that need an answer - those stay on the screen that failed.

const DEFAULT_DURATION_MS = 2600;
// Just above the bottom navigation, which sits under every signed-in screen.
const ABOVE_NAVIGATION = 92;

let listener = null;
let nextId = 1;

/** Shows `message` for a moment. `tone`: "success" (a check) or "info". */
export function showToast(message, { tone = "success", durationMs = DEFAULT_DURATION_MS } = {}) {
  if (typeof message !== "string" || message.trim() === "") {
    return;
  }

  listener?.({ id: nextId++, message, tone, durationMs });
}

export default function ToastHost() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);

  useEffect(() => {
    listener = (next) => {
      clearTimeout(hideTimerRef.current);
      setToast(next);
      AccessibilityInfo.announceForAccessibility?.(next.message);

      Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();

      hideTimerRef.current = setTimeout(() => {
        Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
          if (finished) {
            setToast((current) => (current?.id === next.id ? null : current));
          }
        });
      }, next.durationMs);
    };

    return () => {
      listener = null;
      clearTimeout(hideTimerRef.current);
    };
  }, [progress]);

  if (!toast) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + ABOVE_NAVIGATION }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: theme.raisedSurface,
            borderColor: theme.cardBorder,
            shadowColor: "#000000",
            opacity: progress,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        {toast.tone === "success" ? (
          <View style={[styles.check, { backgroundColor: theme.secondary }]}>
            <Checkmark width={12} height={12} color={theme.inkOnSecondary} thickness={3} />
          </View>
        ) : null}
        <ThemedText style={styles.message} setColor={theme.title} numberOfLines={2}>
          {toast.message}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  toast: {
    maxWidth: 420,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: Platform.OS === "android" ? 8 : 0,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
});
