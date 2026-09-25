// English, the fallback language. One file per area of the app; a key is
// "<area>.<name>". Keep the Danish files in ../da in step - the test in
// scripts/test-localization.js fails on a key present in one and not the other.
import auth from "./auth";
import calendar from "./calendar";
import common from "./common";
import errors from "./errors";
import exercises from "./exercises";
import explore from "./explore";
import friends from "./friends";
import gyms from "./gyms";
import home from "./home";
import music from "./music";
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
import time from "./time";
import workout from "./workout";
import workoutStart from "./workoutStart";

export default {
  auth,
  calendar,
  common,
  errors,
  exercises,
  explore,
  friends,
  gyms,
  home,
  music,
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
  time,
  workout,
  workoutStart,
};
