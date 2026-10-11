// English, the fallback language. One file per area of the app; a key is
// "<area>.<name>". Keep the Danish files in ../da in step - the test in
// scripts/test-localization.js fails on a key present in one and not the other.
import auth from "./auth";
import calendar from "./calendar";
import category from "./category";
import categoryService from "./categoryService";
import common from "./common";
import customExerciseDetail from "./customExerciseDetail";
import customExercises from "./customExercises";
import errors from "./errors";
import exerciseSharing from "./exerciseSharing";
import exercises from "./exercises";
import explore from "./explore";
import friends from "./friends";
import gyms from "./gyms";
import home from "./home";
import homeExplore from "./homeExplore";
import knowledge from "./knowledge";
import liveWorkout from "./liveWorkout";
import music from "./music";
import myExercise from "./myExercise";
import nav from "./nav";
import notifications from "./notifications";
import profile from "./profile";
import programs from "./programs";
import publicProfile from "./publicProfile";
import records from "./records";
import run from "./run";
import settings from "./settings";
import social from "./social";
import statistics from "./statistics";
import steps from "./steps";
import time from "./time";
import train from "./train";
import trainCalendar from "./trainCalendar";
import trainLibrary from "./trainLibrary";
import walk from "./walk";
import workout from "./workout";
import workoutStart from "./workoutStart";
import workoutTypes from "./workoutTypes";

export default {
  auth,
  calendar,
  category,
  categoryService,
  common,
  customExerciseDetail,
  customExercises,
  errors,
  exerciseSharing,
  exercises,
  explore,
  friends,
  gyms,
  home,
  homeExplore,
  knowledge,
  liveWorkout,
  music,
  myExercise,
  nav,
  notifications,
  profile,
  programs,
  publicProfile,
  records,
  run,
  settings,
  social,
  statistics,
  steps,
  time,
  train,
  trainCalendar,
  trainLibrary,
  walk,
  workout,
  workoutStart,
  workoutTypes,
};
