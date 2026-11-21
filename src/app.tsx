// Playlist Prism: entry point.
// Spicetify Creator bundles this file (and anything it imports) into
// playlist-prism.js, which Spotify loads at startup.

import { getTrackInfo } from "./spotify/read";
import { getArtistTopTags, getTrackTopTags, LastfmError } from "./lastfm/client";
import { getLastfmKey } from "./storage";
import { openSettings } from "./ui/SettingsModal";
import { cleanTags } from "./tags/cleanTags";
import { titleVariants } from "./tags/titleVariants";
import { getSongTags, type TagFetchers } from "./tags/getSongTags";
import { formatAudio, getAudioAttributes } from "./spotify/audio";
import { openSeedPanel, type SeedData } from "./ui/SeedPanel";
import { injectStyles } from "./ui/styles";

// The REAL Last.fm fetchers for getSongTags (unit tests pass fakes instead).
function lastfmFetchers(apiKey: string): TagFetchers {
  return {
    fetchTrackTags: async (artist, title) => (await getTrackTopTags(artist, title, apiKey)).tags,
    fetchArtistTags: (artist) => getArtistTopTags(artist, apiKey),
  };
}

// A prefix for console logs, so ours are easy to filter in DevTools.
const LOG_PREFIX = "[Playlist Prism]";

async function main() {
  // Extensions can start running before Spotify's UI and the Spicetify APIs
  // are ready. Wait (checking every 100 ms) until the APIs we use exist.
  while (!Spicetify?.showNotification || !Spicetify?.ContextMenu || !Spicetify?.Menu || !Spicetify?.LocalStorage) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  injectStyles(); // popup animations
  registerContextMenu();
  registerSettingsMenu();
  exposeDebugHook();

  console.log(`${LOG_PREFIX} loaded`);
}

// Makes a few READ-ONLY functions callable from outside the extension, so
// the smoke-test script (scripts/smoke.mjs) can test them inside Spotify
// through the debug port. Nothing here can change the user's Spotify, and
// the API key itself is never exposed (only whether one is saved).
// TODO before publishing: remove this or hide it behind a dev-only flag.
function exposeDebugHook() {
  (window as any).__playlistPrism = {
    isSingleTrack,
    getTrackInfo,
    cleanTags,
    titleVariants,
    openSettings,
    // Runs the same thing as clicking "Start a Prism playlist" (reads only, opens the panel).
    startPrism: (uri: string) => onStartPrism([uri]),
    // BPM/key for some songs. Returns a plain object (a Map can't cross the debug port).
    getAudioAttributes: async (uris: string[]) => {
      const plain: Record<string, unknown> = {};
      (await getAudioAttributes(uris)).forEach((audio, uri) => (plain[uri] = audio));
      return plain;
    },
    hasLastfmKey: () => getLastfmKey() !== null,
    // Uses the saved key internally so the caller never sees it.
    getTrackTopTags: (artist: string, track: string) => {
      const key = getLastfmKey();
      if (!key) throw new Error("No Last.fm key saved");
      return getTrackTopTags(artist, track, key);
    },
    // The full chain (title retries + artist fallback) for one song.
    getSongTags: (song: { name: string; artists: string[] }) => {
      const key = getLastfmKey();
      if (!key) throw new Error("No Last.fm key saved");
      return getSongTags(song, lastfmFetchers(key));
    },
  };
}

// Adds "Start a Prism playlist" to the right-click menu, for songs only.
function registerContextMenu() {
  const item = new Spicetify.ContextMenu.Item(
    "Start a Prism playlist", // the menu label
    onStartPrism, // what to do when it's clicked
    isSingleTrack, // decides whether the item appears in this menu
    "playlist" // icon, from Spicetify's built-in icon list
  );
  // An Item only shows up in menus after register() is called.
  item.register();
}

