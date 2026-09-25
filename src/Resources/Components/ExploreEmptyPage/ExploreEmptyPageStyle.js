import { StyleSheet } from "react-native";

// Layout only; colours come from `theme` in the component.
export default StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  title: { fontSize: 23, fontWeight: "800", letterSpacing: -0.5, lineHeight: 27 },
  card: {
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", lineHeight: 21, textAlign: "center" },
  emptyBody: { fontSize: 13, fontWeight: "600", lineHeight: 18, textAlign: "center", maxWidth: 300 },
});
