import { StatusBar } from "expo-status-bar";
import { Alert, ScrollView, View, useColorScheme } from "react-native";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { formatDate, useTranslation } from "@localization";

import styles from "./ExerciseLibraryPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { Colors } from "../../Resources/GlobalStyling/colors";
import RepeatWorkoutSheet from "../../Resources/Components/RepeatWorkoutSheet";
import {
  ThemedDateWheelPicker,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import { programService, splitService } from "../../Services";
import { getTodaysDate } from "../../Utils/dateUtils";
import ActiveProgramCard from "./Components/ActiveProgramCard/ActiveProgramCard";
import SplitCard from "./Components/SplitCard/SplitCard";
import RepeatAlso from "./Components/SplitCard/RepeatAlso";
import SplitEditorSheet from "./Components/SplitCard/SplitEditorSheet";
import TrainCalendarBlock from "./Components/TrainCalendarBlock/TrainCalendarBlock";
import TrainLibraryGrid from "./Components/TrainLibrary/TrainLibraryGrid";
import TrainTools from "./Components/TrainTools/TrainTools";

const FALLBACK_WORKOUT_TYPE = "Resistance";

/**
 * Train: what to do next, then your library.
 *
 * With an active program the top is that program - its block, its week and
 * today's workout to start (2a). Without one it is your split - the sessions
 * you rotate through, the next one to repeat, and what else to repeat (3a).
 * Which of the two is decided again on every visit, so starting or finishing
 * a program shows on the next one without a restart.
 */
export default function ExerciseLibraryPage() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [programCard, setProgramCard] = useState(null);
  const [split, setSplit] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatTarget, setRepeatTarget] = useState(null);
  const [datePickerFor, setDatePickerFor] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSavingSplit, setIsSavingSplit] = useState(false);
  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    let card = null;

    try {
      card = await programService.getActiveProgramCard(db, { date: getTodaysDate() });
    } catch (error) {
      console.error("Could not load the active program:", error);
    }

    let nextSplit = null;

    if (!card) {
      try {
        nextSplit = await splitService.getSplitCard(db, { userId: user?.id ?? null });
      } catch (error) {
        console.error("Could not load the split:", error);
        nextSplit = { source: "guess", sessions: [], chosenNames: null, candidates: [], repeatAlso: [] };
      }
    }

    if (loadId === loadIdRef.current) {
      setProgramCard(card);
      setSplit(nextSplit);
      setLoaded(true);
    }
  }, [db, user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();

      return () => {
        loadIdRef.current += 1;
      };
    }, [load])
  );

  const mode = programCard ? "program" : "split";

  const startToday = () => {
    const today = programCard?.today;

    if (!today || isStarting) {
      return;
    }

    setIsStarting(true);
    navigation.navigate("WorkoutPage", {
      workout_id: today.workoutId,
      workout_label: today.label,
      workout_type: today.workoutType,
      day: today.weekday,
      date: today.date,
      program_id: today.programId,
    });
    setIsStarting(false);
  };

  const repeatToday = async ({ workoutId, label, workoutType }) => {
    if (!workoutId || isRepeating) {
      return;
    }

    setIsRepeating(true);

    try {
      const params = await programService.repeatWorkoutToday(db, {
        workoutId,
        label,
        workoutType: workoutType ?? FALLBACK_WORKOUT_TYPE,
        date: getTodaysDate(),
      });

      if (!params) {
        throw new Error("Nothing was copied");
      }

      setRepeatTarget(null);
      navigation.navigate("WorkoutPage", params);
    } catch (error) {
      console.error("Could not repeat the workout:", error);
      Alert.alert(t("calendar.library.startFailedTitle"), t("calendar.library.startFailedMessage"));
    } finally {
      setIsRepeating(false);
    }
  };

  const planInProgram = async (target) => {
    if (!repeatTarget || isRepeating) {
      return;
    }

    setIsRepeating(true);

    try {
      const copiedWorkoutId = await programService.copyWorkoutToProgramDay(db, {
        workoutId: repeatTarget.workout_id,
        dayId: target.dayId,
        date: target.date,
      });

      if (!copiedWorkoutId) {
        throw new Error("Nothing was planned");
      }

      const name = repeatTarget.label;

      setRepeatTarget(null);
      Alert.alert(
        t("calendar.library.plannedTitle"),
        t("calendar.library.plannedMessage", {
          name,
          day: target.weekday ? programService.getWeekdayName(target.weekday, t) : t("calendar.library.theDay"),
        })
      );
      load();
    } catch (error) {
      console.error("Could not plan the workout:", error);
      Alert.alert(t("train.plan.failedTitle"), t("train.plan.failedMessage"));
    } finally {
      setIsRepeating(false);
    }
  };

  const planOnDate = async (date) => {
    const workout = datePickerFor;

    if (!workout || isPlanning) {
      return;
    }

    setIsPlanning(true);

    try {
      const copied = await programService.copyWorkoutToStandaloneDate(db, {
        workoutId: workout.workout_id,
        date,
      });

      if (!copied) {
        throw new Error("Nothing was planned");
      }

      setDatePickerFor(null);
      Alert.alert(
        t("train.plan.plannedTitle"),
        t("train.plan.plannedMessage", {
          name: workout.label,
          date: formatDate(date, { weekday: "long", day: "numeric", month: "long" }),
        })
      );
      load();
    } catch (error) {
      console.error("Could not plan the workout on a date:", error);
      Alert.alert(t("train.plan.failedTitle"), t("train.plan.failedMessage"));
    } finally {
      setIsPlanning(false);
    }
  };

  const saveSplit = async (names) => {
    if (!user?.id || isSavingSplit) {
      return;
    }

    setIsSavingSplit(true);

    try {
      await splitService.saveChosenSplitNames({ userId: user.id, names });
      setIsEditorOpen(false);
      load();
    } catch (error) {
      console.error("Could not save the split:", error);
      Alert.alert(t("train.editor.title"), t("train.editor.saveFailed"));
    } finally {
      setIsSavingSplit(false);
    }
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedTitle type="pageTitle" style={styles.title}>
          {t("train.title")}
        </ThemedTitle>

        {!loaded ? (
          <ThemedStateBlock style={styles.loading} />
        ) : programCard ? (
          <ActiveProgramCard
            card={programCard}
            isStarting={isStarting}
            onOpen={() =>
              navigation.navigate("ProgramOverviewPage", {
                program_id: programCard.programId,
                program_name: programCard.programName,
                start_date: programCard.programStartDate,
              })
            }
            onStart={startToday}
          />
        ) : (
          <View>
            <SplitCard
              split={split}
              isRepeating={isRepeating}
              onEdit={() => setIsEditorOpen(true)}
              onRepeat={(session) =>
                repeatToday({
                  workoutId: session.lastWorkoutId,
                  label: session.name,
                  workoutType: session.workoutType,
                })
              }
            />
            <RepeatAlso
              items={split?.repeatAlso ?? []}
              onPress={(item) =>
                setRepeatTarget({
                  workout_id: item.workoutId,
                  label: item.name,
                  workout_type: item.workoutType ?? FALLBACK_WORKOUT_TYPE,
                })
              }
            />
          </View>
        )}

        <View style={styles.library}>
          <ThemedText style={styles.sectionEyebrow} setColor={theme.quietText}>
            {t("train.yourLibrary")}
          </ThemedText>
          <TrainCalendarBlock mode={mode} />
          <TrainLibraryGrid />
          <TrainTools />
        </View>
      </ScrollView>

      <RepeatWorkoutSheet
        visible={Boolean(repeatTarget)}
        workout={repeatTarget}
        isWorking={isRepeating}
        onClose={() => setRepeatTarget(null)}
        onStart={() =>
          repeatToday({
            workoutId: repeatTarget?.workout_id,
            label: repeatTarget?.label,
            workoutType: repeatTarget?.workout_type,
          })
        }
        onPlan={planInProgram}
        onPlanOnDate={() => {
          const workout = repeatTarget;

          setRepeatTarget(null);
          setDatePickerFor(workout);
        }}
      />

      <ThemedDateWheelPicker
        visible={Boolean(datePickerFor)}
        value={new Date()}
        title={t("train.plan.pickDate")}
        isConfirming={isPlanning}
        onClose={() => setDatePickerFor(null)}
        onConfirm={planOnDate}
      />

      <SplitEditorSheet
        visible={isEditorOpen}
        candidates={split?.candidates ?? []}
        chosenNames={split?.chosenNames ?? null}
        isSaving={isSavingSplit}
        onClose={() => setIsEditorOpen(false)}
        onSave={saveSplit}
      />

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
