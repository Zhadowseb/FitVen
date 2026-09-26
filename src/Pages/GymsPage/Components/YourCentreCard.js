import { Image, TouchableOpacity, View, useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import styles from "./YourCentreCardStyle";
import CoverGradient from "@resources/Components/CoverGradient";
import { Colors, withAlpha } from "@resources/GlobalStyling/colors";
import ChevronRight from "@resources/Icons/UI-icons/ChevronRight";
import MapPin from "@resources/Icons/UI-icons/MapPin";
import { ThemedText } from "@resources/ThemedComponents";
import { getChainInitials } from "@utils/gymUtils";

/**
 * "Your centre" at the top of every level: a way into your own centre, not a
 * summary of it - the photo, the name and how many train there, nothing it
 * ranks. Over a photo the words use the dark palette in both themes, since
 * the veil under them is dark; without one they sit on the card like any
 * other text.
 */
export default function YourCentreCard({ gym, onPress }) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const hasPhoto = Boolean(gym?.imageUrl);
  const ink = hasPhoto ? Colors.dark : theme;
  // The short name: the chain is already written above it, and the full name
  // ("Gentofte, Kildeskovshallen") would lose its end to the ellipsis.
  const name = gym?.shortName ?? gym?.name ?? t("gyms.centre");
  const memberCount = Number(gym?.memberCount) || 0;
  const following = Number(gym?.followedMemberCount) || 0;
  const members =
    following > 0
      ? t("gyms.members", { count: memberCount, following })
      : t("gyms.overview.membersTrainHere", { count: memberCount });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${t("gyms.myGym")}: ${name}. ${members}`}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: withAlpha(theme.primary, 0.32) },
      ]}
    >
      {hasPhoto ? (
        <Image source={{ uri: gym.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.fallback}>
          <ThemedText style={styles.fallbackText} setColor={theme.quietText}>
            {getChainInitials(gym?.chain)}
          </ThemedText>
        </View>
      )}

      <CoverGradient
        color={ink.background}
        style={styles.veil}
        stops={[
          { offset: "0%", opacity: 0 },
          { offset: "50%", opacity: 0.75 },
          { offset: "100%", opacity: 0.96 },
        ]}
      />

      <View
        style={[
          styles.pill,
          {
            backgroundColor: hasPhoto
              ? withAlpha(Colors.dark.background, 0.6)
              : withAlpha(theme.primary, 0.14),
          },
        ]}
      >
        <MapPin width={11} height={11} color={ink.primaryText} thickness={2.6} />
        <ThemedText style={styles.pillText} setColor={ink.primaryText}>
          {t("gyms.myGym")}
        </ThemedText>
      </View>

      <View style={styles.bottom}>
        <View style={styles.copy}>
          {gym?.chain ? (
            <ThemedText style={styles.chain} setColor={ink.primaryText} numberOfLines={1}>
              {gym.chain}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.name} setColor={ink.title} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText style={styles.members} setColor={ink.mutedStrong} numberOfLines={1}>
            {members}
          </ThemedText>
        </View>
        <View style={[styles.go, { backgroundColor: theme.primary }]}>
          <ChevronRight width={17} height={17} color={theme.textInverted} thickness={2.4} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
