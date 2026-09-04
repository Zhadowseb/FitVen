import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { programService as programRepository } from "../../../Services";
import { ThemedPicker, ThemedText, ThemedModal } from "../../ThemedComponents";

const Mesocycle = ({ program_id, visible, close }) => {
  const db = useSQLiteContext();
  const [mesocycles, set_Mesocycles] = useState([]);
  const [loading, set_Loading] = useState(false);

  useEffect(() => {
    if (!program_id) return;

    const load = async () => {
      try {
        set_Loading(true);
        const rows = await programRepository.getMesocycleOptions(db, program_id);
        set_Mesocycles(rows);
      } catch (e) {
        console.error(e);
      } finally {
        set_Loading(false);
      }
    };

    load();
  }, [program_id]);

  if (loading) return <ActivityIndicator />;

  if (mesocycles.length === 0) {
    return <ThemedText>No blocks</ThemedText>;
  }

  return (
    <>
      <ThemedModal
        visible={visible}
        onClose={() => close()}
        title="Pick a block">

        {mesocycles.map(mc => (
          <Pressable
            key={mc.mesocycle_id}
            onPress={() => {
              close();
            }}
            style={{ paddingVertical: 12 }}
          >
            <ThemedText>
              Block {mc.mesocycle_number}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedModal>
    </>
    
  );
};

export default Mesocycle;
