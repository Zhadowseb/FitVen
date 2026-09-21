import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "@localization";

import styles from "./GymExerciseLeaderboardPageStyle";
import { useAuth } from "@contexts/AuthContext";
import { gymService } from "@services";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import CameraPlus from "@resources/Icons/UI-icons/CameraPlus";
import LeaderboardRow from "@resources/Components/GymLeaderboard/LeaderboardRow";
import LiftStatusPill from "@resources/Components/GymLeaderboard/LiftStatusPill";
import RadialGlow from "@resources/Components/GymLeaderboard/RadialGlow";
import ScopeToggle from "@resources/Components/GymLeaderboard/ScopeToggle";
import LiftVerificationSheet from "@resources/Components/LiftVerificationSheet/LiftVerificationSheet";
import {
  ThemedBottomSheet,
  ThemedConfirmModal,
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

function formatValue(lift, unit) {
  if (unit === gymService.LIFT_UNIT_BODYWEIGHT) {
    return lift?.ratio !== null && lift?.ratio !== undefined ? Number(lift.ratio).toFixed(2) : "—";
  }

  return formatWeightKg(lift?.weightKg);
}

function Podium({ rows, unit, theme, colorScheme }) {
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
                {lift.isMe ? t("common.you") : shortenDisplayName(lift.displayName)}
              </ThemedText>
              <View style={styles.podiumWeightGroup}>
                <ThemedText
                  style={[styles.podiumWeight, isFirst ? styles.podiumWeightFirst : null]}
                  setColor={isFirst && lift.videoStatus === "verified" ? theme.record : theme.title}
                >
                  {formatValue(lift, unit)}
                </ThemedText>
                <ThemedText style={styles.podiumUnit} setColor={theme.quietText}>
                  {unit === gymService.LIFT_UNIT_BODYWEIGHT ? "×" : t("common.kg")}
                </ThemedText>
              </View>
              {lift.videoStatus === "none" ? (
                <ThemedText style={styles.podiumNoVideo} setColor={theme.quietText}>
                  {t("gyms.status.noVideo")}
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
  const { t } = useTranslation();
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
  // Separate from the page's notice: the modal stays open when the upload
  // fails, and the notice is drawn behind its overlay.
  const [uploadError, setUploadError] = useState("");
  const [notice, setNotice] = useState("");
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

    if (national) {
      return {
        titleKey: "gyms.exercise.empty.noVerifiedTitle",
        bodyKey: "gyms.exercise.empty.noVerifiedBody",
      };
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

  const listRows = rows.slice(3);
  const hasMoreRow = Boolean(board?.nextCursor);

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
            onPressReview={openReview}
            onPressAttach={() => setIsAttachSheetOpen(true)}
          />
          {!isLast ? (
            <View style={[styles.rowDivider, { backgroundColor: theme.hairline }]} />
          ) : null}
        </View>
      );
    },
    [hasMoreRow, listRows.length, national, openReview, theme, unit]
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
        setNotice(fromCamera ? t("gyms.video.cameraPermission") : t("gyms.video.libraryPermission"));
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

      setUploadError("");
      setPendingAsset(result.assets[0]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("gyms.video.pickerFailed"));
    }
  };

  const uploadPendingVideo = async () => {
    if (!pendingAsset || !me || !user?.id) {
      return;
    }

    setIsUploading(true);
    setNotice("");
    setUploadError("");

    try {
      const { notified } = await gymService.attachLiftVideo({ userId: user.id, liftId: me.liftId, asset: pendingAsset });

      setPendingAsset(null);
      setNotice(
        notified > 0
          ? t("gyms.video.attachedNotified", { count: notified })
          : t("gyms.video.attached")
      );
      await load({ silent: true });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : t("gyms.video.attachFailed")
      );
    } finally {
      setIsUploading(false);
    }
  };

  const eyebrow = national ? t("gyms.exercise.nationalEyebrow") : board?.gym?.shortName ?? " ";
  const title = board?.exercise?.name ?? (isLoading ? t("common.loading") : t("gyms.exercise.titleFallback"));
  const pendingSeconds = pendingAsset?.duration ? Math.round(pendingAsset.duration / 1000) : null;

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
                    {t("gyms.exercise.nationalNote")}
                  </ThemedText>
                </View>
              </>
            ) : (
              <ScopeToggle options={scopeOptions} value={scope} onChange={setScope} />
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
                  <ThemedText style={styles.emptyBody} setColor={quietText}>
                    {t(emptyState.bodyKey)}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <Podium rows={podiumRows} unit={unit} theme={theme} colorScheme={colorScheme} />
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

            <View style={styles.listFootnotes}>
              {notice ? (
                <ThemedText style={styles.footnote} setColor={theme.title}>
                  {notice}
                </ThemedText>
              ) : null}

              <ThemedText style={styles.footnote} setColor={quietText}>
                {t("gyms.exercise.legend")}
              </ThemedText>
            </View>
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
          {national && me.videoStatus !== "verified" ? (
            <View style={styles.pinnedNote}>
              <View style={styles.pinnedNoteCopy}>
                <ThemedText style={styles.pinnedNoteTitle} setColor={theme.title}>
                  {me.videoStatus === "pending"
                    ? t("gyms.exercise.pinned.pendingTitle")
                    : t("gyms.exercise.pinned.noVideoTitle")}
                </ThemedText>
                <ThemedText style={styles.pinnedNoteBody} setColor={quietText}>
                  {t("gyms.exercise.pinned.body", {
                    weight: formatWeightKg(me.weightKg),
                    gym: me.gym?.shortName ?? t("gyms.yourCentre"),
                  })}
                </ThemedText>
              </View>
              {me.videoStatus === "none" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t("gyms.video.attachA11y")}
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
            {t("gyms.video.attachTitle")}
          </ThemedText>
          <ThemedText style={styles.sheetBody} setColor={quietText}>
            {t("gyms.video.attachBody", { seconds: gymService.LIFT_VIDEO_MAX_DURATION_SECONDS })}
          </ThemedText>
        </View>
        {[
          {
            key: "camera",
            title: t("gyms.video.recordNow"),
            body: t("gyms.video.recordNowBody"),
            fromCamera: true,
          },
          {
            key: "library",
            title: t("gyms.video.chooseLibrary"),
            body: t("gyms.video.chooseLibraryBody"),
            fromCamera: false,
          },
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
        title={t("gyms.video.confirmTitle")}
        message={
          uploadError
            ? uploadError
            : pendingSeconds !== null
              ? t("gyms.video.confirmBodyWithDuration", { count: pendingSeconds })
              : t("gyms.video.confirmBody")
        }
        confirmLabel={t("gyms.video.use")}
        cancelLabel={t("common.cancel")}
        isWorking={isUploading}
        onConfirm={uploadPendingVideo}
        onClose={() => {
          if (isUploading) {
            return;
          }

          setUploadError("");
          setPendingAsset(null);
        }}
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
