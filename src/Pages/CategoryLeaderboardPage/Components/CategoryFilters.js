import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "@localization";

import styles from "./CategoryFiltersStyle";
import CategoryTabs from "./CategoryTabs";
import FilterPill from "./FilterPill";
import FilterSheet from "./FilterSheet";
import {
  AGE_GROUPS,
  DEFAULT_FLID_PERIOD,
  FLID_PERIODS,
  FLID_TABS,
  FREMGANG_TABS,
  ageGroupLabelKey,
  categoryNameKey,
  flidTabLabelKey,
  fremgangTabLabelKey,
  periodLabelKey,
} from "@utils/gymCategories";

/**
 * Each category's own filters, under the gender control (spec 7.2):
 *  - Flid: Workouts / Weeks in a row, then Period and Age. A streak is not
 *    counted over a period, so Period leaves while that tab is chosen.
 *  - Powerlifting: weight class, Age and Video only.
 *  - Progress: All lifts / Bench / Squat / Deadlift.
 *  - Calisthenics: weight and Age.
 * The weight pill is only there once a gender is chosen, and says "Alle
 * vægte" without a sheet: there is no body weight to put anybody in a class
 * by yet (BODY_WEIGHT_AVAILABLE in Utils/gymCategories.js).
 *
 * `onChange` gets the part that changed; the page merges it and fetches.
 */
export default function CategoryFilters({ category, gender, filters, tone, onChange }) {
  const { t } = useTranslation();
  const [openSheet, setOpenSheet] = useState(null);
  const categoryName = t(categoryNameKey(category));
  const hasWeightPill = (category === "powerlifting" || category === "calisthenics") && gender !== "all";
  const hasAgePill = category !== "fremgang";
  const hasPeriodPill = category === "flid" && filters.tab !== "streak";

  let tabs = null;

  if (category === "flid") {
    tabs = FLID_TABS.map((tab) => ({ value: tab, label: t(flidTabLabelKey(tab)) }));
  } else if (category === "fremgang") {
    tabs = FREMGANG_TABS.map((tab) => ({ value: tab, label: t(fremgangTabLabelKey(tab)) }));
  }

  const choose = (patch) => {
    setOpenSheet(null);
    onChange?.(patch);
  };
  const periodLabel = t(periodLabelKey(filters.period));
  const ageLabel = t(ageGroupLabelKey(filters.ageGroup));

  return (
    <View style={styles.filters}>
      {tabs ? <CategoryTabs options={tabs} value={filters.tab} tone={tone} onChange={(tab) => onChange?.({ tab })} /> : null}

      {hasPeriodPill || hasWeightPill || hasAgePill ? (
        <View style={styles.pills}>
          {hasPeriodPill ? (
            <FilterPill
              label={periodLabel}
              active={filters.period !== DEFAULT_FLID_PERIOD}
              accessibilityLabel={`${t("category.filters.period")}: ${periodLabel}`}
              onPress={() => setOpenSheet("period")}
            />
          ) : null}

          {hasWeightPill ? (
            <FilterPill
              isStatic
              label={t("category.weightClasses.all")}
              accessibilityLabel={`${t("category.filters.weightClass")}: ${t("category.weightClasses.all")}`}
              accessibilityHint={t("category.filters.weightClassStatic")}
            />
          ) : null}

          {hasAgePill ? (
            <FilterPill
              label={ageLabel}
              active={filters.ageGroup !== "all"}
              accessibilityLabel={`${t("category.filters.age")}: ${ageLabel}`}
              onPress={() => setOpenSheet("age")}
            />
          ) : null}

          {category === "powerlifting" ? (
            <FilterPill
              kind="toggle"
              label={t("category.onlyVideo")}
              active={filters.onlyVideo === true}
              accessibilityHint={t("category.filters.onlyVideoHint")}
              onPress={() => onChange?.({ onlyVideo: !filters.onlyVideo })}
            />
          ) : null}
        </View>
      ) : null}

      <FilterSheet
        visible={openSheet === "period"}
        overline={categoryName}
        title={t("category.filters.period")}
        options={FLID_PERIODS.map((period) => ({ value: period, label: t(periodLabelKey(period)) }))}
        value={filters.period}
        onSelect={(period) => choose({ period })}
        onClose={() => setOpenSheet(null)}
      />

      <FilterSheet
        visible={openSheet === "age"}
        overline={categoryName}
        title={t("category.filters.age")}
        hint={t("category.filters.ageHint")}
        options={AGE_GROUPS.map((ageGroup) => ({ value: ageGroup, label: t(ageGroupLabelKey(ageGroup)) }))}
        value={filters.ageGroup}
        onSelect={(ageGroup) => choose({ ageGroup })}
        onClose={() => setOpenSheet(null)}
      />
    </View>
  );
}
