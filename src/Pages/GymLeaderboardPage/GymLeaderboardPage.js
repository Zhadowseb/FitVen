import { useCallback, useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import styles, { HERO_HEIGHT } from "./GymLeaderboardPageStyle";
import ChangeGymSheet from "./Components/ChangeGymSheet";
import { useAuth } from "../../Contexts/AuthContext";
import { gymService } from "../../Services";
import { Colors, withAlpha } from "../../Resources/GlobalStyling/colors";
import ArrowLeft from "../../Resources/Icons/UI-icons/ArrowLeft";
import ChevronRight from "../../Resources/Icons/UI-icons/ChevronRight";
import MapPin from "../../Resources/Icons/UI-icons/MapPin";
import Play from "../../Resources/Icons/UI-icons/Play";
import CoverGradient from "../../Resources/Components/CoverGradient";
import LiftStatusPill from "../../Resources/Components/GymLeaderboard/LiftStatusPill";
import RadialGlow from "../../Resources/Components/GymLeaderboard/RadialGlow";
import ScopeToggle from "../../Resources/Components/GymLeaderboard/ScopeToggle";
import LiftVerificationSheet from "../../Resources/Components/LiftVerificationSheet/LiftVerificationSheet";
import {
  ThemedStateBlock,
  ThemedText,
  ThemedView,
  UserAvatar,
} from "../../Resources/ThemedComponents";
import { formatWeightKg, getChainInitials } from "../../Utils/gymUtils";

const SCOPE_OPTIONS = [
  { value: gymService.GYM_SCOPE_GYM, label: "Centre" },
  { value: gymService.GYM_SCOPE_FRIENDS, label: "Friends" },
];

function FeaturedCard({ entry, theme, colorScheme, onPress }) {
  const top = entry.top;
  const me = entry.me;
  const quietText = theme.quietText;
  const isLight = colorScheme === "light";
  const mutedStrong = isLight ? "#3F4550" : "#C4C7CF";
  const isVerified = top?.videoStatus === "verified";
  const glowColor = isVerified ? theme.record : theme.primary;
  const ringColor = isVerified ? theme.record : isLight ? "#C9CDD5" : "#33383F";
  const progress =
    me && top && top.weightKg > 0 ? Math.max(0.04, Math.min(1, me.weightKg / top.weightKg)) : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${entry.exerciseName} leaderboard`}
      onPress={onPress}
      style={[styles.featuredCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
    >
      <RadialGlow color={glowColor} />

      <View style={styles.featuredHeader}>
        <View style={styles.featuredHeaderCopy}>
          <ThemedText style={styles.featuredExercise} setColor={theme.title} numberOfLines={1}>
            {entry.exerciseName}
          </ThemedText>
          <ThemedText style={styles.featuredCount} setColor={quietText}>
            {`${entry.lifterCount} ${entry.lifterCount === 1 ? "person has" : "people have"} a record here`}
          </ThemedText>
        </View>
        <ChevronRight width={18} height={18} color={isLight ? "#A8ACB6" : "#4A4F5A"} />
      </View>

      {top ? (
        <View style={styles.topRow}>
          <View style={[styles.topAvatarRing, { borderColor: ringColor }]}>
            <UserAvatar uri={top.avatarUrl} size={40} iconSize={18} />
          </View>
          <View style={styles.topCopy}>
            <ThemedText style={styles.topName} setColor={theme.title} numberOfLines={1}>
              {top.isMe ? "You" : top.displayName}
            </ThemedText>
            <View style={styles.topMetaRow}>
              <ThemedText style={styles.topRank} setColor={quietText}>
                #1
              </ThemedText>
              <LiftStatusPill status={top.videoStatus} approvals={top.approvals} />
            </View>
          </View>
          <View style={styles.topWeightGroup}>
            <ThemedText style={styles.topWeight} setColor={isVerified ? theme.record : theme.title}>
              {formatWeightKg(top.weightKg)}
            </ThemedText>
            <ThemedText style={styles.topUnit} setColor={quietText}>
              kg
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.emptyTop}>
          <ThemedText style={styles.emptyTopText} setColor={quietText}>
            Nobody has a record here yet. Finish a workout with this exercise inside the centre and yours is first.
          </ThemedText>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

      <View style={styles.meRow}>
        {me ? (
          <>
            <View style={styles.meLine}>
              <ThemedText style={styles.meLabel} setColor={theme.primary}>
                You
              </ThemedText>
              <ThemedText style={styles.meRank} setColor={mutedStrong}>
                {me.rank ? `· #${me.rank} of ${entry.lifterCount}` : "· not ranked"}
              </ThemedText>
              <View style={styles.meSpacer} />
              <ThemedText style={styles.meWeight} setColor={theme.title}>
                {`${formatWeightKg(me.weightKg)} kg`}
              </ThemedText>
              {me.gapToTop !== null && me.gapToTop !== undefined && me.gapToTop > 0 ? (
                <ThemedText style={styles.meGap} setColor={quietText}>
                  {`${formatWeightKg(me.gapToTop)} to #1`}
                </ThemedText>
              ) : null}
            </View>
            <View style={[styles.meBarTrack, { backgroundColor: withAlpha(theme.title, 0.055) }]}>
              <View
                style={[
                  styles.meBarFill,
                  { width: `${progress * 100}%`, backgroundColor: withAlpha(theme.primary, 0.83) },
                ]}
              />
            </View>
          </>
        ) : (
          <View style={styles.meLine}>
            <ThemedText style={styles.meLabel} setColor={quietText}>
              You · not on the list
            </ThemedText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Screen 1a: one centre. Hero, Centre / Friends toggle, the big three with
 * the top lifter and the viewer's own standing, then every other exercise.
 */
export default function GymLeaderboardPage() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const gymId = Number(route.params?.gym_id ?? route.params?.gymId);
  const [scope, setScope] = useState(route.params?.scope ?? gymService.GYM_SCOPE_GYM);
  const [overview, setOverview] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAllMore, setShowAllMore] = useState(false);
  const [isChangeSheetOpen, setIsChangeSheetOpen] = useState(false);
  const [reviewLiftId, setReviewLiftId] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(
    Boolean(route.params?.open_verification)
  );
  const quietText = theme.quietText ?? theme.text;
  const isLight = colorScheme === "light";
  const mutedStrong = isLight ? "#3F4550" : "#C4C7CF";
  const scrimColor = isLight ? "rgba(8, 9, 12, 0.65)" : "rgba(8, 9, 12, 0.55)";

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!Number.isFinite(gymId)) {
        setErrorMessage("That centre could not be found.");
        setIsLoading(false);
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }

      setErrorMessage("");

      try {
        const [overviewResult, queueResult] = await Promise.allSettled([
          gymService.getGymOverview({ gymId, scope, moreLimit: showAllMore ? null : 8 }),
          gymService.getVerificationQueue({ gymId }),
        ]);

        if (overviewResult.status === "rejected") {
          throw overviewResult.reason;
        }

        if (!overviewResult.value) {
          throw new Error("That centre could not be found.");
        }

        setOverview(overviewResult.value);
        setQueue(queueResult.status === "fulfilled" ? queueResult.value : []);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not load the centre.");
      } finally {
        setIsLoading(false);
      }
    },
    [gymId, scope, showAllMore]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (route.params?.lift_id) {
      setReviewLiftId(Number(route.params.lift_id));
    }
  }, [route.params?.lift_id]);

  const gym = overview?.gym ?? null;
  const memberLine = gym
    ? [
        `${gym.memberCount} ${gym.memberCount === 1 ? "person trains" : "people train"} here`,
        gym.followedMemberCount > 0 ? `you follow ${gym.followedMemberCount} of them` : null,
      ].filter(Boolean)
    : [];

  const openExercise = (exerciseId) => {
    navigation.navigate("GymExerciseLeaderboardPage", { gym_id: gymId, exercise_id: exerciseId, scope });
  };

  return (
    <ThemedView safe={["left", "right"]} style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: theme.cardBackground }]}>
          {gym?.imageUrl ? (
            <Image source={{ uri: gym.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroFallback}>
              <ThemedText style={styles.heroFallbackText} setColor={quietText}>
                {getChainInitials(gym?.chain)}
              </ThemedText>
            </View>
          )}
          <CoverGradient
            color="#08090C"
            style={{ height: 90, bottom: undefined }}
            stops={[
              { offset: "0%", opacity: isLight ? 0.65 : 0.55 },
              { offset: "100%", opacity: 0 },
            ]}
          />
          <CoverGradient
            color={theme.background}
            style={{ top: HERO_HEIGHT - 150 }}
            stops={[
              { offset: "0%", opacity: 0 },
              { offset: "45%", opacity: isLight ? 0.82 : 0.72 },
              { offset: "100%", opacity: 1 },
            ]}
          />

          <View style={[styles.heroTopBar, { top: insets.top + 8 }]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              style={[styles.heroButton, { backgroundColor: scrimColor }]}
            >
              <ArrowLeft width={22} height={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Change centre"
              onPress={() => setIsChangeSheetOpen(true)}
              style={[styles.heroPill, { backgroundColor: scrimColor }]}
            >
              <MapPin width={12} height={12} color={theme.primary} thickness={2.4} />
              <ThemedText style={styles.heroPillText} setColor="#FFFFFF">
                {gym?.isHomeGym ? "Your centre" : "Change centre"}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCopy}>
            <ThemedText style={styles.heroEyebrow} setColor={theme.primary}>
              {gym?.chain ?? " "}
            </ThemedText>
            <ThemedText style={styles.heroTitle} setColor={isLight ? "#FFFFFF" : theme.title} numberOfLines={2}>
              {gym?.name ?? (isLoading ? "Loading…" : "Centre")}
            </ThemedText>
            {memberLine.length ? (
              <View style={styles.heroMetaRow}>
                {memberLine.map((part, index) => (
                  <View key={part} style={styles.heroMetaRow}>
                    {index > 0 ? <View style={[styles.heroMetaDot, { backgroundColor: "#6E7480" }]} /> : null}
                    <ThemedText style={styles.heroMeta} setColor={isLight ? "#E9EBF0" : "#C4C7CF"}>
                      {part}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {errorMessage ? (
          <ThemedStateBlock
            variant="error"
            style={styles.stateBlock}
            title="Centre unavailable"
            message={errorMessage}
            actionLabel="Try again"
            onAction={() => load()}
          />
        ) : isLoading && !overview ? (
          <ThemedStateBlock variant="loading" style={styles.stateBlock} />
        ) : (
          <View style={styles.body}>
            <ScopeToggle options={SCOPE_OPTIONS} value={scope} onChange={setScope} />

            {queue.length > 0 ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                onPress={() => {
                  setReviewLiftId(null);
                  setIsReviewOpen(true);
                }}
                style={[
                  styles.reviewRow,
                  { backgroundColor: theme.cardBackground, borderColor: withAlpha(theme.planned, 0.4) },
                ]}
              >
                <View style={[styles.reviewIcon, { backgroundColor: withAlpha(theme.planned, 0.16) }]}>
                  <Play width={14} height={14} color={theme.planned} />
                </View>
                <View style={styles.reviewCopy}>
                  <ThemedText style={styles.reviewTitle} setColor={theme.title}>
                    {`${queue.length} ${queue.length === 1 ? "lift is" : "lifts are"} waiting for a verdict`}
                  </ThemedText>
                  <ThemedText style={styles.reviewBody} setColor={quietText}>
                    Watch the video and approve or reject it.
                  </ThemedText>
                </View>
                <ChevronRight width={18} height={18} color={isLight ? "#A8ACB6" : "#4A4F5A"} />
              </TouchableOpacity>
            ) : null}

            {(overview?.featured ?? []).map((entry) => (
              <FeaturedCard
                key={entry.exerciseId}
                entry={entry}
                theme={theme}
                colorScheme={colorScheme}
                onPress={() => openExercise(entry.exerciseId)}
              />
            ))}

            {overview?.moreTotal > 0 ? (
              <>
                <View style={styles.sectionLabelRow}>
                  <ThemedText style={styles.sectionLabel} setColor={quietText}>
                    More exercises
                  </ThemedText>
                  <ThemedText style={styles.sectionHint} setColor="#6E7480">
                    #1 at the centre · your place
                  </ThemedText>
                </View>
                <View style={[styles.listCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
                  {overview.more.map((entry, index) => (
                    <View key={entry.exerciseId}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        onPress={() => openExercise(entry.exerciseId)}
                        style={styles.moreRow}
                      >
                        <View style={styles.moreCopy}>
                          <ThemedText style={styles.moreExercise} setColor={theme.title} numberOfLines={1}>
                            {entry.exerciseName}
                          </ThemedText>
                          <ThemedText style={styles.moreTop} setColor={quietText} numberOfLines={1}>
                            {entry.topName ? `${entry.topName} · ${formatWeightKg(entry.topWeightKg)} kg` : "No lifts yet"}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.moreRank} setColor={entry.myRank ? mutedStrong : "#6E7480"}>
                          {entry.myRank ? `#${entry.myRank}` : "—"}
                        </ThemedText>
                        <ChevronRight width={18} height={18} color={isLight ? "#A8ACB6" : "#4A4F5A"} />
                      </TouchableOpacity>
                      {index < overview.more.length - 1 ? (
                        <View style={[styles.rowDivider, { backgroundColor: theme.hairline }]} />
                      ) : null}
                    </View>
                  ))}
                  {overview.moreTotal > overview.more.length || showAllMore ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      activeOpacity={0.8}
                      onPress={() => setShowAllMore((value) => !value)}
                      style={[styles.footerRow, { borderTopColor: theme.hairline }]}
                    >
                      <ThemedText style={styles.footerText} setColor={theme.primary}>
                        {showAllMore ? "Show fewer" : `Show all ${overview.moreTotal} exercises`}
                      </ThemedText>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        )}
      </ScrollView>

      <ChangeGymSheet
        visible={isChangeSheetOpen}
        onClose={() => setIsChangeSheetOpen(false)}
        currentHomeGymId={gym?.isHomeGym ? gym.id : null}
        isAutomatic={false}
        onChanged={(nextGymId) => {
          if (nextGymId && nextGymId !== gymId) {
            navigation.setParams({ gym_id: nextGymId });
          } else {
            load({ silent: true });
          }
        }}
      />

      <LiftVerificationSheet
        visible={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        gymId={gymId}
        initialLiftId={reviewLiftId}
        onVoted={() => load({ silent: true })}
      />
    </ThemedView>
  );
}
