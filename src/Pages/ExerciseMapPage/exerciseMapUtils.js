// The existing upper_traps key selects the full trapezius group on this map.
// It does not imply equal activation of upper, middle and lower fibres.
export const REGION_LABELS = {
  pecs: 'Chest', front_delts: 'Front delts', side_delts: 'Side delts',
  rear_delts: 'Rear delts', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques',
  upper_traps: 'Trapezius (traps)', lats: 'Lats', lower_back: 'Lower back',
  infraspinatus: 'Infraspinatus', teres_major: 'Teres major', teres_minor: 'Teres minor',
  glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings', calves: 'Calves', adductors: 'Adductors',
};

function keys(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(key => Object.prototype.hasOwnProperty.call(REGION_LABELS, key)))];
}

export function normalizeMapExercise(row) {
  const sides = {};
  for (const side of ['front', 'back']) {
    const primary = keys(row[`primary_${side}_body_map_region_keys`]);
    const secondary = keys(row[`secondary_${side}_body_map_region_keys`]);
    // Older catalog rows may only carry the chosen preview side.
    if (!primary.length && !secondary.length && (row.body_map_view || 'front') === side) {
      primary.push(...keys(row.primary_body_map_region_keys));
      secondary.push(...keys(row.secondary_body_map_region_keys));
    }
    sides[side] = { primary, secondary: secondary.filter(key => !primary.includes(key)) };
  }
  const primary = [...new Set([...sides.front.primary, ...sides.back.primary])];
  const secondary = [...new Set([...sides.front.secondary, ...sides.back.secondary])].filter(key => !primary.includes(key));
  return {
    name: row.exercise_name || row.name || '',
    nickname: row.nickname || '',
    custom: Boolean(row.is_custom),
    front: sides.front, back: sides.back, primary, secondary,
    hasMetadata: Boolean(primary.length || secondary.length),
  };
}

export function filterMapExercises(exercises, { query = '', selected = [], primaryOnly = false, matchAll = true } = {}) {
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const search = normalize(query);
  return exercises.filter(exercise => {
    if (!normalize(`${exercise.name} ${exercise.nickname}`).includes(search)) return false;
    if (!selected.length) return true;
    const involved = primaryOnly ? exercise.primary : [...exercise.primary, ...exercise.secondary];
    return matchAll ? selected.every(key => involved.includes(key)) : selected.some(key => involved.includes(key));
  });
}
