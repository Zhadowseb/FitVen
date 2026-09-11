// src/Components/ExerciseList/ExerciseListStyle.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  emptyExercises: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyExercisesText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  addExerciseRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingTop: 26,
    paddingHorizontal: 16,
  },
  // Dashed and grey on purpose: these sit under the exercises and should read
  // as somewhere to add one, not as the thing to do next.
  addExerciseButton: {
    flex: 1,
    maxWidth: 190,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingHorizontal: 12,
  },
  addExerciseButtonText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  dragWrapper: {
    position: "relative",
  },

  dragWrapperActive: {
    opacity: 0.96,
    zIndex: 10,
    elevation: 8,
  },

  

});
