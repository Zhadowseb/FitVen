import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, TextInput, TouchableOpacity, View, useColorScheme, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { weightliftingService } from '@services';
import { Colors, withAlpha } from '@resources/GlobalStyling/colors';
import { ThemedButton, ThemedCard, ThemedHeader, ThemedSegmentedControl, ThemedStateBlock, ThemedSwitch, ThemedText, ThemedTitle, ThemedView } from '@resources/ThemedComponents';
import ExerciseMapBody from './ExerciseMapBody';
import { filterMapExercises, normalizeMapExercise, REGION_LABELS } from './exerciseMapUtils';
import styles from './ExerciseMapPageStyle';

const MODES = [{ value: 'exercise', label: 'View exercise' }, { value: 'muscles', label: 'Select muscles' }];
const VIEWS = [{ value: 'both', label: 'Both' }, { value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }];
const CROPS = [{ value: 'full', label: 'Full body' }, { value: 'upper', label: 'Upper' }, { value: 'lower', label: 'Lower' }];
const EMPTY = [];

// Everything below is defined once, at module scope, rather than inside the
// component. A fresh `ItemSeparatorComponent` on every render is a new
// component *type*, so React unmounts and remounts every separator instead of
// leaving them alone; a fresh `renderItem` re-renders every visible row. Both
// used to happen on each muscle toggle, and removing a muscle is the expensive
// direction - it widens the result set rather than narrowing it.
const Separator = () => <View style={styles.spacer} />;
const keyExtractor = item => item.name;

