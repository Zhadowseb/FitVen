import { StatusBar } from "expo-status-bar";
import { ScrollView, View, useColorScheme } from "react-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import ExerciseLibraryList from "../ExerciseLibraryPage/Components/ExerciseLibraryList/ExerciseLibraryList";
import styles from "./ExerciseCatalogPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import {
  ThemedHeader,
  ThemedText,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const ExerciseCatalogPage = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [refreshKey, setRefreshKey] = useState(0);
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((prev) => prev + 1);
    }, [])
  );

  return (
    <ThemedView safe={["top", "left", "right"]} style={styles.container}>
      <ThemedHeader>
        <View style={styles.pageHeaderTitleGroup}>
          <ThemedText
            size={10}
            style={[styles.pageHeaderTitleEyebrow, { color: quietText }]}
          >
            Exercise Library
          </ThemedText>

          <ThemedTitle
            type="h3"
            style={styles.pageHeaderTitleMain}
            numberOfLines={1}
          >
            Catalog
          </ThemedTitle>
        </View>
      </ThemedHeader>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ExerciseLibraryList refreshKey={refreshKey} />
      </ScrollView>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
};

export default ExerciseCatalogPage;
