// Playlist Prism: entry point.
// Spicetify Creator bundles this file (and anything it imports) into
// playlist-prism.js, which Spotify loads at startup.

import { getTrackInfo } from "./spotify/read";
import { getTrackTopTags, LastfmError } from "./lastfm/client";
import { getLastfmKey } from "./storage";
import { openSettings } from "./ui/SettingsModal";
import { cleanTags } from "./tags/cleanTags";
import { titleVariants } from "./tags/titleVariants";

// A prefix for console logs, so ours are easy to filter in DevTools.
const LOG_PREFIX = "[Playlist Prism]";

async function main() {
  // Extensions can start running before Spotify's UI and the Spicetify APIs
  // are ready. Wait (checking every 100 ms) until the APIs we use exist.
  while (!Spicetify?.showNotification || !Spicetify?.ContextMenu || !Spicetify?.Menu || !Spicetify?.LocalStorage) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

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
    hasLastfmKey: () => getLastfmKey() !== null,
    // Uses the saved key internally so the caller never sees it.
    getTrackTopTags: (artist: string, track: string) => {
      const key = getLastfmKey();
      if (!key) throw new Error("No Last.fm key saved");
      return getTrackTopTags(artist, track, key);
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
async function onStartPrism(uris: string[]) {
  const uri = uris[0];

  // No key yet? Explain and open settings instead of failing later.
  const apiKey = getLastfmKey();
  if (!apiKey) {
    Spicetify.showNotification("Playlist Prism: add your Last.fm API key first");
    openSettings();
    return;
  }

  try {
    // Step 1: song details from Spotify.
    const track = await getTrackInfo(uri);
    console.log(`${LOG_PREFIX} seed song:`, track);

    // Step 2: tags from Last.fm. We send only the MAIN artist (first in the
    // list), because Last.fm stores songs under the main artist's name.
    // (Title cleanup like removing "- Remastered" comes in step 4.)
    const mainArtist = track.artists[0] ?? "";
    const result = await getTrackTopTags(mainArtist, track.name, apiKey);

    console.log(
      `${LOG_PREFIX} Last.fm matched "${result.matchedTrack}" by "${result.matchedArtist}"` +
        ` (we asked for "${track.name}" by "${mainArtist}"): ${result.tags.length} tags`
    );
    // One line with our prefix, so it survives the "[Playlist Prism]" console
    // filter (console.table output has no prefix, so the filter hides it).
    const tagList = result.tags.map((tag) => `${tag.name} (${tag.count})`).join(", ");
    console.log(`${LOG_PREFIX} raw tags: ${tagList || "(none)"}`);

    // Step 4: clean the tags (drop junk, merge duplicates, re-scale 0..1).
    const cleaned = cleanTags(result.tags, { artistNames: track.artists });
    const cleanList = cleaned.map((tag) => `${tag.name} (${tag.weight.toFixed(2)})`).join(", ");
    console.log(`${LOG_PREFIX} clean tags: ${cleanList || "(none)"}`);

    // Preview only (used in step 4b): the title variants we'd try next.
    console.log(`${LOG_PREFIX} title variants: ${JSON.stringify(titleVariants(track.name))}`);

    if (cleaned.length === 0) {
      Spicetify.showNotification(`No usable Last.fm tags for "${track.name}"`);
    } else {
      const top = cleaned.slice(0, 5).map((tag) => tag.name).join(", ");
      Spicetify.showNotification(`${track.name}: ${top}`);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} failed for ${uri}`, error);

    // Turn known Last.fm error codes into messages a user can act on.
    if (error instanceof LastfmError && error.code === 6) {
      Spicetify.showNotification("Last.fm doesn't know this song", true);
    } else if (error instanceof LastfmError && (error.code === 10 || error.code === 26)) {
      Spicetify.showNotification("Last.fm API key problem: check Playlist Prism settings", true);
    } else if (error instanceof LastfmError && error.code === 29) {
      Spicetify.showNotification("Last.fm rate limit hit: wait a minute and try again", true);
    } else {
      Spicetify.showNotification("Playlist Prism: something went wrong (see console)", true);
    }
  }
}

export default main;
