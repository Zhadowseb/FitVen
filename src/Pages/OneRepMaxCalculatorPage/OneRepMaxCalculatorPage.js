import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Keyboard,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useTranslation } from "@localization";

import styles from "./OneRepMaxCalculatorPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { formatDisplayNumber } from "../../Utils/numberUtils";
import {
  ThemedButton,
  ThemedHeader,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";
import {
  calculateBrzyckiOneRepMax,
  MAX_ESTIMATE_REPS,
  roundToNearestWeightIncrement,
} from "../../Utils/oneRepMaxUtils";

const LOAD_PERCENTAGES = [100, 95, 90, 85, 80, 75, 70];

function parseDecimal(value) {
  const normalizedValue = String(value ?? "").trim().replace(",", ".");
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/**
 * A set to open on, from the route: `weight`, `reps` and, optionally,
 * `exerciseName` - the Train tab's 1RM tool passes its best set of the last
 * thirty days. The form starts filled in and already worked out, so the
 * number on the tile is the number on this screen. A set the form itself
 * would refuse is ignored, and the calculator starts empty as it always has.
 */
function readPrefilledSet(params) {
  const weight = Number(params?.weight);
  const reps = Number(params?.reps);

  if (
    !Number.isFinite(weight) ||
    weight <= 0 ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > MAX_ESTIMATE_REPS
  ) {
    return null;
  }

  const exerciseName =
    typeof params?.exerciseName === "string" ? params.exerciseName.trim() : "";

  return {
    weight: String(weight),
    reps: String(reps),
    exerciseName: exerciseName || null,
    estimate: roundToNearestWeightIncrement(calculateBrzyckiOneRepMax(weight, reps)),
  };
}

export default function OneRepMaxCalculatorPage() {
  const { t } = useTranslation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // Read once, when the screen opens: after that the form is the user's.
  const [prefilledSet] = useState(() => readPrefilledSet(route.params));
  const [weight, setWeight] = useState(prefilledSet?.weight ?? "");
  const [reps, setReps] = useState(prefilledSet?.reps ?? "");
  const [exerciseName, setExerciseName] = useState(prefilledSet?.exerciseName ?? null);
  const [estimatedOneRepMax, setEstimatedOneRepMax] = useState(
    prefilledSet?.estimate ?? null
  );
  const [errors, setErrors] = useState({});

  const primaryColor = theme.primary;

  const primaryTextColor = theme.primaryText ?? theme.primary;
  const secondaryColor = theme.secondary;
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.fields ?? theme.uiBackground ?? cardSurface;
  const cardBorder =
    theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;

  const calculate = () => {
    Keyboard.dismiss();

    const parsedWeight = parseDecimal(weight);
    const parsedReps = parseDecimal(reps);
    const nextErrors = {};

    if (parsedWeight === null || parsedWeight <= 0) {
      nextErrors.weight = t("settings.oneRepMax.errors.weight");
    }

    if (
      parsedReps === null ||
      !Number.isInteger(parsedReps) ||
      parsedReps < 1 ||
      parsedReps > MAX_ESTIMATE_REPS
    ) {
      nextErrors.reps = t("settings.oneRepMax.errors.reps", {
        max: MAX_ESTIMATE_REPS,
      });
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setEstimatedOneRepMax(null);
      return;
    }

    const result = calculateBrzyckiOneRepMax(parsedWeight, parsedReps);
    setErrors({});
    setEstimatedOneRepMax(roundToNearestWeightIncrement(result));
  };

  const reset = () => {
    setWeight("");
    setReps("");
    setExerciseName(null);
    setEstimatedOneRepMax(null);
    setErrors({});
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={12}
            style={styles.pageHeaderTitleEyebrow}
            setColor={quietText}
          >
            {t("settings.oneRepMax.eyebrow")}
          </ThemedText>
          <ThemedTitle
            type="pageTitle"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            {t("settings.oneRepMax.title")}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ThemedKeyboardProtection
        scroll
        bottomOffset={48}
        contentContainerStyle={styles.content}
        scrollViewProps={{ showsVerticalScrollIndicator: false }}
      >
        <View
          style={[
            styles.calculatorCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          {exerciseName ? (
            <ThemedText
              style={styles.exerciseName}
              setColor={titleColor}
              numberOfLines={1}
            >
              {exerciseName}
            </ThemedText>
          ) : null}

          <View style={styles.inputRow}>
            <View style={styles.inputColumn}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                {t("settings.oneRepMax.weight")}
              </ThemedText>
              <ThemedTextInput
                value={weight}
                onChangeText={(value) => {
                  setWeight(value);
                  setEstimatedOneRepMax(null);
                  setErrors((current) => ({ ...current, weight: null }));
                }}
                placeholder={t("settings.oneRepMax.weightPlaceholder")}
                keyboardType="decimal-pad"
                returnKeyType="next"
                error={errors.weight}
                suffix={t("common.kg")}
                inputStyle={[
                  styles.input,
                  {
                    backgroundColor: innerSurface,
                    color: titleColor,
                  },
                ]}
              />
            </View>

            <View style={styles.inputColumn}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                {t("settings.oneRepMax.reps")}
              </ThemedText>
              <ThemedTextInput
                value={reps}
                onChangeText={(value) => {
                  setReps(value);
                  setEstimatedOneRepMax(null);
                  setErrors((current) => ({ ...current, reps: null }));
                }}
                placeholder={t("settings.oneRepMax.repsPlaceholder")}
                keyboardType="number-pad"
                returnKeyType="done"
                error={errors.reps}
                onSubmitEditing={calculate}
                suffix={t("settings.oneRepMax.repsSuffix")}
                inputStyle={[
                  styles.input,
                  {
                    backgroundColor: innerSurface,
                    color: titleColor,
                  },
                ]}
              />
            </View>
          </View>

          {estimatedOneRepMax !== null ? (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: innerSurface,
                  borderColor: secondaryColor,
                },
              ]}
            >
              <ThemedText style={styles.resultLabel} setColor={secondaryColor}>
                {t("settings.oneRepMax.resultLabel")}
              </ThemedText>
              <View style={styles.resultValueRow}>
                <ThemedText style={styles.resultValue} setColor={titleColor}>
                  {formatDisplayNumber(estimatedOneRepMax)}
                </ThemedText>
                <ThemedText style={styles.resultUnit} setColor={quietText}>
                  {t("common.kg")}
                </ThemedText>
              </View>
              <ThemedText style={styles.resultNote} setColor={quietText}>
                {t("settings.oneRepMax.roundedNote")}
              </ThemedText>
            </View>
          ) : null}

          <ThemedButton
            title={t("settings.oneRepMax.calculate")}
            onPress={calculate}
            fullWidth
            style={[styles.calculateButton, { backgroundColor: primaryColor }]}
          />
        </View>

        {estimatedOneRepMax !== null ? (
          <View
            style={[
              styles.percentageCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.percentageHeader}>
              <View>
                <ThemedText
                  style={styles.percentageEyebrow}
                  setColor={primaryTextColor}
                >
                  {t("settings.oneRepMax.loadsEyebrow")}
                </ThemedText>
                <ThemedTitle type="h3" style={styles.percentageTitle}>
                  {t("settings.oneRepMax.loadsTitle")}
                </ThemedTitle>
              </View>
            </View>

            <View style={styles.percentageList}>
              {LOAD_PERCENTAGES.map((percentage) => {
                const load = roundToNearestWeightIncrement(
                  estimatedOneRepMax * (percentage / 100)
                );

                return (
                  <View
                    key={percentage}
                    style={[
                      styles.percentageRow,
                      {
                        backgroundColor: innerSurface,
                        borderColor: cardBorder,
                      },
                    ]}
                  >
                    <ThemedText
                      style={styles.percentageValue}
                      setColor={primaryTextColor}
                    >
                      {percentage}%
                    </ThemedText>
                    <ThemedText style={styles.loadValue} setColor={titleColor}>
                      {`${formatDisplayNumber(load)} ${t("common.kg")}`}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <ThemedText style={styles.infoTitle} setColor={titleColor}>
            {t("settings.oneRepMax.aboutTitle")}
          </ThemedText>
          <ThemedText style={styles.infoText} setColor={quietText}>
            {t("settings.oneRepMax.aboutBody", { max: MAX_ESTIMATE_REPS })}
          </ThemedText>
        </View>

        {(weight || reps || exerciseName || estimatedOneRepMax !== null) && (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={reset}
            style={[styles.resetButton, { borderColor: cardBorder }]}
          >
            <ThemedText style={styles.resetButtonText} setColor={primaryTextColor}>
              {t("settings.oneRepMax.reset")}
            </ThemedText>
          </TouchableOpacity>
        )}
      </ThemedKeyboardProtection>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
