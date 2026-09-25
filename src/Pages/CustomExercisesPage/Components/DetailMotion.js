import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the OS asks for reduced motion: null until it has answered, then
 * true or false, and followed after that.
 *
 * The shared useReduceMotion() says false while it asks. For the exercise
 * page that is too late: the clip would already be playing, and the bars
 * already growing, by the time the answer comes back. So both wait for null
 * to turn into an answer before they move.
 */
export function useReduceMotionSetting() {
  const [reduceMotion, setReduceMotion] = useState(null);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) {
          setReduceMotion(Boolean(enabled));
        }
      })
      .catch(() => {
        if (isMounted) {
          setReduceMotion(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) =>
      setReduceMotion(Boolean(enabled))
    );

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
}
