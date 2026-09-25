import { StatusBar } from "expo-status-bar";
import { ScrollView, TouchableOpacity, View, useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "@localization";

import styles from "./ExploreEmptyPageStyle";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ArrowLeft from "@resources/Icons/UI-icons/ArrowLeft";
import { ThemedText, ThemedView } from "@resources/ThemedComponents";

/**
 * A page under Explore that has nothing in it yet - programs to choose from,
 * exercises others have shared - with Explore's header and a card that says
 * so plainly. The real list replaces the card when there is something to list.
 */
export default function ExploreEmptyPage({ title, emptyTitle, emptyBody, icon, tone }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const accent = tone ?? theme.primary;

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("common.goBack")}
            onPress={() => navigation.goBack()}
            style={[styles.back, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
          >
            <ArrowLeft width={18} height={18} color={theme.title} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <ThemedText style={styles.eyebrow} setColor={theme.primaryText}>
              {t("explore.title")}
            </ThemedText>
            <ThemedText style={styles.title} setColor={theme.title} accessibilityRole="header">
              {title}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
          <View style={[styles.icon, { backgroundColor: withAlpha(accent, colorScheme === "light" ? 0.12 : 0.14) }]}>
            {icon}
          </View>
          <ThemedText style={styles.emptyTitle} setColor={theme.title}>
            {emptyTitle}
          </ThemedText>
          <ThemedText style={styles.emptyBody} setColor={theme.quietText}>
            {emptyBody}
          </ThemedText>
        </View>
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
