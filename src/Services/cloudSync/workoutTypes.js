// The workout type catalog: cloud to local, plus the selectable list.
import { supabase } from "@database/supaBaseClient";
import { programRepository } from "@repository";
import { withTransaction } from "@services/shared";
import {
  getAuthenticatedUserId,
  normalizeBooleanFlag,
  normalizeWorkoutLabel,
  normalizeWorkoutType,
} from "./cloudSyncShared";

const WORKOUT_TYPE_CLOUD_TABLE = "workout_type";

const WORKOUT_TYPE_CLOUD_SELECT = "type, display_name, is_active";

const REQUIRED_LOCAL_WORKOUT_TYPES = [
  { name: "Walk", displayName: "Walk", isActive: 1 },
];

export const LOCATION_WORKOUT_TYPES = new Set(["Run", "Walk"]);

function normalizeWorkoutTypeCatalogRow(row) {
  const name = normalizeWorkoutType(row?.type);

  if (!name) {
    return null;
  }

  return {
    name,
    displayName: normalizeWorkoutLabel(row?.display_name) ?? name,
    isActive: normalizeBooleanFlag(row?.is_active),
  };
}

export async function getSelectableWorkoutTypes(db) {
  return programRepository.getSelectableWorkoutTypes(db);
}

export async function syncWorkoutTypesWithCloud(db) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return getSelectableWorkoutTypes(db);
  }

  const { data, error } = await supabase
    .from(WORKOUT_TYPE_CLOUD_TABLE)
    .select(WORKOUT_TYPE_CLOUD_SELECT)
    .order("is_active", { ascending: false })
    .order("type", { ascending: true });

  if (error) {
    throw error;
  }

  let cloudRows = data ?? [];

  // App-required types (e.g. Walk) must exist in the cloud catalog too:
  // workout_type_instance.workout_type carries an FK to workout_type, so a
  // type that only exists locally makes every instance push fail with 23503.
  const cloudTypeNames = new Set(
    cloudRows.map((row) => normalizeWorkoutType(row?.type)).filter(Boolean)
  );
  const missingRequiredTypes = REQUIRED_LOCAL_WORKOUT_TYPES.filter(
    (workoutType) => !cloudTypeNames.has(workoutType.name)
  );

  if (missingRequiredTypes.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from(WORKOUT_TYPE_CLOUD_TABLE)
      .upsert(
        missingRequiredTypes.map((workoutType) => ({
          type: workoutType.name,
          display_name: workoutType.displayName ?? workoutType.name,
          is_active: Boolean(workoutType.isActive),
        })),
        { onConflict: "type" }
      )
      .select(WORKOUT_TYPE_CLOUD_SELECT);

    if (insertError) {
      // RLS may forbid catalog writes from the client. The local catalog
      // still works, but instance pushes for these types keep failing until
      // the rows are added server-side.
      console.warn(
        "Could not add required workout types to the cloud catalog:",
        insertError
      );
    } else {
      cloudRows = cloudRows.concat(insertedRows ?? []);
    }
  }

  const workoutTypes = cloudRows
    .map(normalizeWorkoutTypeCatalogRow)
    .filter(Boolean);

  await withTransaction(db, async () => {
    await programRepository.markAllWorkoutTypesInactive(db);

    for (const workoutType of workoutTypes) {
      await programRepository.upsertWorkoutType(db, workoutType);
    }

    for (const workoutType of REQUIRED_LOCAL_WORKOUT_TYPES) {
      await programRepository.upsertWorkoutType(db, workoutType);
    }
  });

  return getSelectableWorkoutTypes(db);
}

export async function refreshSelectableWorkoutTypes(db) {
  try {
    return await syncWorkoutTypesWithCloud(db);
  } catch (error) {
    console.warn("Workout type catalog cloud sync failed:", error);
    return getSelectableWorkoutTypes(db);
  }
}
