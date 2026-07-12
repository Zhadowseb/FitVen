import { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { Colors } from "../../../../Resources/GlobalStyling/colors";

import styles from "./Rm_listStyle";
import { weightliftingService } from "../../../../Services";
import EditEstimatedSet from "./Components/EditEstimatedSet/EditEstimatedSet";

import { ThemedText } from "../../../../Resources/ThemedComponents";
import Pencil from "../../../../Resources/Icons/UI-icons/Pencil";
import Plus from "../../../../Resources/Icons/UI-icons/Plus";

function formatWeight(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return "--";
  }

  return Number.isInteger(parsedValue) ? `${parsedValue}` : parsedValue.toFixed(1);
}

const RmList = ({
  program_id,
  refreshKey,
  refresh,
  programExerciseBestMap = {},
  onAddPress,
}) => {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [loading, setLoading] = useState(false);
  const [editEstimatedSet_visible, set_editEstimatedSet_visible] = useState(false);
  const [estimated_sets, setEstimated_sets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null);

  const quietText = theme.quietText;
  const titleColor = theme.title;

  const loadEstimatedSets = async () => {
    try {
      setLoading(true);
      const nextEstimatedSets = await weightliftingService.getEstimatedSets(
        db,
        program_id
      );
      setEstimated_sets(nextEstimatedSets);
    } catch (error) {
      console.error("Error loading estimated sets", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      await weightliftingService.updateEstimatedSetWeight(db, {
        estimatedSetId: data.id,
        estimatedWeight: data.estimated_weight,
      });
      refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (data) => {
    try {
      await weightliftingService.deleteEstimatedSet(db, data.id);
      refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEstimatedSets();
  }, [program_id, refreshKey]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {estimated_sets.length > 0 && (
        <>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLeft} setColor={theme.text}>
              {`${estimated_sets.length} estimated ${
                estimated_sets.length === 1 ? "lift" : "lifts"
              }`}
            </ThemedText>
            <ThemedText style={styles.metaHint} setColor={quietText}>
              Tap a row to edit
            </ThemedText>
          </View>
          <View style={[styles.dividerFull, { backgroundColor: theme.hairline }]} />
        </>
      )}

      {estimated_sets.length === 0 && (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyText} setColor={titleColor}>
            No 1 RM have been set.
          </ThemedText>
          <ThemedText style={styles.emptyHint} setColor={quietText}>
            Add your first estimate below to start using weight targets.
          </ThemedText>
        </View>
      )}

      {estimated_sets.map((item, index) => (
        <View key={item.estimated_set_id}>
          {index > 0 && (
            <View
              style={[styles.dividerInset, { backgroundColor: theme.hairline }]}
            />
          )}
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.75}
            onPress={() => {
              setSelectedSet(item);
              set_editEstimatedSet_visible(true);
            }}
          >
            <ThemedText style={styles.rowName} setColor={titleColor} numberOfLines={1}>
              {item.exercise_name}
            </ThemedText>

            <View style={styles.rowValueGroup}>
              <ThemedText style={styles.rowValue} setColor={titleColor}>
                {formatWeight(item.estimated_weight)}
              </ThemedText>
              <ThemedText style={styles.rowUnit} setColor={quietText}>
                {" kg"}
              </ThemedText>
            </View>

            <Pencil width={15} height={15} color={quietText} thickness={1.8} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.addButton,
            {
              backgroundColor: theme.chipBackground,
              borderColor: theme.border,
            },
          ]}
          activeOpacity={0.85}
          onPress={onAddPress}
        >
          <Plus width={15} height={15} color={theme.title} thickness={2.2} />
          <ThemedText style={styles.addButtonText} setColor={theme.title}>
            Add 1RM
          </ThemedText>
        </TouchableOpacity>
      </View>

      <EditEstimatedSet
        visible={editEstimatedSet_visible}
        estimatedSet={selectedSet}
        programBest={selectedSet ? programExerciseBestMap[selectedSet.exercise_name] : null}
        onClose={() => set_editEstimatedSet_visible(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        refreshKey={refreshKey}
      />
    </View>
  );
};

export default RmList;
