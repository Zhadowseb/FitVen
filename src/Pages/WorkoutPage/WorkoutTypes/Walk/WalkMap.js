import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Linking, View, useColorScheme } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { Colors, withAlpha } from "../../../../Resources/GlobalStyling/colors";
import { ThemedButton, ThemedText } from "../../../../Resources/ThemedComponents";
import { useTranslation } from "@localization";

import styles from "./WalkStyle";

// The map card of a walk: the route so far in the accent's green with a soft
// wider line under it, a ring where it started, and an orange dot for where
// you are with a ring that pulses. The camera follows you, so the dot stays in
// the middle of the card and the map cannot be dragged away from it.
//
// A finished walk is a map to look at, not a camera that follows: it shows the
// whole route, can be dragged and zoomed, and has no "you are here" dot - the
// route ends at a ring instead.
//
// With nothing to draw (the walk has not started, the position is still being
// found, or location is not allowed) the card says so in one line, and offers
// the one button that fixes it.

const FOLLOW_EVERY_MS = 1500;
const REGION_DELTA = 0.004;

const isHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

// Google's map takes a style in hex; the iOS map follows the colour scheme.
function buildMapStyle(theme) {
  const ground = isHex(theme.uiBackground) ? theme.uiBackground : null;
  const road = isHex(theme.cardBackground) ? theme.cardBackground : null;
  const label = isHex(theme.quietText) ? theme.quietText : null;
  const water = isHex(theme.background) ? theme.background : null;

  if (!ground || !road || !label || !water) {
    return undefined;
  }

  return [
    { elementType: "geometry", stylers: [{ color: ground }] },
    { elementType: "labels.text.fill", stylers: [{ color: label }] },
    { elementType: "labels.text.stroke", stylers: [{ color: ground }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: road }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: water }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ];
}

function PulsingDot({ color, ringColor, animate }) {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      ring.setValue(0);
      return undefined;
    }

    ring.setValue(0);

    const loop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    loop.start();

    return () => loop.stop();
  }, [animate, ring]);

  return (
    <View style={styles.hereAnchor} pointerEvents="none">
      {animate ? (
        <Animated.View
          style={[
            styles.hereRing,
            {
              backgroundColor: color,
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
              transform: [
                { scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.6] }) },
              ],
            },
          ]}
        />
      ) : null}
      <View style={[styles.hereDot, { backgroundColor: color, borderColor: ringColor }]} />
    </View>
  );
}

