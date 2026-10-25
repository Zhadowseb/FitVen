import { useCallback, useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "@localization";

import { Colors } from "../../../Resources/GlobalStyling/colors";
import { ThemedSwitch, ThemedText } from "../../../Resources/ThemedComponents";
import { useAuth } from "../../../Contexts/AuthContext";
import { askService } from "../../../Services";

// Privacy: whether FitVen's AI may read your training data when you ask it a
// question. The same yes the first question asks for. Turned off, it is said
// to the cloud (the next question has to ask again) and Ask FitVen goes from
// Home. It is a switch that waits for the cloud: it shows what the cloud says,
// and says so when it could not be changed.
export default function AskFitvenSwitch() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  // null while it is not known - not read yet, or no connection.
  const [consented, setConsented] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      askService.getAskConsent({ userId }).then((result) => {
        if (active && !result.code) {
          setConsented(result.consented);
        }
      });

      return () => {
        active = false;
      };
    }, [userId])
  );

  const change = async (next) => {
    setIsSaving(true);
    setFailed(false);

    const result = await askService.setAskConsent(next, { userId });

    setIsSaving(false);

    if (result.code) {
      setFailed(true);
      return;
    }

    setConsented(result.consented);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <ThemedText style={styles.title} setColor={theme.title}>
            {t("ask.settings.title")}
          </ThemedText>
          <ThemedText style={styles.body} setColor={theme.quietText}>
            {t("ask.settings.body")}
          </ThemedText>
        </View>

        <ThemedSwitch
          accessibilityLabel={t("ask.settings.title")}
          value={consented === true}
          disabled={consented === null || isSaving}
          onValueChange={change}
        />
      </View>

      {failed ? (
        <ThemedText accessibilityLiveRegion="polite" style={styles.error} setColor={theme.danger}>
          {t("ask.settings.failed")}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
  },
});
