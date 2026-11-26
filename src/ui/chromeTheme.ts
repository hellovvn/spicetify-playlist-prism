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

const STYLE_ID = "prism-chrome-theme";
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

/* Left panel: the round "+" (Create) button reads the elevated colours
   (Spotify's grey #1f1f1f / #2a2a2a), so give it the same cards as the top bar. */
${ON} .Root__nav-bar {
  --background-elevated-base: ${CARD};
  --background-elevated-highlight: ${CARD_HOVER};
  /* Round icon buttons (Expand Your Library...) are see-through and hover /
     press in Spotify's grey --background-highlight / --background-press. */
  --background-highlight: ${CARD_HOVER};
  --background-press: ${CARD};
}
/* Picture placeholders in the side panels and the player (a FOLDER's icon tile
   in Your Library, and the square behind covers while they load) read
   --image-placeholder-bg-color (Spotify's grey #282828). */
${ON} .Root__nav-bar,
${ON} .Root__right-sidebar,
${ON} .Root__now-playing-bar { --image-placeholder-bg-color: ${CARD}; }

/* The playing song's "equaliser" in song lists is a green picture, which no
   colour variable reaches: /images/equaliser-animated-green.gif while Spotify's
   window has focus, the still /images/equaliser-green.svg while it doesn't.
   This filter turns every pixel Prism pink (#f6a6c8) and keeps the animation. */
${ON} img[src*="equaliser-animated-green"],
${ON} img[src*="equaliser-green"] {
  filter: brightness(0) saturate(100%) invert(80%) sepia(30%) saturate(900%) hue-rotate(290deg);
}

/* Right-hand panel (Now Playing, Queue, ...): Spotify paints #121212 on its
   outer boxes; its cards (Credits, Next in queue...) read the elevated
   colours set above. */
${ON} .Root__right-sidebar { --background-base: ${PANEL}; --background-highlight: ${CARD}; }
/* Friend activity: the "listening now" dot on a friend's photo reads
   --spice-notification (Spotify blue -> lavender); a friend without a photo
   gets a circle in --spice-button-disabled (grey #535353 -> deep purple).
   The panel's own background (the theme, mirrored) is set in libraryTheme.ts. */
${ON} .Root__right-sidebar {
  --spice-notification: #cdb8ff;
  --spice-rgb-notification: 205, 184, 255;
  --spice-button-disabled: #3a2d5e;
}
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
/* Menus carry Spotify's .encore-dark-theme class, which sets the green accent
   again on the menu itself, so the bars' swap never reaches them: ticked rows
   (e.g. a song list's "Change visible columns") showed green text and boxes. */
