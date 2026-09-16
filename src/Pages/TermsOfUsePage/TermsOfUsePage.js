import { StatusBar } from "expo-status-bar";
import { ScrollView, View, useColorScheme } from "react-native";

import styles from "./TermsOfUsePageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import {
  TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
} from "../../Resources/Legal/termsOfUse";
import {
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

export default function TermsOfUsePage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.headerTitleGroup}>
          <ThemedText
            size={12}
            style={[styles.headerEyebrow, { color: quietText }]}
          >
            Legal
          </ThemedText>

          <ThemedTitle
            type="pageTitle"
            style={styles.headerTitle}
            numberOfLines={1}
          >
            Terms of use
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={styles.updated} setColor={quietText}>
          Last updated {TERMS_LAST_UPDATED}
        </ThemedText>

        {TERMS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
            <ThemedText style={styles.sectionBody} setColor={quietText}>
              {section.body}
            </ThemedText>
          </View>
        ))}
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
