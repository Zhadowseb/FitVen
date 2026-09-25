import { useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import Library from "@resources/Icons/UI-icons/Library";
import ExploreEmptyPage from "@resources/Components/ExploreEmptyPage/ExploreEmptyPage";

/**
 * Exercises others have made, under Explore. Exercises cannot be shared yet,
 * so for now the page says there are none.
 */
export default function CustomExercisesPage() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <ExploreEmptyPage
      title={t("explore.customExercises.title")}
      emptyTitle={t("explore.customExercises.emptyTitle")}
      emptyBody={t("explore.customExercises.emptyBody")}
      tone={theme.music}
      icon={<Library width={20} height={20} color={theme.music} thickness={1.6} />}
    />
  );
}
