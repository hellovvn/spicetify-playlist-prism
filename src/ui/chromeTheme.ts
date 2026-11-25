// SPOTIFY'S BARS ("chrome") with a playlist theme on: look "C, Quiet night"
// (developer's pick 2026-11-24). The always-visible parts around the page
// (top bar, the right-hand panel, the player bar and the "Playing on ..."
// strip) stay nearly black, only tinted deep purple, so the page keeps the
// focus. Spotify's green there turns Prism pastel: the play/pause button gets
// the pink-to-lavender gradient, progress and volume fills the same gradient,
// toggled icons (shuffle, queue, liked tick) pink. The "Playing on iPhone"
// strip becomes a thin pastel rainbow line with small lavender text.
//
// Same switch as the other theme parts (Settings > "Playlist theme"), but on
// EVERY page, because these bars never go away. Pure CSS: one attribute on
// <html> (Spotify never re-renders it) turns the style on.
//
// Spotify's greens here come from Spicetify's colour variables
// (--spice-button / --spice-button-active and their rgb twins) and Spotify's
// own --text-bright-accent / --essential-bright-accent, so swapping those
// on the bars recolours every green in them at once.

import { loadPlaylistThemeSetting } from "../storage";
import { parsePlaylistTheme, PLAYLIST_THEME_CHANGED_EVENT } from "../theme/playlistTheme";

const STYLE_ID = "playlist-prism-chrome-theme";
const ATTR = "data-prism-chrome"; // on <html> while a theme is on

const NIGHT = "#0b0817"; // bars and the gaps between panels
const PANEL = "#151029"; // right-hand panel
const CARD = "#1d1638"; // cards and inputs on the bars
const CARD_HOVER = "#251c45";
const PINK = "#f6a6c8";
const GRADIENT = "linear-gradient(90deg, #f6a6c8, #b9a7ff)";
const RAINBOW = "linear-gradient(90deg, #f6a6c8, #ffd59e, #9fe3d0, #a9d4ff, #b9a7ff)";

// Right-click menus: clear frost over a deep purple tint (so the menu stays
// readable over a light album cover), icons in Prism pastels by turn.
const MENU_GLASS =
  "linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06)), rgba(43, 26, 82, 0.62)";
const MENU_ICON_COLOURS = ["#f4c0d1", "#cdb8ff", "#9fe1cb", "#b5d4f4"];

const ON = `html[${ATTR}]`;
const BARS = [".Root__globalNav", ".Root__now-playing-bar", ".Root__right-sidebar"].map((s) => `${ON} ${s}`).join(",\n");

