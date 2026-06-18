import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import Mesocycle from "./Mesocycle";
import Microcycle from "./Microcycle";
import Workout from "./Workout";

import { ThemedPicker, ThemedText } from "../../ThemedComponents";

const CalenderPastePicker = ({
  program_id,
  visible,
  close,
  version,
  source_microcycle_id,
}) => {
  return (
    <>
      {version === "mesocycle" && (
        <Mesocycle
          program_id={program_id}
          visible={visible}
          close={close}
        />
      )}

      {version === "microcycle" && (
        <Microcycle
          program_id={program_id}
          visible={visible}
          close={close}
          source_microcycle_id={source_microcycle_id}
        />
      )}

      {version === "workout" && (
        <Workout
          program_id={program_id}
          visible={visible}
          close={close}
        />
      )}
    </>
  );
};


export default CalenderPastePicker;
