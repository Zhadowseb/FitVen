import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerMenuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 22,
  },
  section: {
    gap: 10,
  },

  // Card shell
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 0,
    marginHorizontal: 0,
    padding: 0,
  },

  // 2a. Avatar row
  avatarRow: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    padding: 3,
    flexShrink: 0,
  },
  avatarInner: {
    borderRadius: 999,
  },
  avatarInfo: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    alignItems: "flex-start",
  },
  changePhotoChip: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoChipText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  avatarHelperText: {
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: "500",
  },

  // 2b/2c. Username & email rows
  fieldRow: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fieldLabel: {
    width: 88,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  fieldValue: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "700",
  },

  // 2d. Birth date row
  birthDateRow: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  birthDateCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  birthDateValue: {
    fontSize: 13.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  birthDateSubline: {
    fontSize: 10.5,
    fontWeight: "500",
  },
  agePill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  agePillText: {
    fontSize: 10.5,
    fontWeight: "800",
    flexShrink: 0,
  },
  clearBirthDateRow: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    alignItems: "flex-end",
  },
  clearBirthDateText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // 2e. Display name section
  displayNameSection: {
    padding: 14,
    paddingHorizontal: 18,
    gap: 6,
  },
  fieldSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  inputField: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputFieldValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    padding: 0,
  },
  inputFieldCounter: {
    fontSize: 10.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  fieldHelperText: {
    fontSize: 10.5,
    fontWeight: "500",
  },

  // 2f. Bio section
  bioSection: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 6,
  },
  bioField: {
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 6,
  },
  bioFieldValue: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "600",
    padding: 0,
    textAlignVertical: "top",
  },
  bioFieldCounter: {
    alignSelf: "flex-end",
    fontSize: 10.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },

  // Loading / feedback banner
  loadingText: {
    paddingHorizontal: 18,
    paddingTop: 4,
    fontSize: 12.5,
  },
  feedbackBanner: {
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  feedbackBannerText: {
    fontSize: 12.5,
    lineHeight: 18,
  },

  // 2g. Save button
  saveButtonWrapper: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  saveButton: {
    height: 50,
    borderRadius: 14,
    width: "100%",
  },

  // 3. Settings rows
  settingsRow: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  accentPickerWrap: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 2,
  },

  // 4. Feedback card
  feedbackCard: {
    padding: 18,
    gap: 10,
  },
  feedbackHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedbackTextColumn: {
    flex: 1,
    gap: 1,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  feedbackSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "500",
  },
  feedbackChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  feedbackChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  feedbackChipText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // 5. Account card
  accountRow: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accountInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  accountLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  accountValue: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  logoutButton: {
    height: 38,
    borderRadius: 11,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoutButtonText: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  metaRow: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  metaRowLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  metaRowValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    fontSize: 12,
  },
});
