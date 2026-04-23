import {
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "../GlobalStyling/colors";
import Home from "../Icons/UI-icons/Home";
import Male from "../Icons/UI-icons/Male";
import Search from "../Icons/UI-icons/Search";

function ThemedBottomNavigation({ currentRouteName, navigationRef }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const insets = useSafeAreaInsets();

  const isProfileActive = currentRouteName === "ProfilePage";
  const isSearchActive = currentRouteName === "SearchPage";
  const isHomeActive = !isProfileActive && !isSearchActive;
  const activeColor =
    theme.iconColorFocused ?? theme.primary ?? theme.title ?? theme.text;
  const inactiveColor = theme.iconColor ?? theme.quietText ?? theme.text;
  const barBackground =
    theme.cardBackground ?? theme.navBackground ?? theme.background;
  const barBorder = theme.border ?? theme.cardBorder ?? theme.iconColor;

  const handleHomePress = () => {
    if (!navigationRef?.isReady?.()) {
      return;
    }

    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: "HomePage" }],
    });
  };

  const handleProfilePress = () => {
    if (!navigationRef?.isReady?.() || isProfileActive) {
      return;
    }

    navigationRef.navigate("ProfilePage");
  };

  const handleSearchPress = () => {
    if (!navigationRef?.isReady?.() || isSearchActive) {
      return;
    }

    navigationRef.navigate("SearchPage");
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: barBackground,
          borderTopColor: barBorder,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={handleHomePress}
        style={styles.tab}
      >
        <Home
          width={28}
          height={28}
          color={isHomeActive ? activeColor : inactiveColor}
        />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={handleSearchPress}
        style={styles.tab}
      >
        <Search
          width={27}
          height={27}
          color={isSearchActive ? activeColor : inactiveColor}
        />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={handleProfilePress}
        style={styles.tab}
      >
        <Male
          width={27}
          height={27}
          color={isProfileActive ? activeColor : inactiveColor}
        />
      </TouchableOpacity>
    </View>
  );
}

export default ThemedBottomNavigation;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 4,
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
});
