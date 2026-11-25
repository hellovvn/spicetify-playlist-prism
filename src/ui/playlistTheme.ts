// PLAYLIST THEMES on Spotify's own playlist pages (developer's picks
// 2026-11-24: mockups H1 "Northern lights", H2 "Starry night", H3 "Bubble
// nebula", plus "No theme"). Picked in Prism Settings.
//
// Album, artist and Liked Songs pages get the same sky, cleared washes,
// glass bars and pastel play button, but no rail or genre mix (step 16,
// developer's pick "A, full sky"; which page gets what: themedPageKind).
// Home gets the sky as a BAND behind its top part, fading into Quiet night's
// dark purple below it and as you scroll (developer's pick "D, sky band"),
// with glass shortcut tiles, cards and filter chips.
//
// With a theme on, EVERY playlist page gets:
//   - a moving background (the "sky") behind the whole page,
//   - the COLOUR RAIL: a thin glowing bar down the left of the song list,
//     each song's part in its main genre's colour (the playing song pulses;
//     songs Prism hasn't scanned get a faint lavender part),
//   - the GENRE MIX bar under the title (top genres of the scanned songs).
//
// Spotify draws the page, so we can't change its code: a <style> tag clears
// Spotify's own cover-colour backgrounds, and our elements are added into
// its page and re-checked whenever the page changes (Spotify reuses row
// elements while you scroll, so a rail part must follow the SONG). Same
// approach as the Tone view (src/ui/toneRows.ts).
//
// READ-ONLY: it reads the playlist's songs and Prism's tag cache only.
// Nothing is sent to Last.fm for this, and the playlist is never touched.
// Pure parts: src/theme/playlistTheme.ts (tests/playlistTheme.test.ts).

import { loadPlaylistThemeOverrides, loadPlaylistThemeSetting, loadTagCacheText } from "../storage";
import { getSourceTracks } from "../spotify/read";
import { TagCache } from "../scan/tagCache";
import { LOG_PREFIX } from "../log";
import { effectiveTheme, genreColours, genreMix, mainGenre, mixCaption, parsePlaylistTheme, parseThemeOverrides, PLAYLIST_THEME_CHANGED_EVENT, themedPageKind, type PlaylistThemeId } from "../theme/playlistTheme";
import { playlistUriFromPath } from "./toneView";
import { RING_ANGLE_PROPERTY, RING_GLINT, RING_RAINBOW } from "./ringColours";
import { isNewSkyTheme, NEW_SKY_CSS, newSkyHtml, wireSky } from "./themeSkies";

const STYLE_ID = "playlist-prism-playlist-theme";
const THEME_ATTR = "data-prism-theme"; // on .Root__main-view while a themed playlist shows
const SKY_CLASS = "prism-pl-sky";
const RAIL_CLASS = "prism-rail";
const MIX_ATTR = "data-prism-genre-mix";
const LIB_ATTR = "data-prism-lib-theme"; // on .Root__nav-bar while the left panel is themed (src/ui/libraryTheme.ts)
const BAND_ATTR = "data-prism-band"; // on .Root__main-view while Home shows the sky as a band
const PAGE_ATTR = "data-prism-page"; // on .Root__main-view: the themed page kind (themedPageKind)
const CHIP_ROW_ATTR = "data-prism-chip-row"; // Search's sticky filter-chip row (found by structure)
const PHOTO_ATTR = "data-prism-photo"; // Spotify's big photo header box while we move it with the scroll
const HEADER_STUCK_ATTR ="data-prism-stuck"; // on the song-list column header while stuck to the top (an attribute: React rewrites its class list)
const UNKNOWN_COLOUR = "rgba(205, 184, 255, 0.28)"; // songs Prism hasn't scanned
const RELOAD_GAP_MS = 5000; // at most one re-read of the playlist this often
const CACHE_REFRESH_MS = 30000; // re-read the tag cache (new scans) this often

// The playlist's own song list (not Spotify's "Recommended" list under it).
const ROW_SELECTOR = '.Root__main-view .main-trackList-indexable [role="row"]';

