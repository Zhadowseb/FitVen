import { StyleSheet } from "react-native";

// Layout only; colours are applied inline from the theme.
export default StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 32 },
  backText: { fontSize: 12.5, fontWeight: "800" },

  title: { fontSize: 18, fontWeight: "800", lineHeight: 23, marginTop: 6 },
  body: { fontSize: 13, fontWeight: "600", lineHeight: 18, marginTop: 4 },

  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  loading: { marginTop: 12 },
  quiet: { fontSize: 13, fontWeight: "600", lineHeight: 18, marginTop: 12 },

  dayList: { marginTop: 6 },
  dayRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  dayRowName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "700" },
  dayRowMeta: { fontSize: 11.5, fontWeight: "700", flexShrink: 0 },

  sectionHead: {
    marginTop: 16,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },

  detailTitle: { fontSize: 18, fontWeight: "800", lineHeight: 23, marginTop: 6 },
  detailMeta: { fontSize: 12.5, fontWeight: "700", lineHeight: 17, marginTop: 3 },
  exerciseList: { marginTop: 6, maxHeight: 220 },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: "700" },
  exerciseDetail: { flexShrink: 1, maxWidth: "50%", fontSize: 12, fontWeight: "600", textAlign: "right" },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  nameInput: { flex: 1, minWidth: 0 },
  nameSave: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nameSaveText: { fontSize: 13, fontWeight: "800" },

  addButton: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  addText: { fontSize: 14.5, fontWeight: "800" },
  hint: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 8, textAlign: "center" },
});
