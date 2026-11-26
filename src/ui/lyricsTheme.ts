// Prism's twilight look for Spotify's own LYRICS views, and player controls
// that never fade out there.
//
// Spotify draws the lyrics, so we can't change its code. Instead this adds a
// <style> tag (from the always-on script, src/extensions/prism.tsx) that
// overrides the colours Spotify sets. Spotify picks them per song from the
// cover art and writes them as CSS variables in a style="" attribute:
//   --cinema-mode-bg-color-from / -to   the expanded lyrics view's background
//   --lyrics-color-background, -active, -inactive, -passed, -messaging
//                                        the lyric lines and their backdrop
// A rule marked !important in a stylesheet beats a normal style="" value, so
// re-defining those variables here wins. The attribute selector
// [style*="--lyrics-color"] means "any element whose style contains that
// text": it finds the right element without relying on Spotify's random,
// auto-generated class names (which change between Spotify versions).
//
// Controls: Spotify's "Full screen" makes the lyrics view cover the top bar and
// the player bar, so its buttons are hidden. And in the expanded lyrics view Spotify fades the player bar out
// (opacity 0) after a few idle seconds, until you move or click. The
// developer wants the controls always usable, so the bar is kept visible.
// We use its data-testid ("now-playing-bar"), which is stable, rather than
// the generated class that hides it.
//
// Nothing here reads or stores lyrics text: it's colours only.

import { loadLyricsThemeSetting, loadPlaylistThemeOverrides, loadPlaylistThemeSetting } from "../storage";
import { effectiveTheme, LYRICS_LINE_COLOURS, parsePlaylistTheme, parseThemeOverrides, PLAYLIST_THEME_CHANGED_EVENT, type PlaylistThemeId } from "../theme/playlistTheme";
import { buildSky } from "./playlistTheme";

const STYLE_ID = "prism-lyrics-theme";

