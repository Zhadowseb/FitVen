// Music during a workout, for the Friends activity tiles.
//
// One provider today, Spotify, connected with OAuth PKCE from Profile ->
// Settings -> Music. The tokens stay on the device in the secure store; the
// cloud only ever sees track names. Nothing is written unless the user has
// both connected a provider and switched "Share music with friends" on, and
// switching it off deletes what was written.
//
// Apple Music (MusicKit) has no Expo module and would need a native module of
// its own; the provider field and the table are ready for it.
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { t } from "@localization";
import { supabase } from "../Database/supaBaseClient";
import { workoutRepository } from "../Repository";

// expo-auth-session pulls in expo-web-browser and expo-crypto, and both throw
// at import time on a client whose native build predates them. Loaded on
// demand, so a development client built before 2.0 still runs the rest of
// the app and Spotify simply reports itself unavailable.
let nativeAuth;

function getNativeAuth() {
  if (nativeAuth === undefined) {
    try {
      nativeAuth = {
        AuthSession: require("expo-auth-session"),
        WebBrowser: require("expo-web-browser"),
      };
    } catch (error) {
      console.warn("Spotify is unavailable in this build:", error?.message ?? error);
      nativeAuth = null;
    }
  }

  return nativeAuth;
}

/** False on a client built without expo-web-browser and expo-crypto. */
export function isSpotifyAvailableInThisBuild() {
  return getNativeAuth() !== null;
}

export const MUSIC_PROVIDER_SPOTIFY = "spotify";
export const NOW_PLAYING_POLL_MS = 30000;
// A row younger than this on a live workout is "playing". The poller touches
// the newest row every 30 s while the same track keeps going.
export const NOW_PLAYING_FRESHNESS_MS = 90000;
export const SPOTIFY_NOT_CONFIGURED_MESSAGE =
  "Spotify is not configured for this build. Add spotifyClientId under expo.extra in app.json (or EXPO_PUBLIC_SPOTIFY_CLIENT_ID), register fitven://spotify-auth as a redirect URI in the Spotify dashboard, and rebuild.";

const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
};
const SPOTIFY_SCOPES = ["user-read-currently-playing", "user-read-playback-state"];
const SPOTIFY_NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track";
const SPOTIFY_ME_URL = "https://api.spotify.com/v1/me";
const TOKEN_STORE_KEY = "fitven.music.spotify";
const PROFILE_PRIVATE_TABLE = "profile_private";
const WORKOUT_MUSIC_TABLE = "workout_music";
const WORKOUT_MUSIC_SETUP_MESSAGE =
  "Music sharing is not set up in Supabase yet. Run supabase/migrations/20260917120100_workout-music.sql in the Supabase SQL editor first.";
const SETTINGS_CACHE_MS = 60000;

function normalizeMusicError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();

  if (
    (message.includes(WORKOUT_MUSIC_TABLE) || message.includes("share_music_with_friends")) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  ) {
    return new Error(WORKOUT_MUSIC_SETUP_MESSAGE);
  }

  return error instanceof Error
    ? error
    : new Error(String(error?.message ?? t("music.errors.failed")));
}

/* -------------------------------------------------------- configuration -- */

export function getSpotifyClientId() {
  return (
    Constants.expoConfig?.extra?.spotifyClientId ??
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ??
    null
  );
}

export function isSpotifyConfigured() {
  return Boolean(getSpotifyClientId());
}

export function getSpotifyRedirectUri() {
  const native = getNativeAuth();

  return native
    ? native.AuthSession.makeRedirectUri({ scheme: "fitven", path: "spotify-auth" })
    : "fitven://spotify-auth";
}

/* --------------------------------------------------------------- tokens -- */

async function readTokens() {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_STORE_KEY);

    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Could not read the music connection:", error);
    return null;
  }
}

async function writeTokens(tokens) {
  await SecureStore.setItemAsync(TOKEN_STORE_KEY, JSON.stringify(tokens));
}

async function clearTokens() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_STORE_KEY);
  } catch {
    // Already gone is the state we wanted.
  }
}

function storeTokenResponse(response, previous = null) {
  const expiresInMs = (response?.expiresIn ?? 3600) * 1000;

  return {
    provider: MUSIC_PROVIDER_SPOTIFY,
    accessToken: response?.accessToken ?? null,
    refreshToken: response?.refreshToken ?? previous?.refreshToken ?? null,
    // A minute early, so a token never expires between the check and the call.
    expiresAt: Date.now() + expiresInMs - 60000,
    connectedAt: previous?.connectedAt ?? new Date().toISOString(),
    accountName: previous?.accountName ?? null,
  };
}

