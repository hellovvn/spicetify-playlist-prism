// Playlist Prism: the ALWAYS-ON part.
//
// Since step 12a, Playlist Prism is a page (a Spicetify "custom app", see
// src/app.tsx). Spicetify loads the page's code only when the page opens, but
// files in src/extensions/ run as soon as Spotify starts. This one adds:
//   - "Start a Prism playlist" to a song's right-click menu
//   - "Add with Prism" (song right-click): the 5 best playlists (src/ui/addWithPrism.ts)
//   - "Playlist Prism settings" to the profile menu
//   - the read-only debug hook for the smoke test
//   - twilight colours for Spotify's lyrics views (src/ui/lyricsTheme.ts)
//   - Prism stats in the right-hand panel for Prism playlists (src/ui/panelHost.tsx)
//   - "Prism tone" on playlists + the Tone view's score rings (src/ui/toneRows.ts)
//   - playlist themes: moving sky, colour rail, genre mix (src/ui/playlistTheme.ts)
//   - the same theme on the left panel, "Your Library" (src/ui/libraryTheme.ts)
// All of them simply OPEN THE PAGE with a request (see src/nav.ts).
// The header icon needs no code: Spicetify adds it for every custom app.

import { getTrackInfo } from "../spotify/read";
import { getTrackTopTags } from "../lastfm/client";
import { getLastfmKey } from "../storage";
import { cleanTags } from "../tags/cleanTags";
import { titleVariants } from "../tags/titleVariants";
import { getSongTags } from "../tags/getSongTags";
import { getAudioAttributes } from "../spotify/audio";
import { getLyricsMood } from "../spotify/lyrics";
import { lastfmFetchers } from "../lastfm/fetchers";
import { LOG_PREFIX } from "../log";
import { isPlaylistUri, openPage } from "../nav";
import { injectHeaderIconStyles } from "../ui/headerIcon";
import { startLyricsTheme } from "../ui/lyricsTheme";
import { startPanelStats } from "../ui/panelHost";
import { startToneRows } from "../ui/toneRows";
import { startPlaylistTheme } from "../ui/playlistTheme";
import { startLibraryTheme } from "../ui/libraryTheme";
import { startChromeTheme } from "../ui/chromeTheme";
import { findPlaylistsForSong, loadTones } from "../flow";
import { injectStyles } from "../ui/styles";
import { addWithPrismState, startAddWithPrism } from "../ui/addWithPrism";

async function main() {
  // This can run before Spotify's UI and the Spicetify APIs are ready.
  // Wait (checking every 100 ms) until the APIs we use exist.
  // (Not showNotification: it only appears once Spotify's window is drawn,
  // so waiting for it stalled the extension while Spotify was minimized.)
  while (!Spicetify?.ContextMenu || !Spicetify?.Menu || !Spicetify?.LocalStorage || !Spicetify?.Platform?.History) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  injectHeaderIconStyles(); // hover spin + sparkle on the header diamond
  startLyricsTheme(); // twilight lyrics views + bars kept (Settings switch, on by default)
  injectStyles(); // Prism's styles, also needed by the side-panel stats outside the page
  startPanelStats(); // Prism playlist stats in the right-hand panel (Settings switch, on by default)
  registerContextMenu();
  startAddWithPrism(PRISM_MENU_ICON); // "Add with Prism" flyout: the 5 playlists that fit a song best
  registerStatsMenu();
  registerToneMenu();
  startToneRows(); // "Tone" switch (with the Prism star) + score rings on playlists with a tone
  startPlaylistTheme(); // playlist page themes: sky, colour rail, genre mix (Settings, off by default)
  startLibraryTheme(); // the same theme on the left panel: still background, moving open-playlist row
  startChromeTheme(); // and on Spotify's bars: "Quiet night" (deep purple, pastel instead of green)
  registerSettingsMenu();
  exposeDebugHook();

  console.log(`${LOG_PREFIX} loaded`);
}

// Adds "Start a Prism playlist" to the right-click menu, for songs only.
function registerContextMenu() {
  const item = new Spicetify.ContextMenu.Item(
    "Start a Prism playlist", // the menu label
    (uris) => openPage({ go: "start", seed: uris[0] }), // open the page for this song
    isSingleTrack, // decides whether the item appears in this menu
    "playlist" // icon, from Spicetify's built-in icon list
  );
  item.register();
}

// Adds "Prism stats" to the right-click menu of playlists. Prism playlists
// show how they were made; any other playlist gets an estimate from songs
// Prism has scanned (see loadPlaylistStats in src/flow.ts).
function registerStatsMenu() {
  new Spicetify.ContextMenu.Item(
    "Prism stats",
    (uris) => openPage({ go: "stats", playlist: uris[0] }),
    isSinglePlaylist,
    // Spicetify's type list only names its built-in icons, but it also draws
    // SVG text (checked in its spicetifyWrapper.js), hence the cast.
    PRISM_MENU_ICON as Spicetify.Icon
  ).register();
}

