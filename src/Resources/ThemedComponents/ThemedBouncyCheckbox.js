import { useColorScheme } from "react-native";
import BouncyCheckbox from "react-native-bouncy-checkbox";
import { Colors } from "../GlobalStyling/colors";
import Checkmark from "../Icons/UI-icons/Checkmark";


const ThemedBouncyCheckbox = ({
  value,
  onChange,
  size = 24,
  text,
  style,
  edgeSize = 2,
  checkmarkColor,
  fillColor,
  ...props
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  return (
    <BouncyCheckbox
      size={size}
      isChecked={value}
      useBuiltInState={false}
      disableText
      fillColor={fillColor ? fillColor : theme.secondary}
      unFillColor={theme.cardBackground}
      iconStyle={fillColor ? fillColor : theme.secondary}
      innerIconStyle={{
        borderWidth: edgeSize,
        color: "#c40f0f"
      }}
      text={text}
      textStyle={{
        color: theme.text,
        fontSize: 14,
      }}
      style={style}
      iconComponent={
        value ? (
          <Checkmark
            width={size * 0.9}
            height={size * 0.9}
            color={checkmarkColor ? checkmarkColor : theme.primary}
            thickness={3}
          />
        ) : null
      }
      onPress={() => onChange?.(!value)}
      {...props}
    />
  );
};

export default ThemedBouncyCheckbox;
