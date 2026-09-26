import { useState } from "react";
import { ActivityIndicator, TouchableOpacity, View, useColorScheme } from "react-native";

import styles from "./SupabaseUsageFormStyle";
import { parseUsageReading, usageFields } from "../devDashboardView";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import { ThemedText, ThemedTextInput } from "@resources/ThemedComponents";

const FIELDS = [
  { key: "db", label: "DB" },
  { key: "storage", label: "Storage" },
  { key: "egress", label: "Egress" },
  { key: "mau", label: "MAU" },
];

/**
 * S10 is read by hand off the Supabase dashboard, so the row carries a field
 * to type the reading into: four percentages of the plan, saved to
 * `dev_metrics` with today as "Aflæst". A blank field is saved as not read.
 *
 * `onSave(reading)` does the saving and throws with a message if it fails.
 */
export default function SupabaseUsageForm({ reading, onSave }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [fields, setFields] = useState(() => usageFields(reading));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const save = async () => {
    const parsed = parseUsageReading(fields);

    if (parsed.error) {
      setMessage({ text: parsed.error, isError: true });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await onSave(parsed.reading);
      setMessage({ text: "Gemt.", isError: false });
    } catch (error) {
      setMessage({
        text: error instanceof Error && error.message ? error.message : "Kunne ikke gemme.",
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.form, { borderColor: theme.hairline }]}>
      <View style={styles.fields}>
        {FIELDS.map((field) => (
          <View key={field.key} style={styles.field}>
            <ThemedText style={styles.label} setColor={theme.quietText} numberOfLines={1}>
              {field.label.toUpperCase()} %
            </ThemedText>

            <ThemedTextInput
              value={fields[field.key]}
              onChangeText={(text) => {
                setFields((current) => ({ ...current, [field.key]: text }));
                setMessage(null);
              }}
              placeholder="—"
              keyboardType="decimal-pad"
              maxLength={5}
              accessibilityLabel={`${field.label} i procent af planen`}
              inputStyle={styles.input}
            />
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <ThemedText
          style={styles.message}
          setColor={message?.isError ? theme.danger : theme.quietText}
          numberOfLines={2}
        >
          {message?.text ?? "Aflæst i dag, når du gemmer."}
        </ThemedText>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving }}
          activeOpacity={0.85}
          disabled={isSaving}
          onPress={save}
          style={[
            styles.button,
            {
              backgroundColor: withAlpha(theme.title, 0.05),
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.primaryText ?? theme.primary} />
          ) : (
            <ThemedText
              style={styles.buttonText}
              setColor={theme.primaryText ?? theme.primary}
              numberOfLines={1}
            >
              Gem aflæsning
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