const CSS = `
/* ----- Playlist themes (src/ui/playlistTheme.ts) ----- */
/* The sky sits behind everything in the main view: isolation makes the view
   its own layer stack, so z-index -1 is above the view's background but
   below all of Spotify's content. */
.Root__main-view[${THEME_ATTR}] { isolation: isolate; background-color: #1a1333 !important; }
.${SKY_CLASS} { position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; border-radius: inherit; }
.${SKY_CLASS} * { position: absolute; }
/* Spotify's cover-colour washes (header, action bar, page) go see-through. */
[${THEME_ATTR}] .main-entityHeader-backgroundColor,
[${THEME_ATTR}] .playlist-playlist-actionBarBackground-background,
[${THEME_ATTR}] .main-actionBarBackground-background { background: none !important; }
[${THEME_ATTR}] .playlist-playlist-playlistContent { background-color: transparent !important; }
/* Artist pages: the cover-colour wash behind the banner and the solid
   #121212 block under it (generated class names, so found by structure). */
[${THEME_ATTR}] [data-testid="overscroll-background"] { background: none !important; }
[${THEME_ATTR}] [data-testid="artist-page"] div:has(> .playlist-playlist-actionBarBackground-background) { background-color: transparent !important; }
/* The artist photo is pinned behind the page (it never scrolls) and Spotify
   hides it under that #121212 block. With the block see-through, the photo
   fades out instead as you scroll (--prism-banner-fade, set on scroll). */
.Root__main-view[${THEME_ATTR}]:has([data-testid="artist-page"]) .before-scroll-node { opacity: var(--prism-banner-fade, 1); }
/* While scrolling, two bars stick to the top: Spotify's top bar and the song
   list's column header (# / Title / Album, solid grey in Spotify). Both get
   the same twilight glass so they read as one panel (nearly solid: the sky
   behind them is darker at the top, and see-through glass looked black there).
   Before the column header sticks (it sits in the page under the title) it is
   fully see-through, so the sky shows; it turns to glass only once stuck
   (HEADER_STUCK_ATTR, set by updateHeader), or songs would scroll under the text. */
[${THEME_ATTR}] .main-topBar-background,
/* Spotify's stuck header is ~1px narrower than the top bar on each side, so
   the sky showed through two thin strips while scrolling. Two 2px side
   shadows in the header's colour cover them without moving the layout
   (Spotify sets the header's own margins, so don't touch those). */
[${THEME_ATTR}] .main-trackList-trackListHeader[${HEADER_STUCK_ATTR}] { background-color: rgba(38, 26, 76, 0.94) !important; backdrop-filter: blur(16px); box-shadow: -2px 0 0 rgba(38, 26, 76, 0.94), 2px 0 0 rgba(38, 26, 76, 0.94); }
[${THEME_ATTR}] .main-trackList-trackListHeader { background-color: transparent !important; border-bottom-color: rgba(205, 184, 255, 0.18) !important; transition: background-color 0.2s ease; }
/* Spotify fades its top bar in with an inline opacity as you scroll. Once the
   column header is stuck under it, the top bar is always fully shown, or a
   half-faded (dark) top bar sits on a fully purple header. */
[${THEME_ATTR}]:has(.main-trackList-trackListHeader[${HEADER_STUCK_ATTR}]) .main-topBar-background { opacity: 1 !important; }
/* Spotify darkens its top bar with extra layers meant for the cover colour:
   a 60% black .main-topBar-overlay (seen while a playlist opened for the
   first time loads: a dark top bar over the purple column header) and a
   #121212 radial gradient ("mixing background" ::after) on the top bar and
   the page. Not wanted with a theme on. */
[${THEME_ATTR}] .main-topBar-overlay { background-color: transparent !important; }
[${THEME_ATTR}] .main-topBar-mixingBackground::after,
[${THEME_ATTR}] .playlist-playlist-mixingBackground::after { display: none !important; }
/* Spotify's own playlists with a big PHOTO header (Today's Top Hits...): the
   photo lives outside the scrolling page (.before-scroll-node) and stays put;
   Spotify hides it behind the page's solid background, which the theme
   clears. updateHeader moves it up with the scroll instead (PHOTO_ATTR marks
   it). Spotify's own scroll effect fades the photo into the cover colour
   (a ::after on the photo's shade layer: olive on Today's Top Hits); with the
   photo scrolling away that isn't needed, so it's hidden, as is the cover
   colour behind an overscroll ([data-testid=overscroll-background]). */
[${THEME_ATTR}] [data-testid="overscroll-background"],
[${THEME_ATTR}] .before-scroll-node > [${PHOTO_ATTR}] > :not([data-testid="background-image"])::after { display: none !important; }
[${THEME_ATTR}] .before-scroll-node > [${PHOTO_ATTR}] { will-change: transform; }

/* HOME ("D, sky band"): the sky only covers the top of the page (its height
   is set by update) and fades out downwards; it also fades as you scroll
   (--prism-band-fade, set on scroll). Below it: Quiet night's dark purple. */
.Root__main-view[${THEME_ATTR}][${BAND_ATTR}] { background-color: #151029 !important; }
[${BAND_ATTR}] > .${SKY_CLASS} {
  bottom: auto; height: var(--prism-band-height, 520px);
  -webkit-mask-image: linear-gradient(#000 40%, transparent);
  mask-image: linear-gradient(#000 40%, transparent);
  opacity: var(--prism-band-fade, 1);
}
/* Spotify's grey header wash (it changes colour when you hover a shortcut)
   goes; the filter chips' row, once it sticks under the top bar while
   scrolling, is the same twilight glass as the top bar. */
[${BAND_ATTR}] .main-home-homeHeader { background: none !important; }
[${BAND_ATTR}] .main-home-filterChipsSection { background-color: rgba(38, 26, 76, 0.94) !important; backdrop-filter: blur(16px); }
/* Shortcut tiles: lavender glass, standard lavender hover. */
[${BAND_ATTR}] .view-homeShortcutsGrid-shortcut {
  background-color: rgba(205, 184, 255, 0.09) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
}
[${BAND_ATTR}] .view-homeShortcutsGrid-shortcut:hover {
  background-color: rgba(205, 184, 255, 0.18) !important;
  box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.35), 0 0 16px rgba(205, 184, 255, 0.18);
}
/* Album/playlist cards in the rows: lavender hover instead of grey. */
[${BAND_ATTR}] [data-encore-id="card"]:hover::after,
[${PAGE_ATTR}="profile"] [data-encore-id="card"]:hover::after,
[${PAGE_ATTR}="search"] [data-encore-id="card"]:hover::after,
[${PAGE_ATTR}="genre"] [data-encore-id="card"]:hover::after { background-color: rgba(205, 184, 255, 0.12) !important; }

/* PROFILE pages (step 16f, developer's pick "A, full sky + avatar ring"):
   the sky (cleared washes come from the shared rules above), each section
   ("Top artists this month", "Followers"...) on lavender glass like Home's
   shortcut tiles, and the avatar inside the stats page's moving cover ring
   ("Cover ring" in docs/ui-elements.md, round here). The ring and its glow
   sit behind the photo (negative z-index in an isolated box), just outside it. */
${RING_ANGLE_PROPERTY}
[${PAGE_ATTR}="profile"] section.main-shelf-shelf {
  padding: 12px 16px 8px;
  border-radius: 12px;
  background-color: rgba(205, 184, 255, 0.09);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
}
/* Spotify puts a grey #333 square behind every card picture; behind the round
   profile and artist photos it showed as grey corners on the glass. Cleared
   when there's a picture, and its square drop shadow moves onto the picture
   itself (round or square, it follows the picture's own shape). The no-photo
   placeholder becomes faint lavender. */
[${PAGE_ATTR}="profile"] .main-cardImage-imageWrapper:has(img) { background-color: transparent !important; box-shadow: none !important; }
[${PAGE_ATTR}="profile"] .main-cardImage-imageWrapper img { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5); }
[${PAGE_ATTR}="profile"] .main-cardImage-imageWrapper:not(:has(img)) { background-color: rgba(205, 184, 255, 0.12) !important; }
[${PAGE_ATTR}="profile"] .main-entityHeader-imageContainer {
  position: relative;
  isolation: isolate;
  border-radius: 50%;
  overflow: visible;
  animation: prism-ring-turn 3.5s linear infinite;
}
[${PAGE_ATTR}="profile"] .main-entityHeader-imageContainer::after,
[${PAGE_ATTR}="profile"] .main-entityHeader-imageContainer::before {
  content: "";
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  pointer-events: none;
}
[${PAGE_ATTR}="profile"] .main-entityHeader-imageContainer::after { inset: -4px; background: ${RING_GLINT}, ${RING_RAINBOW}; filter: blur(1.5px); opacity: 0.9; }
[${PAGE_ATTR}="profile"] .main-entityHeader-imageContainer::before { inset: -8px; background: ${RING_RAINBOW}; filter: blur(12px); opacity: 0.7; }
@media (prefers-reduced-motion: reduce) {
  [${PAGE_ATTR}="profile"] .main-entityHeader-imageContainer { animation: none; }
}

/* PODCAST shows and episodes (step 16g, developer's pick "A, full sky"): the
   sky and cleared washes come from the shared rules; the episode page's solid
   #121212 block under its header (the parent of the action bar background,
   generated class) is cleared like the artist page's. Spotify's blue
   "not played yet" dots read --spice-notification -> Prism lavender. The
   show's trailer card and its "Trailer" tag become lavender glass. */
[${PAGE_ATTR}="podcast"] { --spice-notification: #b9a7ff; --spice-rgb-notification: 185, 167, 255; }
[${PAGE_ATTR}="podcast"] [data-testid="episode"] div:has(> .playlist-playlist-actionBarBackground-background) { background-color: transparent !important; }
[${PAGE_ATTR}="podcast"] [data-testid="trailer-component"] {
  background-color: rgba(205, 184, 255, 0.09) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
}
[${PAGE_ATTR}="podcast"] [data-testid="trailer-component"]:hover { background-color: rgba(205, 184, 255, 0.18) !important; }
[${PAGE_ATTR}="podcast"] [data-testid="trailer-component"] [data-encore-id="tag"] { background-color: rgba(205, 184, 255, 0.16) !important; color: #ece6ff !important; }

/* SEARCH + GENRE pages (step 16c, developer's pick "B, full sky + pastel
   glass tiles"). Browse all's category tiles (a grid item holding a link
   holding a box with Spotify's colour as an inline style and a cover image;
   the links aren't all /genre/: Live Events = /concerts) become lavender glass with a
   Prism pastel glowing from the cover's corner; the pastel goes round
   pink, lavender, mint, peach, sky by the tile's place in the grid. */
:is([${PAGE_ATTR}="search"], [${PAGE_ATTR}="genre"]) .main-gridContainer-gridContainer > * { --prism-tile: #f6a6c8; }
:is([${PAGE_ATTR}="search"], [${PAGE_ATTR}="genre"]) .main-gridContainer-gridContainer > :nth-child(5n + 2) { --prism-tile: #b9a7ff; }
:is([${PAGE_ATTR}="search"], [${PAGE_ATTR}="genre"]) .main-gridContainer-gridContainer > :nth-child(5n + 3) { --prism-tile: #9fe3d0; }
:is([${PAGE_ATTR}="search"], [${PAGE_ATTR}="genre"]) .main-gridContainer-gridContainer > :nth-child(5n + 4) { --prism-tile: #ffd59e; }
:is([${PAGE_ATTR}="search"], [${PAGE_ATTR}="genre"]) .main-gridContainer-gridContainer > :nth-child(5n + 5) { --prism-tile: #a9d4ff; }
:is([${PAGE_ATTR}="search"], [${PAGE_ATTR}="genre"]) .main-gridContainer-gridContainer > * > a > div[style*="background-color"]:has(> img) {
  --prism-tile-fill: rgba(205, 184, 255, 0.09);
  background: radial-gradient(circle at 80% 85%, color-mix(in srgb, var(--prism-tile, #b9a7ff) 55%, transparent), transparent 72%), var(--prism-tile-fill) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
:is([${PAGE_ATTR}="search"], [${PAGE_ATTR}="genre"]) .main-gridContainer-gridContainer > * > a:hover > div[style*="background-color"]:has(> img) {
  --prism-tile-fill: rgba(205, 184, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.35), 0 0 16px rgba(205, 184, 255, 0.18);
  transform: translateY(-2px);
}
@media (prefers-reduced-motion: reduce) {
  [${PAGE_ATTR}] .main-gridContainer-gridContainer > * > a:hover > div[style*="background-color"]:has(> img) { transform: none; }
}
/* Search results: the grey "top result" box is lavender glass, and the
   filter-chip row (sticky under the top bar, #121212 in Spotify) is the same
   twilight glass as the top bar. */
[${PAGE_ATTR}="search"] [class*="legacy-box--tinted"] {
  background-color: rgba(205, 184, 255, 0.09) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
[${PAGE_ATTR}="search"] [class*="legacy-box--tinted"]:hover {
  background-color: rgba(205, 184, 255, 0.18) !important;
  box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.35), 0 0 16px rgba(205, 184, 255, 0.18);
}
[${PAGE_ATTR}="search"] [${CHIP_ROW_ATTR}] { background-color: rgba(38, 26, 76, 0.94) !important; backdrop-filter: blur(16px); }
/* Genre pages: Spotify's colour header (a pinned picture behind the page)
   and the #121212 block under it go, so the sky shows behind the title. */
[${PAGE_ATTR}="genre"] .before-scroll-node { visibility: hidden; }
[${PAGE_ATTR}="genre"] div:has(> .main-actionBarBackground-background) { background-color: transparent !important; }

/* SETTINGS ("C, quiet night + cards"): no sky, Quiet night's still dark
   purple, every section on a card like the right panel's, Spotify's green
   switches in the Prism Toggle's look (at Spotify's size), glass dropdowns
   and buttons, lavender instead of green in the zoom picker, the equalizer
   (a canvas, so hue-shifted like the playing icon) and the Beta tag.
   Spotify's x-settings-* / x-toggle-* class names are stable. */
.Root__main-view[${THEME_ATTR}][${PAGE_ATTR}="settings"] { background-color: #151029 !important; }
[${PAGE_ATTR}="settings"] .x-settings-section {
  background: #1d1638; border: 1px solid rgba(205, 184, 255, 0.12); border-radius: 12px;
  padding: 16px 20px;
}
[${PAGE_ATTR}="settings"] div:has(> .x-settings-section) { row-gap: 12px !important; }
[${PAGE_ATTR}="settings"] .x-settings-section > hr { display: none; }
[${PAGE_ATTR}="settings"] :is(.x-settings-zoomContainer, .x-settings-equalizerSection, .x-settings-outputDeviceSection) {
  background-color: rgba(205, 184, 255, 0.06) !important; box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.1); border-radius: 12px;
}
[${PAGE_ATTR}="settings"] .x-toggle-indicatorWrapper {
  background-color: rgba(255, 255, 255, 0.1) !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: background-color 150ms ease, box-shadow 150ms ease;
}
[${PAGE_ATTR}="settings"] .x-toggle-input:checked + .x-toggle-indicatorWrapper {
  background-color: #b794ff !important; box-shadow: inset 0 0 0 1px #cdb8ff;
}
[${PAGE_ATTR}="settings"] .x-toggle-wrapper:hover .x-toggle-indicatorWrapper {
  box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.75), 0 0 12px rgba(205, 184, 255, 0.4);
}
[${PAGE_ATTR}="settings"] .x-toggle-indicator { background-color: #ffffff !important; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); }
[${PAGE_ATTR}="settings"] .main-dropDown-dropDown {
  background-color: rgba(255, 255, 255, 0.1) !important; color: #ece6ff !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25); border: 0 !important; border-radius: 999px;
  /* The browser's own arrow box drew a second edge: off, with a plain chevron. */
  appearance: none; padding-right: 34px !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23ece6ff' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important; background-position: right 14px center !important;
}
[${PAGE_ATTR}="settings"] .main-dropDown-dropDown:hover { box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.75), 0 0 12px rgba(205, 184, 255, 0.4); }
[${PAGE_ATTR}="settings"] .main-dropDown-dropDown option { background-color: #1d1638; color: #ece6ff; }
[${PAGE_ATTR}="settings"] [data-encore-id="buttonSecondary"] {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05)) !important;
  border: 1px solid rgba(255, 255, 255, 0.28) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35) !important;
}
[${PAGE_ATTR}="settings"] [data-encore-id="buttonSecondary"]:hover {
  border-color: rgba(205, 184, 255, 0.75) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 0 12px rgba(205, 184, 255, 0.4) !important;
}
[${PAGE_ATTR}="settings"] .x-settings-zoomButtonIcon.selected { color: #b794ff !important; }
[${PAGE_ATTR}="settings"] .x-settings-zoomRadioCircle { background-color: transparent !important; }
[${PAGE_ATTR}="settings"] .x-settings-zoomRadioCircle[class*=" "] { background-color: #b794ff !important; box-shadow: 0 0 10px rgba(205, 184, 255, 0.5); }
[${PAGE_ATTR}="settings"] .x-settings-zoomRadioCircle[class*=" "]::before { background-color: #1d1638 !important; }
[${PAGE_ATTR}="settings"] .x-settings-zoomRadioWrapper { background-color: transparent !important; }
[${PAGE_ATTR}="settings"] .x-settings-zoomRadioGroup::before { background-color: rgba(205, 184, 255, 0.2) !important; }
[${PAGE_ATTR}="settings"] .x-settings-equalizerPanelCanvas { filter: hue-rotate(190deg) saturate(0.7) brightness(1.25); }
[${PAGE_ATTR}="settings"] .encore-bright-accent-set { background: linear-gradient(135deg, #f6a6c8, #b9a7ff) !important; color: #2b1d52 !important; }
/* Spotify's filter chips (All / Music / Podcasts...) on every themed page
   and in the themed left panel (Playlists / Albums; LIB_ATTR is set by
   src/ui/libraryTheme.ts): glass pills; the chosen one gets the
   pink-to-lavender gradient. Class names carry Spotify's version number, so
   they're matched by part. */
:is([${THEME_ATTR}], .Root__nav-bar[${LIB_ATTR}]) [data-encore-id="chip"] > [class*="legacy-chip__inner"] {
  background: rgba(255, 255, 255, 0.08) !important; color: #ece6ff !important;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}
:is([${THEME_ATTR}], .Root__nav-bar[${LIB_ATTR}]) [data-encore-id="chip"]:hover > [class*="legacy-chip__inner"]:not([class*="--selected"]) {
  background: rgba(205, 184, 255, 0.2) !important;
  box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.35);
}
:is([${THEME_ATTR}], .Root__nav-bar[${LIB_ATTR}]) [data-encore-id="chip"] > [class*="legacy-chip__inner--selected"] {
  background: linear-gradient(135deg, #f6a6c8, #b9a7ff) !important; color: #2b1d52 !important;
  box-shadow: 0 0 12px rgba(205, 184, 255, 0.35);
}

/* Spotify's green accent -> Prism pastels (mockup play button): the big play
   buttons get the pink-to-lavender gradient with a dark purple triangle, and
   every other green (liked ticks, the playing song's title, toggled icons)
   reads Spotify's --text-bright-accent / --essential-bright-accent, so those
   are swapped for Prism pink. The playing song's animated equaliser is a
   green picture, so it's hue-shifted to pink. */
[${THEME_ATTR}] {
  --text-bright-accent: #f6a6c8;
  --essential-bright-accent: #f6a6c8;
}
[${THEME_ATTR}] .main-playButton-PlayButton .encore-bright-accent-set,
[${THEME_ATTR}] [data-testid="action-bar-row"] .encore-bright-accent-set {
  background: linear-gradient(135deg, #f6a6c8, #b9a7ff) !important;
  color: #2b1d52 !important;
  box-shadow: 0 0 18px rgba(205, 184, 255, 0.45);
}
[${THEME_ATTR}] .main-trackList-playingIcon { filter: hue-rotate(190deg) saturate(0.7) brightness(1.25); }

/* The colour rail: one part per song row, touching the rows above/below.
   It sits on the row's outer element, outside Spotify's own row content. */
[${THEME_ATTR}] .main-trackList-indexable [role="row"] { position: relative; }
.${RAIL_CLASS} {
  position: absolute; left: -12px; top: 0; bottom: 0; width: 6px; /* in the page margin, clear of the song numbers */
  background: var(--c); box-shadow: 0 0 10px var(--c);
  pointer-events: none;
}
.${RAIL_CLASS}.first { border-radius: 6px 6px 0 0; }
.${RAIL_CLASS}.last { border-radius: 0 0 6px 6px; }
.${RAIL_CLASS}.first.last { border-radius: 6px; }
.${RAIL_CLASS}.unknown { box-shadow: none; }
.${RAIL_CLASS}.playing { animation: prism-pl-pulse 2s ease-in-out infinite; }
@keyframes prism-pl-pulse {
  0%, 100% { box-shadow: 0 0 6px var(--c); }
  50% { box-shadow: 0 0 18px var(--c), 0 0 4px #fff; }
}

/* The genre mix under the title. */
[${MIX_ATTR}] { margin-top: 8px; color: #c9bde8; font-size: 12px; }
[${MIX_ATTR}] .prism-mix-bar {
  display: flex; width: 260px; max-width: 100%; height: 12px; margin-bottom: 4px;
  border-radius: 999px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* Northern lights */
.prism-pl-ray { border-radius: 50%; transform-origin: bottom; will-change: transform, opacity; animation: prism-pl-ray var(--d) var(--l) ease-in-out infinite; }
.prism-pl-curtain { inset: 0; animation: prism-pl-sway var(--d) ease-in-out infinite; will-change: transform; }
@keyframes prism-pl-ray { 0%, 100% { opacity: 0.35; transform: scaleY(0.9); } 50% { opacity: 0.9; transform: scaleY(1.08); } }
@keyframes prism-pl-sway { 0%, 100% { transform: translateX(0) skewX(0); } 50% { transform: translateX(-30px) skewX(-6deg); } }
@keyframes prism-pl-breathe { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.85; } }
.prism-pl-aurora-hue { inset: 0; animation: prism-pl-aurora-hue 70s ease-in-out infinite; }
@keyframes prism-pl-aurora-hue { 0%, 100% { filter: hue-rotate(0deg); } 30% { filter: hue-rotate(45deg); } 55% { filter: hue-rotate(120deg); } 75% { filter: hue-rotate(-30deg); } }
/* Tiny dots (aurora sky, nebula) */
.prism-pl-dot { border-radius: 50%; background: #fff; animation: prism-pl-twinkle var(--d) var(--l) infinite; }
@keyframes prism-pl-twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
/* Sparkle stars (the Prism four-point sparkle) */
.prism-pl-star {
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  animation: prism-pl-sparkle var(--d) var(--l) ease-in-out infinite;
}
@keyframes prism-pl-sparkle { 0%, 100% { opacity: 0; transform: scale(0.2) rotate(0); } 50% { opacity: 1; transform: scale(1) rotate(45deg); } }
/* Bubble nebula */
.prism-pl-cloud { border-radius: 50%; filter: blur(24px); will-change: transform; animation: prism-pl-cloud var(--d) var(--l) ease-in-out infinite; }
@keyframes prism-pl-cloud { 0%, 100% { transform: translate(0, 0) rotate(0) scale(1); } 50% { transform: translate(30px, -20px) rotate(8deg) scale(1.1); } }
.prism-pl-bubble { bottom: -50px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.25); will-change: transform; animation: prism-pl-rise var(--d) var(--l) linear infinite; }
@keyframes prism-pl-rise {
  0% { transform: translate(0, 0); opacity: 0; }
  10% { opacity: 0.85; }
  50% { transform: translate(14px, -55vh); }
  100% { transform: translate(-6px, -115vh); opacity: 0; }
}
${NEW_SKY_CSS}
@media (prefers-reduced-motion: reduce) {
  .${SKY_CLASS} *, .${RAIL_CLASS} { animation: none !important; }
}
`;

