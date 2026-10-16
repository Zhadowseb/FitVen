import { useSyncExternalStore } from "react";

import { setEditorBar } from "@utils/setEditorBar";

/**
 * True while a finger is dragging the reps carousel over the keyboard. The page
 * behind it turns its scrolling off for as long: the drag may wander up or down
 * off the toolbar, and only the sideways part is the carousel's.
 */
export default function useSetEditorDragging() {
  return useSyncExternalStore(setEditorBar.subscribe, setEditorBar.isDragging, setEditorBar.isDragging);
}
