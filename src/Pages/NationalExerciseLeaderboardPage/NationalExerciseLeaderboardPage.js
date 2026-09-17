import GymExerciseLeaderboardPage from "../GymExerciseLeaderboardPage/GymExerciseLeaderboardPage";

// Screen 2b, "Strongest in Denmark": the exercise ranking across every
// centre. Same screen as 1b with no centre and verified lifts only, so it is
// the same component told so.
export default function NationalExerciseLeaderboardPage() {
  return <GymExerciseLeaderboardPage national />;
}