const ExerciseRow = memo(function ExerciseRow({ item, isSelected, theme, onPress }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${item.name}`} accessibilityState={{ selected: isSelected }} onPress={() => onPress(item)} style={[styles.exerciseRow, { backgroundColor: isSelected ? withAlpha(theme.primary, 0.08) : theme.cardBackground, borderColor: theme.cardBorder }]}>
    <View style={[styles.exerciseIcon, { backgroundColor: theme.chipBackground }]}><Ionicons name="barbell-outline" size={21} color={theme.primaryText} /></View>
    <View style={styles.grow}><ThemedText style={styles.exerciseName} setColor={theme.textStrong}>{item.name}</ThemedText><ThemedText style={styles.exerciseMeta} setColor={theme.quietText}>{item.hasMetadata ? item.primary.length ? item.primary.map(key => REGION_LABELS[key]).join(', ') : 'Secondary muscle mapping' : 'Muscle mapping unavailable'}{item.custom ? ' · Custom' : ''}</ThemedText></View><Ionicons name="chevron-forward" size={17} color={theme.quietText} />
  </TouchableOpacity>;
});

export default function ExerciseMapPage() {
  const db = useSQLiteContext();
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const { width } = useWindowDimensions();
  const listRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState('exercise');
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState(null);
  const [selected, setSelected] = useState([]);
  const [view, setView] = useState('both');
  const [crop, setCrop] = useState('full');
  const [surface, setSurface] = useState('surface');
  const [primaryOnly, setPrimaryOnly] = useState(false);
  const [matchAll, setMatchAll] = useState(true);
  const [namesVisible, setNamesVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(false);
    weightliftingService.getExerciseLibraryEntries(db).then(entries => {
      if (!active) return;
      const next = entries.map(normalizeMapExercise).filter(entry => entry.name);
      setRows(next);
      setSelectedName(previous => next.some(entry => entry.name === previous) ? previous : (next.find(entry => /bench press/i.test(entry.name) && entry.hasMetadata) ?? next.find(entry => entry.hasMetadata) ?? next[0])?.name ?? null);
    }).catch(loadError => {
      if (!active) return;
      console.error('Failed to load Exercise Map:', loadError);
      setError(true);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, reload]));

  const exercise = useMemo(() => rows.find(entry => entry.name === selectedName), [rows, selectedName]);
  const results = useMemo(() => filterMapExercises(rows, { query, selected: mode === 'muscles' ? selected : EMPTY, primaryOnly, matchAll }), [rows, query, mode, selected, primaryOnly, matchAll]);
  const toggleRegion = useCallback(key => {
    setQuery('');
    if (mode === 'exercise') { setSelected([key]); setMode('muscles'); }
    else setSelected(previous => previous.includes(key) ? previous.filter(region => region !== key) : [...previous, key]);
  }, [mode]);
  const chooseExercise = useCallback(item => {
    setSelectedName(item.name); setMode('exercise'); setQuery('');
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  // Deliberately does not depend on `selected` or `results`: toggling a muscle
  // changes which exercises are listed, not how a row draws itself, so the rows
  // that survive the change should not be asked to render again.
  const renderItem = useCallback(({ item }) => <ExerciseRow item={item} isSelected={mode === 'exercise' && item.name === selectedName} theme={theme} onPress={chooseExercise} />, [mode, selectedName, theme, chooseExercise]);
  const changeMode = value => { setMode(value); setQuery(''); };
  const frameWidth = Math.max(100, width - 68);
  const modelWidth = view === 'both' ? (frameWidth - 12) / 2 : frameWidth;
  const bodySides = view === 'both' ? ['front', 'back'] : [view];
  const chip = (key, removable = false) => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`${REGION_LABELS[key]}${removable ? ', remove selection' : ''}`} accessibilityState={{ selected: mode === 'muscles' && selected.includes(key) }} onPress={() => toggleRegion(key)} style={[styles.chip, { backgroundColor: mode === 'muscles' && selected.includes(key) ? theme.primary : theme.uiBackground, borderColor: theme.border }]}>
    <ThemedText style={{ fontSize: 13, fontWeight: '600' }} setColor={mode === 'muscles' && selected.includes(key) ? theme.textInverted : theme.textStrong}>{REGION_LABELS[key]}</ThemedText>
    {removable ? <Ionicons name="close" size={15} color={theme.textInverted} /> : null}
  </TouchableOpacity>;
  const header = <View style={styles.header}>
    <View style={[styles.search, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
      <Ionicons name="search" size={19} color={theme.quietText} />
      <TextInput accessibilityLabel="Search exercises" value={query} onChangeText={setQuery} placeholder="Search exercise, e.g. bench press" placeholderTextColor={theme.quietText} style={[styles.input, { color: theme.textStrong }]} autoCorrect={false} returnKeyType="search" />
      {query ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" style={styles.iconButton} onPress={() => setQuery('')}><Ionicons name="close" size={20} color={theme.quietText} /></TouchableOpacity> : null}
    </View>
    <ThemedSegmentedControl options={MODES} value={mode} onChange={changeMode} />
    {!query.trim() ? <ThemedCard style={styles.panel}>
      <View style={styles.row}>
        <View style={styles.grow}><ThemedText style={styles.label} setColor={theme.quietText}>MUSCLE MAP</ThemedText><ThemedText style={styles.title} setColor={theme.title}>{mode === 'exercise' ? exercise?.name || 'Explore muscles' : selected.length ? `${selected.length} selected` : 'Where do you want to train?'}</ThemedText></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Toggle surface and contour" onPress={() => setSurface(value => value === 'surface' ? 'contour' : 'surface')} style={[styles.smallButton, { borderColor: theme.border, backgroundColor: theme.uiBackground }]}><ThemedText type="bodySmall">{surface === 'surface' ? 'Surface' : 'Contour'}</ThemedText></TouchableOpacity>
      </View>
      <View style={styles.wrap}><ThemedSegmentedControl options={VIEWS} value={view} onChange={setView} /><ThemedSegmentedControl options={CROPS} value={crop} onChange={setCrop} /></View>
      <View style={styles.bodies}>{bodySides.map(side => <ExerciseMapBody key={side} side={side} width={modelWidth} crop={crop} surface={surface} primary={exercise?.[side].primary ?? EMPTY} secondary={exercise?.[side].secondary ?? EMPTY} selected={selected} mode={mode} onSelect={toggleRegion} />)}</View>
      <ThemedText style={styles.hint} setColor={theme.quietText}>Tap a muscle to find exercises</ThemedText>
      <View style={[styles.legend, { borderTopColor: theme.hairline }]}>
        {[['#60DAAC', mode === 'muscles' ? 'Selected' : 'Primary'], ...(mode === 'exercise' ? [['#18A06C', 'Secondary']] : []), [theme.quietText, 'Other']].map(([color, label]) => <View key={label} style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color }]} /><ThemedText type="bodySmall">{label}</ThemedText></View>)}
      </View>
    </ThemedCard> : null}
    {mode === 'exercise' && exercise && !query.trim() ? <ThemedCard style={styles.panel}>
      <ThemedText style={styles.label} setColor={theme.quietText}>MUSCLE INVOLVEMENT</ThemedText>
      {exercise.hasMetadata ? <>
        {[...exercise.primary, ...exercise.secondary].map(key => <TouchableOpacity key={key} accessibilityRole="button" onPress={() => toggleRegion(key)} style={[styles.roleRow, { borderBottomColor: theme.hairline }]}>
          <View style={[styles.dot, { backgroundColor: exercise.primary.includes(key) ? '#60DAAC' : '#18A06C' }]} /><View style={styles.grow}><ThemedText style={styles.roleName} setColor={theme.textStrong}>{REGION_LABELS[key]}</ThemedText><ThemedText type="bodySmall" setColor={theme.quietText}>{exercise.primary.includes(key) ? 'Primary · main muscle' : 'Secondary · assisting muscle'}</ThemedText></View><Ionicons name="chevron-forward" color={theme.quietText} size={17} />
        </TouchableOpacity>)}
        <ThemedText style={styles.note} setColor={theme.quietText}>Colours show muscle roles, not measured percentages. A whole group is highlighted; involvement can differ within the group.</ThemedText>
        <ThemedButton title="Find exercises for these muscles" fullWidth onPress={() => { setSelected(exercise.primary.length ? exercise.primary : exercise.secondary); changeMode('muscles'); }} />
      </> : <ThemedText style={styles.note} setColor={theme.quietText}>No muscle mapping is available for this exercise. It remains searchable; no involvement is estimated.</ThemedText>}
    </ThemedCard> : null}
    {mode === 'muscles' ? <ThemedCard style={styles.panel}>
      <View style={styles.row}><ThemedText style={styles.label} setColor={theme.quietText}>SELECTED MUSCLES</ThemedText>{selected.length ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear muscle selection" onPress={() => setSelected([])} style={styles.iconButton}><Ionicons name="refresh" size={20} color={theme.primaryText} /></TouchableOpacity> : null}</View>
      {selected.length ? <View style={styles.wrap}>{selected.map(key => chip(key, true))}</View> : <ThemedText type="body">Select muscles on the body or by name below.</ThemedText>}
      <View style={styles.row}><ThemedText type="body">Primary muscles only</ThemedText><ThemedSwitch accessibilityLabel="Primary muscles only" value={primaryOnly} onValueChange={setPrimaryOnly} /></View>
      {selected.length > 1 ? <View style={styles.row}><ThemedText type="body">Match every selected muscle</ThemedText><ThemedSwitch accessibilityLabel="Match every selected muscle" value={matchAll} onValueChange={setMatchAll} /></View> : null}
    </ThemedCard> : null}
    <ThemedCard style={styles.panel}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: namesVisible }} onPress={() => setNamesVisible(value => !value)} style={[styles.row, { minHeight: 44 }]}><ThemedText type="body" style={{ fontWeight: '700' }}>Select muscle by name</ThemedText><Ionicons name={namesVisible ? 'chevron-up' : 'chevron-down'} size={18} color={theme.quietText} /></TouchableOpacity>
      {namesVisible ? <View style={styles.wrap}>{Object.keys(REGION_LABELS).map(key => chip(key))}</View> : null}
    </ThemedCard>
    <ThemedText style={styles.listHeading} accessibilityLiveRegion="polite">{query.trim() ? 'Search results' : mode === 'muscles' ? 'Matching exercises' : 'Exercise library'} · {results.length}</ThemedText>
  </View>;

  return <ThemedView safe={['top', 'left', 'right']} style={styles.container}>
    <ThemedHeader><ThemedTitle type="pageTitle">Exercise Map</ThemedTitle></ThemedHeader>
    {loading ? <ThemedStateBlock message="Loading exercise map…" fill /> : error ? <ThemedStateBlock variant="error" title="Could not load exercises" message="Please try again." actionLabel="Retry" onAction={() => setReload(value => value + 1)} fill /> :
      <FlatList ref={listRef} data={results} keyExtractor={keyExtractor} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" ListHeaderComponent={header} ItemSeparatorComponent={Separator} initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5} refreshing={false} onRefresh={() => setReload(value => value + 1)}
        renderItem={renderItem}
        ListEmptyComponent={<ThemedStateBlock variant="empty" title={rows.length ? 'No matching exercises' : 'Your exercise library is empty'} message={rows.length ? 'Try another name or fewer muscles.' : 'Add exercises through Exercise Library first.'} actionLabel={rows.length ? 'Clear filters' : undefined} onAction={() => { setQuery(''); setSelected([]); }} />}
      />}
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
  </ThemedView>;
}
