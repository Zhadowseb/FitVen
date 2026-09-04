import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    lineHeight: 28,
    textAlign: "center",
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  notificationCard: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 22,
    marginBottom: 10,
    paddingHorizontal: 13,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatarSlot: {
    position: "relative",
    flexShrink: 0,
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  notificationBody: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  notificationTime: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  // Lifts the empty state clear of the list's bottom inset.
  emptyState: {
    paddingBottom: 70,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
});
