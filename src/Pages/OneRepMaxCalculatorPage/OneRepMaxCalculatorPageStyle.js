import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeaderTitleGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  pageHeaderTitleEyebrow: {
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  pageHeaderTitleMain: {
    textAlign: "center",
    lineHeight: 26,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 110,
    gap: 14,
  },
  calculatorCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  inputColumn: {
    flex: 1,
    minWidth: 0,
  },
  inputLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 7,
  },
  input: {
    minHeight: 54,
    borderRadius: 14,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
  },
  calculateButton: {
    borderRadius: 18,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  resultLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  resultValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  resultValue: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  resultUnit: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    marginLeft: 7,
    textTransform: "uppercase",
  },
  resultNote: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  percentageCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  percentageHeader: {
    marginBottom: 13,
  },
  percentageEyebrow: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  percentageTitle: {
    padding: 0,
    fontSize: 19,
    lineHeight: 24,
  },
  percentageList: {
    gap: 7,
  },
  percentageRow: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  percentageValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  loadValue: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  infoTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  resetButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  resetButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
});
