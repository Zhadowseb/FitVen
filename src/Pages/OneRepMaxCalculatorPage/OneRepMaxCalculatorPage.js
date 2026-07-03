import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./OneRepMaxCalculatorPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
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
  roundToNearestWeightIncrement,
} from "../../Utils/oneRepMaxUtils";

const LOAD_PERCENTAGES = [100, 95, 90, 85, 80, 75, 70];

function parseDecimal(value) {
  const normalizedValue = String(value ?? "").trim().replace(",", ".");
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatWeight(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(1);
}

export default function OneRepMaxCalculatorPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [estimatedOneRepMax, setEstimatedOneRepMax] = useState(null);
  const [errors, setErrors] = useState({});

  const primaryColor = theme.primary ?? "#f7742e";
  const secondaryColor = theme.secondary ?? "#60daac";
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.fields ?? theme.uiBackground ?? cardSurface;
  const cardBorder =
    theme.cardBorder ?? theme.border ?? theme.iconColor ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;

  const calculate = () => {
    const parsedWeight = parseDecimal(weight);
    const parsedReps = parseDecimal(reps);
    const nextErrors = {};

    if (parsedWeight === null || parsedWeight <= 0) {
      nextErrors.weight = "Enter a weight above 0.";
    }

    if (
      parsedReps === null ||
      !Number.isInteger(parsedReps) ||
      parsedReps < 1 ||
      parsedReps > 36
    ) {
      nextErrors.reps = "Enter a whole number between 1 and 36.";
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
    setEstimatedOneRepMax(null);
    setErrors({});
  };

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={styles.pageHeaderTitleEyebrow}
            setColor={quietText}
          >
            Train
          </ThemedText>
          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            1RM Calculator
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ThemedKeyboardProtection
        scroll
        contentContainerStyle={styles.content}
        scrollViewProps={{ showsVerticalScrollIndicator: false }}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[styles.heroAccent, { backgroundColor: secondaryColor }]}
          />
          <ThemedText style={styles.heroEyebrow} setColor={secondaryColor}>
            ESTIMATED ONE REP MAX
          </ThemedText>
          <ThemedTitle type="h2" style={styles.heroTitle}>
            Turn a working set into an estimate
          </ThemedTitle>
          <ThemedText style={styles.heroDescription} setColor={quietText}>
            Enter the weight and completed reps. The result uses the same
            Brzycki formula as your automatic personal records.
          </ThemedText>
        </View>

        <View
          style={[
            styles.calculatorCard,
            {
              backgroundColor: cardSurface,
              borderColor: cardBorder,
            },
          ]}
        >
          <View style={styles.inputRow}>
            <View style={styles.inputColumn}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Weight
              </ThemedText>
              <ThemedTextInput
                value={weight}
                onChangeText={(value) => {
                  setWeight(value);
                  setEstimatedOneRepMax(null);
                  setErrors((current) => ({ ...current, weight: null }));
                }}
                placeholder="100"
                keyboardType="decimal-pad"
                returnKeyType="next"
                error={errors.weight}
                inputStyle={[
                  styles.input,
                  {
                    backgroundColor: innerSurface,
                    color: titleColor,
                  },
                ]}
              />
              <ThemedText style={styles.inputUnit} setColor={quietText}>
                kg
              </ThemedText>
            </View>

            <View style={styles.inputColumn}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Reps
              </ThemedText>
              <ThemedTextInput
                value={reps}
                onChangeText={(value) => {
                  setReps(value);
                  setEstimatedOneRepMax(null);
                  setErrors((current) => ({ ...current, reps: null }));
                }}
                placeholder="5"
                keyboardType="number-pad"
                returnKeyType="done"
                error={errors.reps}
                onSubmitEditing={calculate}
                inputStyle={[
                  styles.input,
                  {
                    backgroundColor: innerSurface,
                    color: titleColor,
                  },
                ]}
              />
              <ThemedText style={styles.inputUnit} setColor={quietText}>
                completed
              </ThemedText>
            </View>
          </View>

          <ThemedButton
            title="Calculate estimated 1RM"
            onPress={calculate}
            fullWidth
            style={[styles.calculateButton, { backgroundColor: primaryColor }]}
          />

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
                ESTIMATED 1RM
              </ThemedText>
              <View style={styles.resultValueRow}>
                <ThemedText style={styles.resultValue} setColor={titleColor}>
                  {formatWeight(estimatedOneRepMax)}
                </ThemedText>
                <ThemedText style={styles.resultUnit} setColor={quietText}>
                  kg
                </ThemedText>
              </View>
              <ThemedText style={styles.resultNote} setColor={quietText}>
                Rounded to the nearest 0.5 kg.
              </ThemedText>
            </View>
          ) : null}
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
                  setColor={primaryColor}
                >
                  TRAINING LOADS
                </ThemedText>
                <ThemedTitle type="h3" style={styles.percentageTitle}>
                  Percent of estimated 1RM
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
                      setColor={primaryColor}
                    >
                      {percentage}%
                    </ThemedText>
                    <ThemedText style={styles.loadValue} setColor={titleColor}>
                      {formatWeight(load)} kg
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
            About the estimate
          </ThemedText>
          <ThemedText style={styles.infoText} setColor={quietText}>
            Estimates are generally most useful from hard sets of 1-10 reps.
            Fatigue, technique and exercise choice can change the result.
          </ThemedText>
        </View>

        {(weight || reps || estimatedOneRepMax !== null) && (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={reset}
            style={[styles.resetButton, { borderColor: cardBorder }]}
          >
            <ThemedText style={styles.resetButtonText} setColor={primaryColor}>
              Reset calculator
            </ThemedText>
          </TouchableOpacity>
        )}
      </ThemedKeyboardProtection>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
