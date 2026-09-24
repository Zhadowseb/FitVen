import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { programService } from "../../../Services";
import {
  ThemedModal,
  ThemedStateBlock,
  ThemedText,
} from "../../ThemedComponents";
import { useTranslation } from "@localization";

const Mesocycle = ({ program_id, visible, close }) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const [mesocycles, set_Mesocycles] = useState([]);
  const [loading, set_Loading] = useState(false);

  useEffect(() => {
    if (!program_id) return;

    const load = async () => {
      try {
        set_Loading(true);
        const rows = await programService.getMesocycleOptions(db, program_id);
        set_Mesocycles(rows);
      } catch (e) {
        console.error(e);
      } finally {
        set_Loading(false);
      }
    };

    load();
  }, [program_id]);

  if (loading) return <ThemedStateBlock />;

  if (mesocycles.length === 0) {
    return <ThemedText>{t("programs.picker.noBlocks")}</ThemedText>;
  }

  return (
    <>
      <ThemedModal
        visible={visible}
        onClose={() => close()}
        title={t("programs.picker.pickBlock")}>

        {mesocycles.map(mc => (
          <Pressable
            key={mc.mesocycle_id}
            onPress={() => {
              close();
            }}
            style={{ paddingVertical: 12 }}
          >
            <ThemedText>
              {t("programs.blocks.blockNumber", { number: mc.mesocycle_number })}
            </ThemedText>
          </Pressable>
        ))}
      </ThemedModal>
    </>
    
  );
};

export default Mesocycle;
