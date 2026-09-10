// The policy text itself, so the screen you can open from your profile and the
// consent gate you have to pass through show exactly the same words. Agreeing
// to one thing and being able to read another is the failure mode here.
import { View, useColorScheme } from "react-native";

import styles from "./PrivacyPolicyBodyStyle";
import { Colors } from "../../GlobalStyling/colors";
import { ThemedText, ThemedTitle } from "../../ThemedComponents";
import {
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_VERSION,
} from "../../Legal/privacyPolicy";

export default function PrivacyPolicyBody() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const titleColor = theme.title ?? theme.text;

  return (
    <View style={styles.container}>
      <ThemedText style={styles.meta} setColor={quietText}>
        Version {PRIVACY_POLICY_VERSION} · Last updated{" "}
        {PRIVACY_POLICY_LAST_UPDATED}
      </ThemedText>

      {PRIVACY_POLICY_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <ThemedTitle type="h3" style={styles.sectionTitle}>
            {section.title}
          </ThemedTitle>
          <ThemedText style={styles.sectionBody} setColor={titleColor}>
            {section.body}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}
