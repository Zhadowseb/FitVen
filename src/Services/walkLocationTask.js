import * as TaskManager from "expo-task-manager";

import { WALK_LOCATION_TASK, deliverWalkLocations } from "./locationService";

// The task a walk's location updates are delivered to, with the screen on or
// off (see locationService.startWalkTracking).
//
// expo-task-manager only runs a task it was told about before the app asks for
// it, and after a relaunch that happens at import time - so this is imported
// by App.js, at the top level, and is not part of the Services barrel. It is
// its own file because the Node tests load the barrel and have no native
// task manager to load.
TaskManager.defineTask(WALK_LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.warn("The walk location task failed:", error);
    return;
  }

  deliverWalkLocations(data?.locations);
});