// Adds the tone item to the right-click menu of playlists: set (or edit) the
// genres/moods/tempo the playlist is meant to have. Saved only on this computer.
// A menu item's label is fixed, so there are TWO items and the "shouldAdd"
// check shows the one that fits: "Add Prism tone" (no tone yet) or
// "Prism tone" (has one). Spotify runs the check each time the menu opens.
function registerToneMenu() {
  const hasTone = (uris: string[]) => isSinglePlaylist(uris) && !!loadTones()[uris[0]];
  const open = (uris: string[]) => openPage({ go: "tone", playlist: uris[0] });
  new Spicetify.ContextMenu.Item("Add Prism tone", open, (uris) => isSinglePlaylist(uris) && !hasTone(uris), PRISM_MENU_ICON as Spicetify.Icon).register();
  new Spicetify.ContextMenu.Item("Prism tone", open, hasTone, PRISM_MENU_ICON as Spicetify.Icon).register();
}

// The faceted Prism diamond for the right-click menu (instead of a built-in
// icon). Spicetify draws a full <svg> text as-is; menu icons are 16px and use
// the menu's text colour (currentColor). Same shape as src/assets/prism.svg.
const PRISM_MENU_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">' +
  '<path d="M12 2 11 10.6 4 12Z" fill="currentColor" fill-opacity=".42" stroke="none"/>' +
  '<path d="M12 2 20 12 11 10.6Z" fill="currentColor" fill-opacity=".2" stroke="none"/>' +
  '<path d="M4 12 11 10.6 12 22Z" fill="currentColor" fill-opacity=".1" stroke="none"/>' +
  '<path d="M20 12 12 22 11 10.6Z" fill="currentColor" fill-opacity=".28" stroke="none"/>' +
  '<path d="M12 2 20 12 12 22 4 12Z"/>' +
  '<path d="M12 2 11 10.6 12 22M4 12 11 10.6 20 12" stroke-width="1" opacity=".75"/>' +
  "</svg>";

// "shouldAdd" check for "Prism stats": exactly one playlist.
function isSinglePlaylist(uris: string[]): boolean {
  return uris.length === 1 && isPlaylistUri(uris[0]);
}

// Adds "Playlist Prism settings" to the profile menu (click your avatar, top right).
// Spicetify.Menu.Item is meant for on/off toggles, so isEnabled = false.
function registerSettingsMenu() {
  new Spicetify.Menu.Item("Prism settings", false, () => openPage({ go: "settings" })).register();
}

// "shouldAdd" check: Spotify calls this every time a right-click menu opens.
// We want exactly one song (not an album, artist, playlist, or several songs).
function isSingleTrack(uris: string[]): boolean {
  return uris.length === 1 && Spicetify.URI.isTrack(uris[0]);
}

// Makes a few READ-ONLY functions callable from outside, so the smoke test
// (scripts/smoke.mjs) can drive and check things through the debug port.
// Nothing here can change the user's Spotify, and the API key itself is never
// exposed (only whether one is saved).
// TODO before publishing (step 11): remove this or hide it behind a dev-only flag.
function exposeDebugHook() {
  const hook = ((window as any).__playlistPrism ??= {});
  Object.assign(hook, {
    isSingleTrack,
    getTrackInfo,
    cleanTags,
    titleVariants,
    // Same as the right-click item / profile menu / header icon.
    startPrism: (uri: string) => openPage({ go: "start", seed: uri }),
    openSettings: () => openPage({ go: "settings" }),
    goHome: () => openPage({ go: "home" }),
    // Scan screen with a fake, hand-driven scan (layout tests). Nothing is scanned.
    // The page then adds hook.setPreviewProgress.
    previewScan: () => openPage({ go: "demo-scan" }),
    // Stats page with made-up numbers (layout tests), and the real one for a playlist.
    previewStats: () => openPage({ go: "demo-stats" }),
    openStats: (uri: string) => openPage({ go: "stats", playlist: uri }),
    isSinglePlaylist,
    // Add with Prism: open its page, and what the flyout last found (read-only).
    openAddTo: (uri?: string) => openPage(uri ? { go: "addto", song: uri } : { go: "addto" }),
    getAddWithPrismState: addWithPrismState,
    findPlaylistsForSong,
    // Tone editor for a playlist, and the saved tones (read-only copy).
    openTone: (uri: string) => openPage({ go: "tone", playlist: uri }),
    getTones: () => loadTones(),
    // BPM/key for some songs. Returns a plain object (a Map can't cross the debug port).
    getAudioAttributes: async (uris: string[]) => {
      const plain: Record<string, unknown> = {};
      (await getAudioAttributes(uris)).forEach((audio, uri) => (plain[uri] = audio));
      return plain;
    },
    hasLastfmKey: () => getLastfmKey() !== null,
    // Lyrics MOOD profile for one song (the lyrics themselves never leave the extension).
    getLyricsMood,
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
  });
}

// In a custom app, files in src/extensions/ run as plain scripts when Spotify
// starts (nothing calls an export), so start ourselves.
main();
