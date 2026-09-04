import { StyleSheet, View } from "react-native";

// 36x36 icon tile with a 12%-alpha accent background used in Settings rows
// and the Feedback card header. Kept local to ProfilePage per file-ownership
// scope. `backgroundColor` is passed per-usage (orange-12% / green-12%).
export default function SettingsIconTile({ backgroundColor, children }) {
  return (
    <View style={[styles.tile, { backgroundColor }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
