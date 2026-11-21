// Small wrapper around Spicetify.LocalStorage for our saved settings.
//
// LocalStorage is a key/value store inside Spotify that survives restarts.
// It lives only on this computer: it is never synced, committed to git, or
// sent anywhere. That's why the Last.fm API key goes here and not in code.
//
// All our keys start with "prism:" so they can't clash with other extensions.

const LASTFM_KEY = "prism:lastfmKey";

// Returns the saved key, or null if none has been saved yet.
export function getLastfmKey(): string | null {
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
    console.warn("[Playlist Prism] couldn't save the tag cache", error);
  }
}