${ON} [data-encore-id="menu"],
${ON} [data-encore-id="popover"] {
  --text-bright-accent: ${PINK};
  --essential-bright-accent: ${PINK};
  --spice-button: ${PINK};
  --spice-button-active: ${PINK};
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
/* That inner menu scrolls (overflow: auto) with no padding of its own, so the
   hover rim + glow of its first and last rows were cut off. Room for them: */
${ON} [data-trigger="ContextMenuSubmenu"] [data-encore-id="menu"] { padding: 4px !important; }
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

/* Spotify's DIALOGS (step 16h, developer's pick "A, Prism pop-up"): every
   pop-up Spotify opens in its GenericModal (Edit details, credits, keyboard
   shortcuts...) looks like Prism's own pop-up: the page behind dims and blurs
   (.prism-overlay) and the box is the glass card (.prism-glass-card, 20px
   corners). Text boxes are the glass text box (.prism-glass-input), the main
   button is Prism's main button (solid lavender, dark text, glow on hover),
   and Spotify's blue character counters turn lavender. The values are copied
   from styles.ts because these dialogs live outside the Prism page. */
${ON} .GenericModal__overlay,
${ON} dialog[open]::backdrop {
  background: rgba(20, 8, 40, 0.45) !important;
  backdrop-filter: blur(6px);
}
${ON} .GenericModal__overlay { --spice-notification: #b794ff; }
/* Some of Spotify's pop-ups (Keyboard shortcuts, Credits) are native <dialog>
   elements instead: the <dialog> is exactly the box, so it gets the glass card
   and a single box inside it (Credits' #121212 container) goes clear. */
${ON} dialog[open] { overflow: hidden; }
${ON} dialog[open] > :only-child { background: transparent !important; border-radius: 0 !important; }
${ON} dialog[open],
${ON} .GenericModal__overlay [role="dialog"] > * {
  border-radius: 20px !important;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.05)), rgba(43, 26, 82, 0.55) !important;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 20px 50px rgba(10, 0, 30, 0.5) !important;
  backdrop-filter: blur(18px) saturate(140%);
}
${ON} .GenericModal__overlay :is(input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea) {
  border-radius: 12px !important;
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.08) !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25) !important;
  outline: none !important;
}
${ON} .GenericModal__overlay :is(input, textarea):focus {
  border-color: #cdb8ff !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25), 0 0 0 3px rgba(205, 184, 255, 0.25) !important;
}
${ON} .GenericModal__overlay :is(input, textarea)::placeholder { color: rgba(255, 255, 255, 0.5) !important; }
${ON} :is(.GenericModal__overlay, dialog[open]) ::selection { background: rgba(183, 148, 255, 0.55); color: #ffffff; }
${ON} .GenericModal__overlay [class*="CharacterCounter"] { background-color: #b794ff !important; color: #1a1030 !important; }
${ON} .GenericModal__overlay [data-encore-id="buttonPrimary"],
${ON} .GenericModal__overlay [data-encore-id="buttonPrimary"] > span { transform: none !important; }
${ON} .GenericModal__overlay [data-encore-id="buttonPrimary"] > span {
  background: #b794ff !important;
  color: #1a1030 !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transition: background-color 150ms ease-out, box-shadow 150ms ease-out;
}
${ON} .GenericModal__overlay [data-encore-id="buttonPrimary"]:hover:not(:disabled) > span {
  background: #c6a8ff !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 0 14px rgba(205, 184, 255, 0.55);
}
${ON} .GenericModal__overlay [data-encore-id="buttonPrimary"]:active:not(:disabled) > span { transform: scale(0.97) !important; }

/* ----- Tooltips, "night + rainbow line" (mockup "D" of four, 2026-11-25) -----
   Spotify's tooltips are a .main-contextMenu-tippy box (grey #282828) inside
   [data-tippy-root], holding a [role="tooltip"] span. Right-click menus can
   use the same box, so only boxes that hold a tooltip are touched. */
${ON} [data-tippy-root] .main-contextMenu-tippy:has(> [role="tooltip"]) {
  position: relative;
  overflow: hidden;
  background: ${NIGHT} !important;
  color: #e9dcff !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px !important;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5) !important;
}
${ON} [data-tippy-root] .main-contextMenu-tippy:has(> [role="tooltip"]) > [role="tooltip"] { color: #e9dcff !important; }
${ON} [data-tippy-root] .main-contextMenu-tippy:has(> [role="tooltip"])::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: ${RAINBOW};
  pointer-events: none;
}

/* ----- Toasts, "night + rainbow line" (look "A" of four, 2026-11-25) -----
   The same look as the tooltips. Two kinds live in notistack's
   .notistack-Snackbar: Spotify's own ("Removed from ...") is an Encore box in
   Spotify's LIGHT theme (white, black text); Spicetify.showNotification's is a
   .notistack-MuiContent (-default grey, -error red). Errors keep the night box
   but get a pink line and a pink icon instead of Spotify's red. */
${ON} .notistack-Snackbar [role="alert"] > [data-encore-id="box"],
${ON} .notistack-Snackbar .notistack-MuiContent {
  position: relative;
  overflow: hidden;
  background: ${NIGHT} !important;
  color: #e9dcff !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px !important;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5) !important;
}
${ON} .notistack-Snackbar [role="alert"] > [data-encore-id="box"] [data-encore-id="text"] { color: #e9dcff !important; }
${ON} .notistack-Snackbar [role="alert"] > [data-encore-id="box"] :is(button, a) { color: #cdb8ff !important; }
${ON} .notistack-Snackbar [role="alert"] > [data-encore-id="box"]::after,
${ON} .notistack-Snackbar .notistack-MuiContent::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: ${RAINBOW};
  pointer-events: none;
}
${ON} .notistack-Snackbar .notistack-MuiContent-error::after { background: linear-gradient(90deg, #ff8fae, #f6a6c8); }
${ON} .notistack-Snackbar .notistack-MuiContent-error svg { color: #ff8fae !important; fill: #ff8fae !important; }

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
