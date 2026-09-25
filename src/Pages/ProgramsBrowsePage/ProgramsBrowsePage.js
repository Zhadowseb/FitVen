import { useColorScheme } from "react-native";
import { useTranslation } from "@localization";

import { Colors } from "@resources/GlobalStyling/colors";
import Calender from "@resources/Icons/UI-icons/Calender";
import ExploreEmptyPage from "@resources/Components/ExploreEmptyPage/ExploreEmptyPage";

/**
 * Programs to choose from, under Explore. Programs are shared by hand-picking
 * them, and none has been picked yet, so for now the page says there are none.
 */
export default function ProgramsBrowsePage() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <ExploreEmptyPage
      title={t("explore.programs.title")}
      emptyTitle={t("explore.programs.emptyTitle")}
      emptyBody={t("explore.programs.emptyBody")}
      tone={theme.secondary}
      icon={<Calender width={20} height={20} color={theme.secondary} thickness={1.6} />}
    />
  );
}
