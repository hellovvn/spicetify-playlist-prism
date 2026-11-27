// Small wrapper around Spicetify.LocalStorage for our saved settings.
//
// LocalStorage is a key/value store inside Spotify that survives restarts.
// It lives only on this computer: it is never synced, committed to git, or
// sent anywhere. That's why the user's own Last.fm API key goes here and not in code.
//
// All our keys start with "prism:" so they can't clash with other extensions.

import { chooseLastfmKey, type KeySource } from "./lastfm/keyChoice";

const LASTFM_KEY = "prism:lastfmKey";
// Prism's shared key, a copy of what the relay hands out (src/lastfm/sharedKey.ts).
const SHARED_LASTFM_KEY = "prism:sharedLastfmKey";

// The key Prism should use: the user's own one, else Prism's shared one (or null).
export function getLastfmKey(): string | null {
  return chooseLastfmKey(getOwnLastfmKey(), getSharedLastfmKey())?.key ?? null;
}

// Whose key getLastfmKey() returns ("own" / "prism"), or null when there's none.
export function getLastfmKeySource(): KeySource | null {
  return chooseLastfmKey(getOwnLastfmKey(), getSharedLastfmKey())?.source ?? null;
}

// The user's own key from Settings, or null if they haven't added one.
export function getOwnLastfmKey(): string | null {
  const key = Spicetify.LocalStorage.get(LASTFM_KEY);
  // Treat an empty or whitespace-only value the same as "not set".
  return key && key.trim() ? key.trim() : null;
}

export function setLastfmKey(key: string): void {
  Spicetify.LocalStorage.set(LASTFM_KEY, key.trim());
}

export function clearLastfmKey(): void {
  Spicetify.LocalStorage.remove(LASTFM_KEY);
}

export function getSharedLastfmKey(): string | null {
  const key = Spicetify.LocalStorage.get(SHARED_LASTFM_KEY);
  return key && key.trim() ? key.trim() : null;
}

export function saveSharedLastfmKey(key: string): void {
  Spicetify.LocalStorage.set(SHARED_LASTFM_KEY, key.trim());
}

// ----- Tag cache (see src/scan/tagCache.ts) -----
// One JSON text for all songs. About 300 bytes per song, so 1,000 songs is
// roughly 0.3 MB, well within LocalStorage's ~5 MB.

const TAG_CACHE_KEY = "prism:tagCache";

export function loadTagCacheText(): string | null {
  return Spicetify.LocalStorage.get(TAG_CACHE_KEY);
}

export function saveTagCacheText(json: string): void {
  try {
    Spicetify.LocalStorage.set(TAG_CACHE_KEY, json);
  } catch (error) {
    // Storage full or blocked: the scan still works, it just won't be cached.
    console.warn("[Prism] couldn't save the tag cache", error);
  }
}

// ----- Lyrics mood cache (see src/scan/moodCache.ts) -----
// Only mood profiles (a few numbers per song), never lyrics.

const MOOD_CACHE_KEY = "prism:moodCache";

export function loadMoodCacheText(): string | null {
  return Spicetify.LocalStorage.get(MOOD_CACHE_KEY);
}

export function saveMoodCacheText(json: string): void {
  try {
    Spicetify.LocalStorage.set(MOOD_CACHE_KEY, json);
  } catch (error) {
    console.warn("[Prism] couldn't save the mood cache", error);
  }
}

// ----- Prism playlist records (see src/stats/playlistStats.ts) -----
// How each Prism playlist was made (tags, counts), for the stats page.
// A few hundred bytes per playlist; never sent anywhere.

const PLAYLISTS_KEY = "prism:playlists";

export function loadPlaylistRecordsText(): string | null {
  return Spicetify.LocalStorage.get(PLAYLISTS_KEY);
}

export function savePlaylistRecordsText(json: string): void {
  try {
    Spicetify.LocalStorage.set(PLAYLISTS_KEY, json);
  } catch (error) {
    console.warn("[Prism] couldn't save the playlist record", error);
  }
}

// ----- Prism look for Spotify's lyrics (see src/ui/lyricsTheme.ts) -----
// "off" = Spotify's own lyrics look. Anything else (including never set) = on.

const LYRICS_THEME_KEY = "prism:lyricsTheme";

export function loadLyricsThemeSetting(): string | null {
  return Spicetify.LocalStorage.get(LYRICS_THEME_KEY);
}

