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
      <View style={styles.overlay}>
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
                BLUETOOTH HEART RATE
              </ThemedText>
              <ThemedText style={styles.title} setColor={titleColor}>
                Connect your HRM-Pro
              </ThemedText>
              <ThemedText style={styles.subtitle} setColor={quietText}>
                Wear the strap while FitVen searches for nearby monitors.
              </ThemedText>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close heart rate monitor setup"
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
                    Connected and receiving live heart rate
                  </ThemedText>
                </View>
              </View>
              <TouchableOpacity onPress={onDisconnect} style={styles.textButton}>
                <ThemedText style={styles.textButtonLabel} setColor={primaryColor}>
                  Disconnect
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
                  Nearby monitors
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
                    {isScanning ? "Searching" : "Search"}
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
                            ? "Bluetooth heart rate monitor"
                            : `Signal ${device.rssi} dBm`}
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
                      {isScanning ? "Looking for your HRM-Pro" : "No monitor found"}
                    </ThemedText>
                    <ThemedText style={styles.emptyText} setColor={quietText}>
                      Wet the electrodes, put the strap on, and keep it close to
                      your phone.
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.58)",
  },
  sheet: {
    maxHeight: "82%",
    minHeight: 470,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    marginTop: 10,
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 5,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 7,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  connectedCard: {
    marginTop: 22,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 13,
  },
  deviceIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceCopy: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: "900",
  },
  deviceMeta: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  textButton: {
    alignSelf: "flex-start",
    paddingVertical: 3,
  },
  textButtonLabel: {
    fontSize: 13,
    fontWeight: "900",
  },
  errorCard: {
    marginTop: 16,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  listHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  refreshButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 4,
  },
  refreshLabel: {
    fontSize: 13,
    fontWeight: "900",
  },
  deviceList: {
    flexGrow: 0,
  },
  deviceListContent: {
    gap: 10,
    paddingBottom: 8,
  },
  deviceRow: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyState: {
    minHeight: 190,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },
});
