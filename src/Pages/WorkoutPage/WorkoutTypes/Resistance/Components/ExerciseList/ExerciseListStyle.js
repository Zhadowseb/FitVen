// src/Components/ExerciseList/ExerciseListStyle.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  addExerciseRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingTop: 26,
    paddingHorizontal: 16,
  },
  addExerciseButton: {
    flex: 1,
    maxWidth: 190,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
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
