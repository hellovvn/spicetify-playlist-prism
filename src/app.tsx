// Playlist Prism: entry point.
// Spicetify Creator bundles this file (and anything it imports) into
// playlist-prism.js, which Spotify loads at startup.

import { getTrackInfo } from "./spotify/read";
import { getTrackTopTags, LastfmError } from "./lastfm/client";
import { getLastfmKey } from "./storage";
import { openSettings } from "./ui/SettingsModal";

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

  console.log(`${LOG_PREFIX} loaded`);
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
    console.log(`${LOG_PREFIX} tags: ${tagList || "(none)"}`);

    if (result.tags.length === 0) {
      Spicetify.showNotification(`Last.fm has no tags for "${track.name}"`);
    } else {
      const top = result.tags.slice(0, 5).map((tag) => tag.name).join(", ");
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
