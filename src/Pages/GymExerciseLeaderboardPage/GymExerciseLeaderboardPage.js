import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@localization";

import styles from "./GymExerciseLeaderboardPageStyle";
import { gymService } from "@services";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import LeaderboardRow from "@resources/Components/GymLeaderboard/LeaderboardRow";
import RadialGlow from "@resources/Components/GymLeaderboard/RadialGlow";
import ScopeToggle from "@resources/Components/GymLeaderboard/ScopeToggle";
import {
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "@resources/ThemedComponents";
import { formatWeightKg, shortenDisplayName } from "@utils/gymUtils";

const PODIUM_ORDER = [1, 0, 2];
const PODIUM_AVATAR = [58, 48, 48];
const PODIUM_PLINTH = [64, 44, 30];
const PAGE_SIZE = 50;
// Room left of the chosen chip when the row scrolls it into view.
const CHIP_SCROLL_INSET = 24;

function formatValue(lift, unit) {
  if (unit === gymService.LIFT_UNIT_BODYWEIGHT) {
    return lift?.ratio !== null && lift?.ratio !== undefined ? Number(lift.ratio).toFixed(2) : "—";
  }

  return formatWeightKg(lift?.weightKg);
}

function Podium({ rows, unit, theme, colorScheme, onOpenLifter }) {
  const { t } = useTranslation();
  const isLight = colorScheme === "light";
  const ringColors = [theme.record, "#B8BEC9", "#C98F5A"];
  const top = rows.slice(0, 3);

  if (!top.length) {
    return null;
  }

  return (
    <View style={[styles.podiumCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
      <RadialGlow color={theme.record} width={300} height={240} top={-110} right={undefined} left={20} />
      <View style={styles.podium}>
        {PODIUM_ORDER.map((position) => {
          const lift = top[position];

          if (!lift) {
            return <View key={position} style={styles.podiumColumn} />;
          }

          const isFirst = position === 0;
          const ringColor = ringColors[position];
          const avatarSize = PODIUM_AVATAR[position];
          // Somebody else's picture and name open their profile; yours do not.
          const canOpen = Boolean(onOpenLifter) && Boolean(lift.userId) && !lift.isMe;
          const Lifter = canOpen ? TouchableOpacity : View;
          const lifterProps = canOpen
            ? {
                activeOpacity: 0.75,
                accessibilityRole: "button",
                accessibilityHint: t("publicProfile.opensProfile"),
                onPress: () => onOpenLifter(lift),
              }
            : {};

          return (
            <View key={lift.liftId} style={styles.podiumColumn}>
              <Lifter style={styles.podiumLifter} {...lifterProps}>
                <View
                  style={[
                    styles.podiumAvatarRing,
                    { width: avatarSize + 6, height: avatarSize + 6, borderColor: ringColor },
                  ]}
                >
                  <UserAvatar uri={lift.avatarUrl} size={avatarSize} iconSize={Math.round(avatarSize * 0.4)} />
                </View>
                <ThemedText
                  style={[styles.podiumName, isFirst ? styles.podiumNameFirst : null]}
                  setColor={theme.title}
                  numberOfLines={1}
                >
                  {lift.isMe ? t("common.you") : shortenDisplayName(lift.displayName)}
                </ThemedText>
              </Lifter>
              <View style={styles.podiumWeightGroup}>
                <ThemedText
                  style={[styles.podiumWeight, isFirst ? styles.podiumWeightFirst : null]}
                  setColor={theme.title}
                >
                  {formatValue(lift, unit)}
                </ThemedText>
                <ThemedText style={styles.podiumUnit} setColor={theme.quietText}>
                  {unit === gymService.LIFT_UNIT_BODYWEIGHT ? "×" : t("common.kg")}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.plinth,
                  {
                    height: PODIUM_PLINTH[position],
                    backgroundColor: withAlpha(ringColor, isLight ? 0.16 : 0.14),
                  },
                ]}
              >
                <ThemedText style={styles.plinthText} setColor={ringColor}>
                  {position + 1}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Screens 1b and 2b. One exercise ranked: a podium for the top three, the
 * list from #4, the viewer's own row pinned at the bottom when it is not in
 * the loaded page. With `national` (route 2b) there is no centre, and
 * exercise chips switch between the big three.
 */
export default function GymExerciseLeaderboardPage({ national: nationalProp = false }) {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { t } = useTranslation();
  const national = nationalProp || Boolean(route.params?.national);
  const gymId = national ? null : Number(route.params?.gym_id ?? route.params?.gymId);
  const [exerciseId, setExerciseId] = useState(Number(route.params?.exercise_id ?? route.params?.exerciseId) || null);
  const [scope, setScope] = useState(route.params?.scope ?? gymService.GYM_SCOPE_GYM);
  const [unit, setUnit] = useState(gymService.LIFT_UNIT_KG);
  const [board, setBoard] = useState(null);
  const [otherScopeTotal, setOtherScopeTotal] = useState(null);
  const [chips, setChips] = useState([]);
  // In a centre: every exercise ranked there, so "All exercises" on the
  // centre's page reaches each one. Its own state, apart from the national
  // chips, because load() does not need it and should not rerun for it.
  const [gymChips, setGymChips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const chipRowRef = useRef(null);
  const quietText = theme.quietText ?? theme.text;
  const isLight = colorScheme === "light";
  const unitOptions = [
    { value: gymService.LIFT_UNIT_KG, label: t("common.kg") },
    { value: gymService.LIFT_UNIT_BODYWEIGHT, label: t("gyms.unit.bodyweight") },
  ];

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!exerciseId) {
        if (national) {
          try {
            const strongest = await gymService.getNationalStrongest();

            setChips(strongest.map((entry) => ({ id: entry.exerciseId, name: entry.exerciseName })));

            if (strongest[0]?.exerciseId) {
              setExerciseId(strongest[0].exerciseId);
              return;
            }
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : t("gyms.exercise.loadFailed"));
          }
        }

        setErrorMessage(t("gyms.exercise.pickExercise"));
        setIsLoading(false);
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }

      setErrorMessage("");

      try {
        const requests = [
          gymService.getExerciseLeaderboard({ gymId, exerciseId, scope, unit, limit: PAGE_SIZE }),
        ];

        if (!national) {
          requests.push(
            gymService.getExerciseLeaderboard({
              gymId,
              exerciseId,
              scope: scope === gymService.GYM_SCOPE_GYM ? gymService.GYM_SCOPE_FRIENDS : gymService.GYM_SCOPE_GYM,
              unit,
              limit: 1,
            })
          );
        } else if (chips.length === 0) {
          requests.push(gymService.getNationalStrongest());
        }

        const [boardResult, secondResult] = await Promise.allSettled(requests);

        if (boardResult.status === "rejected") {
          throw boardResult.reason;
        }

        setBoard(boardResult.value);

        if (!national) {
          setOtherScopeTotal(secondResult?.status === "fulfilled" ? secondResult.value.total : null);
        } else if (secondResult?.status === "fulfilled") {
          const list = secondResult.value.map((entry) => ({ id: entry.exerciseId, name: entry.exerciseName }));

          if (boardResult.value.exercise && !list.some((chip) => chip.id === boardResult.value.exercise.id)) {
            list.push({ id: boardResult.value.exercise.id, name: boardResult.value.exercise.name });
          }

          setChips(list);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : t("gyms.exercise.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    },
    [chips.length, exerciseId, gymId, national, scope, t, unit]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // The centre's exercises: the featured three, then every other one ranked
  // there - by everyone, whichever scope is showing, so Friends does not hide
  // an exercise only strangers have lifted. A chip row is a convenience; if
  // it cannot load, the page is still the one exercise it was opened on.
  useEffect(() => {
    if (national || !Number.isFinite(gymId)) {
      return undefined;
    }

    let isCancelled = false;

    gymService
      .getGymOverview({ gymId, scope: gymService.GYM_SCOPE_GYM, moreLimit: null })
      .then((overview) => {
        if (!isCancelled && overview) {
          setGymChips(
            [...overview.featured, ...overview.more]
              .filter((entry) => entry.exerciseId)
              .map((entry) => ({ id: entry.exerciseId, name: entry.exerciseName }))
          );
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [gymId, national]);

  const loadMore = async () => {
    if (!board?.nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const next = await gymService.getExerciseLeaderboard({
        gymId,
        exerciseId,
        scope,
        unit,
        limit: PAGE_SIZE,
        cursor: board.nextCursor,
      });

      setBoard((current) => ({
        ...next,
        rows: [...(current?.rows ?? []), ...next.rows],
        me: current?.me ?? next.me,
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("gyms.exercise.loadMoreFailed"));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const rows = board?.rows ?? [];
  const me = board?.me ?? null;
  const podiumRows = rows.slice(0, 3);
  // Four reasons a list can be empty, and the wording for each. As nested
  // ternaries in the markup you had to read the whole expression outwards to
  // know which pair a given combination produced - and the friends case, which
  // has a title of its own but no body, looked like drift rather than the
  // deliberate choice it is.
  const emptyState = useMemo(() => {
    if (unit === gymService.LIFT_UNIT_BODYWEIGHT) {
      return {
        titleKey: "gyms.exercise.empty.noBodyweightTitle",
        bodyKey: "gyms.exercise.empty.noBodyweightBody",
      };
    }

    // Across Denmark there is no one centre to finish a workout in, so no
    // second sentence either.
    if (national) {
      return { titleKey: "gyms.noLiftsYet", bodyKey: null };
    }

    if (scope === gymService.GYM_SCOPE_FRIENDS) {
      // There is no noFriendsBody: "nobody you follow has lifted this here"
      // needs no second sentence that the empty one does not already say.
      return {
        titleKey: "gyms.exercise.empty.noFriendsTitle",
        bodyKey: "gyms.exercise.empty.noLiftsBody",
      };
    }

    return {
      titleKey: "gyms.noLiftsYet",
      bodyKey: "gyms.exercise.empty.noLiftsBody",
    };
  }, [national, scope, unit]);

  // The podium takes the first three; the list is the rest. Memoised because
  // it is FlatList's data prop, and a new array on every render re-renders
  // every mounted row.
  const listRows = useMemo(() => rows.slice(3), [rows]);
  const hasMoreRow = Boolean(board?.nextCursor);

  const openLifter = useCallback(
    (lift) => navigation.navigate("PublicProfilePage", { userId: lift.userId }),
    [navigation]
  );

  const renderLeaderboardRow = useCallback(
    ({ item: lift, index }) => {
      const isLast = index === listRows.length - 1;

      return (
        <View
          style={[
            styles.listRowCard,
            index === 0 ? styles.listRowCardFirst : null,
            isLast && !hasMoreRow ? styles.listRowCardLast : null,
            { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          <LeaderboardRow
            lift={lift}
            unit={unit}
            showGym={national}
            onPressLifter={openLifter}
          />
          {!isLast ? (
            <View style={[styles.rowDivider, { backgroundColor: theme.hairline }]} />
          ) : null}
        </View>
      );
    },
    [hasMoreRow, listRows.length, national, openLifter, theme, unit]
  );
  const meInPage = me ? rows.some((row) => row.liftId === me.liftId) : false;
  const showPinnedMe = Boolean(me) && !meInPage;
  const scopeOptions = useMemo(() => {
    const gymTotal = scope === gymService.GYM_SCOPE_GYM ? board?.total : otherScopeTotal;
    const friendsTotal = scope === gymService.GYM_SCOPE_FRIENDS ? board?.total : otherScopeTotal;

    return [
      {
        value: gymService.GYM_SCOPE_GYM,
        label:
          gymTotal !== null && gymTotal !== undefined
            ? t("gyms.scope.centreWithCount", { count: gymTotal })
            : t("gyms.scope.centre"),
      },
      {
        value: gymService.GYM_SCOPE_FRIENDS,
        label:
          friendsTotal !== null && friendsTotal !== undefined
            ? t("gyms.scope.friendsWithCount", { count: friendsTotal })
            : t("gyms.scope.friends"),
      },
    ];
  }, [board?.total, otherScopeTotal, scope, t]);

  // The exercise on screen always has its chip, even one nobody at the
  // centre has lifted yet.
  const centreChips = useMemo(() => {
    const current = board?.exercise;

    return current && gymChips.length > 0 && !gymChips.some((chip) => chip.id === current.id)
      ? [...gymChips, { id: current.id, name: current.name }]
      : gymChips;
  }, [board?.exercise, gymChips]);

  // A centre can rank dozens of exercises, and the one the page was opened
  // on - from the centre's search, say - may be far along the row. When its
  // chip is laid out, the row scrolls it into view; a tap on a chip already
  // in view does not move the row.
  const renderChips = (list) => (
    <ScrollView
      ref={chipRowRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {list.map((chip) => {
        const isActive = chip.id === exerciseId;

        return (
          <TouchableOpacity
            key={chip.id}
            onLayout={
              isActive
                ? (event) =>
                    chipRowRef.current?.scrollTo({
                      x: Math.max(0, event.nativeEvent.layout.x - CHIP_SCROLL_INSET),
                      animated: false,
                    })
                : undefined
            }
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            activeOpacity={0.85}
            onPress={() => setExerciseId(chip.id)}
            style={[
              styles.chip,
              isActive
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { backgroundColor: theme.cardBackground, borderColor: isLight ? "rgba(15, 17, 22, 0.09)" : "rgba(255, 255, 255, 0.09)" },
            ]}
          >
            <ThemedText style={styles.chipText} setColor={isActive ? theme.textInverted : theme.title}>
              {chip.name}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const eyebrow = national ? t("gyms.exercise.nationalEyebrow") : board?.gym?.shortName ?? " ";
  const title = board?.exercise?.name ?? (isLoading ? t("common.loading") : t("gyms.exercise.titleFallback"));

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader
        rightWidth={104}
        right={<ScopeToggle compact options={unitOptions} value={unit} onChange={setUnit} />}
      >
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText size={12} style={[styles.pageHeaderTitleEyebrow, { color: quietText }]} numberOfLines={1}>
            {eyebrow}
          </ThemedText>
          <ThemedTitle type="pageTitle" style={styles.pageHeaderTitleMain} numberOfLines={1}>
            {title}
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <FlatList
        style={styles.content}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        data={listRows}
        keyExtractor={(lift) => String(lift.liftId)}
        renderItem={renderLeaderboardRow}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={[styles.listHeader, listRows.length > 0 ? styles.listHeaderSpaced : null]}>
            {national ? (
              renderChips(chips)
            ) : (
              <>
                {centreChips.length > 1 ? renderChips(centreChips) : null}
                <ScopeToggle options={scopeOptions} value={scope} onChange={setScope} />
              </>
            )}

            {errorMessage ? (
              <ThemedStateBlock
                variant="error"
                title={t("gyms.exercise.unavailableTitle")}
                message={errorMessage}
                actionLabel={t("common.retry")}
                onAction={() => load()}
              />
            ) : isLoading && !board ? (
              <ThemedStateBlock variant="loading" />
            ) : rows.length === 0 ? (
              <View style={[styles.listCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                <View style={styles.emptyRow}>
                  <ThemedText style={styles.emptyTitle} setColor={theme.title}>
                    {t(emptyState.titleKey)}
                  </ThemedText>
                  {emptyState.bodyKey ? (
                    <ThemedText style={styles.emptyBody} setColor={quietText}>
                      {t(emptyState.bodyKey)}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : (
              <Podium
                rows={podiumRows}
                unit={unit}
                theme={theme}
                colorScheme={colorScheme}
                onOpenLifter={openLifter}
              />
            )}
          </View>
        }
        ListFooterComponent={
          <>
            {listRows.length > 0 && hasMoreRow ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={loadMore}
                disabled={isLoadingMore}
                style={[
                  styles.footerRow,
                  styles.listRowCard,
                  styles.listRowCardLast,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                    borderTopColor: theme.hairline,
                  },
                ]}
              >
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={theme.primaryText ?? theme.primary} />
                ) : (
                  <ThemedText style={styles.footerText} setColor={theme.primaryText}>
                    {t("common.loadMore")}
                  </ThemedText>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        }
      />

      {showPinnedMe ? (
        <View
          style={[
            styles.pinnedMe,
            { bottom: insets.bottom + 12, backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          <LeaderboardRow lift={me} unit={unit} showGym={national} />
        </View>
      ) : null}
    </ThemedView>
  );
}