export const LYRICS_THEME_CSS = `
/* Expanded lyrics view: Prism's twilight sky instead of the cover colour.
   Spotify paints two layers here: a window-sized backdrop from the
   --cinema-mode-* colours, and over it a flat block in
   --lyrics-color-background behind the lines. Both are made see-through,
   and the sky is painted on the view's still (non-scrolling) container as
   stacked backgrounds, first listed = on top:
   two rainbow light bands, three soft glows, then the twilight gradient.
   The animation slides the bands and glows (background-position), so they
   drift slowly like on Prism's own page. The bands' images are twice the
   window's width and only slide between 15% and 85%, so the coloured
   stripe always stays on screen. No !important on these: an
   !important value would block the animation. */
[style*="--cinema-mode-bg-color-from"] {
  --cinema-mode-bg-color-from: transparent !important;
  --cinema-mode-bg-color-to: transparent !important;
}
/* Spotify's cover-colour backdrop is a direct child of that element, with a
   solid dark grey (#121212) under its gradient: clearing the gradient alone
   left the start of the lyrics dark grey (bug seen 2026-11-22). Its other
   direct child holds the lyrics and has no background of its own. */
[style*="--cinema-mode-bg-color-from"] > * {
  background-color: transparent !important;
}
/* The sky goes on the box that stays still while the lyrics scroll inside
   it (the window-sized container around the scrolling area; Spotify paints
   it plain dark grey). On the scrolling part, the sky scrolled away and
   left black behind (bug seen 2026-11-22). */
.Root__cinema-view > .main-actionBar-ActionBarContainer {
  background-color: #150e22;
  background-image:
    linear-gradient(105deg, transparent 38%, rgba(255, 150, 200, 0.24) 42%, rgba(255, 190, 140, 0.24) 45%, rgba(255, 240, 150, 0.2) 48%, rgba(150, 240, 190, 0.2) 51%, rgba(140, 200, 255, 0.24) 54%, rgba(190, 160, 255, 0.24) 57%, transparent 61%),
    linear-gradient(125deg, transparent 41%, rgba(190, 160, 255, 0.18) 45%, rgba(140, 200, 255, 0.18) 49%, rgba(150, 240, 190, 0.15) 53%, rgba(255, 150, 200, 0.18) 57%, transparent 61%),
    radial-gradient(closest-side, rgba(208, 106, 208, 0.32), transparent),
    radial-gradient(closest-side, rgba(106, 63, 192, 0.55), transparent),
    radial-gradient(closest-side, rgba(138, 63, 184, 0.42), transparent),
    linear-gradient(100deg, #150e22 0%, #21143d 32%, #33195a 62%, #4d2270 85%, #6e2f7e 100%);
  background-size: 200% 100%, 200% 100%, 70% 80%, 75% 85%, 60% 70%, 100% 100%;
  background-repeat: no-repeat;
  background-position: 85% 0, 15% 0, 100% 0, 0% 100%, 90% 100%, 0 0;
  animation: prism-lyrics-sky 26s ease-in-out infinite alternate;
}
[style*="--cinema-mode-bg-color-from"] [style*="--lyrics-color-background"] {
  --lyrics-color-background: transparent !important;
}
@keyframes prism-lyrics-sky {
  from { background-position: 85% 0, 15% 0, 100% 0, 0% 100%, 90% 100%, 0 0; }
  to { background-position: 15% 0, 85% 0, 75% 25%, 20% 80%, 65% 85%, 0 0; }
}
@media (prefers-reduced-motion: reduce) {
  .Root__cinema-view > .main-actionBar-ActionBarContainer { animation: none; }
}
/* Lyric lines: white for the line being sung, soft lavender for the rest. */
[style*="--lyrics-color-background"] {
  --lyrics-color-background: #21143d !important;
  --lyrics-color-active: #ffffff !important;
  --lyrics-color-inactive: rgba(205, 184, 255, 0.6) !important;
  --lyrics-color-passed: #e9dcff !important;
  --lyrics-color-messaging: #e9dcff !important;
}
/* WITH A PLAYLIST THEME ON (14c, pick "D, moving sky + reading veil"): the
   theme's own moving sky (.prism-lyrics-sky, built like the playlist page's,
   placed by syncLyricsSky below) replaces the twilight sky, and a soft dark
   veil behind the lyric column keeps the lines easy to read. The lines take
   the theme's colours (html[data-prism-lyrics-sky], LYRICS_LINE_COLOURS). */
.Root__cinema-view > .main-actionBar-ActionBarContainer:has(> .prism-lyrics-sky) {
  background: #150e22 !important;
  animation: none;
  isolation: isolate;
}
.prism-lyrics-sky .prism-lyrics-veil {
  inset: 0;
  background: linear-gradient(90deg, rgba(12, 8, 28, 0.62) 0%, rgba(12, 8, 28, 0.5) 55%, transparent 82%);
}
${Object.entries(LYRICS_LINE_COLOURS).map(([theme, c]) => `html[data-prism-lyrics-sky="${theme}"] [style*="--lyrics-color-background"] {
  --lyrics-color-inactive: ${c.inactive} !important;
  --lyrics-color-passed: ${c.passed} !important;
  --lyrics-color-messaging: ${c.passed} !important;
}`).join("\n")}
/* No "Full screen" for the lyrics. Spotify's Full screen makes the lyrics
   view cover the top bar and the player bar (it adds the class
   Root__cinema-view--controls-hidden: negative margins and a higher
   z-index), and the developer wants both bars always there. Undoing that
   class's layout left a blank top bar and an empty grey panel, so instead
   the two buttons that switch it on are hidden: the player bar's
   (data-testid "fullscreen-mode-button") and the one in the lyrics view's
   own title row. (Immersive mode, which Spotify switches on by itself, is
   handled just below.) */
[data-testid="fullscreen-mode-button"],
.Root__cinema-view button[aria-label="Enter Full screen"] {
  display: none !important;
}
/* IMMERSIVE MODE: when you're idle in the expanded lyrics view, Spotify
   switches this on BY ITSELF (no button needed). It adds the class
   Root__cinema-view--controls-hidden, which pulls the view over the top bar
   and the player bar (margins -56px / -80px and a higher z-index) and makes
   the top bar invisible (opacity 0). The developer wants both bars always
   there, so in that mode the view keeps its normal place and size, sits
   under the player bar again (z-index 5, the bar's wrapper is 6), and the
   top bar and the view's own title row stay visible and clickable. */
.Root__cinema-view.Root__cinema-view--controls-hidden {
  margin: 0 !important;
  height: auto !important;
  z-index: 5 !important;
}
.Root:has(.Root__cinema-view--controls-hidden) .Root__globalNav,
.Root:has(.Root__cinema-view--controls-hidden) [data-testid="global-nav-bar"] {
  opacity: 1 !important;
  pointer-events: auto !important;
}
.Root__cinema-view--controls-hidden [style*="--header-text-color"] {
  opacity: 1 !important;
  pointer-events: auto !important;
}
/* In immersive mode Spotify's right-hand panel (Now Playing,
   .Root__right-sidebar) showed up as an empty dark grey block over the
   right side of the lyrics and both bars. The lyrics view covers that panel
   anyway when it's open, so hide it while immersive mode is on. */
.Root:has(.Root__cinema-view--controls-hidden) .Root__right-sidebar {
  visibility: hidden !important;
}
/* Player controls stay visible (Spotify fades them out when idle). */
[data-testid="now-playing-bar"] {
  opacity: 1 !important;
  visibility: visible !important;
}
`;

