import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import styles from "./GymExerciseLeaderboardPageStyle";
import { useAuth } from "../../Contexts/AuthContext";
import { gymService } from "../../Services";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import CameraPlus from "../../Resources/Icons/UI-icons/CameraPlus";
import LeaderboardRow from "../../Resources/Components/GymLeaderboard/LeaderboardRow";
import LiftStatusPill from "../../Resources/Components/GymLeaderboard/LiftStatusPill";
import RadialGlow from "../../Resources/Components/GymLeaderboard/RadialGlow";
import ScopeToggle from "../../Resources/Components/GymLeaderboard/ScopeToggle";
import LiftVerificationSheet from "../../Resources/Components/LiftVerificationSheet/LiftVerificationSheet";
import {
  ThemedBottomSheet,
  ThemedConfirmModal,
  ThemedHeader,
  ThemedStateBlock,
  ThemedText,
  ThemedTitle,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";
import { formatWeightKg, shortenDisplayName } from "../../Utils/gymUtils";

const UNIT_OPTIONS = [
  { value: gymService.LIFT_UNIT_KG, label: "kg" },
  { value: gymService.LIFT_UNIT_BODYWEIGHT, label: "×BW" },
];
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_AVATAR = [58, 48, 48];
const PODIUM_PLINTH = [64, 44, 30];
const PAGE_SIZE = 50;

function formatValue(lift, unit) {
  if (unit === gymService.LIFT_UNIT_BODYWEIGHT) {
    return lift?.ratio !== null && lift?.ratio !== undefined ? Number(lift.ratio).toFixed(2) : "—";
  }

  return formatWeightKg(lift?.weightKg);
}

function Podium({ rows, unit, theme, colorScheme }) {
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

          return (
            <View key={lift.liftId} style={styles.podiumColumn}>
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
                {lift.isMe ? "You" : shortenDisplayName(lift.displayName)}
              </ThemedText>
              <View style={styles.podiumWeightGroup}>
                <ThemedText
                  style={[styles.podiumWeight, isFirst ? styles.podiumWeightFirst : null]}
                  setColor={isFirst && lift.videoStatus === "verified" ? theme.record : theme.title}
                >
                  {formatValue(lift, unit)}
                </ThemedText>
                <ThemedText style={styles.podiumUnit} setColor={theme.quietText}>
                  {unit === gymService.LIFT_UNIT_BODYWEIGHT ? "×" : "kg"}
                </ThemedText>
              </View>
              {lift.videoStatus === "none" ? (
                <ThemedText style={styles.podiumNoVideo} setColor={theme.quietText}>
                  No video
                </ThemedText>
              ) : (
                <LiftStatusPill status={lift.videoStatus} approvals={lift.approvals} compact />
              )}
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
 * the loaded page. With `national` (route 2b) there is no centre, only
 * verified lifts count, and exercise chips switch between the big three.
 */
export default function GymExerciseLeaderboardPage({ national: nationalProp = false }) {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const national = nationalProp || Boolean(route.params?.national);
  const gymId = national ? null : Number(route.params?.gym_id ?? route.params?.gymId);
  const [exerciseId, setExerciseId] = useState(Number(route.params?.exercise_id ?? route.params?.exerciseId) || null);
  const [scope, setScope] = useState(route.params?.scope ?? gymService.GYM_SCOPE_GYM);
  const [unit, setUnit] = useState(gymService.LIFT_UNIT_KG);
  const [board, setBoard] = useState(null);
  const [otherScopeTotal, setOtherScopeTotal] = useState(null);
  const [chips, setChips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewLiftId, setReviewLiftId] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [ownPendingLift, setOwnPendingLift] = useState(null);
  const [isAttachSheetOpen, setIsAttachSheetOpen] = useState(false);
  const [pendingAsset, setPendingAsset] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const quietText = theme.quietText ?? theme.text;
  const isLight = colorScheme === "light";

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
            setErrorMessage(error instanceof Error ? error.message : "Could not load the ranking.");
          }
        }

        setErrorMessage("Pick an exercise.");
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
        setErrorMessage(error instanceof Error ? error.message : "Could not load the ranking.");
      } finally {
        setIsLoading(false);
      }
    },
    [chips.length, exerciseId, gymId, national, scope, unit]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    setNotice("");
  }, [exerciseId, scope, unit]);

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
      setErrorMessage(error instanceof Error ? error.message : "Could not load more.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const rows = board?.rows ?? [];
  const me = board?.me ?? null;
  const podiumRows = rows.slice(0, 3);
  const listRows = rows.slice(3);
  const meInPage = me ? rows.some((row) => row.liftId === me.liftId) : false;
  const showPinnedMe = Boolean(me) && !meInPage;
  const scopeOptions = useMemo(() => {
    const gymTotal = scope === gymService.GYM_SCOPE_GYM ? board?.total : otherScopeTotal;
    const friendsTotal = scope === gymService.GYM_SCOPE_FRIENDS ? board?.total : otherScopeTotal;

    return [
      {
        value: gymService.GYM_SCOPE_GYM,
        label: gymTotal !== null && gymTotal !== undefined ? `Centre · ${gymTotal}` : "Centre",
      },
      {
        value: gymService.GYM_SCOPE_FRIENDS,
        label: friendsTotal !== null && friendsTotal !== undefined ? `Friends · ${friendsTotal}` : "Friends",
      },
    ];
  }, [board?.total, otherScopeTotal, scope]);

  const openReview = (lift) => {
    if (lift.isMe) {
      setOwnPendingLift(lift);
    } else {
      setOwnPendingLift(null);
      setReviewLiftId(lift.liftId);
    }

    setIsReviewOpen(true);
  };

  const pickVideo = async (fromCamera) => {
    setIsAttachSheetOpen(false);
    setNotice("");

    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setNotice(fromCamera ? "Camera access is needed to record a video." : "Photo library access is needed to pick a video.");
        return;
      }

      const options = {
        mediaTypes: ["videos"],
        videoMaxDuration: gymService.LIFT_VIDEO_MAX_DURATION_SECONDS,
        allowsEditing: false,
        quality: 0.8,
        ...(Platform.OS === "ios"
          ? { videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720 }
          : {}),
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      setPendingAsset(result.assets[0]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open the video picker.");
    }
  };

  const uploadPendingVideo = async () => {
    if (!pendingAsset || !me || !user?.id) {
      return;
    }

    setIsUploading(true);
    setNotice("");

    try {
      const { notified } = await gymService.attachLiftVideo({ userId: user.id, liftId: me.liftId, asset: pendingAsset });

      setPendingAsset(null);
      setNotice(
        notified > 0
          ? `Video attached. ${notified} ${notified === 1 ? "member has" : "members have"} been asked to verify it.`
          : "Video attached. Members of the centre can now verify it."
      );
      await load({ silent: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not attach the video.");
    } finally {
      setIsUploading(false);
    }
  };

  const eyebrow = national ? "All centres · Denmark" : board?.gym?.shortName ?? " ";
  const title = board?.exercise?.name ?? (isLoading ? "Loading…" : "Exercise");
  const pendingSeconds = pendingAsset?.duration ? Math.round(pendingAsset.duration / 1000) : null;

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader
        rightWidth={104}
        right={<ScopeToggle compact options={UNIT_OPTIONS} value={unit} onChange={setUnit} />}
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

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;

          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
            loadMore();
          }
        }}
      >
        {national ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {chips.map((chip) => {
                const isActive = chip.id === exerciseId;

                return (
                  <TouchableOpacity
                    key={chip.id}
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
            <View style={styles.infoRow}>
              <LiftStatusPill status="verified" approvals={3} compact />
              <ThemedText style={styles.infoText} setColor={quietText}>
                Across centres a lift needs an approved video to count.
              </ThemedText>
            </View>
          </>
        ) : (
          <ScopeToggle options={scopeOptions} value={scope} onChange={setScope} />
        )}

        {errorMessage ? (
          <ThemedStateBlock
            variant="error"
            title="Ranking unavailable"
            message={errorMessage}
            actionLabel="Try again"
            onAction={() => load()}
          />
        ) : isLoading && !board ? (
          <ThemedStateBlock variant="loading" />
        ) : rows.length === 0 ? (
          <View style={[styles.listCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
            <View style={styles.emptyRow}>
              <ThemedText style={styles.emptyTitle} setColor={theme.title}>
                {unit === gymService.LIFT_UNIT_BODYWEIGHT
                  ? "No bodyweight on record"
                  : scope === gymService.GYM_SCOPE_FRIENDS && !national
                    ? "None of your friends lift here yet"
                    : national
                      ? "No verified lifts yet"
                      : "No lifts yet"}
              </ThemedText>
              <ThemedText style={styles.emptyBody} setColor={quietText}>
                {unit === gymService.LIFT_UNIT_BODYWEIGHT
                  ? "Ranking by bodyweight needs a bodyweight on the lift, which nobody here has recorded."
                  : national
                    ? "Attach a video to a lift and have three members of your centre approve it."
                    : "Finish a workout with this exercise inside the centre and the first lift is yours."}
              </ThemedText>
            </View>
          </View>
        ) : (
          <>
            <Podium rows={podiumRows} unit={unit} theme={theme} colorScheme={colorScheme} />

            {listRows.length > 0 || isLoadingMore ? (
              <View style={[styles.listCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                {listRows.map((lift, index) => (
                  <View key={lift.liftId}>
                    <LeaderboardRow
                      lift={lift}
                      unit={unit}
                      showGym={national}
                      onPressReview={openReview}
                      onPressAttach={() => setIsAttachSheetOpen(true)}
                    />
                    {index < listRows.length - 1 ? (
                      <View style={[styles.rowDivider, { backgroundColor: theme.hairline }]} />
                    ) : null}
                  </View>
                ))}
                {board?.nextCursor ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.8}
                    onPress={loadMore}
                    disabled={isLoadingMore}
                    style={[styles.footerRow, { borderTopColor: theme.hairline }]}
                  >
                    {isLoadingMore ? (
                      <ActivityIndicator size="small" color={theme.primaryText ?? theme.primary} />
                    ) : (
                      <ThemedText style={styles.footerText} setColor={theme.primary}>
                        Load more
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        {notice ? (
          <ThemedText style={styles.footnote} setColor={theme.title}>
            {notice}
          </ThemedText>
        ) : null}

        <ThemedText style={styles.footnote} setColor={quietText}>
          Video verified: three members of the centre approved the video. Video pending: a video is attached and
          waiting for votes. No video: the lift counts at the centre but not across Denmark.
        </ThemedText>
      </ScrollView>

      {showPinnedMe ? (
        <View
          style={[
            styles.pinnedMe,
            { bottom: insets.bottom + 12, backgroundColor: theme.cardBackground, borderColor: theme.cardBorder },
          ]}
        >
          {national && me.videoStatus !== "verified" ? (
            <View style={styles.pinnedNote}>
              <View style={styles.pinnedNoteCopy}>
                <ThemedText style={styles.pinnedNoteTitle} setColor={theme.title}>
                  {me.videoStatus === "pending" ? "Not ranked · your video is waiting for votes" : "Not ranked · your lift needs a video"}
                </ThemedText>
                <ThemedText style={styles.pinnedNoteBody} setColor={quietText}>
                  {`${formatWeightKg(me.weightKg)} kg at ${me.gym?.shortName ?? "your centre"}`}
                </ThemedText>
              </View>
              {me.videoStatus === "none" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Attach a video to your lift"
                  onPress={() => setIsAttachSheetOpen(true)}
                  style={[styles.attachButton, { backgroundColor: theme.primary }]}
                >
                  <CameraPlus width={18} height={18} color={theme.textInverted} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <LeaderboardRow
              lift={me}
              unit={unit}
              showGym={national}
              onPressReview={openReview}
              onPressAttach={() => setIsAttachSheetOpen(true)}
            />
          )}
        </View>
      ) : null}

      <ThemedBottomSheet visible={isAttachSheetOpen} onClose={() => setIsAttachSheetOpen(false)}>
        <View style={styles.sheetHeader}>
          <ThemedText style={styles.sheetTitle} setColor={theme.title}>
            Attach a video
          </ThemedText>
          <ThemedText style={styles.sheetBody} setColor={quietText}>
            {`Up to ${gymService.LIFT_VIDEO_MAX_DURATION_SECONDS} seconds. Members of the centre watch it and vote; three approvals verify the lift.`}
          </ThemedText>
        </View>
        {[
          { key: "camera", title: "Record now", body: "Open the camera.", fromCamera: true },
          { key: "library", title: "Choose from library", body: "A video you already have.", fromCamera: false },
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => pickVideo(option.fromCamera)}
            style={[styles.sheetOption, { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder }]}
          >
            <View style={styles.sheetOptionCopy}>
              <ThemedText style={styles.sheetOptionTitle} setColor={theme.title}>
                {option.title}
              </ThemedText>
              <ThemedText style={styles.sheetOptionBody} setColor={quietText}>
                {option.body}
              </ThemedText>
            </View>
            <CameraPlus width={20} height={20} color={theme.primaryText ?? theme.primary} />
          </TouchableOpacity>
        ))}
      </ThemedBottomSheet>

      <ThemedConfirmModal
        visible={Boolean(pendingAsset)}
        title="Use this video?"
        message={
          pendingSeconds !== null
            ? `${pendingSeconds} ${pendingSeconds === 1 ? "second" : "seconds"}. It replaces any video already on this lift and resets its votes.`
            : "It replaces any video already on this lift and resets its votes."
        }
        confirmLabel="Use"
        cancelLabel="Cancel"
        isWorking={isUploading}
        onConfirm={uploadPendingVideo}
        onClose={() => (isUploading ? null : setPendingAsset(null))}
      />

      <LiftVerificationSheet
        visible={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        gymId={gymId ?? me?.gym?.id ?? null}
        initialLiftId={reviewLiftId}
        ownLift={ownPendingLift}
        onVoted={() => load({ silent: true })}
      />
    </ThemedView>
  );
}
