// Stands between a signed-in user and the app until they have accepted the
// current privacy policy.
//
// A gate rather than a checkbox on the register screen, for two reasons. The
// profile row does not exist yet while registering, so there is nowhere to
// record the answer at that moment - and a tick that is not recorded is not
// consent, it is decoration. And everyone who signed up before this existed has
// never been asked, which art. 9 does not allow for health data; a gate reaches
// them on their next launch without a separate migration path.
//
// It fails open on a network error. Locking people out of their own training
// data because Supabase is unreachable is worse than asking again tomorrow.
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, useColorScheme } from "react-native";

import styles from "./PrivacyConsentGateStyle";
import PrivacyPolicyBody from "../PrivacyPolicyBody/PrivacyPolicyBody";
import { Colors } from "../../GlobalStyling/colors";
import { useAuth } from "../../../Contexts/AuthContext";
import { socialService } from "../../../Services";
import { PRIVACY_POLICY_VERSION } from "../../Legal/privacyPolicy";
import {
  ThemedButton,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../ThemedComponents";

export default function PrivacyConsentGate({ children }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const { user } = useAuth();
  const [consentState, setConsentState] = useState("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;

  const checkConsent = useCallback(async () => {
    if (!user?.id) {
      setConsentState("granted");
      return;
    }

    try {
      const consent = await socialService.getPrivacyConsent({ user });

      setConsentState(
        consent.version === PRIVACY_POLICY_VERSION ? "granted" : "needed"
      );
    } catch (error) {
      console.warn("Could not read privacy consent:", error);
      setConsentState("granted");
    }
  }, [user]);

  useEffect(() => {
    setConsentState("checking");
    checkConsent();
  }, [checkConsent]);

  const handleAccept = async () => {
    setErrorMessage("");
    setConsentState("saving");

    try {
      await socialService.acceptPrivacyPolicy({
        user,
        version: PRIVACY_POLICY_VERSION,
      });
      setConsentState("granted");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save your answer. Try again."
      );
      setConsentState("needed");
    }
  };

  // "checking" renders the app rather than a spinner: the check is one round
  // trip and a flash of a loading screen on every launch is a worse trade than
  // a second of the app before the sheet appears.
  if (consentState === "granted" || consentState === "checking") {
    return children;
  }

  return (
    <ThemedView safe={["top", "left", "right", "bottom"]} style={styles.container}>
      <View style={styles.header}>
        <ThemedTitle type="h2">Before you continue</ThemedTitle>
        <ThemedText style={styles.headerBody} setColor={quietText}>
          FitVen stores your training, and — through sickness entries, heart
          rate and tracked runs — health data about you. European law needs your
          explicit permission for that. Read this and tap Accept to carry on, or
          close the app if you would rather not.
        </ThemedText>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <PrivacyPolicyBody />
      </ScrollView>

      <View style={styles.footer}>
        {errorMessage ? (
          <ThemedText style={styles.errorText} setColor={theme.danger}>
            {errorMessage}
          </ThemedText>
        ) : null}

        <ThemedButton
          title={
            consentState === "saving" ? "Saving..." : "Accept and continue"
          }
          onPress={handleAccept}
          disabled={consentState === "saving"}
          fullWidth
          height={48}
        />
      </View>
    </ThemedView>
  );
}