async function getValidAccessToken() {
  const tokens = await readTokens();

  if (!tokens?.refreshToken) {
    return null;
  }

  if (tokens.accessToken && tokens.expiresAt > Date.now()) {
    return tokens.accessToken;
  }

  const clientId = getSpotifyClientId();
  const native = getNativeAuth();

  if (!clientId || !native) {
    return null;
  }

  try {
    const refreshed = await native.AuthSession.refreshAsync(
      { clientId, refreshToken: tokens.refreshToken },
      SPOTIFY_DISCOVERY
    );
    const next = storeTokenResponse(refreshed, tokens);

    await writeTokens(next);

    return next.accessToken;
  } catch (error) {
    console.warn("Spotify token refresh failed:", error);
    return null;
  }
}

/* ----------------------------------------------------------- connection -- */

/** { provider, connectedAt, accountName } or null. */
export async function getMusicConnection() {
  const tokens = await readTokens();

  if (!tokens?.refreshToken) {
    return null;
  }

  return {
    provider: tokens.provider ?? MUSIC_PROVIDER_SPOTIFY,
    connectedAt: tokens.connectedAt ?? null,
    accountName: tokens.accountName ?? null,
  };
}

/**
 * Opens Spotify's consent page and stores the tokens. Resolves with
 * { connected: false, cancelled: true } when the user backs out, so the
 * settings screen can stay quiet about it.
 */
export async function connectSpotify() {
  const native = getNativeAuth();

  if (!native) {
    // Translated here, at the moment it is thrown, so the settings screen can
    // show error.message as it is. The same key is what that screen prints
    // when it finds the build unavailable before anyone taps Connect.
    throw new Error(t("music.errors.notInBuild"));
  }

  const clientId = getSpotifyClientId();

  if (!clientId) {
    throw new Error(SPOTIFY_NOT_CONFIGURED_MESSAGE);
  }

  const { AuthSession, WebBrowser } = native;

  WebBrowser.maybeCompleteAuthSession();

  const redirectUri = getSpotifyRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SPOTIFY_SCOPES,
    redirectUri,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
  });
  const result = await request.promptAsync(SPOTIFY_DISCOVERY);

  if (result.type !== "success" || !result.params?.code) {
    return { connected: false, cancelled: true };
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier },
    },
    SPOTIFY_DISCOVERY
  );
  const tokens = storeTokenResponse(tokenResponse);

  try {
    const me = await fetch(SPOTIFY_ME_URL, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (me.ok) {
      const profile = await me.json();

      tokens.accountName = profile?.display_name ?? profile?.id ?? null;
    }
  } catch {
    // The name is decoration on the settings row.
  }

  await writeTokens(tokens);
  invalidateSettingsCache();

  return { connected: true, accountName: tokens.accountName };
}

/** Forgets the tokens and switches sharing off, so nothing keeps being written. */
export async function disconnectMusic({ user } = {}) {
  await clearTokens();
  publishNowPlaying(null);
  invalidateSettingsCache();

  if (user?.id) {
    try {
      await setMusicSharingEnabled({ user, enabled: false });
    } catch (error) {
      console.warn("Could not switch music sharing off:", error);
    }
  }
}

/* ---------------------------------------------------------- now playing -- */

/**
 * What Spotify says is on right now, or null when nothing is, when the
 * connection is gone, or when the answer is not a track.
 */
