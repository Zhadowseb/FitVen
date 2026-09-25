import { useCallback, useEffect } from "react";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";

// Everything a state plays once on its way in - the roll, the stamp, the
// crown, the confetti - is over by now.
export const ENTRY_MS = 4000;
// When animations are off, the loops are drawn as they are at this moment:
// particles caught mid-flight rather than lined up at their start.
export const STILL_MS = 6000;
// A frame that took longer than this (the app was busy, or has just come
// back) moves the card on by this much, so nothing jumps.
const MAX_FRAME_STEP_MS = 64;

/**
 * One clock for everything on the card, in ms since the state began: every
 * layer reads its place in its keyframes from it, so the fire's flare, its
 * flash, its burst and the edge that lights up with it stay on one beat.
 *
 * A state that can be watched starts at 0 and plays its entrance. One that
 * cannot - reduce motion, off screen, in the background - starts finished.
 * When the animations stop half-way through an entrance the clock jumps past
 * it, so coming back shows the loops going on, never the entrance again.
 *
 * `entry` is the clock held at ENTRY_MS: what only plays once reads that,
 * and stops being worked out once it is over.
 */
export default function useSceneClock(animate) {
  const clock = useSharedValue(animate ? 0 : ENTRY_MS);
  const entry = useDerivedValue(() => Math.min(clock.value, ENTRY_MS));

  const onFrame = useCallback(
    (frame) => {
      "worklet";
      const step = frame.timeSincePreviousFrame;

      if (step !== null && step > 0) {
        clock.value += Math.min(step, MAX_FRAME_STEP_MS);
      }
    },
    [clock]
  );
  const ticker = useFrameCallback(onFrame, false);

  useEffect(() => {
    if (!animate) {
      clock.modify((value) => {
        "worklet";
        return Math.max(value, ENTRY_MS);
      });
    }

    ticker.setActive(animate);
  }, [animate, clock, ticker]);

  return { clock, entry };
}
