import { View, useColorScheme } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import styles from "./WorkoutSummaryCardStyle";
import Fire from "../../../../Resources/Icons/UI-icons/Fire";
import ThreeDots from "../../../../Resources/Icons/UI-icons/ThreeDots";
import { Colors } from "../../../../Resources/GlobalStyling/colors";
import {
  ThemedText,
  ThemedTitle,
  UserAvatar,
} from "../../../../Resources/ThemedComponents";

const summaryStats = [
  { label: "Duration", value: "52", unit: "min" },
  { label: "Sets", value: "18" },
  { label: "Exercises", value: "5" },
];

const personalRecords = [
  { exercise: "Bench Press", result: "100 kg x 3" },
  { exercise: "Incline DB", result: "32 kg x 8" },
];

export default function WorkoutSummaryCard() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const accent = theme.primary ?? "#f7742e";
  const quietText = theme.iconColor ?? "#8795ad";
  const mutedText = "#8392b0";
  const titleColor = theme.title ?? "#ffffff";
  const surface = colorScheme === "dark" ? "#151922" : "#f3f2f8";
  const insetSurface = colorScheme === "dark" ? "#181d27" : "#ffffff";
  const softBorder =
    colorScheme === "dark"
      ? "rgba(132, 145, 166, 0.16)"
      : "rgba(40, 37, 58, 0.14)";
  const accentBorder =
    colorScheme === "dark" ? "rgba(247, 116, 46, 0.42)" : "rgba(247, 116, 46, 0.55)";
  const footerColor = colorScheme === "dark" ? "#7f90ad" : theme.iconColor;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor: softBorder,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <UserAvatar
          size={50}
          iconSize={25}
          iconColor={accent}
          backgroundColor={insetSurface}
          borderColor={accent}
          borderWidth={2}
        />

        <View style={styles.headerCopy}>
          <ThemedText style={styles.authorName} setColor={titleColor}>
            Mads Jensen
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaText} setColor={mutedText}>
              2h ago
            </ThemedText>
            <View style={[styles.metaDot, { backgroundColor: mutedText }]} />
            <ThemedText style={styles.workoutType} setColor={accent}>
              Resistance
            </ThemedText>
          </View>
        </View>

        <ThreeDots width={18} height={18} color={quietText} />
      </View>

      <View style={styles.categoryRow}>
        <Fire width={15} height={15} stroke={accent} color={accent} />
        <ThemedText style={styles.categoryLabel} setColor={accent}>
          Strength
        </ThemedText>
      </View>

      <ThemedTitle type="h3" style={[styles.title, { color: titleColor }]}>
        Push A - Chest focus
      </ThemedTitle>

      <ThemedText style={styles.description} setColor={mutedText}>
        Solid session today. Felt strong on bench, finally hit a clean triple at
        100.
      </ThemedText>

      <View style={[styles.statsPanel, { borderColor: softBorder }]}>
        {summaryStats.map((stat, index) => (
          <View
            key={stat.label}
            style={[
              styles.statItem,
              index > 0 ? { borderLeftColor: softBorder, borderLeftWidth: 1 } : null,
            ]}
          >
            <ThemedText style={styles.statLabel} setColor={mutedText}>
              {stat.label}
            </ThemedText>
            <View style={styles.statValueRow}>
              <ThemedText style={styles.statValue} setColor={titleColor}>
                {stat.value}
              </ThemedText>
              {stat.unit ? (
                <ThemedText style={styles.statUnit} setColor={mutedText}>
                  {stat.unit}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.prPanel,
          {
            borderColor: accentBorder,
            backgroundColor:
              colorScheme === "dark"
                ? "rgba(247, 116, 46, 0.06)"
                : "rgba(247, 116, 46, 0.1)",
          },
        ]}
      >
        <View style={styles.prHeaderRow}>
          <Feather name="award" size={15} color={accent} />
          <ThemedText style={styles.prHeaderText} setColor={accent}>
            2 new PRs
          </ThemedText>
        </View>

        {personalRecords.map((record) => (
          <View key={record.exercise} style={styles.prRow}>
            <ThemedText style={styles.prExercise} setColor={titleColor}>
              {record.exercise}
            </ThemedText>
            <ThemedText style={styles.prResult} setColor={accent}>
              {record.result}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={[styles.footerRow, { borderTopColor: softBorder }]}>
        <View style={styles.footerAction}>
          <Feather name="heart" size={19} color={footerColor} />
          <ThemedText style={styles.footerText} setColor={footerColor}>
            12
          </ThemedText>
        </View>

        <View style={styles.footerAction}>
          <Feather name="message-circle" size={19} color={footerColor} />
          <ThemedText style={styles.footerText} setColor={footerColor}>
            3
          </ThemedText>
        </View>

        <View style={styles.footerSpacer} />

        <Feather name="share-2" size={19} color={footerColor} />
      </View>
    </View>
  );
}
