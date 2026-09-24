import { useState } from "react";
import { View } from "react-native";

import {
  ThemedTextInput,
  ThemedButton,
  ThemedModal,
} from "../../../../Resources/ThemedComponents";
import styles from "./AddMesocycleModalStyle";
import { useTranslation } from "@localization";

export default function AddMesocycleModal({ visible, onClose, onSubmit }) {
  const { t } = useTranslation();
  const [focus, setFocus] = useState("");

  const handleSubmit = () => {
    onSubmit({ focus });
    setFocus("");
  };

  return (
    <ThemedModal visible={visible} title={t("programs.blocks.add")}>
      <ThemedTextInput
        placeholder={t("programs.blocks.focusPlaceholder")}
        value={focus}
        onChangeText={setFocus}
      />

      <View style={styles.row}>
        <ThemedButton title={t("common.cancel")} variant="danger" onPress={onClose} />
        <ThemedButton title={t("programs.add.addButton")} variant="primary" onPress={handleSubmit} />
      </View>
    </ThemedModal>
  );
}
