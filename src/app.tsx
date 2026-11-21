// Playlist Prism: entry point.
// Spicetify Creator bundles this file (and anything it imports) into
// playlist-prism.js, which Spotify loads at startup.

import { getSources, getSourceTracks, getTrackInfo } from "./spotify/read";
import { getArtistTopTags, getTrackTopTags, LastfmError } from "./lastfm/client";
import { getLastfmKey, loadTagCacheText, saveTagCacheText } from "./storage";
import { mergeTracks } from "./scan/tracks";
import { scanSongs, shareArtistLookups, type ScanProgress } from "./scan/scan";
import { createRateLimiter, realClock } from "./scan/limits";
import { TagCache } from "./scan/tagCache";
import type { SourceOption } from "./sources/sources";
import { openScanPreview, type ScanOutcome } from "./ui/ScanScreen";
import { openSettings } from "./ui/SettingsModal";
import { cleanTags } from "./tags/cleanTags";
import { titleVariants } from "./tags/titleVariants";
import { getSongTags, type TagFetchers } from "./tags/getSongTags";
import { formatAudio, getAudioAttributes } from "./spotify/audio";
import { openSeedPanel, type SeedData } from "./ui/SeedPanel";
import { injectStyles } from "./ui/styles";

// The REAL Last.fm fetchers for getSongTags (unit tests pass fakes instead).
// `wait` (optional) is a rate limiter: awaited before every request.
function lastfmFetchers(apiKey: string, wait: () => Promise<void> = async () => {}): TagFetchers {
  return {
    fetchTrackTags: async (artist, title) => {
      await wait();
      return (await getTrackTopTags(artist, title, apiKey)).tags;
    },
    fetchArtistTags: async (artist) => {
      await wait();
      return getArtistTopTags(artist, apiKey);
    },
  };
}

// Last.fm asks for about 5 requests per second at most; stay a bit under.
const LASTFM_REQUESTS_PER_SECOND = 4;

const isKeyProblem = (error: unknown) => error instanceof LastfmError && (error.code === 10 || error.code === 26);
const isRateLimit = (error: unknown) => error instanceof LastfmError && error.code === 29;

// Step 7: read every song in the chosen sources, then get tags + BPM/key.
// READ-ONLY: the sources are only read.
async function runScan(
  sources: SourceOption[],
  onProgress: (progress: ScanProgress) => void,
  shouldStop: () => boolean
): Promise<ScanOutcome> {
  const apiKey = getLastfmKey();
  if (!apiKey) throw new LastfmError(10, "No Last.fm key saved");

  // All playlists at once; each is one fast Spotify request.
  const lists = await Promise.all(sources.map((source) => getSourceTracks(source.uri)));
  const { tracks, duplicates } = mergeTracks(lists);
  console.log(`${LOG_PREFIX} scanning ${tracks.length} songs (${duplicates} duplicates removed)`);
  onProgress({ done: 0, total: tracks.length, fromCache: 0, failed: 0 });

  const fetchers = shareArtistLookups(lastfmFetchers(apiKey, createRateLimiter(LASTFM_REQUESTS_PER_SECOND)));
  const cache = new TagCache(loadTagCacheText());
  const started = Date.now();
  const result = await scanSongs(
    tracks,
    {
      getAudio: getAudioAttributes,
      getTags: (song) => getSongTags(song, fetchers),
      cache,
      saveCache: () => saveTagCacheText(cache.toJSON(Date.now())),
      clock: realClock,
      isFatal: isKeyProblem,
      isRateLimit,
    },
    onProgress,
    shouldStop
  );
  console.log(
    `${LOG_PREFIX} scan ${result.cancelled ? "cancelled" : "finished"}: ${result.songs.length} songs in ${Math.round(
      (Date.now() - started) / 1000
    )} s`
  );
  return { ...result, duplicates };
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
    // Scan screen with a fake, hand-driven scan (layout tests). Nothing is scanned.
    previewScan: () => {
      const setProgress = openScanPreview();
      (window as any).__playlistPrism.setPreviewProgress = setProgress;
    },
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
    loadSources: getSources,
    runScan,
    describeError: friendlyError,
    // Creating the playlist is step 9; for now, log what would go in it.
    onDone: ({ seed, kept, sources, songs }) => {
      console.log(`${LOG_PREFIX} seed: ${seed.track.name}`);
      console.log(`${LOG_PREFIX} kept tags: ${kept.map((tag) => tag.name).join(", ")}`);
      console.log(`${LOG_PREFIX} sources: ${sources.map((s) => s.name).join(", ")}`);
      console.log(
        `${LOG_PREFIX} picked ${songs.length} songs: ` +
          songs.map((s) => `${s.name} (${Math.round(s.match.score * 100)}%)`).join(", ")
      );
      Spicetify.PopupModal.hide();
      Spicetify.showNotification(`${songs.length + 1} songs picked. Creating the playlist comes in step 9.`);
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
  if (isKeyProblem(error)) {
    return "Last.fm API key problem: check Playlist Prism settings (profile menu).";
  }
  if (isRateLimit(error)) {
    return "Last.fm rate limit hit: wait a minute and try again.";
  }
  return "Something went wrong. Details are in the console.";
}

export default main;