// ----- The skies (random each time, like the mockups) -----

const PASTELS = ["#f6a6c8", "#b9a7ff", "#9fe3d0", "#ffd59e", "#a9d4ff"];
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const timing = (minD: number, maxD: number) => `--d:${rand(minD, maxD).toFixed(1)}s;--l:${(-rand(0, maxD)).toFixed(1)}s`;

function dotsHtml(count: number): string {
  let html = "";
  for (let i = 0; i < count; i++) {
    const size = rand(1, 2.5).toFixed(1);
    html += `<span class="prism-pl-dot" style="left:${rand(0, 100).toFixed(1)}%;top:${rand(0, 100).toFixed(1)}%;width:${size}px;height:${size}px;${timing(2, 5)}"></span>`;
  }
  return html;
}

function starsHtml(count: number, maxSize: number): string {
  let html = "";
  for (let i = 0; i < count; i++) {
    const size = rand(5, maxSize).toFixed(1);
    const colour = Math.random() < 0.25 ? pick(PASTELS) : "#fff";
    html += `<span class="prism-pl-star" style="left:${rand(0, 98).toFixed(1)}%;top:${rand(0, 98).toFixed(1)}%;width:${size}px;height:${size}px;background:${colour};filter:drop-shadow(0 0 4px ${colour});${timing(2.5, 5.5)}"></span>`;
  }
  return html;
}