// ----- The Settings switch ("Prism look for lyrics", on by default) -----
// Off = no style tag at all, so Spotify's lyrics are exactly as Spotify
// makes them (including its own full screen and immersive mode).

// Event the Settings page sends after the switch changes, so the lyrics
// update straight away (no reload needed).
export const LYRICS_THEME_CHANGED_EVENT = "prism:lyrics-theme-changed";

// The saved text ("on" / "off" / nothing yet) -> on or off. PURE (tested in
// tests/lyricsTheme.test.ts). Only an explicit "off" turns it off, so new
// users, and anyone from before this setting existed, keep the Prism look.
export function isLyricsThemeOn(saved: string | null): boolean {
  return saved !== "off";
}

// Adds the style tag (once) or removes it.
export function applyLyricsTheme(on: boolean): void {
  const existing = document.getElementById(STYLE_ID);
  if (!on) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = LYRICS_THEME_CSS;
  document.head.appendChild(style);
}

// Run once by the always-on script: apply the saved choice now, and again
// whenever Settings changes it.
export function startLyricsTheme(): void {
  applyLyricsTheme(isLyricsThemeOn(loadLyricsThemeSetting()));
  window.addEventListener(LYRICS_THEME_CHANGED_EVENT, () => {
    applyLyricsTheme(isLyricsThemeOn(loadLyricsThemeSetting()));
    syncLyricsSky();
  });
  window.addEventListener(PLAYLIST_THEME_CHANGED_EVENT, syncLyricsSky);
  Spicetify.Player?.addEventListener?.("songchange", () => syncLyricsSky()); // another playlist may have its own theme
  watchLyricsView();
}

// ----- The playlist theme's sky in the expanded lyrics view -----
const SKY_ATTR = "data-prism-lyrics-sky"; // on <html>: which theme's line colours apply
const LYRICS_BOX = ".Root__cinema-view > .main-actionBar-ActionBarContainer"; // the still box around the lyrics

// The theme the lyrics should show, or "none" for Prism's twilight lyrics
// (or Spotify's own, when the lyrics switch is off).
function lyricsSkyTheme(): PlaylistThemeId {
  if (!isLyricsThemeOn(loadLyricsThemeSetting())) return "none";
  // Playing from a playlist with its own theme (14b)? Then that one.
  const playingFrom = Spicetify.Player?.data?.context?.uri;
  return effectiveTheme(parsePlaylistTheme(loadPlaylistThemeSetting()), parseThemeOverrides(loadPlaylistThemeOverrides()), playingFrom);
}

// Puts the theme's sky (plus the reading veil) into the lyrics view when it's
// open, swaps it when the theme changes and removes it when it's turned off.
function syncLyricsSky(): void {
  const theme = lyricsSkyTheme();
  const root = document.documentElement;
  if (theme === "none") root.removeAttribute(SKY_ATTR);
  else if (root.getAttribute(SKY_ATTR) !== theme) root.setAttribute(SKY_ATTR, theme);
  const box = document.querySelector(LYRICS_BOX);
  document.querySelectorAll<HTMLElement>(".prism-lyrics-sky").forEach((sky) => {
    if (theme === "none" || sky.parentElement !== box || sky.dataset.theme !== theme) sky.remove();
  });
  if (theme === "none" || !box || box.querySelector(":scope > .prism-lyrics-sky")) return;
  const sky = buildSky(theme, box, false);
  sky.classList.add("prism-lyrics-sky");
  const veil = document.createElement("span");
  veil.className = "prism-lyrics-veil";
  sky.appendChild(veil);
  box.insertBefore(sky, box.firstChild);
}

// The lyrics view (.Root__cinema-view) is added to .Root__top-container when
// it opens, and its still box is added to it a moment later: watch both
// (children only, not the whole page).
function watchLyricsView(): void {
  const top = document.querySelector(".Root__top-container");
  if (!top) {
    window.setTimeout(watchLyricsView, 1000);
    return;
  }
  let viewObserver: MutationObserver | null = null;
  const hookView = () => {
    viewObserver?.disconnect();
    viewObserver = null;
    const view = top.querySelector(":scope > .Root__cinema-view");
    if (view) {
      viewObserver = new MutationObserver(syncLyricsSky);
      viewObserver.observe(view, { childList: true });
    }
    syncLyricsSky();
  };
  new MutationObserver(hookView).observe(top, { childList: true });
  hookView();
}
