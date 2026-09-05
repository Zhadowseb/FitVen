import { StatusBar } from "expo-status-bar";
import { ScrollView, View, useColorScheme } from "react-native";

import styles from "./PrivacyPolicyPageStyle";
import PrivacyPolicyBody from "../../Resources/Components/PrivacyPolicyBody/PrivacyPolicyBody";
import { Colors } from "../../Resources/GlobalStyling/colors";
import {
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

export default function PrivacyPolicyPage() {
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
            Privacy
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PrivacyPolicyBody />
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
