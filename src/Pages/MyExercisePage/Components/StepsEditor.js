import { useState } from "react";
import { TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./StepsEditorStyle";
import { useTranslation } from "@localization";
import { Colors } from "@resources/GlobalStyling/colors";
import Cross from "@resources/Icons/UI-icons/Cross";
import Plus from "@resources/Icons/UI-icons/Plus";
import { ThemedText, ThemedTextInput } from "@resources/ThemedComponents";
import { MAX_STEPS, STEP_MAX_LENGTH } from "@utils/customExercises";

// The count appears once a step is this close to the limit, not before: a
// counter under every short step is noise.
const COUNTER_FROM = STEP_MAX_LENGTH - 20;

// A step is one line of text, so a line break - pasted, or typed on a
// keyboard that ignores the return key setting - becomes a space.
function oneLine(text) {
  return String(text ?? "").replace(/\s*\n\s*/g, " ");
}

/**
 * "How it's done": up to MAX_STEPS numbered steps, each a field of its own
 * with a remove button, and "+ Add step" under them while there is room.
 *
 * Props:
 *   steps                 [{ id, text }] - the page's draft
 *   getInputRef(id)       a ref object for that step's field, so the page can
 *                         focus a step it has just added
 *   onChangeStep(id, text), onAddStep(), onRemoveStep(id)
 *   onSubmitStep(id)      the return key on a step that has one after it
 */
export default function StepsEditor({
  steps,
  getInputRef,
  onChangeStep,
  onAddStep,
  onRemoveStep,
  onSubmitStep,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [focusedId, setFocusedId] = useState(null);

  return (
    <View style={styles.list}>
      {steps.map((step, index) => {
        const number = index + 1;
        const isFocused = focusedId === step.id;
        const isLast = index === steps.length - 1;
        const stepLabel = t("myExercise.steps.step", { number });

        return (
          <View key={step.id} style={styles.row}>
            <ThemedText
              style={styles.number}
              setColor={theme.primaryText}
              importantForAccessibility="no"
              accessibilityElementsHidden
            >
              {number}
            </ThemedText>

            <View style={styles.field}>
              <ThemedTextInput
                innerRef={getInputRef(step.id)}
                value={step.text}
                onChangeText={(text) => onChangeStep(step.id, oneLine(text))}
                placeholder={stepLabel}
                accessibilityLabel={stepLabel}
                maxLength={STEP_MAX_LENGTH}
                multiline
                autoCapitalize="sentences"
                // The last step closes the keyboard; the others go on to the
                // next one without letting it drop in between.
                returnKeyType={isLast ? "done" : "next"}
                submitBehavior={isLast ? "blurAndSubmit" : "submit"}
                onSubmitEditing={isLast ? undefined : () => onSubmitStep?.(step.id)}
                onFocus={() => setFocusedId(step.id)}
                onBlur={() =>
                  setFocusedId((current) => (current === step.id ? null : current))
                }
                inputStyle={[
                  styles.input,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: isFocused ? theme.primary : theme.border,
                    borderWidth: isFocused ? 1.5 : 1,
                    color: theme.title,
                  },
                ]}
              />
              {step.text.length >= COUNTER_FROM ? (
                <ThemedText style={styles.counter} setColor={theme.quietText}>
                  {`${step.text.length}/${STEP_MAX_LENGTH}`}
                </ThemedText>
              ) : null}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("myExercise.steps.remove", { number })}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={() => onRemoveStep(step.id)}
              style={styles.remove}
            >
              <Cross width={18} height={18} color={theme.quietText} />
            </TouchableOpacity>
          </View>
        );
      })}

      {steps.length < MAX_STEPS ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("myExercise.steps.add")}
          activeOpacity={0.8}
          onPress={onAddStep}
          style={[styles.add, { borderColor: theme.overlayStrong }]}
        >
          <Plus width={16} height={16} color={theme.primaryText} thickness={2.2} />
          <ThemedText style={styles.addText} setColor={theme.primaryText}>
            {t("myExercise.steps.add")}
          </ThemedText>
        </TouchableOpacity>
      ) : (
        <ThemedText style={styles.full} setColor={theme.quietText}>
          {t("myExercise.steps.full", { max: MAX_STEPS })}
        </ThemedText>
      )}
    </View>
  );
}
