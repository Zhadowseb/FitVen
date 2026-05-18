import { useNavigation } from "@react-navigation/native";

import HomeImageShortcutCard from "../HomeImageShortcutCard/HomeImageShortcutCard";

const sicknessDarkImage = require("../../../../Resources/Images/DarkVersion/sickness dark.png");

export default function SicknessLogCard() {
  const navigation = useNavigation();

  return (
    <HomeImageShortcutCard
      accessibilityLabel="Sickness log"
      imageSource={sicknessDarkImage}
      onPress={() => navigation.navigate("SicknessPage")}
      title="Sickness log"
    />
  );
}
