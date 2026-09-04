import { useState } from "react";
import { View } from "react-native";

import {
  ThemedTextInput,
  ThemedButton,
  ThemedModal,
} from "../../../../Resources/ThemedComponents";
import styles from "./AddMesocycleModalStyle";

export default function AddMesocycleModal({ visible, onClose, onSubmit }) {
  const [focus, setFocus] = useState("");

  const handleSubmit = () => {
    onSubmit({ focus });
    setFocus("");
  };

  return (
    <ThemedModal visible={visible} title="Add block">
      <ThemedTextInput
        placeholder="Focus (e.g. Hypertrophy)"
        value={focus}
        onChangeText={setFocus}
      />

      <View style={styles.row}>
        <ThemedButton title="Cancel" variant="danger" onPress={onClose} />
        <ThemedButton title="Add" variant="primary" onPress={handleSubmit} />
      </View>
    </ThemedModal>
  );
}
