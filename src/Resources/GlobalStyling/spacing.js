// Layout constants, in the same spirit as Typography: a named place to stand
// for the numbers that are otherwise written straight into StyleSheet.create.
//
// The steps below are the values the codebase already reaches for most often,
// not an invented scale. They are for NEW code and for files another change
// touches anyway — there is deliberately no global search-and-replace, because
// swapping ~700 spacing numbers would move the layout of every screen at once
// with no way to verify the result.

/* ========= SPACING ========= */

// Padding, margin and gap. 12 and 8 carry most of the app; 14 and 18 are the
// card and page insets; 4 is the tight pairing gap; 24 separates sections.
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 24,
};

/* ========= RADIUS ========= */

// sm for chips and small tiles, md for cells, lg for cards, xl for panels,
// xxl for sheets and hero surfaces, pill for anything fully rounded.
export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 22,
  pill: 999,
};

/* ========= ELEVATION ========= */

// The three shadow recipes actually in use, copied as they are. Spread one into
// a style; note that `card` has no `elevation`, so like the code it comes from
// it casts a shadow on iOS only.
export const Elevation = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  sheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },

  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.95,
    shadowRadius: 40,
    elevation: 14,
  },
};