// One aurora curtain: many soft, blurred light streaks along a gentle wave.
// baseY = where the curtain's bright bottom edge sits (% of the height).
function curtainHtml(baseY: number, amplitude: number, phase: number, topColour: string, count: number, blur: number, opacity: number, swaySeconds: number): string {
  let rays = "";
  for (let k = 0; k < count; k++) {
    const x = (k / (count - 1)) * 110 - 5;
    const y = baseY + Math.sin((x / 100) * Math.PI * 2.4 + phase) * amplitude;
    // Sizes are % of the page, so the curtain looks the same on any window size.
    const height = rand(14, 26);
    const width = (110 / count) * rand(1, 2);
    rays +=
      `<span class="prism-pl-ray" style="left:${x.toFixed(1)}%;top:${(y - height).toFixed(1)}%;height:${height.toFixed(1)}%;width:${width.toFixed(2)}%;` +
      `background:linear-gradient(0deg,transparent 0,#8ff7cf 10%,#6fe6c0aa 35%,${topColour}66 70%,transparent);filter:blur(${blur}px);${timing(3, 7)}"></span>`;
  }
  return `<div class="prism-pl-curtain" style="opacity:${opacity};--d:${swaySeconds}s">${rays}</div>`;
}

// The mockups were 680 x 500 px; a real playlist page is often 3-5 times
// that. `scale` (1 to 4) multiplies the counts so a big window isn't sparse,
// and `width` sizes the nebula clouds like in the mockup.
function skyHtml(theme: PlaylistThemeId, width: number, scale: number): { background: string; html: string } {
  const n = (count: number) => Math.round(count * scale);
  if (isNewSkyTheme(theme)) return newSkyHtml(theme, width, scale);
  if (theme === "aurora") {
    return {
      background: "linear-gradient(180deg, #0f0d28, #171338 50%, #1b1335)",
      html:
        dotsHtml(n(50)) +
        `<div style="left:-10%;right:-10%;top:8%;height:200px;background:radial-gradient(ellipse at 50% 60%,#7ff5c833,transparent 65%);filter:blur(30px);animation:prism-pl-breathe 8s ease-in-out infinite"></div>` +
        // The lights slowly drift through other colours (green -> teal/blue ->
        // violet/pink and back, ~70 s; developer's request 2026-11-25).
        `<div class="prism-pl-aurora-hue">` +
        curtainHtml(26, 3.5, 0, "#c49bff", 46, 10, 0.85, 18) +
        curtainHtml(30, 2.5, 2, "#f6a6c8", 34, 14, 0.55, 24) +
        `</div>` +
        `<div style="left:0;right:0;bottom:0;height:52%;background:linear-gradient(transparent,#150f2cdd)"></div>`,
    };
  }
  if (theme === "stars") {
    return { background: "radial-gradient(ellipse at 70% 0%, #3d2878, #1a1333 70%)", html: starsHtml(n(28), 16) };
  }
  // nebula
  const clouds: [string, number, number, number, number][] = [
    ["#f6a6c8", -8, 5, 380, 26],
    ["#b9a7ff", 30, -8, 420, 32],
    ["#9fe3d0", 50, 35, 360, 28],
    ["#a9d4ff", -5, 55, 340, 30],
    ["#ffd59e", 65, 70, 260, 24],
  ];
  let html = clouds
    .map(([c, x, y, size, d], i) => [c, x, y, Math.round((size / 680) * width), d] as const)
    .map(([c, x, y, size, d], i) => `<span class="prism-pl-cloud" style="left:${x}%;top:${y}%;width:${size}px;height:${Math.round(size * 0.7)}px;background:radial-gradient(ellipse at 40% 45%,${c}88,${c}33 45%,transparent 70%);--d:${d}s;--l:${-i * 4}s"></span>`)
    .join("");
  html += `<span style="left:30%;top:10%;width:${Math.round((280 / 680) * width)}px;height:${Math.round((120 / 680) * width)}px;background:radial-gradient(ellipse,rgba(255,255,255,.18),transparent 70%);filter:blur(14px);transform:rotate(-20deg)"></span>`;
  html += dotsHtml(n(45)) + starsHtml(n(5), 12);
  for (let i = 0; i < n(14); i++) {
    const c = PASTELS[i % PASTELS.length];
    const size = rand(14, 42).toFixed(0);
    html +=
      `<span class="prism-pl-bubble" style="left:${rand(0, 95).toFixed(1)}%;width:${size}px;height:${size}px;` +
      `background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.75) 0 8%,transparent 12%),radial-gradient(circle,${c}11 55%,${c}99 100%);box-shadow:0 0 14px ${c}66;${timing(12, 22)}"></span>`;
  }
  return { background: "#1a1335", html };
}

