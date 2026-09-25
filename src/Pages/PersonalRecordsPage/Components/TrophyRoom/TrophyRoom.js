import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { formatDate, formatNumber, useTranslation } from "@localization";

import styles from "./TrophyRoomStyle";
import Trophy from "./Trophy";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import Checkmark from "@resources/Icons/UI-icons/Checkmark";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import Dumbbell from "@resources/Icons/UI-icons/Dumbbell";
import Fire from "@resources/Icons/UI-icons/Fire";
import Layers from "@resources/Icons/UI-icons/Layers";
import Star from "@resources/Icons/UI-icons/Star";
import UpwardGraf from "@resources/Icons/UI-icons/UpwardGraf";
import RecordStar from "@resources/Components/RecordStar/RecordStar";
import { ThemedText } from "@resources/ThemedComponents";
import { formatRelativeDay } from "@utils/dateUtils";

const COUNT_UP_MS = 900;
const REVEAL_STEP_MS = 90;

function formatKg(value) {
  return formatNumber(Math.round(value * 2) / 2, { maximumFractionDigits: 1 });
}

// The big number counts up to itself the first time the room opens - once
// per screen, not on every return to it - and simply is the number with
// reduce motion on.
function useCountUp(target, enabled) {
  const [shown, setShown] = useState(enabled ? 0 : target);
  const doneRef = useRef(!enabled);

  useEffect(() => {
    if (doneRef.current || !enabled) {
      doneRef.current = true;
      setShown(target);
      return undefined;
    }

    let frame = null;
    const startedAt = Date.now();
    const step = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - progress, 3);

      setShown(Math.round(target * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        doneRef.current = true;
      }
    };

    frame = requestAnimationFrame(step);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      doneRef.current = true;
      setShown(target);
    };
  }, [enabled, target]);

  return shown;
}

