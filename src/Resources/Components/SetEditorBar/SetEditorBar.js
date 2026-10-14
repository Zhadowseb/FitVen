import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View, useColorScheme } from "react-native";
import {
  DefaultKeyboardToolbarTheme,
  KeyboardToolbar,
  useKeyboardState,
} from "react-native-keyboard-controller";

import { Colors, withAlpha } from "../../GlobalStyling/colors";
import Minus from "../../Icons/UI-icons/Minus";
import Plus from "../../Icons/UI-icons/Plus";
import ThemedText from "../../ThemedComponents/ThemedText";
import RepsCarousel from "./RepsCarousel";
import { formatNumber, useTranslation } from "@localization";
import { setEditorBar } from "@utils/setEditorBar";

// The bar over the keyboard while a weight is being edited: minus and plus,
// and the step they move by, in a field that is kept for the exercise. It is the
// content of the keyboard toolbar App.js mounts once - the part of the
// keyboard that is ours - so it sits on the keyboard on both phones and never
// covers a column of the table.
//
// It only shows what the set list that owns the field put in the store
// (Utils/setEditorBar.js) and calls back what that set list gave it: the
// stepping, the holding, saving the step. It touches no database.

const HIT_SLOP = { top: 6, bottom: 6, left: 8, right: 8 };

function useSetEditorBar() {
  return useSyncExternalStore(setEditorBar.subscribe, setEditorBar.get, setEditorBar.get);
}

function BarButton({ direction, disabled, bar, color, background, label }) {
  const Icon = direction > 0 ? Plus : Minus;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      delayLongPress={bar.repeatDelayMs}
      onPress={() => bar.onStep(direction)}
      onLongPress={() => bar.onRepeatStart(direction)}
      onPressOut={() => bar.onRepeatStop()}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        (disabled || pressed) && styles.buttonDimmed,
      ]}
    >
      <Icon width={16} height={16} color={color} thickness={2.6} />
    </Pressable>
  );
}

// The reps of a set: the carousel, over the keyboard. Its text and border
// follow the keyboard's own look, like the weight bar's.
function RepsBarContent({ bar }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const keyboardAppearance = useKeyboardState((state) => state.appearance);
  const toolbarColors = DefaultKeyboardToolbarTheme[keyboardAppearance === "dark" ? "dark" : "light"];

  return (
    <View style={styles.bar}>
      <RepsCarousel
        value={bar.reps}
        onChange={bar.onChangeReps}
        suffix={bar.suffix}
        suffixColor={theme.amrap}
        borderColor={theme.primary}
        textColor={toolbarColors.primary}
        quietColor={toolbarColors.primary}
        accessibilityLabel={t("workout.setList.repsCarouselLabel", { label: bar.label })}
        onActivate={bar.onActivate}
      />
    </View>
  );
}

function WeightBarContent({ bar }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const keyboardAppearance = useKeyboardState((state) => state.appearance);
  const stepLabel = formatNumber(bar.step, { maximumFractionDigits: 2 });
  const [text, setText] = useState(stepLabel);
  const [focused, setFocused] = useState(false);
  const textRef = useRef(text);
  const focusedRef = useRef(false);
  const barRef = useRef(bar);
  const sentRef = useRef(stepLabel);

  textRef.current = text;
  focusedRef.current = focused;
  barRef.current = bar;

  // The step changed behind the field - saved, or another set's bar - and the
  // person is not typing in it: it shows the step now.
  useEffect(() => {
    if (!focusedRef.current) {
      setText(stepLabel);
      sentRef.current = stepLabel;
    }
  }, [stepLabel]);

  // What was typed is sent once per distinct text: on blur, on the keyboard
  // going away and when the bar closes - Android's hide-keyboard button does
  // not blur a field - and a second way out finds it already sent.
  const submit = () => {
    if (textRef.current === sentRef.current) {
      return;
    }

    sentRef.current = textRef.current;

    // The step now in use comes back at once: what was typed, tidied - "1,3"
    // is 1,25 - or the old one when what was typed is not a step.
    const result = barRef.current.onStepSubmit(textRef.current);

    if (result?.step) {
      const shown = formatNumber(result.step, { maximumFractionDigits: 2 });

      sentRef.current = shown;
      setText(shown);
    }
  };

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      if (focusedRef.current) {
        submit();
      }
    });

    return () => {
      subscription.remove();

      if (focusedRef.current) {
        submit();
      }
    };
  }, []);

  const danger = theme.danger ?? "#ef4444";
  const secondary = theme.secondary ?? theme.primary;
  // The toolbar takes its background from the keyboard's own look - light or
  // dark whatever the app's theme is - so the text on it does too. The app's
  // theme is only for the red and the green.
  const toolbarColors = DefaultKeyboardToolbarTheme[keyboardAppearance === "dark" ? "dark" : "light"];
  const textColor = toolbarColors.primary;
  const quiet = toolbarColors.disabled;

  return (
    <View
      accessible={false}
      accessibilityLabel={t("workout.setList.weightBarLabel", { label: bar.label })}
      style={styles.bar}
    >
      <BarButton
        direction={-1}
        bar={bar}
        disabled={!bar.canDecrease}
        color={danger}
        background={withAlpha(danger, 0.14)}
        label={t("workout.setList.weightMinus", { step: stepLabel, label: bar.label })}
      />

      <View style={styles.step}>
        <ThemedText style={styles.stepSign} setColor={quiet}>
          {"±"}
        </ThemedText>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            focusedRef.current = false;
            submit();
          }}
          onSubmitEditing={submit}
          // The weight cell's own keyboard, so moving focus between the two
          // does not make Android swap keyboards.
          keyboardType="numeric"
          selectTextOnFocus
          maxLength={6}
          accessibilityLabel={t("workout.setList.weightStepField")}
          style={[styles.stepInput, { color: textColor, borderBottomColor: theme.primary }]}
          selectionColor={theme.primary}
        />
        <ThemedText style={styles.stepUnit} setColor={quiet}>
          {t("common.kg")}
        </ThemedText>
      </View>

      <BarButton
        direction={1}
        bar={bar}
        disabled={false}
        color={secondary}
        background={withAlpha(secondary, 0.14)}
        label={t("workout.setList.weightPlus", { step: stepLabel, label: bar.label })}
      />
    </View>
  );
}

/**
 * The global keyboard toolbar (a Done button over every keyboard), with the
 * weight bar in its middle while a weight is edited. The arrows go while it is
 * there: they need the room, and moving focus into the step field would
 * close the weight cell under it.
 */
export default function SetEditorKeyboardToolbar() {
  const bar = useSetEditorBar();

  // The keyboard going away closes the bar. Not the weight cell's blur: the
  // step field, which the bar owns, takes focus from it.
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", () => setEditorBar.close());

    return () => subscription.remove();
  }, []);

  return (
    <KeyboardToolbar
      showArrows={!bar}
      content={
        bar ? (
          bar.kind === "reps" ? (
            <RepsBarContent bar={bar} />
          ) : (
            <WeightBarContent bar={bar} />
          )
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 8,
  },
  button: {
    width: 44,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDimmed: {
    opacity: 0.45,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  stepSign: {
    fontSize: 13,
    fontWeight: "700",
  },
  stepInput: {
    minWidth: 44,
    paddingVertical: 2,
    paddingHorizontal: 2,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    borderBottomWidth: 1.5,
  },
  stepUnit: {
    fontSize: 12,
  },
});