export async function fetchNowPlaying() {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(SPOTIFY_NOW_PLAYING_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 204 || response.status === 202 || response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Spotify answered ${response.status}.`);
  }

  const payload = await response.json();
  const item = payload?.item;

  if (!item || (payload?.currently_playing_type ?? "track") !== "track") {
    return null;
  }

  return {
    provider: MUSIC_PROVIDER_SPOTIFY,
    track: item.name ?? null,
    artist:
      (item.artists ?? [])
        .map((artist) => artist?.name)
        .filter(Boolean)
        .join(", ") || null,
    artUrl: item.album?.images?.[0]?.url ?? null,
    trackUri: item.uri ?? null,
    isPlaying: Boolean(payload?.is_playing),
    fetchedAt: Date.now(),
  };
}

// The viewer's own now-playing, for their own tile. Module state rather than
// a context so the poller and the Home screen need no shared provider.
let currentNowPlaying = null;
const nowPlayingListeners = new Set();

export function getCurrentNowPlaying() {
  return currentNowPlaying;
}

export function subscribeNowPlaying(listener) {
  nowPlayingListeners.add(listener);

  return () => {
    nowPlayingListeners.delete(listener);
  };
}

function publishNowPlaying(next) {
  currentNowPlaying = next;

  for (const listener of nowPlayingListeners) {
    try {
      listener(next);
    } catch (error) {
      console.warn("Now playing listener failed:", error);
    }
  }
}

/* ------------------------------------------------------------- settings -- */

let settingsCache = null;

function invalidateSettingsCache() {
  settingsCache = null;
}

export async function getMusicSharingSettings({ user }) {
  const connection = await getMusicConnection();
  let shareWithFriends = false;

  if (user?.id) {
    const { data, error } = await supabase
      .from(PROFILE_PRIVATE_TABLE)
      .select("share_music_with_friends")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw normalizeMusicError(error);
    }

    shareWithFriends = Boolean(data?.share_music_with_friends);
  }

  return {
    connection,
    shareWithFriends,
    isConfigured: isSpotifyConfigured(),
    isAvailable: isSpotifyAvailableInThisBuild(),
    redirectUri: getSpotifyRedirectUri(),
  };
}

async function getCachedSharingSettings(user) {
  if (
    settingsCache &&
    settingsCache.userId === user.id &&
    Date.now() - settingsCache.fetchedAt < SETTINGS_CACHE_MS
  ) {
    return settingsCache.value;
  }

  const value = await getMusicSharingSettings({ user });

  settingsCache = { userId: user.id, value, fetchedAt: Date.now() };

  return value;
}

/**
 * The "Share music with friends" toggle. Off deletes every row the user has
 * written: a toggle that only stops future writes would leave the last track
 * on their finished workouts for as long as those stay in the feed.
 */
export async function setMusicSharingEnabled({ user, enabled }) {
  if (!user?.id) {
    throw new Error(t("music.errors.signInToChangeSharing"));
  }

  const { error } = await supabase.from(PROFILE_PRIVATE_TABLE).upsert(
    {
      user_id: user.id,
      share_music_with_friends: Boolean(enabled),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw normalizeMusicError(error);
  }

  invalidateSettingsCache();

  if (!enabled) {
    publishNowPlaying(null);
    lastRecorded = null;

    const { error: deleteError } = await supabase
      .from(WORKOUT_MUSIC_TABLE)
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      throw normalizeMusicError(deleteError);
    }
  }
}

/* --------------------------------------------------------------- poller -- */

let lastRecorded = null;

/**
 * One tick of the now-playing poller, run by src/Sync/WorkoutMusicSync.js
 * every 30 s while the app is in the foreground. Publishes the viewer's own
 * track for their tile, and writes it to workout_music for their followers
 * when a workout is running and sharing is on. Nothing here throws to the
 * caller; a failed poll is a quiet tile, not a broken app.
 */
export async function pollWorkoutMusic(db, { user }) {
  if (!user?.id) {
    publishNowPlaying(null);
    return { skipped: "signed_out" };
  }

  let settings;

  try {
    settings = await getCachedSharingSettings(user);
  } catch (error) {
    console.warn("Could not read music settings:", error);
    return { skipped: "settings_unavailable" };
  }

  if (!settings.connection || !settings.shareWithFriends) {
    publishNowPlaying(null);
    return { skipped: "sharing_off" };
  }

  const activeWorkout = await workoutRepository.getActiveWorkoutTimer(db);

  if (!activeWorkout?.workout_id) {
    publishNowPlaying(null);
    lastRecorded = null;
    return { skipped: "no_live_workout" };
  }

  let nowPlaying = null;

  try {
    nowPlaying = await fetchNowPlaying();
  } catch (error) {
    console.warn("Could not read now playing:", error);
    return { skipped: "provider_unavailable" };
  }

  if (!nowPlaying?.track) {
    publishNowPlaying(null);
    return { skipped: "nothing_playing" };
  }

  publishNowPlaying({
    track: nowPlaying.track,
    artist: nowPlaying.artist,
    artUrl: nowPlaying.artUrl,
    provider: nowPlaying.provider,
    state: nowPlaying.isPlaying ? "playing" : "last",
  });

  if (!nowPlaying.isPlaying) {
    return { recorded: false, reason: "paused" };
  }

  const match = await workoutRepository.getWorkoutGymMatch(db, activeWorkout.workout_id);
  const cloudWorkoutId = Number(match?.cloud_workout_type_instance_id);

  if (!Number.isFinite(cloudWorkoutId) || cloudWorkoutId <= 0) {
    // The workout has not synced yet; the next tick will find the id.
    return { recorded: false, reason: "not_synced" };
  }

  const trackKey = nowPlaying.trackUri ?? `${nowPlaying.track}|${nowPlaying.artist ?? ""}`;
  const playedAt = new Date().toISOString();

  try {
    if (
      lastRecorded &&
      lastRecorded.cloudWorkoutId === cloudWorkoutId &&
      lastRecorded.trackKey === trackKey &&
      lastRecorded.rowId
    ) {
      const { error } = await supabase
        .from(WORKOUT_MUSIC_TABLE)
        .update({ played_at: playedAt })
        .eq("id", lastRecorded.rowId)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      return { recorded: true, touched: true };
    }

    const { data, error } = await supabase
      .from(WORKOUT_MUSIC_TABLE)
      .insert({
        user_id: user.id,
        workout_type_instance_id: cloudWorkoutId,
        provider: nowPlaying.provider,
        track: nowPlaying.track,
        artist: nowPlaying.artist,
        art_url: nowPlaying.artUrl,
        track_uri: nowPlaying.trackUri,
        played_at: playedAt,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    lastRecorded = { cloudWorkoutId, trackKey, rowId: data?.id ?? null };

    return { recorded: true, touched: false };
  } catch (error) {
    console.warn("Could not record workout music:", normalizeMusicError(error));
    lastRecorded = null;
    return { recorded: false, reason: "write_failed" };
  }
}
