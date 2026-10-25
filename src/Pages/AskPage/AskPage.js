import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import { formatDate, useTranslation } from "@localization";

import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import {
  ThemedBottomSheet,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedView,
} from "@resources/ThemedComponents";
import { useAuth } from "@contexts/AuthContext";
import { askService } from "@services";
import { buildEmptyStateRows } from "@utils/askPrompts";
import {
  assistantMessage,
  clearFailed,
  markFailed,
  userMessage,
  withoutFailedQuestion,
} from "@utils/askConversation";
import { chooseDefaultTier, isTierExhausted } from "@utils/askTiers";
import { workoutDisplayName } from "@utils/workoutTypeLabel";
import AnswerMessage from "./Components/AnswerMessage";
import AskHeader from "./Components/AskHeader";
import { ChatNotice, TypingIndicator } from "./Components/ChatNotices";
import ConsentScreen from "./Components/ConsentScreen";
import EmptyState from "./Components/EmptyState";
import InputBar from "./Components/InputBar";
import TierPicker from "./Components/TierPicker";
import styles from "./AskPageStyle";

// Ask FitVen: the chat about your own training. Opened from the bar on Home
// (`focusInput` when the mic was pressed). The conversation is on this phone
// only; the function gets the text of the last turns. The AI writes nothing: a
// suggested change is applied by its button, and can be undone.
//
// Which model answers: the three are shown with their questions left this
// month. While you type, FitVen is asked which suits the question; the one it
// names is preselected if it has questions left, otherwise the next one down.
// Choosing one yourself stops the asking.

// A question is not worth a recommendation until it is this long.
const RECOMMEND_MIN_CHARS = 8;
// How long the typing has to rest before the recommendation is asked for.
const RECOMMEND_DELAY_MS = 900;
// The Done bar App.js puts over every keyboard (react-native-keyboard-controller's
// KeyboardToolbar, 42 high) floats over the bottom of the screen without moving
// it, so the pinned input is lifted by its height as well.
const KEYBOARD_TOOLBAR_HEIGHT = 42;