// How tall Home's sky band is: the top part of the view, 320-560px.
const bandHeight = (main: Element) => Math.round(Math.min(560, Math.max(320, main.getBoundingClientRect().height * 0.42)));

// Also used by the lyrics view (src/ui/lyricsTheme.ts), with any box as `main`.
export function buildSky(theme: PlaylistThemeId, main: Element, band: boolean): HTMLElement {
  const sky = document.createElement("div");
  sky.className = SKY_CLASS;
  sky.dataset.theme = theme;
  sky.dataset.band = band ? "1" : "";
  const width = main.getBoundingClientRect().width;
  const height = band ? bandHeight(main) : main.getBoundingClientRect().height;
  const scale = Math.min(4, Math.max(1, (width * height) / (680 * 500)));
  const { background, html } = skyHtml(theme, Math.max(680, width), scale);
  sky.style.background = background;
  sky.innerHTML = html;
  // Each sparkle star moves to a new random spot after it fades out.
  sky.querySelectorAll<HTMLElement>(".prism-pl-star").forEach((star) =>
    star.addEventListener("animationiteration", () => {
      star.style.left = `${rand(0, 98).toFixed(1)}%`;
      star.style.top = `${rand(0, 98).toFixed(1)}%`;
    })
  );
  wireSky(sky);
  return sky;
}