// Each section rises into place a moment after the one above it, once, when
// the room opens. Nothing moves with reduce motion on.
function Reveal({ index, still, children }) {
  const progress = useRef(new Animated.Value(still ? 1 : 0)).current;

  useEffect(() => {
    if (still) {
      progress.setValue(1);
      return undefined;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay: index * REVEAL_STEP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
    // Once: a later change of `still` does not replay the entrance.
  }, []);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const MILESTONE_ICONS = {
  workouts: (color) => <Dumbbell width={17} height={17} color={color} thickness={1.7} />,
  tonnes: (color) => <Layers width={17} height={17} color={color} />,
  records: (color) => <Star width={17} height={17} color={color} filled />,
  weekStreak: (color) => <Fire width={17} height={17} color={color} />,
};

/**
 * The trophy room: the records and what they add up to, over the whole
 * history. A trophy and the record count at the top, the strongest lifts on
 * a podium with the next round weight to go for, the newest records on a
 * shelf with a star each, the milestones, and a way through to the numbers.
 */
export default function TrophyRoom({ room, now, animate, reduceMotion, onOpenExercise, onOpenStatistics }) {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const gold = theme.record;
  const title = theme.title;
  const quiet = theme.quietText;
  const card = theme.cardBackground;
  const border = theme.border;
  const hairline = theme.hairline;
  const medals = [gold, theme.medalSilver, theme.medalBronze];
  const { hero, podium, recent, milestones } = room;
  const shownCount = useCountUp(hero?.recordCount ?? 0, !reduceMotion);
  let section = 0;

  const sectionHead = (label) => (
    <View style={styles.sectionHead}>
      <ThemedText style={styles.overline} setColor={quiet}>
        {label}
      </ThemedText>
      <View style={[styles.sectionRule, { backgroundColor: hairline }]} />
    </View>
  );

  const milestoneLabel = (key, rung) =>
    t(`records.trophy.milestones.${key}`, { count: rung, value: formatNumber(rung) });

  return (
    <View style={styles.screen}>
      {/* The trophy and the number. */}
      <Reveal index={section++} still={reduceMotion}>
        <View
          style={[
            styles.hero,
            hero
              ? { backgroundColor: theme.recordSurface, borderColor: withAlpha(gold, 0.35) }
              : { backgroundColor: card, borderColor: border },
          ]}
        >
          <Trophy size={116} animate={animate} dimmed={!hero} />

          {hero ? (
            <>
              <View
                accessible
                accessibilityLabel={`${formatNumber(hero.recordCount)} ${t("records.trophy.recordCount", { count: hero.recordCount })}`}
                style={styles.heroCount}
              >
                <ThemedText style={styles.heroNumber} setColor={gold}>
                  {formatNumber(shownCount)}
                </ThemedText>
                <ThemedText style={styles.heroLabel} setColor={title}>
                  {t("records.trophy.recordCount", { count: hero.recordCount })}
                </ThemedText>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => onOpenExercise?.(hero.heaviest.name)}
                style={[styles.heroLift, { borderTopColor: withAlpha(gold, 0.28) }]}
              >
                <ThemedText style={styles.overline} setColor={quiet}>
                  {t("records.trophy.heaviest")}
                </ThemedText>
                <ThemedText style={styles.heroLiftValue} setColor={title} numberOfLines={1}>
                  {t("records.trophy.heaviestValue", {
                    weight: formatKg(hero.heaviest.weight),
                    reps: hero.heaviest.reps,
                    name: hero.heaviest.name,
                  })}
                </ThemedText>
                <ThemedText style={styles.caption} setColor={quiet}>
                  {t("records.trophy.since", {
                    date: formatDate(hero.since, { month: "long", year: "numeric" }),
                  })}
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.heroCount}>
              <ThemedText style={styles.emptyTitle} setColor={title}>
                {t("records.trophy.emptyTitle")}
              </ThemedText>
              <ThemedText style={styles.emptyBody} setColor={quiet}>
                {t("records.trophy.emptyBody")}
              </ThemedText>
            </View>
          )}
        </View>
      </Reveal>

      {/* The strongest lifts. */}
      {podium.length > 0 ? (
        <Reveal index={section++} still={reduceMotion}>
          <View style={styles.section}>
            {sectionHead(t("records.trophy.podium.title"))}

            <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
              {podium.map((entry, index) => {
                const medal = medals[index] ?? quiet;

                return (
                  <TouchableOpacity
                    key={entry.name}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t("records.trophy.podium.label", {
                      rank: index + 1,
                      name: entry.name,
                      weight: formatKg(entry.weight),
                      reps: entry.reps,
                    })}
                    onPress={() => onOpenExercise?.(entry.name)}
                    style={[
                      styles.podiumRow,
                      index > 0 ? { borderTopWidth: 1, borderTopColor: hairline } : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.medal,
                        { backgroundColor: withAlpha(medal, 0.16), borderColor: medal },
                      ]}
                    >
                      <ThemedText style={styles.medalNumber} setColor={medal}>
                        {index + 1}
                      </ThemedText>
                    </View>

                    <View style={styles.podiumCopy}>
                      <ThemedText style={styles.podiumName} setColor={title} numberOfLines={1}>
                        {entry.name}
                      </ThemedText>
                      <ThemedText style={styles.caption} setColor={quiet} numberOfLines={1}>
                        {t("records.trophy.podium.meta", {
                          reps: entry.reps,
                          date: formatDate(entry.at, { day: "numeric", month: "short", year: "numeric" }),
                        })}
                      </ThemedText>
                    </View>

                    <View style={styles.podiumWeight}>
                      <ThemedText style={styles.podiumKg} setColor={index === 0 ? gold : title}>
                        {formatKg(entry.weight)}
                      </ThemedText>
                      <ThemedText style={styles.podiumUnit} setColor={quiet}>
                        {t("common.kg")}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* The next round weight for the strongest lift. */}
              <View style={[styles.goal, { borderTopColor: hairline }]}>
                <View style={styles.goalHead}>
                  <ThemedText style={styles.goalTitle} setColor={title} numberOfLines={1}>
                    {t("records.trophy.podium.nextGoal", {
                      goal: formatKg(podium[0].goal),
                      name: podium[0].name,
                    })}
                  </ThemedText>
                  <ThemedText style={styles.caption} setColor={quiet}>
                    {t("records.trophy.podium.toGo", { value: formatKg(podium[0].toGo) })}
                  </ThemedText>
                </View>
                <View style={[styles.track, { backgroundColor: withAlpha(gold, 0.16) }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.round((podium[0].weight / podium[0].goal) * 100)}%`,
                        backgroundColor: gold,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </Reveal>
      ) : null}

      {/* The newest records, a star on each. */}
      {recent.length > 0 ? (
        <Reveal index={section++} still={reduceMotion}>
          <View style={styles.section}>
            {sectionHead(t("records.trophy.recent.title"))}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelf}
            >
              {recent.map((record, index) => (
                <TouchableOpacity
                  key={`${record.name}-${record.at}`}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={t("records.trophy.recent.label", {
                    name: record.name,
                    weight: formatKg(record.weight),
                    reps: record.reps,
                    when: formatRelativeDay(record.at, now),
                  })}
                  onPress={() => onOpenExercise?.(record.name)}
                  style={[
                    styles.recordCard,
                    { backgroundColor: withAlpha(gold, 0.08), borderColor: withAlpha(gold, 0.3) },
                  ]}
                >
                  <RecordStar size={22} index={index} style={styles.recordStar} />
                  <ThemedText style={styles.recordName} setColor={title} numberOfLines={1}>
                    {record.name}
                  </ThemedText>
                  <View style={styles.recordWeightLine}>
                    <ThemedText style={styles.recordWeight} setColor={gold}>
                      {formatKg(record.weight)}
                    </ThemedText>
                    <ThemedText style={styles.recordWeightMeta} setColor={quiet}>
                      {`${t("common.kg")} × ${record.reps}`}
                    </ThemedText>
                  </View>
                  <View style={styles.recordFoot}>
                    <ThemedText style={styles.caption} setColor={quiet} numberOfLines={1}>
                      {formatRelativeDay(record.at, now)}
                    </ThemedText>
                    {record.isNew ? (
                      <View style={[styles.newPill, { backgroundColor: withAlpha(gold, 0.18) }]}>
                        <ThemedText style={styles.newPillText} setColor={gold}>
                          {t("records.trophy.recent.new")}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Reveal>
      ) : null}

      {/* Milestones. */}
      <Reveal index={section++} still={reduceMotion}>
        <View style={styles.section}>
          {sectionHead(t("records.trophy.milestones.title"))}

          <View style={styles.milestoneGrid}>
            {milestones.map((milestone) => {
              const reached = milestone.reached !== null;
              const tone = reached ? gold : quiet;
              const heading = reached
                ? milestoneLabel(milestone.key, milestone.reached)
                : milestoneLabel(milestone.key, milestone.next);
              const note =
                milestone.next === null
                  ? t("records.trophy.milestones.maxed")
                  : reached
                    ? t("records.trophy.milestones.nextUp", {
                        label: milestoneLabel(milestone.key, milestone.next),
                      })
                    : t("records.trophy.milestones.notYet");

              return (
                <View
                  key={milestone.key}
                  accessible
                  accessibilityLabel={`${heading}. ${note}`}
                  style={[
                    styles.milestone,
                    reached
                      ? { backgroundColor: theme.recordSurface, borderColor: withAlpha(gold, 0.35) }
                      : { backgroundColor: card, borderColor: border },
                  ]}
                >
                  <View style={styles.milestoneHead}>
                    <View
                      style={[
                        styles.milestoneIcon,
                        { backgroundColor: reached ? withAlpha(gold, 0.2) : theme.uiBackground },
                      ]}
                    >
                      {MILESTONE_ICONS[milestone.key]?.(tone)}
                    </View>
                    {reached ? <Checkmark width={14} height={14} color={gold} thickness={2.6} /> : null}
                  </View>

                  <ThemedText
                    style={styles.milestoneTitle}
                    setColor={reached ? title : quiet}
                    numberOfLines={2}
                  >
                    {heading}
                  </ThemedText>

                  {milestone.next !== null ? (
                    <View
                      style={[
                        styles.track,
                        { backgroundColor: reached ? withAlpha(gold, 0.16) : theme.uiBackground },
                      ]}
                    >
                      <View
                        style={[
                          styles.fill,
                          {
                            width: `${Math.round(milestone.progress * 100)}%`,
                            backgroundColor: reached ? gold : theme.primary,
                          },
                        ]}
                      />
                    </View>
                  ) : null}

                  <ThemedText
                    style={styles.caption}
                    setColor={milestone.next === null ? gold : quiet}
                    numberOfLines={2}
                  >
                    {note}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </Reveal>

      {/* Through to the numbers. */}
      <Reveal index={section++} still={reduceMotion}>
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={onOpenStatistics}
          style={[styles.statsLink, { backgroundColor: card, borderColor: border }]}
        >
          <View style={[styles.statsIcon, { backgroundColor: withAlpha(theme.primary, 0.12) }]}>
            <UpwardGraf width={18} height={18} color={theme.primaryText} thickness={1.8} />
          </View>
          <View style={styles.statsCopy}>
            <ThemedText style={styles.statsTitle} setColor={title}>
              {t("records.trophy.statistics.title")}
            </ThemedText>
            <ThemedText style={styles.caption} setColor={quiet} numberOfLines={2}>
              {t("records.trophy.statistics.body")}
            </ThemedText>
          </View>
          <ChevronRight width={16} height={16} color={quiet} thickness={2} />
        </TouchableOpacity>
      </Reveal>
    </View>
  );
}