const CSS = `
/* ----- Spotify's bars, "Quiet night" (src/ui/chromeTheme.ts) ----- */
${BARS} {
  --spice-button: ${PINK};
  --spice-button-active: ${PINK};
  --spice-rgb-button: 246, 166, 200;
  --spice-rgb-button-active: 246, 166, 200;
  --text-bright-accent: ${PINK};
  --essential-bright-accent: ${PINK};
  --background-elevated-base: ${CARD};
  --background-elevated-highlight: ${CARD_HOVER};
  --background-tinted-base: rgba(205, 184, 255, 0.1);
  --background-tinted-highlight: rgba(205, 184, 255, 0.16);
}
${ON} .Root__top-container,
${ON} .Root__globalNav,
${ON} .Root__nav-bar,
${ON} .Root__now-playing-bar { background-color: ${NIGHT} !important; }

/* Top bar: the round buttons and the search box. */
${ON} .Root__globalNav button[class*="legacy-button"],
${ON} .Root__globalNav .spicetify-sc-chevronBtn,
${ON} .Root__globalNav input { background-color: ${CARD} !important; }
${ON} .Root__globalNav button[class*="legacy-button"]:hover,
${ON} .Root__globalNav input:hover { background-color: ${CARD_HOVER} !important; }

/* Right-hand panel (Now Playing, Queue, ...): Spotify paints #121212 on its
   outer boxes; its cards (Credits, Next in queue...) read the elevated
   colours set above. */
${ON} .Root__right-sidebar { --background-base: ${PANEL}; --background-highlight: ${CARD}; }
${ON} .Root__right-sidebar .Root__right-sidebar-peek,
${ON} .Root__right-sidebar aside,
${ON} .Root__right-sidebar .main-nowPlayingView-container { background-color: ${PANEL} !important; }

/* Player: play/pause gets the Prism play-button gradient, fills the pastel gradient. */
${ON} .Root__now-playing-bar [data-testid="control-button-playpause"] [class*="button-primary__inner"] {
  background: linear-gradient(135deg, #f6a6c8, #b9a7ff) !important;
  color: #2b1d52 !important;
}
${ON} .Root__now-playing-bar .x-progressBar-fillColor { background: ${GRADIENT} !important; }

/* "Playing on iPhone": a thin rainbow line, small lavender text. */
${ON} .main-connectBar-connectBar { background: transparent !important; color: #cdb8ff !important; }
${ON} .main-connectBar-connectBar * { color: #cdb8ff !important; }
${ON} .main-connectBar-connectBar::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
  border-radius: 3px; background: ${RAINBOW}; pointer-events: none;
}

/* Right-click menus and their sub-menus (look "D, clear frost", developer's
   pick 2026-11-25): see-through frosted glass with a white rim and top shine,
   pastel icons (pink, lavender, mint, sky in turn), and Prism's standard
   hover (lavender rim + glow). Spotify's menus are Encore components: the box
   is [data-encore-id="menu"], each line [data-encore-id="menuRow"], which
   marks hover / keyboard focus / an open sub-menu with data-hovered,
   data-focused and data-open. They live in <body> (tippy pop-ups), so they
   are styled on every page. */
${ON} [data-encore-id="menu"],
${ON} [data-encore-id="popover"][data-trigger="ContextMenuSubmenu"] {
  background: ${MENU_GLASS} !important;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 16px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 14px 34px rgba(10, 0, 30, 0.45) !important;
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
}
/* A sub-menu with a search box ("Add to playlist") is a popover holding the
   search box and a menu: the popover is the one glass card, the menu inside
   it goes clear, and the search box is a glass text box. */
${ON} [data-trigger="ContextMenuSubmenu"] [data-encore-id="menu"] {
  background: transparent !important;
  border: 0;
  box-shadow: none !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
/* Spotify fades a scrolling menu's top/bottom edge into its grey (#242424). */
${ON} [data-encore-id="menu"]::before,
${ON} [data-encore-id="menu"]::after { background-image: none !important; }
${ON} [data-trigger="ContextMenuSubmenu"] input {
  background: rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  border-radius: 12px !important;
}
${ON} [data-trigger="ContextMenuSubmenu"] input:focus { border-color: rgba(205, 184, 255, 0.75) !important; box-shadow: 0 0 0 3px rgba(205, 184, 255, 0.25); }
${ON} [data-encore-id="menuRow"] {
  border-radius: 9px;
  transition: background 150ms ease-out, box-shadow 150ms ease-out;
}
${ON} [data-encore-id="menuRow"]:is([data-hovered], [data-focused], [data-open]) {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(205, 184, 255, 0.1)) !important;
  box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.75), 0 0 12px rgba(205, 184, 255, 0.4);
}
${ON} [data-encore-id="menu"] [class*="menu-divider"] { border-color: rgba(255, 255, 255, 0.14) !important; background-color: rgba(255, 255, 255, 0.14) !important; }
${MENU_ICON_COLOURS.map(
  (c, i) =>
    `${ON} [data-encore-id="menuRow"]:nth-child(${MENU_ICON_COLOURS.length}n+${i + 1}) > :first-child svg { color: ${c} !important; fill: ${c} !important; }`,
).join("\n")}
`;

export function startChromeTheme(): void {
  const apply = () => {
    const on = parsePlaylistTheme(loadPlaylistThemeSetting()) !== "none";
    let style = document.getElementById(STYLE_ID);
    if (!on) {
      style?.remove();
      document.documentElement.removeAttribute(ATTR);
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    document.documentElement.setAttribute(ATTR, "");
  };
  apply();
  window.addEventListener(PLAYLIST_THEME_CHANGED_EVENT, apply);
}