// Adds "Playlist Prism settings" to the profile menu (click your avatar,
// top right). Spicetify.Menu.Item is meant for on/off toggles, so we pass
// isEnabled = false and just use the click to open the settings popup.
function registerSettingsMenu() {
  new Spicetify.Menu.Item("Playlist Prism settings", false, () => openSettings()).register();
}

// "shouldAdd" check: Spotify calls this every time a right-click menu opens,
// passing the URIs of what was right-clicked. Returning false hides our item.
// We want exactly one song (not an album, artist, playlist, or a
// multi-selection of several songs).
function isSingleTrack(uris: string[]): boolean {
  return uris.length === 1 && Spicetify.URI.isTrack(uris[0]);
}

// Runs when the user clicks "Start a Prism playlist".
function onStartPrism(uris: string[]) {
  const uri = uris[0];

  // No key yet? Explain and open settings instead of failing later.
  const apiKey = getLastfmKey();
  if (!apiKey) {
    Spicetify.showNotification("Playlist Prism: add your Last.fm API key first");
    openSettings();
    return;
  }

  // Open the panel RIGHT AWAY (it shows a spinner); it calls loadSeed itself.
  openSeedPanel({
    load: () => loadSeed(uri, apiKey),
    describeError: friendlyError,
    // "Next" will open the playlist picker in step 6; for now it logs what was kept.
    onNext: (kept) => {
      console.log(`${LOG_PREFIX} kept tags: ${kept.map((tag) => tag.name).join(", ") || "(none)"}`);
      Spicetify.PopupModal.hide();
      Spicetify.showNotification(`Kept ${kept.length} tags. Choosing playlists comes in step 6.`);
    },
  });
}

// Everything the seed panel needs: song details, tags, BPM/key.
// If anything fails, the error goes back to the panel, which shows friendlyError().
async function loadSeed(uri: string, apiKey: string): Promise<SeedData> {
  // Step 1: song details from Spotify.
  const track = await getTrackInfo(uri);
  console.log(`${LOG_PREFIX} seed song: ${track.name} - ${track.artists.join(", ")}`);

  // Step 2 (in parallel): Last.fm tags AND Spotify's BPM/key.
  // Promise.all starts both requests at once and waits for both, which is
  // faster than doing one after the other.
  // getSongTags: tries cleaned titles, cleans the tags, and falls back to
  // the artist's tags when the song has few.
  const [result, audioMap] = await Promise.all([
    getSongTags(track, lastfmFetchers(apiKey)),
    getAudioAttributes([uri]),
  ]);
  const audio = audioMap.get(uri) ?? null;

  // Each log line starts with our prefix so the console filter keeps it.
  console.log(`${LOG_PREFIX} bpm/key: ${formatAudio(audio)}`);
  console.log(`${LOG_PREFIX} titles tried: ${JSON.stringify(result.titlesTried)}`);
  console.log(`${LOG_PREFIX} matched title: ${result.matchedTitle ?? "(none: no song-level tags)"}`);
  console.log(`${LOG_PREFIX} used artist tags: ${result.usedArtistTags ? "yes" : "no"}`);
  const tagList = result.tags
    .map((tag) => `${tag.name} (${tag.weight.toFixed(2)}${tag.source === "artist" ? ", via artist" : ""})`)
    .join(", ");
  console.log(`${LOG_PREFIX} tags: ${tagList || "(none)"}`);

  return { track, tags: result.tags, audio };
}

// Turns known errors into messages a user can act on (shown inside the panel).
// (Last.fm error 6 "not found" never gets here: getSongTags treats it as "no tags".)
function friendlyError(error: unknown): string {
  if (error instanceof LastfmError && (error.code === 10 || error.code === 26)) {
    return "Last.fm API key problem: check Playlist Prism settings (profile menu).";
  }
  if (error instanceof LastfmError && error.code === 29) {
    return "Last.fm rate limit hit: wait a minute and try again.";
  }
  return "Something went wrong reading this song. Details are in the console.";
}

export default main;
