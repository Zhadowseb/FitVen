// src/Components/ExerciseList/ExerciseListStyle.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  dragWrapper: {
    position: "relative",
  },

  dragWrapperActive: {
    opacity: 0.96,
    zIndex: 10,
    elevation: 8,
  },

  card: {
      backgroundColor: "#fff",
      marginVertical: 10,
      marginHorizontal: 0,
      borderRadius: 5,
      elevation: 20,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { height: 2, width: 0 },
  },
  
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  exercise_container: {
    flex: 1,
    flexDirection: "row",
    padding: 5,
    borderBottomWidth: 1,
    borderColor: "#dbdbdbff",
    justifyContent: "center",
    alignItems: "center",
  },

  headerRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: "#ccc",
    marginBottom: 4,
  },

  //Columns pacing
  exercise_alignment: {
    justifyContent: "center",
    alignItems: "center",
  },

  exercise_name: {
    flex: 50,
  },
  exercise_sets: {
    flex: 20,
  },
  exercise_x: {
    flex: 10,
  },
  exercise_reps: {
    flex: 20,
  },
  exercise_weight: {
    flex: 30,
  },
  exercise_done: {
    flex: 10,
  },

  headerText: {
    fontWeight: "bold",
    alignContent: "center",
  },

  checkbox: {
    marginRight: 8,
  },

  SetList_container: {
    flexDirection: "row",
    padding: 5,
    width: "100%",
  },
  SetList_left: { 
    width: "40%",
  },
  SetList_Right: {
    width: "60%",
  },

});
