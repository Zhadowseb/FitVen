import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  ThemedTextInput,
  ThemedButton,
  ThemedModal,
} from "../../../../Resources/ThemedComponents";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
});

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
