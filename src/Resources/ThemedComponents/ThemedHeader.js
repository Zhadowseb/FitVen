import { View, TouchableOpacity, useColorScheme } from "react-native";
import { Colors } from "../GlobalStyling/colors";
import { useNavigation } from "@react-navigation/native";
import ArrowLeft from "../Icons/UI-icons/ArrowLeft";

const HEADER_HEIGHT = 64;

const ThemedHeader = ({
  left,          // custom left slot (optional)
  right,         // custom right slot (optional)
  children,      // center content
  showBack = true,
  leftWidth = 48,
  rightWidth = 48,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const navigation = useNavigation();

  return (
    <View
      style={{
        height: HEADER_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingHorizontal: 12,
      }}
    >
      {/* LEFT */}
      <View style={{ width: leftWidth, justifyContent: "center" }}>
        {left ? (
          left
        ) : (
          showBack && (
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ArrowLeft/>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* CENTER */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>

      {/* RIGHT */}
      <View style={{ width: rightWidth, alignItems: "flex-end" }}>
        {right}
      </View>
    </View>
  );
};

export default ThemedHeader;
