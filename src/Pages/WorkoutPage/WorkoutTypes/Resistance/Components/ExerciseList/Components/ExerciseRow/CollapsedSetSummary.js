import { View } from "react-native";
import { ThemedText } from "../../../../../../../../Resources/ThemedComponents";
import { withAlpha } from "../../../../../../../../Resources/GlobalStyling/colors";
import Star from "../../../../../../../../Resources/Icons/UI-icons/Star";
import styles from "./CollapsedSetSummaryStyle";

function value(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export function isPersonalRecordSet(set) {
  return Number(set?.personal_record) === 1 && Number(set?.done) === 1 && Number(set?.failed) !== 1;
}

export function SetProgressDots({ sets = [], theme, style }) {
  return (
    <View style={[styles.dots, style]}>
      {sets.map((set, index) => {
        const failed = Number(set?.failed) === 1;
        const done = Number(set?.done) === 1;
        const pr = isPersonalRecordSet(set);
        return pr ? <Star key={index} width={11} height={11} color={theme.planned} filled /> : (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: failed ? theme.danger : done ? theme.secondary : theme.overlayStrong,
              },
              !failed && !done && { borderWidth: 1, borderColor: withAlpha(theme.title, 0.42) },
            ]}
          />
        );
      })}
    </View>
  );
}

export function ClassicSetSummary({ sets = [], theme }) {
  if (!sets.length) return null;

  return (
    <View style={styles.classicRow}>
      {sets.map((set, index) => {
        const failed = Number(set?.failed) === 1;
        const personalRecord = isPersonalRecordSet(set);
        const valueColor = failed
          ? theme.danger
          : personalRecord
            ? theme.planned
            : theme.secondary;

        return (
          <View key={`${set?.sets_id ?? "set"}-${index}`} style={styles.classicSetGroup}>
            <View
              style={[
                styles.classicSetBubble,
                { borderColor: theme.cardBorder },
              ]}
            >
              <ThemedText size={12} style={styles.classicReps} setColor={theme.title}>
                {value(set?.reps)}
              </ThemedText>
              <ThemedText size={11} style={styles.classicSeparator} setColor={theme.quietText}>
                ·
              </ThemedText>
              <ThemedText
                size={12}
                style={[styles.classicWeight, failed && styles.struck]}
                setColor={valueColor}
              >
                {personalRecord ? "★ " : ""}{value(set?.weight)}
              </ThemedText>
              <ThemedText size={9} style={styles.classicUnit} setColor={theme.quietText}>
                kg
              </ThemedText>
            </View>
            {index < sets.length - 1 ? (
              <View
                style={[
                  styles.classicConnector,
                  { backgroundColor: theme.cardBorder },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function SetCell({ set, theme, compact = false, multiple }) {
  const failed = Number(set?.failed) === 1;
  const done = Number(set?.done) === 1;
  const pr = isPersonalRecordSet(set);
  const statusColor = failed ? theme.danger : pr ? theme.planned : done ? theme.secondary : theme.text;
  const backgroundColor = failed ? withAlpha(theme.danger, 0.1) : pr ? withAlpha(theme.planned, 0.12) : done ? withAlpha(theme.secondary, 0.1) : theme.tableRowAltSurface;
  const weight = <ThemedText size={compact ? 13.5 : 13.5} style={[styles.weight, failed && styles.struck]} setColor={statusColor}>{pr && "★ "}{value(set?.weight)}<ThemedText size={compact ? 9 : 9} setColor={theme.quietText}> kg</ThemedText></ThemedText>;
  const reps = <ThemedText size={compact ? 13.5 : 9.5} style={styles.reps} setColor={compact ? theme.title : theme.title}>{value(set?.reps)}<ThemedText size={compact ? 8.5 : 8.5} setColor={theme.quietText}>{multiple ? " ×" : " reps"}</ThemedText></ThemedText>;
  return <View style={[compact ? styles.compactCell : styles.cell, { backgroundColor }, compact ? { borderRightColor: theme.tableGridline } : null]}>{compact ? <View style={styles.inline}>{weight}{reps}</View> : <>{weight}{reps}</>}</View>;
}

export default function CollapsedSetSummary({ sets = [], view = "cells", theme }) {
  if (!sets.length || view === "progressOnly") return null;
  const compact = view === "compact" && sets.length <= 3;
  return <View style={[compact ? styles.compactRow : styles.cellsRow, compact ? { backgroundColor: theme.tableRowAltSurface } : null]}>{sets.map((set, index) => <SetCell key={`${set?.sets_id ?? "set"}-${index}`} set={set} theme={theme} compact={compact} multiple={!compact && sets.length >= 5} />)}</View>;
}