export default function AskPage() {
  const { t, language } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  // "idle" | "sending" | "consent" (the consent screen is up)
  const [phase, setPhase] = useState("idle");
  const [notice, setNotice] = useState(null);
  const [usage, setUsage] = useState(null);
  // "unknown" | "yes" | "no"
  const [consent, setConsent] = useState("unknown");
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentFailed, setConsentFailed] = useState(false);
  const [tier, setTier] = useState(null);
  const [tierSource, setTierSource] = useState("auto");
  const [recommended, setRecommended] = useState(null);
  const [suggestionStates, setSuggestionStates] = useState({});
  const [facts, setFacts] = useState(null);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // What the async steps below read: the value as it is now, not as it was
  // when the function was made.
  const messagesRef = useRef([]);
  const phaseRef = useRef("idle");
  const consentRef = useRef("unknown");
  const usageRef = useRef(null);
  const tierRef = useRef(null);
  const tierSourceRef = useRef("auto");
  const recommendedRef = useRef(null);
  const suggestionStatesRef = useRef({});
  const pendingQuestionRef = useRef(null);
  const mountedRef = useRef(true);

  // The phase is read by the next tap before the screen has drawn again, so the
  // ref moves with it.
  const changePhase = useCallback((next) => {
    phaseRef.current = next;

    if (mountedRef.current) {
      setPhase(next);
    }
  }, []);

  phaseRef.current = phase;
  consentRef.current = consent;
  usageRef.current = usage;
  tierRef.current = tier;
  tierSourceRef.current = tierSource;
  recommendedRef.current = recommended;
  suggestionStatesRef.current = suggestionStates;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ------------------------------------------------------------- loading -- */

  useEffect(() => {
    let active = true;

    (async () => {
      const stored = await askService.loadConversation({ userId });

      if (!active) {
        return;
      }

      messagesRef.current = stored;
      setMessages(stored);
      setLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    askService
      .loadSuggestionStates({ userId })
      .then((stored) => {
        if (active && Object.keys(stored).length > 0) {
          suggestionStatesRef.current = { ...stored, ...suggestionStatesRef.current };
          setSuggestionStates(suggestionStatesRef.current);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    askService
      .loadEmptyStateFacts(db, { userId })
      .then((found) => {
        if (active) {
          setFacts(found);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [db, userId]);

  const refreshUsage = useCallback(async () => {
    const result = await askService.getAskUsage();

    if (mountedRef.current && result.usage) {
      setUsage(result.usage);
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      const result = await askService.getAskConsent({ userId });

      if (!active || result.code) {
        return;
      }

      setConsent(result.consented ? "yes" : "no");

      if (result.consented) {
        await refreshUsage();
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, refreshUsage]);

  // Opened with the mic: the cursor is in the field, and the keyboard's own
  // dictation is one tap away.
  useEffect(() => {
    if (!loaded || !route.params?.focusInput) {
      return undefined;
    }

    const timer = setTimeout(() => inputRef.current?.focus(), 350);

    return () => clearTimeout(timer);
  }, [loaded, route.params?.focusInput]);

  /* ----------------------------------------------------- the conversation -- */

  const commit = useCallback(
    (next) => {
      messagesRef.current = next;

      if (mountedRef.current) {
        setMessages(next);
      }

      askService.saveConversation(next, { userId }).catch(() => {});
    },
    [userId]
  );

  const failQuestion = useCallback(
    (questionId, failure) => {
      if (!messagesRef.current.some((message) => message.id === questionId)) {
        return;
      }

      commit(markFailed(messagesRef.current, questionId, failure.code));

      if (!mountedRef.current) {
        return;
      }

      if (failure.usage) {
        setUsage(failure.usage);
      }

      if (failure.code === "consent_required") {
        setConsent("no");
      }

      setNotice({ code: failure.code, tier: failure.tier ?? null });
      changePhase("idle");
    },
    [changePhase, commit]
  );

  // Which model answers this question. The person's own choice wins; otherwise
  // FitVen's recommendation for this very text (asked now if it has not been),
  // by the rule in chooseDefaultTier. -> { tier } | { quotaReached: true }
  const resolveTier = useCallback(
    async (questionText, forcedTier) => {
      let nextUsage = usageRef.current;

      if (forcedTier || tierSourceRef.current === "manual") {
        const wanted = forcedTier ?? tierRef.current;

        return isTierExhausted(nextUsage, wanted)
          ? { quotaReached: true, tier: wanted, usage: nextUsage }
          : { tier: wanted };
      }

      let suggested = recommendedRef.current?.text === questionText ? recommendedRef.current.tier : null;

      if (!suggested) {
        const result = await askService.recommendTier(questionText, language);

        if (!result.code) {
          suggested = result.tier;
          nextUsage = result.usage ?? nextUsage;

          if (mountedRef.current) {
            setRecommended({ text: questionText, tier: result.tier });

            if (result.usage) {
              setUsage(result.usage);
            }
          }
        }
      }

      const choice = chooseDefaultTier({ recommended: suggested, usage: nextUsage });

      return choice.quotaReached
        ? { quotaReached: true, tier: choice.recommended, usage: nextUsage }
        : { tier: choice.tier };
    },
    [language]
  );

  // The question is in the conversation already. Consent first, then the
  // model, then the answer.
  const execute = useCallback(
    async (history, questionId, questionText, forcedTier = null) => {
      setNotice(null);
      changePhase("sending");

      if (consentRef.current !== "yes") {
        // Yes may have been said on another phone: the cloud has the answer.
        const consentResult = await askService.getAskConsent({ userId });

        if (consentResult.code) {
          failQuestion(questionId, consentResult);
          return;
        }

        if (!consentResult.consented) {
          setConsent("no");
          pendingQuestionRef.current = { questionId, questionText, forcedTier };
          changePhase("consent");
          return;
        }

        setConsent("yes");
        refreshUsage();
      }

      const picked = await resolveTier(questionText, forcedTier);

      // The next question is recommended for afresh: a model chosen by hand is
      // for this question, not for the rest of the chat - Opus has two a month.
      tierSourceRef.current = "auto";
      setTierSource("auto");
      setRecommended(null);

      if (picked.quotaReached) {
        failQuestion(questionId, { code: "quota_exceeded", tier: picked.tier, usage: picked.usage });
        return;
      }

      const answer = await askService.askQuestion(db, {
        tier: picked.tier,
        messages: history,
        language,
      });

      if (answer.code) {
        failQuestion(questionId, answer);
        return;
      }

      // "New chat" while it was thinking: the answer is for a chat that is gone.
      if (!messagesRef.current.some((message) => message.id === questionId)) {
        return;
      }

      commit([...messagesRef.current, assistantMessage(answer)]);

      if (mountedRef.current) {
        changePhase("idle");

        if (answer.usage) {
          setUsage(answer.usage);
        } else {
          refreshUsage();
        }

        AccessibilityInfo.announceForAccessibility?.(t("ask.answered"));
      }
    },
    [changePhase, commit, db, failQuestion, language, refreshUsage, resolveTier, t, userId]
  );

  // Nothing here is meant to throw (the service answers { code }), but a
  // question left "thinking" for ever is worse than a retry button.
  const runQuestion = useCallback(
    (history, questionId, questionText, forcedTier = null) =>
      execute(history, questionId, questionText, forcedTier).catch((error) => {
        console.warn("Ask FitVen failed:", error);
        failQuestion(questionId, { code: "error" });
      }),
    [execute, failQuestion]
  );

  const submit = useCallback(
    (raw) => {
      const text = String(raw ?? "").trim();

      if (!text || phaseRef.current !== "idle" || !loaded) {
        return;
      }

      // A question that never got its answer is not carried along with the next.
      const history = [...withoutFailedQuestion(messagesRef.current), userMessage(text)];
      const question = history[history.length - 1];

      commit(history);
      setDraft("");
      runQuestion(history, question.id, question.text);
    },
    [commit, loaded, runQuestion]
  );

  const retry = useCallback(() => {
    const failed = [...messagesRef.current]
      .reverse()
      .find((message) => message.role === "user" && message.failed);

    if (!failed || phaseRef.current !== "idle") {
      return;
    }

    const cleared = clearFailed(messagesRef.current);

    commit(cleared);
    runQuestion(cleared, failed.id, failed.text);
  }, [commit, runQuestion]);

  const chooseOtherTier = useCallback(
    (nextTier) => {
      const failed = [...messagesRef.current]
        .reverse()
        .find((message) => message.role === "user" && message.failed);

      tierRef.current = nextTier;
      tierSourceRef.current = "manual";
      setTier(nextTier);
      setTierSource("manual");

      if (failed && phaseRef.current === "idle") {
        const cleared = clearFailed(messagesRef.current);

        commit(cleared);
        runQuestion(cleared, failed.id, failed.text, nextTier);
      }
    },
    [commit, runQuestion]
  );

  const pickTier = useCallback((nextTier) => {
    setTier(nextTier);
    setTierSource("manual");
  }, []);

  /* --------------------------------------------------------------- consent -- */

  const continueConsent = useCallback(async () => {
    setConsentBusy(true);
    setConsentFailed(false);

    const result = await askService.setAskConsent(true, { userId });

    if (!mountedRef.current) {
      return;
    }

    setConsentBusy(false);

    if (result.code) {
      setConsentFailed(true);
      return;
    }

    consentRef.current = "yes";
    setConsent("yes");
    refreshUsage();

    const pending = pendingQuestionRef.current;

    pendingQuestionRef.current = null;

    if (pending) {
      runQuestion(messagesRef.current, pending.questionId, pending.questionText, pending.forcedTier);
    } else {
      changePhase("idle");
      retry();
    }
  }, [changePhase, refreshUsage, retry, runQuestion, userId]);

  // Not now: nothing is shared, nothing is sent, and the question goes back in
  // the field.
  const declineConsent = useCallback(() => {
    const pending = pendingQuestionRef.current;

    pendingQuestionRef.current = null;
    setConsentFailed(false);
    changePhase("idle");

    if (pending) {
      commit(messagesRef.current.filter((message) => message.id !== pending.questionId));
      setDraft(pending.questionText);
    }
  }, [changePhase, commit]);

  // Back from the consent screen is "Not now", on the screen's arrow and on
  // Android's own: the question goes back in the field and nothing is sent.
  useEffect(() => {
    if (phase !== "consent") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      declineConsent();

      return true;
    });

    return () => subscription.remove();
  }, [phase, declineConsent]);

  const openConsent = useCallback(() => {
    setConsentFailed(false);
    changePhase("consent");
  }, [changePhase]);

  /* ----------------------------------------------------------- the picker -- */

  // While the typing rests, FitVen is asked which model suits the question.
  // Once per settled text; not at all after the person has chosen one, nor
  // before they have said yes.
  useEffect(() => {
    const text = draft.trim();

    if (
      consent !== "yes" ||
      tierSource === "manual" ||
      phase !== "idle" ||
      text.length < RECOMMEND_MIN_CHARS ||
      recommendedRef.current?.text === text
    ) {
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      const result = await askService.recommendTier(text, language);

      if (active && mountedRef.current && !result.code) {
        setRecommended({ text, tier: result.tier });

        if (result.usage) {
          setUsage(result.usage);
        }
      }
    }, RECOMMEND_DELAY_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, consent, tierSource, phase, language]);

  const pickerTier = useMemo(() => {
    if (tierSource === "manual") {
      return tier;
    }

    return chooseDefaultTier({ recommended: recommended?.tier ?? null, usage }).tier;
  }, [tier, tierSource, recommended, usage]);

  /* ------------------------------------------------------ the suggestions -- */

  const patchSuggestion = useCallback(
    (key, patch) => {
      const next = {
        ...suggestionStatesRef.current,
        [key]: { ...suggestionStatesRef.current[key], ...patch },
      };

      suggestionStatesRef.current = next;
      setSuggestionStates(next);
      // What was settled is kept with the chat, so a card that was added is
      // still "Added", with its Undo, when the chat is opened again.
      askService.saveSuggestionStates(next, { userId }).catch(() => {});
    },
    [userId]
  );

  const applySuggestionAt = useCallback(
    async (messageId, index, block) => {
      const key = `${messageId}:${index}`;

      patchSuggestion(key, { status: "applying" });

      const result = await askService.applySuggestion(db, block);

      if (!mountedRef.current) {
        return;
      }

      if (result.applied) {
        patchSuggestion(key, {
          status: "applied",
          applied: result.applied,
          workoutLabel: result.applied.workoutLabel,
        });
      } else if (result.code === "no_workout") {
        patchSuggestion(key, { status: "noWorkout" });
      } else {
        patchSuggestion(key, { status: "failed" });
      }
    },
    [db, patchSuggestion]
  );

  const dismissSuggestionAt = useCallback(
    (messageId, index) => patchSuggestion(`${messageId}:${index}`, { status: "dismissed" }),
    [patchSuggestion]
  );

  const undoSuggestionAt = useCallback(
    async (messageId, index) => {
      const key = `${messageId}:${index}`;
      const applied = suggestionStatesRef.current[key]?.applied;

      if (!applied) {
        return;
      }

      patchSuggestion(key, { status: "undoing" });

      const result = await askService.undoSuggestion(db, applied);

      if (!mountedRef.current) {
        return;
      }

      // "gone": the exercise was taken out of the workout since - nothing left to restore.
      patchSuggestion(
        key,
        result.restored || result.code === "gone"
          ? { status: "undone", applied: null }
          : { status: "undoFailed" }
      );
    },
    [db, patchSuggestion]
  );

  const openSource = useCallback(
    (link) => {
      if (link?.route) {
        navigation.navigate(link.route, link.params);
      }
    },
    [navigation]
  );

  const startNewChat = useCallback(() => {
    setMenuOpen(false);
    pendingQuestionRef.current = null;
    commit([]);
    askService.clearConversation({ userId }).catch(() => {});
    suggestionStatesRef.current = {};
    setSuggestionStates({});
    setNotice(null);
    setRecommended(null);
    changePhase("idle");
  }, [changePhase, commit, userId]);

  /* ---------------------------------------------------------------- render -- */

  // The month's name follows the language.
  const monthLabel = useMemo(() => formatDate(new Date(), { month: "long" }), [language]);
  const rows = useMemo(
    () =>
      buildEmptyStateRows(
        {
          flatLift: facts?.flatLift ?? null,
          nextWorkout: facts?.nextWorkout
            ? workoutDisplayName(facts.nextWorkout, t, facts.nextWorkoutType)
            : null,
          monthLabel,
        },
        t
      ),
    [facts, monthLabel, t]
  );

  const isSending = phase === "sending";
  const isEmpty = messages.length === 0 && !isSending;
  const showPicker =
    draft.trim().length > 0 || (notice?.code === "quota_exceeded" && phase === "idle");

  const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.screen}>
      <AskHeader
        onBack={() => (phase === "consent" ? declineConsent() : navigation.goBack())}
        onOpenBadge={() => setBadgeOpen(true)}
        onOpenMenu={() => setMenuOpen(true)}
        showMenu={messages.length > 0 && phase !== "consent"}
      />

      {phase === "consent" ? (
        <ConsentScreen
          busy={consentBusy}
          failed={consentFailed}
          onContinue={continueConsent}
          onNotNow={declineConsent}
        />
      ) : (
        <ThemedKeyboardProtection
          keyboardVerticalOffset={-KEYBOARD_TOOLBAR_HEIGHT}
          footer={
            <InputBar
              value={draft}
              onChange={setDraft}
              onSend={() => submit(draft)}
              onMic={() => inputRef.current?.focus()}
              inputRef={inputRef}
              busy={isSending || !loaded}
            >
              {showPicker ? (
                <TierPicker
                  usage={usage}
                  selected={pickerTier}
                  recommended={tierSource === "auto" ? recommended?.tier ?? null : null}
                  onSelect={pickTier}
                  disabled={isSending}
                />
              ) : null}
            </InputBar>
          }
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={isEmpty ? { flexGrow: 1 } : styles.messages}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
          >
            {isEmpty ? (
              <EmptyState rows={rows} onPick={submit} />
            ) : (
              messages.map((message) =>
                message.role === "user" ? (
                  <View
                    key={message.id}
                    style={[styles.userBubble, { backgroundColor: withAlpha(theme.primary, 0.16) }]}
                  >
                    <ThemedText selectable style={styles.userText} setColor={theme.title}>
                      {message.text}
                    </ThemedText>
                  </View>
                ) : (
                  <AnswerMessage
                    key={message.id}
                    message={message}
                    suggestionStates={suggestionStates}
                    onApply={applySuggestionAt}
                    onDismiss={dismissSuggestionAt}
                    onUndo={undoSuggestionAt}
                    onOpenSource={openSource}
                  />
                )
              )
            )}

            {isSending ? <TypingIndicator /> : null}

            {notice && !isSending ? (
              <ChatNotice
                notice={notice}
                usage={usage}
                onRetry={retry}
                onUseTier={chooseOtherTier}
                onOpenConsent={openConsent}
              />
            ) : null}
          </ScrollView>
        </ThemedKeyboardProtection>
      )}

      <ThemedBottomSheet visible={badgeOpen} onClose={() => setBadgeOpen(false)}>
        <View style={styles.sheetBody}>
          <ThemedText accessibilityRole="header" style={styles.sheetTitle} setColor={theme.title}>
            {t("ask.badgeSheet.title")}
          </ThemedText>
          <ThemedText style={styles.sheetText} setColor={theme.text}>
            {t("ask.badgeSheet.body")}
          </ThemedText>
        </View>
      </ThemedBottomSheet>

      <ThemedBottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <View style={styles.sheetBody}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={startNewChat}
            style={styles.sheetRow}
          >
            <ThemedText style={styles.sheetRowText} setColor={theme.title}>
              {t("ask.menu.newChat")}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedBottomSheet>

      <StatusBar style="auto" />
    </ThemedView>
  );
}