// `mode` is what the card has to say: "map" draws the route, the rest are the
// four reasons there is none.
function WalkMap({
  route,
  fix,
  startLabel,
  mode,
  onAllowLocation,
  onLoadWatchRoute,
  watchRouteTried,
  reduceMotion,
  finished = false,
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const mapRef = useRef(null);
  const lastFollowRef = useRef(0);
  const [tracksMarker, setTracksMarker] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const mapStyle = useMemo(() => buildMapStyle(theme), [theme]);
  const green = theme.secondary ?? theme.primary;
  const orange = theme.primary;
  const startPoint = useMemo(() => {
    const first = route.find((segment) => segment.length > 0);

    return first ? first[0] : null;
  }, [route]);
  const initialRegion = useMemo(
    () =>
      fix
        ? {
            latitude: fix.latitude,
            longitude: fix.longitude,
            latitudeDelta: REGION_DELTA,
            longitudeDelta: REGION_DELTA,
          }
        : undefined,
    // Only read once, by the map as it is created: later fixes move the camera.
    [mode === "map"]
  );

  // The corners of everything the walk drew, to fit the camera to. Two
  // coordinates are enough, however many points the route has.
  const routeBounds = useMemo(() => {
    let south = Infinity;
    let north = -Infinity;
    let west = Infinity;
    let east = -Infinity;

    for (const segment of route) {
      for (const point of segment) {
        south = Math.min(south, point.latitude);
        north = Math.max(north, point.latitude);
        west = Math.min(west, point.longitude);
        east = Math.max(east, point.longitude);
      }
    }

    return Number.isFinite(south)
      ? [
          { latitude: south, longitude: west },
          { latitude: north, longitude: east },
        ]
      : null;
  }, [route]);
  const endPoint = useMemo(() => {
    for (let index = route.length - 1; index >= 0; index -= 1) {
      if (route[index].length > 0) {
        return route[index][route[index].length - 1];
      }
    }

    return null;
  }, [route]);

  // Once the map is there, a finished walk is shown whole.
  useEffect(() => {
    if (!finished || mode !== "map" || !mapReady || !routeBounds) {
      return;
    }

    mapRef.current?.fitToCoordinates(routeBounds, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: false,
    });
  }, [finished, mode, mapReady, routeBounds]);

  // A marker is drawn from a view, and is only taken as a picture once; leaving
  // it to track changes forever costs a frame a second.
  useEffect(() => {
    const timeout = setTimeout(() => setTracksMarker(false), 600);

    return () => clearTimeout(timeout);
  }, [Boolean(startPoint)]);

  useEffect(() => {
    if (!fix || mode !== "map" || finished) {
      return;
    }

    const now = Date.now();

    if (now - lastFollowRef.current < FOLLOW_EVERY_MS) {
      return;
    }

    lastFollowRef.current = now;
    mapRef.current?.animateCamera({ center: fix }, { duration: 400 });
  }, [fix, mode, finished]);

  const cardStyle = [
    styles.mapCard,
    finished && styles.mapCardFinished,
    { backgroundColor: theme.uiBackground, borderColor: theme.cardBorder },
  ];

  if (mode !== "map") {
    const message =
      mode === "denied"
        ? t("walk.map.denied")
        : mode === "blocked"
          ? t("walk.map.blocked")
          : mode === "waiting"
            ? t("walk.map.waitingForFix")
            : mode === "noRoute"
              ? onLoadWatchRoute
                ? watchRouteTried
                  ? t("walk.map.watchRouteTried")
                  : t("walk.map.noRouteWatch")
                : t("walk.map.noRoute")
              : t("walk.map.notStarted");
    const action =
      mode === "denied"
        ? { title: t("walk.map.allow"), onPress: onAllowLocation }
        : mode === "blocked"
          ? { title: t("walk.map.openSettings"), onPress: () => Linking.openSettings() }
          : mode === "noRoute" && onLoadWatchRoute
            ? { title: t("walk.map.loadWatchRoute"), onPress: onLoadWatchRoute }
            : null;

    return (
      <View style={cardStyle}>
        <View style={styles.mapEmpty}>
          <ThemedText style={styles.mapEmptyText} setColor={theme.quietText}>
            {message}
          </ThemedText>
          {action ? (
            <ThemedButton title={action.title} onPress={action.onPress} style={styles.mapEmptyButton} />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={cardStyle}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("walk.map.label")}
    >
      <MapView
        ref={mapRef}
        style={styles.mapFill}
        initialRegion={initialRegion}
        customMapStyle={mapStyle}
        userInterfaceStyle={colorScheme === "dark" ? "dark" : "light"}
        onMapReady={() => setMapReady(true)}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={finished}
        zoomEnabled={finished}
        zoomControlEnabled={finished}
        zoomTapEnabled={finished}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {route.map((segment, index) =>
          segment.length > 1 ? (
            <Polyline
              key={`glow:${index}`}
              coordinates={segment}
              strokeColor={withAlpha(green, 0.25)}
              strokeWidth={12}
              lineCap="round"
              lineJoin="round"
            />
          ) : null
        )}
        {route.map((segment, index) =>
          segment.length > 1 ? (
            <Polyline
              key={`line:${index}`}
              coordinates={segment}
              strokeColor={green}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
            />
          ) : null
        )}
        {startPoint ? (
          <Marker
            coordinate={startPoint}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksMarker}
          >
            <View
              style={[
                styles.startDot,
                { backgroundColor: theme.background, borderColor: theme.title },
              ]}
            />
          </Marker>
        ) : null}
        {finished && endPoint ? (
          <Marker
            coordinate={endPoint}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksMarker}
          >
            <View style={[styles.endDot, { backgroundColor: orange, borderColor: theme.title }]} />
          </Marker>
        ) : null}
      </MapView>

      {finished ? null : (
        <PulsingDot color={orange} ringColor={theme.title} animate={!reduceMotion} />
      )}

      {startLabel ? (
        <View
          style={[styles.mapLabel, { backgroundColor: withAlpha(theme.background, 0.8) }]}
          pointerEvents="none"
        >
          <ThemedText style={styles.mapLabelText} setColor={theme.text}>
            {startLabel}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export default memo(WalkMap);
