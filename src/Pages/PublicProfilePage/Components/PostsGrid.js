import { Image, StyleSheet, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import CoverGradient from "@resources/Components/CoverGradient";
import { ThemedText } from "@resources/ThemedComponents";
import { PROFILE_POST_GRID_SIZE } from "@utils/publicProfileUtils";
import { getWorkoutCoverImage } from "@utils/workoutCoverImages";

const COLUMNS = 3;
// The fixed pair the other cover images use: a dark fade under white type,
// the same over any photograph in either theme.
const SCRIM = "#08090C";
const ON_PHOTO = "#FFFFFF";

function inRows(posts) {
  const rows = [];

  for (let start = 0; start < posts.length; start += COLUMNS) {
    rows.push(posts.slice(start, start + COLUMNS));
  }

  return rows;
}

/**
 * The newest nine posts as squares. A post has no photograph of its own, so
 * each square is its workout type's cover with the workout's title on it; a
 * tap opens the full list at that post.
 */
export default function PostsGrid({ posts, onOpenPost }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const rows = inRows((posts ?? []).slice(0, PROFILE_POST_GRID_SIZE));

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((post) => {
            const title =
              String(post?.title ?? "").trim() ||
              String(post?.workoutType ?? "").trim() ||
              t("publicProfile.posts.untitled");

            return (
              <TouchableOpacity
                key={post.id}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={t("publicProfile.posts.openPost", { title })}
                onPress={() => onOpenPost?.(post)}
                style={[styles.tile, { backgroundColor: theme.raisedSurface }]}
              >
                <Image
                  source={getWorkoutCoverImage(post.workoutType)}
                  style={styles.image}
                  resizeMode="cover"
                />
                <CoverGradient
                  color={SCRIM}
                  stops={[
                    { offset: "0%", opacity: 0 },
                    { offset: "45%", opacity: 0.12 },
                    { offset: "100%", opacity: 0.82 },
                  ]}
                />
                <ThemedText style={styles.title} setColor={ON_PHOTO} numberOfLines={2}>
                  {title}
                </ThemedText>
              </TouchableOpacity>
            );
          })}

          {/* A short last row keeps its squares the size of the rest. */}
          {Array.from({ length: COLUMNS - row.length }, (_, index) => (
            <View key={`empty-${index}`} style={styles.filler} />
          ))}
        </View>
      ))}
    </View>
  );
}

// Layout only.
const styles = StyleSheet.create({
  grid: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 6,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  title: {
    marginHorizontal: 8,
    marginBottom: 7,
    fontSize: 11.5,
    fontWeight: "800",
    lineHeight: 14,
  },
  filler: {
    flex: 1,
  },
});
