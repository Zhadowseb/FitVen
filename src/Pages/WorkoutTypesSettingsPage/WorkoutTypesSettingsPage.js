import {
  Alert,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

import styles from "./WorkoutTypesSettingsPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import ResistanceIcon from "../../Resources/Icons/WorkoutLabels/Resistance";
import RunIcon from "../../Resources/Icons/WorkoutLabels/Run";
import Library from "../../Resources/Icons/UI-icons/Library";
import TailArrowUpRight from "../../Resources/Icons/UI-icons/TailArrowUpRight";
import {
  ThemedCard,
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const WORKOUT_TYPES = [
  {
    id: "strength-training",
    title: "Strength Training",
    category: "STRENGTH",
    metrics: "SETS  /  REPS  /  WEIGHT",
    Icon: ResistanceIcon,
  },
  {
    id: "run",
    title: "Run",
    category: "CARDIO",
    metrics: "DISTANCE  /  PACE  /  TIME",
    Icon: RunIcon,
  },
];

export default function WorkoutTypesSettingsPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.border ?? theme.iconColor;
  const iconSurface = theme.fields ?? theme.uiBackground ?? cardSurface;

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            Settings
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Workout Types
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <View>
            <ThemedText style={styles.sectionEyebrow} setColor={primaryColor}>
              AVAILABLE
            </ThemedText>
            <ThemedText style={styles.sectionTitle} setColor={titleColor}>
              Workout types
            </ThemedText>
          </View>
          <ThemedText style={styles.sectionCount} setColor={quietText}>
            {WORKOUT_TYPES.length} TYPES
          </ThemedText>
        </View>

        <View style={styles.typeList}>
          {WORKOUT_TYPES.map((workoutType) => {
            const accentColor =
              workoutType.id === "run" ? secondaryColor : primaryColor;
            const WorkoutTypeIcon = workoutType.Icon;

            return (
              <ThemedCard
                key={workoutType.id}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: cardSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.typeHeader}>
                  <View
                    style={[
                      styles.typeIconFrame,
                      {
                        backgroundColor: iconSurface,
                        borderColor: accentColor,
                      },
                    ]}
                  >
                    {workoutType.id === "run" ? (
                      <WorkoutTypeIcon
                        width={25}
                        height={25}
                        primaryColor={accentColor}
                      />
                    ) : (
                      <WorkoutTypeIcon
                        width={25}
                        height={25}
                        color={accentColor}
                      />
                    )}
                  </View>

                  <View style={styles.typeCopy}>
                    <ThemedText
                      style={styles.typeCategory}
                      setColor={accentColor}
                    >
                      {workoutType.category}
                    </ThemedText>
                    <ThemedText style={styles.typeTitle} setColor={titleColor}>
                      {workoutType.title}
                    </ThemedText>
                    <ThemedText style={styles.typeMetrics} setColor={quietText}>
                      {workoutType.metrics}
                    </ThemedText>
                  </View>

                  <View style={styles.availableStatus}>
                    <Feather name="check-circle" size={17} color={accentColor} />
                    <ThemedText
                      style={styles.availableStatusText}
                      setColor={quietText}
                    >
                      AVAILABLE
                    </ThemedText>
                  </View>
                </View>

                {workoutType.id === "strength-training" ? (
                  <TouchableOpacity
                    activeOpacity={0.78}
                    onPress={() =>
                      Alert.alert(
                        "Exercises",
                        "Settings for this section will be added here."
                      )
                    }
                    style={[
                      styles.typeSettingRow,
                      { borderTopColor: cardBorder },
                    ]}
                  >
                    <View style={styles.typeSettingCopy}>
                      <Library width={20} height={20} color={titleColor} />
                      <ThemedText
                        style={styles.typeSettingTitle}
                        setColor={titleColor}
                      >
                        Exercises
                      </ThemedText>
                    </View>
                    <TailArrowUpRight
                      width={17}
                      height={17}
                      stroke={titleColor}
                      color={titleColor}
                    />
                  </TouchableOpacity>
                ) : null}
              </ThemedCard>
            );
          })}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
