// Playlist Prism: entry point.
// Spicetify Creator bundles this file (and anything it imports) into
// playlist-prism.js, which Spotify loads at startup.

import { getTrackInfo } from "./spotify/read";

// A prefix for console logs, so ours are easy to filter in DevTools.
const LOG_PREFIX = "[Playlist Prism]";

async function main() {
  // Extensions can start running before Spotify's UI and the Spicetify APIs
  // are ready. Wait (checking every 100 ms) until the APIs we use exist.
  while (!Spicetify?.showNotification || !Spicetify?.ContextMenu || !Spicetify?.Platform) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  registerContextMenu();
  logPlatformApis();

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
  try {
    const track = await getTrackInfo(uri);
    console.log(`${LOG_PREFIX} seed song:`, track);
    Spicetify.showNotification(`Prism seed: ${track.name} by ${track.artists.join(", ")}`);
  } catch (error) {
    // If the lookup fails, we still want to know which song caused it.
    console.error(`${LOG_PREFIX} could not load track ${uri}`, error);
    Spicetify.showNotification("Playlist Prism: couldn't load that song (see console)", true);
  }
}

// Logs which internal Spotify APIs this Spotify version exposes.
// Spicetify.Platform changes between Spotify versions, so we check what's
// really there before relying on it (for playlists, in a later step).
function logPlatformApis() {
  const names = Object.keys(Spicetify.Platform).sort();
  console.log(`${LOG_PREFIX} Spicetify.Platform has ${names.length} APIs:`, names);

  for (const name of ["PlaylistAPI", "RootlistAPI", "LibraryAPI"]) {
    const api = Spicetify.Platform[name];
    if (!api) {
      console.log(`${LOG_PREFIX} ${name}: not found`);
      continue;
    }
    // List the method names on that API object (including inherited ones).
    const methods = new Set<string>();
    let proto = api;
    while (proto && proto !== Object.prototype) {
      Object.getOwnPropertyNames(proto).forEach((m) => methods.add(m));
      proto = Object.getPrototypeOf(proto);
    }
    methods.delete("constructor");
    console.log(`${LOG_PREFIX} ${name} methods:`, [...methods].sort());
  }
}

export default main;