export function saveLyricsThemeSetting(on: boolean): void {
  Spicetify.LocalStorage.set(LYRICS_THEME_KEY, on ? "on" : "off");
}

// ----- Prism stats in Spotify's right-hand panel (see src/ui/sidePanel.ts) -----
// "off" = the panel stays plain Spotify. Anything else (including never set) = on.

const PANEL_STATS_KEY = "prism:panelStats";

export function loadPanelStatsSetting(): string | null {
  return Spicetify.LocalStorage.get(PANEL_STATS_KEY);
}

export function savePanelStatsSetting(on: boolean): void {
  Spicetify.LocalStorage.set(PANEL_STATS_KEY, on ? "on" : "off");
}

// ----- Anonymous usage counts (see src/usage/featureStats.ts) -----
// prism:usageSharing: "off" = nothing is counted or sent. Anything else (never set) = on.
// prism:usageCounts: the counts waiting for the next daily send (src/usage/featureCounts.ts).

const USAGE_SHARING_KEY = "prism:usageSharing";
const USAGE_COUNTS_KEY = "prism:usageCounts";

export function loadUsageSharingSetting(): string | null {
  return Spicetify.LocalStorage.get(USAGE_SHARING_KEY);
}

export function saveUsageSharingSetting(on: boolean): void {
  Spicetify.LocalStorage.set(USAGE_SHARING_KEY, on ? "on" : "off");
}

export function loadUsageCountsText(): string | null {
  return Spicetify.LocalStorage.get(USAGE_COUNTS_KEY);
}

export function saveUsageCountsText(json: string): void {
  Spicetify.LocalStorage.set(USAGE_COUNTS_KEY, json);
}

export function clearUsageCounts(): void {
  Spicetify.LocalStorage.remove(USAGE_COUNTS_KEY);
}

// ----- Playlist theme (see src/theme/playlistTheme.ts) -----
// A PlaylistThemeId (src/theme/playlistTheme.ts), e.g. "nebula". Never set = no theme.

const PLAYLIST_THEME_KEY = "prism:playlistTheme";

// Themes for single playlists (14b): JSON map playlist URI -> theme id
// (parseThemeOverrides in src/theme/playlistTheme.ts). Local only.
const PLAYLIST_THEMES_KEY = "prism:playlistThemes";
export function loadPlaylistThemeOverrides(): string | null {
  return Spicetify.LocalStorage.get(PLAYLIST_THEMES_KEY);
}
export function savePlaylistThemeOverrides(json: string): void {
  Spicetify.LocalStorage.set(PLAYLIST_THEMES_KEY, json);
}

export function loadPlaylistThemeSetting(): string | null {
  return Spicetify.LocalStorage.get(PLAYLIST_THEME_KEY);
}

export function savePlaylistThemeSetting(id: string): void {
  Spicetify.LocalStorage.set(PLAYLIST_THEME_KEY, id);
}

// ----- Grow: how many songs to recommend (see PICK_COUNTS in src/scoring/rank.ts) -----
// "10", "30", "all"... Remembered so the next Prism starts with the same count.

const PICK_COUNT_KEY = "prism:growCount";

export function loadPickCountText(): string | null {
  return Spicetify.LocalStorage.get(PICK_COUNT_KEY);
}

export function savePickCountText(text: string): void {
  Spicetify.LocalStorage.set(PICK_COUNT_KEY, text);
}

// ----- Grow: how many NEW FINDS to tick (see NEW_COUNTS in src/discover/discover.ts) -----

const NEW_COUNT_KEY = "prism:growNewCount";

export function loadNewCountText(): string | null {
  return Spicetify.LocalStorage.get(NEW_COUNT_KEY);
}

export function saveNewCountText(text: string): void {
  Spicetify.LocalStorage.set(NEW_COUNT_KEY, text);
}

// ----- Playlist tones (see src/tone/tone.ts) -----
// The tone the user set for a playlist (genres, moods, tempo) and whether its
// Tone view is on. Keyed by playlist URI; ONLY here, never written to the playlist.

const TONES_KEY = "prism:tones";

export function loadTonesText(): string | null {
  return Spicetify.LocalStorage.get(TONES_KEY);
}

export function saveTonesText(json: string): void {
  try {
    Spicetify.LocalStorage.set(TONES_KEY, json);
  } catch (error) {
    console.warn("[Prism] couldn't save the playlist tones", error);
  }
}
