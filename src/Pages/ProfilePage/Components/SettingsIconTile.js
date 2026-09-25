import { StyleSheet, View } from "react-native";

// The rounded square an icon sits in on Profile: 34 on the settings tiles, 36
// on the feedback row. The tint is passed in, because it is the accent on one
// and the secondary colour on the other.
export default function SettingsIconTile({ backgroundColor, size = 36, children }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
