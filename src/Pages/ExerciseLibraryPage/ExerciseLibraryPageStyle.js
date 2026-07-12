import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTextColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  searchCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },

  // Quick tools grid (2-col image cards)
  quickToolsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickToolCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  quickToolImageArea: {
    height: 88,
    width: "100%",
    position: "relative",
  },
  quickToolFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 13,
  },
  quickToolLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "800",
  },

  // 1RM Calculator row
  calculatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  calculatorThumb: {
    width: 48,
    height: 48,
    borderRadius: 13,
    overflow: "hidden",
  },
  calculatorTextColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 1,
  },
  calculatorTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  calculatorSubtitle: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Programs hero card
  programsCard: {
    borderWidth: 1,
    borderRadius: 20,
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
    fontSize: 10,
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
    fontSize: 10.5,
    fontWeight: "800",
  },

  // Personal records / exercise library cards
  infoCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "column",
    gap: 10,
  },
  infoCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
