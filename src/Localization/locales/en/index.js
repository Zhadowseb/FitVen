// English, the fallback language. One file per area of the app; a key is
// "<area>.<name>". Keep the Danish files in ../da in step - the test in
// scripts/test-localization.js fails on a key present in one and not the other.
import auth from "./auth";
import common from "./common";
import friends from "./friends";
import gyms from "./gyms";
import home from "./home";
import music from "./music";
import nav from "./nav";
import notifications from "./notifications";
import profile from "./profile";
import social from "./social";
import time from "./time";
import workout from "./workout";
import workoutStart from "./workoutStart";

export default {
  auth,
  common,
  friends,
  gyms,
  home,
  music,
  nav,
  notifications,
  profile,
  social,
  time,
  workout,
  workoutStart,
};