// ----- Song data (main genres) for the open playlist -----

interface PlaylistData {
  uri: string;
  mains: Map<string, string | null>; // song URI -> main genre
  colours: Map<string, string>;
  mixHtml: string;
  loadedAt: number;
  loading: boolean;
  notInPlaylist: Set<string>; // rows that aren't the playlist's songs
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function mixHtmlFor(songMains: (string | null)[], colours: Map<string, string>): string {
  const mix = genreMix(songMains);
  let bar = "";
  if (mix.scanned > 0) {
    const segments = mix.rows.map((r) => `<span style="flex:${r.count};background:${colours.get(r.name)}" title="${escapeHtml(r.name)}"></span>`);
    if (mix.otherCount > 0) segments.push(`<span style="flex:${mix.otherCount};background:rgba(205,184,255,.35)" title="other"></span>`);
    bar = `<div class="prism-mix-bar">${segments.join("")}</div>`;
  }
  return bar + `<div>${escapeHtml(mixCaption(mix))}</div>`;
}

// The song URI of one of Spotify's track rows, from React's data on it
// (same as the Tone view: there's no song ID in the page's HTML).
function trackUriOfRow(row: Element): string | null {
  const key = Object.keys(row).find((k) => k.startsWith("__reactFiber"));
  let fiber = key ? (row as any)[key] : null;
  for (let depth = 0; fiber && depth < 25; depth++, fiber = fiber.return) {
    const uri = fiber.memoizedProps?.uri;
    if (typeof uri === "string" && uri.startsWith("spotify:track:")) return uri;
  }
  return null;
}

export function startPlaylistTheme(): void {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  let mainTheme = parsePlaylistTheme(loadPlaylistThemeSetting());
  let overrides = parseThemeOverrides(loadPlaylistThemeOverrides()); // themes for single playlists (14b)
  let data: PlaylistData | null = null;
  let scheduled = false;
  let lastPath: string | undefined;

  const load = (uri: string) => {
    const mine: PlaylistData = data?.uri === uri ? data : { uri, mains: new Map(), colours: new Map(), mixHtml: "", loadedAt: 0, loading: false, notInPlaylist: new Set() };
    data = mine;
    if (mine.loading) return;
    mine.loading = true;
    getSourceTracks(uri)
      .then((tracks) => {
        const cache = new TagCache(loadTagCacheText());
        const now = Date.now();
        const mains = new Map<string, string | null>();
        for (const t of tracks) mains.set(t.uri, mainGenre(cache.get(t.uri, now)?.tags));
        const songMains = tracks.map((t) => mains.get(t.uri) ?? null);
        mine.mains = mains;
        mine.colours = genreColours(songMains);
        mine.mixHtml = mixHtmlFor(songMains, mine.colours);
      })
      .catch((error) => console.warn(`${LOG_PREFIX} playlist theme: couldn't read the playlist`, error))
      .then(() => {
        mine.loading = false;
        mine.loadedAt = Date.now();
        schedule();
      });
  };

  const clear = (main: Element | null) => {
    main?.removeAttribute(THEME_ATTR);
    main?.removeAttribute(BAND_ATTR);
    main?.removeAttribute(PAGE_ATTR);
    // Only the page's own sky (a direct child of the main view): the same sky
    // is also used by the lyrics view and the Settings preview strip, which
    // must stay when the page itself isn't themed.
    main?.querySelectorAll(`:scope > .${SKY_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${RAIL_CLASS}, [${MIX_ATTR}]`).forEach((el) => el.remove());
    document.querySelectorAll(`[${CHIP_ROW_ATTR}]`).forEach((el) => el.removeAttribute(CHIP_ROW_ATTR));
  };

  // Search's filter-chip row: the chips' nearest sticky box (Spotify's class
  // names are generated, so it's found by structure).
  const markChipRow = (main: Element) => {
    let row: Element | null = null;
    const chip = main.querySelector('[data-encore-id="chip"]');
    for (let el = chip?.parentElement ?? null; el && el !== main; el = el.parentElement) {
      if (getComputedStyle(el).position === "sticky") {
        row = el;
        break;
      }
    }
    document.querySelectorAll(`[${CHIP_ROW_ATTR}]`).forEach((el) => el !== row && el.removeAttribute(CHIP_ROW_ATTR));
    if (row && !row.hasAttribute(CHIP_ROW_ATTR)) row.setAttribute(CHIP_ROW_ATTR, "");
  };

  const update = () => {
    scheduled = false;
    scheduleHeader();
    const main = document.querySelector(".Root__main-view");
    const path = Spicetify.Platform.History.location?.pathname;
    const kind = themedPageKind(path);
    if (path !== lastPath) {
      lastPath = path;
      (main as HTMLElement | null)?.style.removeProperty("--prism-banner-fade"); // a new page starts at the top
      (main as HTMLElement | null)?.style.removeProperty("--prism-band-fade");
    }
    const uri = playlistUriFromPath(path);
    // A playlist page shows the playlist's own theme if it has one (14b).
    const theme = effectiveTheme(mainTheme, overrides, kind === "playlist" ? uri : null);
    if (!main || !kind || theme === "none") {
      clear(main);
      if (!uri) data = null;
      return;
    }

    // The sky (rebuilt only when the theme, or band vs. whole page, changes).
    if (main.getAttribute(THEME_ATTR) !== theme) main.setAttribute(THEME_ATTR, theme);
    const band = kind === "band";
    if (main.hasAttribute(BAND_ATTR) !== band) main.toggleAttribute(BAND_ATTR, band);
    if (main.getAttribute(PAGE_ATTR) !== kind) main.setAttribute(PAGE_ATTR, kind);
    if (kind === "search") markChipRow(main);
    else document.querySelectorAll(`[${CHIP_ROW_ATTR}]`).forEach((el) => el.removeAttribute(CHIP_ROW_ATTR));
    let sky = main.querySelector(`:scope > .${SKY_CLASS}`) as HTMLElement | null;
    // Settings: no sky at all (still Quiet night purple, the CSS does the rest).
    if (kind === "settings") {
      sky?.remove();
      data = null;
      main.querySelectorAll(`.${RAIL_CLASS}, [${MIX_ATTR}]`).forEach((el) => el.remove());
      return;
    }
    if (sky && (sky.dataset.theme !== theme || sky.dataset.band !== (band ? "1" : ""))) {
      sky.remove();
      sky = null;
    }
    if (!sky) {
      if (band) (main as HTMLElement).style.setProperty("--prism-band-height", `${bandHeight(main)}px`);
      main.insertBefore(buildSky(theme, main, band), main.firstChild);
    }

    // Album, artist, Liked Songs, Search and genre pages: the sky only.
    if (kind !== "playlist" || !uri) {
      data = null;
      main.querySelectorAll(`.${RAIL_CLASS}, [${MIX_ATTR}]`).forEach((el) => el.remove());
      return;
    }

    // Song data: on a new playlist, and again now and then (new scans).
    if (data?.uri !== uri || (!data.loading && Date.now() - data.loadedAt > CACHE_REFRESH_MS)) load(uri);
    const current = data!;
    if (current.loadedAt === 0) return; // first load still running

    // The genre mix under the title.
    const meta = main.querySelector(".main-entityHeader-metaData");
    let mix = main.querySelector(`[${MIX_ATTR}]`) as HTMLElement | null;
    if (meta && (!mix || mix.previousElementSibling !== meta)) {
      mix?.remove();
      mix = document.createElement("div");
      mix.setAttribute(MIX_ATTR, "");
      meta.after(mix);
    }
    if (mix && mix.innerHTML !== current.mixHtml) mix.innerHTML = current.mixHtml;

    // The rail: a part in every visible song row.
    const playing = Spicetify.Player?.data?.item?.uri;
    const rowCount = Number(main.querySelector(".main-trackList-indexable")?.getAttribute("aria-rowcount") ?? 0);
    const missing: string[] = [];
    main.querySelectorAll(ROW_SELECTOR).forEach((row) => {
      if (!row.querySelector(".main-trackList-trackListRow")) return; // the header row
      const songUri = trackUriOfRow(row);
      let rail = row.querySelector(`:scope > .${RAIL_CLASS}`) as HTMLElement | null;
      if (!songUri || !current.mains.has(songUri)) {
        if (songUri && !current.notInPlaylist.has(songUri)) missing.push(songUri);
        rail?.remove();
        return;
      }
      if (!rail) {
        rail = document.createElement("span");
        rail.setAttribute("aria-hidden", "true");
        row.appendChild(rail);
      }
      const genre = current.mains.get(songUri);
      const colour = (genre && current.colours.get(genre)) || UNKNOWN_COLOUR;
      const index = Number(row.getAttribute("aria-rowindex"));
      const classes = [RAIL_CLASS, genre ? "" : "unknown", index === 2 ? "first" : "", index === rowCount ? "last" : "", songUri === playing ? "playing" : ""].filter(Boolean).join(" ");
      // Only touch the DOM when something changed (Spotify reuses rows).
      if (rail.className !== classes) rail.className = classes;
      if (rail.style.getPropertyValue("--c") !== colour) rail.style.setProperty("--c", colour);
      const label = genre ?? "not scanned by Prism yet";
      if (rail.title !== label) rail.title = label;
    });

    // Songs added since the last read: read the playlist again (rate-limited).
    // Songs still missing after that aren't the playlist's songs.
    if (missing.length > 0 && !current.loading && Date.now() - current.loadedAt > RELOAD_GAP_MS) {
      const before = current.loadedAt;
      load(uri);
      const check = () => {
        if (current.loadedAt === before) return void setTimeout(check, 200);
        missing.filter((m) => !current.mains.has(m)).forEach((m) => current.notInPlaylist.add(m));
      };
      check();
    }
  };

  // The column header is stuck when it sits at its sticky "top" inside the
  // scrolling area. Spotify adds no class for that, so this runs on scroll
  // and page changes (once per frame at most).
  let headerScheduled = false;
  const updateHeader = () => {
    headerScheduled = false;
    document.querySelectorAll<HTMLElement>(".Root__main-view .main-trackList-trackListHeader").forEach((header) => {
      const scroller = header.closest("[data-overlayscrollbars-viewport], .main-view-container__scroll-node");
      const stickyTop = parseFloat(getComputedStyle(header).top) || 0;
      const offset = scroller ? header.getBoundingClientRect().top - scroller.getBoundingClientRect().top : Infinity;
      header.toggleAttribute(HEADER_STUCK_ATTR, offset <= stickyTop + 1);
    });

    // The big photo header of a PLAYLIST scrolls away with the page (see the
    // CSS). Artist pages keep their own photo fade (--prism-banner-fade).
    const main = document.querySelector(".Root__main-view");
    const onPlaylist = !!main?.hasAttribute(THEME_ATTR) && themedPageKind(Spicetify.Platform.History.location?.pathname) === "playlist";
    const photo = main?.querySelector<HTMLElement>('.before-scroll-node > div:has([data-testid="background-image"])');
    document.querySelectorAll<HTMLElement>(`[${PHOTO_ATTR}]`).forEach((old) => {
      if (old !== photo || !onPlaylist) {
        old.removeAttribute(PHOTO_ATTR);
        old.style.removeProperty("transform");
      }
    });
    if (photo && main && onPlaylist) {
      const scroller = main.querySelector(".main-view-container__scroll-node [data-overlayscrollbars-viewport]");
      const transform = `translateY(${-(scroller?.scrollTop ?? 0)}px)`;
      photo.setAttribute(PHOTO_ATTR, "");
      if (photo.style.transform !== transform) photo.style.transform = transform;
    }
  };
  const scheduleHeader = () => {
    if (headerScheduled) return;
    headerScheduled = true;
    requestAnimationFrame(updateHeader);
  };
  document.addEventListener("scroll", scheduleHeader, { capture: true, passive: true });

  // Many changes come at once while Spotify draws or scrolls: handle them
  // together on the next frame.
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };

  const isOurs = (node: Node) => (node as Element).matches?.(`.${SKY_CLASS}, .${SKY_CLASS} *, .${RAIL_CLASS}, [${MIX_ATTR}], [${MIX_ATTR}] *`);
  const observer = new MutationObserver((mutations) => {
    // Ignore our own changes, or we'd loop.
    const ours = mutations.every((m) => isOurs(m.target) || (m.type === "childList" && [...m.addedNodes, ...m.removedNodes].every(isOurs)));
    if (!ours) schedule();
  });
  // Artist pages: fade the pinned photo out over its own height while scrolling.
  // Home: fade the sky band out over its own height.
  const onScroll = (event: Event) => {
    const main = event.currentTarget as HTMLElement;
    const target = event.target as Element;
    if (!(target instanceof Element) || !target.matches(".main-view-container__scroll-node, .main-view-container__scroll-node *")) return;
    if (main.hasAttribute(BAND_ATTR)) {
      const height = parseFloat(main.style.getPropertyValue("--prism-band-height")) || 520;
      main.style.setProperty("--prism-band-fade", Math.max(0, 1 - target.scrollTop / height).toFixed(2));
      return;
    }
    const banner = main.querySelector(".before-scroll-node [data-testid='background-image']");
    if (!banner) return;
    const height = banner.getBoundingClientRect().height || 1;
    const fade = Math.max(0, Math.min(1, 1 - target.scrollTop / height));
    main.style.setProperty("--prism-banner-fade", fade.toFixed(2));
  };

  const watchMainView = () => {
    const main = document.querySelector(".Root__main-view");
    if (main && !(main as any).__prismThemeWatched) {
      (main as any).__prismThemeWatched = true;
      observer.observe(main, { childList: true, subtree: true });
      main.addEventListener("scroll", onScroll, { capture: true, passive: true });
    }
  };

  watchMainView();
  schedule();
  Spicetify.Platform.History.listen(() => schedule());
  Spicetify.Player?.addEventListener?.("songchange", () => schedule());
  window.addEventListener(PLAYLIST_THEME_CHANGED_EVENT, () => {
    mainTheme = parsePlaylistTheme(loadPlaylistThemeSetting());
    overrides = parseThemeOverrides(loadPlaylistThemeOverrides());
    schedule();
  });
  window.setInterval(() => {
    watchMainView(); // Spotify may rebuild its main view
    schedule();
  }, 1500);
}
