import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 22,
  },
  section: {
    flexDirection: "column",
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },

  // Quick tools grid (2-col image cards)

  // 1RM Calculator row
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toolRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toolRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  toolRowTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  toolRowDetail: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },

  // Programs hero card
  programsCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  programsImageArea: {
    height: 110,
    width: "100%",
    position: "relative",
  },
  programsPill: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  programsPillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  programsBody: {
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 16,
    flexDirection: "column",
    gap: 10,
  },

  // Shared card body pieces (programs / records / library)
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitleColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // Personal records / exercise library cards
});
