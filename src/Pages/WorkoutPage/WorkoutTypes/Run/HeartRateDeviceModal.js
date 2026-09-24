import Feather from "@expo/vector-icons/Feather";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import {
  ThemedSheetHandle,
  ThemedText,
} from "../../../../Resources/ThemedComponents";
import styles from "./HeartRateDeviceModalStyle";
import { useTranslation } from "@localization";

export default function HeartRateDeviceModal({
  visible,
  devices,
  status,
  error,
  connectedDevice,
  theme,
  onClose,
  onRefresh,
  onSelectDevice,
  onDisconnect,
}) {
  const { t } = useTranslation();
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const primaryColor = theme.primary;
  const secondaryColor = theme.secondary;
  const cardSurface = theme.cardBackground ?? theme.background;
  const innerSurface = theme.uiBackground ?? cardSurface;
  const borderColor = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const isScanning = status === "scanning";
  const isConnecting = status === "connecting";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: theme.sheetScrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: cardSurface, borderColor },
          ]}
        >
          <ThemedSheetHandle style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText style={styles.eyebrow} setColor={secondaryColor}>
                {t("run.heartRate.modal.eyebrow")}
              </ThemedText>
              <ThemedText style={styles.title} setColor={titleColor}>
                {t("run.heartRate.modal.title")}
              </ThemedText>
              <ThemedText style={styles.subtitle} setColor={quietText}>
                {t("run.heartRate.modal.subtitle")}
              </ThemedText>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("run.heartRate.modal.closeLabel")}
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: innerSurface }]}
            >
              <Feather name="x" size={20} color={titleColor} />
            </TouchableOpacity>
          </View>

          {connectedDevice ? (
            <View
              style={[
                styles.connectedCard,
                {
                  backgroundColor: innerSurface,
                  borderColor: secondaryColor,
                },
              ]}
            >
              <View style={styles.deviceIdentity}>
                <View
                  style={[
                    styles.deviceIcon,
                    { backgroundColor: secondaryColor },
                  ]}
                >
                  <Feather name="heart" size={18} color="#0E0F12" />
                </View>
                <View style={styles.deviceCopy}>
                  <ThemedText style={styles.deviceName} setColor={titleColor}>
                    {connectedDevice.name}
                  </ThemedText>
                  <ThemedText style={styles.deviceMeta} setColor={secondaryColor}>
                    {t("run.heartRate.modal.connectedMeta")}
                  </ThemedText>
                </View>
              </View>
              <TouchableOpacity onPress={onDisconnect} style={styles.textButton}>
                <ThemedText style={styles.textButtonLabel} setColor={primaryColor}>
                  {t("run.heartRate.modal.disconnect")}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.errorCard, { backgroundColor: innerSurface }] }>
              <Feather name="alert-circle" size={17} color={primaryColor} />
              <ThemedText style={styles.errorText} setColor={titleColor}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          {!connectedDevice ? (
            <>
              <View style={styles.listHeader}>
                <ThemedText style={styles.listTitle} setColor={titleColor}>
                  {t("run.heartRate.modal.nearbyMonitors")}
                </ThemedText>
                <TouchableOpacity
                  disabled={isConnecting}
                  onPress={onRefresh}
                  style={styles.refreshButton}
                >
                  {isScanning ? (
                    <ActivityIndicator size="small" color={secondaryColor} />
                  ) : (
                    <Feather name="refresh-cw" size={17} color={secondaryColor} />
                  )}
                  <ThemedText
                    style={styles.refreshLabel}
                    setColor={secondaryColor}
                  >
                    {isScanning ? t("run.heartRate.modal.searching") : t("common.search")}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.deviceList}
                contentContainerStyle={styles.deviceListContent}
                showsVerticalScrollIndicator={false}
              >
                {devices.map((device) => (
                  <TouchableOpacity
                    key={device.id}
                    activeOpacity={0.82}
                    disabled={isConnecting}
                    onPress={() => onSelectDevice(device)}
                    style={[
                      styles.deviceRow,
                      { backgroundColor: innerSurface, borderColor },
                    ]}
                  >
                    <View style={styles.deviceIdentity}>
                      <View
                        style={[
                          styles.deviceIcon,
                          { backgroundColor: `${secondaryColor}22` },
                        ]}
                      >
                        <Feather name="activity" size={18} color={secondaryColor} />
                      </View>
                      <View style={styles.deviceCopy}>
                        <ThemedText style={styles.deviceName} setColor={titleColor}>
                          {device.name}
                        </ThemedText>
                        <ThemedText style={styles.deviceMeta} setColor={quietText}>
                          {device.rssi === null
                            ? t("run.heartRate.modal.genericDevice")
                            : t("run.heartRate.modal.signal", { rssi: device.rssi })}
                        </ThemedText>
                      </View>
                    </View>
                    {isConnecting ? (
                      <ActivityIndicator size="small" color={primaryColor} />
                    ) : (
                      <Feather name="chevron-right" size={19} color={quietText} />
                    )}
                  </TouchableOpacity>
                ))}

                {devices.length === 0 ? (
                  <View style={[styles.emptyState, { borderColor }] }>
                    {isScanning ? (
                      <ActivityIndicator color={secondaryColor} />
                    ) : (
                      <Feather name="bluetooth" size={25} color={quietText} />
                    )}
                    <ThemedText style={styles.emptyTitle} setColor={titleColor}>
                      {isScanning
                        ? t("run.heartRate.status.scanning")
                        : t("run.heartRate.modal.noMonitorFound")}
                    </ThemedText>
                    <ThemedText style={styles.emptyText} setColor={quietText}>
                      {t("run.heartRate.modal.emptyHint")}
                    </ThemedText>
                  </View>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
