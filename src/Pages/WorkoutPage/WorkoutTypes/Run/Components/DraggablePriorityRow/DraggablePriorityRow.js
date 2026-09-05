// One reorderable row in the endurance stat priority list.
import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef } from "react";
import { Animated, PanResponder, View } from "react-native";

import styles from "../../RunStyle";
import { ENDURANCE_STAT_LABELS } from "../../runEnduranceStats";
import { ThemedText } from "@resources/ThemedComponents";

const STAT_PRIORITY_ROW_HEIGHT = 48;

const DraggablePriorityRow = ({
  itemKey,
  index,
  itemCount,
  onMove,
  cardBorder,
  quietText,
  titleColor,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(index);
  const itemCountRef = useRef(itemCount);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    indexRef.current = index;
    itemCountRef.current = itemCount;
    onMoveRef.current = onMove;
  }, [index, itemCount, onMove]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const targetIndex = Math.max(
          0,
          Math.min(
            itemCountRef.current - 1,
            indexRef.current +
              Math.round(gestureState.dy / STAT_PRIORITY_ROW_HEIGHT)
          )
        );

        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 24,
          bounciness: 4,
        }).start();
        onMoveRef.current?.(itemKey, targetIndex);
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.statPriorityRow,
        {
          borderColor: cardBorder,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.statPriorityRank}>
        <ThemedText style={styles.statPriorityRankText} setColor={quietText}>
          {index + 1}
        </ThemedText>
      </View>
      <ThemedText style={styles.statPriorityLabel} setColor={titleColor}>
        {ENDURANCE_STAT_LABELS[itemKey]}
      </ThemedText>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`Reorder ${ENDURANCE_STAT_LABELS[itemKey]}`}
        style={styles.statPriorityDragHandle}
        {...panResponder.panHandlers}
      >
        <Feather name="menu" size={20} color={quietText} />
      </View>
    </Animated.View>
  );
};

export default DraggablePriorityRow;
