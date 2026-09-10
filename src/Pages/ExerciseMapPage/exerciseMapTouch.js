// SVG hit testing chooses the muscle. Track movement in screen coordinates:
// Android SVG group measurements can reject a real tap after tiny movements.
// A drag or a parent ScrollView taking the responder always cancels selection.
export function createMuscleTouchHandlers(onSelect) {
  let start = null;
  const cancel = () => { start = null; };
  const movedOutsideTap = event => !start
    || (event.nativeEvent.touches?.length ?? 0) > 1
    || Math.hypot(event.nativeEvent.pageX - start.x, event.nativeEvent.pageY - start.y) > 10;
  return {
    onStartShouldSetResponder: event => (event.nativeEvent.touches?.length ?? 1) === 1,
    onResponderGrant: event => {
      start = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    },
    onResponderMove: event => { if (movedOutsideTap(event)) cancel(); },
    onResponderRelease: event => {
      const isTap = !movedOutsideTap(event);
      cancel();
      if (isTap) onSelect();
    },
    onResponderTerminationRequest: () => true,
    onResponderTerminate: cancel,
  };
}
