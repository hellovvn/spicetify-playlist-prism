// LYRICS SIDE BY SIDE (14d, layout "C, lyrics first" + "switch inside the
// view", developer's picks 2026-11-27).
//
// Spotify's lyrics button opens its expanded Now Playing view
// (.Root__cinema-view) over the left panel, the middle and the right panel.
// In "Side by side" mode this squeezes that view into the right ~62% of the
// middle + right panel, and stretches the middle view (.Root__main-view) over
// the rest, so the playlist that's playing sits on the left and the lyrics on
// the right. Two small round buttons (Full / Side by side) sit at the top of
// the lyrics view, left of Spotify's own; the choice is saved
// (prism:lyricsLayout) so the lyrics button opens the one used last.
//
// Spotify still draws and scrolls the lyrics itself: this only moves boxes
// with CSS (behind html[data-prism-lyrics-split]). Nothing here reads, stores
// or logs any lyrics text.

import { loadLyricsLayoutSetting, saveLyricsLayoutSetting } from "../storage";
import { lyricsSkyTheme } from "./lyricsTheme";
import { buildSky } from "./playlistTheme";

export type LyricsLayout = "split" | "full";

const SPLIT_ATTR = "data-prism-lyrics-split";
// Side by side with a playlist theme: ONE sky behind both halves.
const ONE_SKY_ATTR = "data-prism-lyrics-one-sky";
const SHARED_SKY_CLASS = "prism-split-sky";
// Lyrics open AND room for both (either layout): keeps the middle view laid out.
const ROOM_ATTR = "data-prism-lyrics-room";
const STYLE_ID = "prism-lyrics-split";
const SWITCH_CLASS = "prism-lyrics-layout";
// Side by side needs room for both: below this (middle + right panel, px) the
// lyrics stay full.
export const MIN_SPLIT_WIDTH = 980;

// The saved text -> layout. PURE (tests/lyricsSplit.test.ts). Side by side is
// the default: it's the reason the feature exists. Only "full" means full.
export function parseLyricsLayout(saved: string | null): LyricsLayout {
  return saved === "full" ? "full" : "split";
}

// The page that lists the songs of what's playing, or null when it isn't a
// list (radio, an artist, a single song...). PURE (tested).
export function listPathFor(contextUri: string | undefined | null): string | null {
  if (!contextUri) return null;
  const parts = contextUri.split(":");
  if (parts[0] !== "spotify") return null;
  if ((parts[1] === "playlist" || parts[1] === "album") && parts[2]) return `/${parts[1]}/${parts[2]}`;
  if (parts[1] === "user" && parts[3] === "collection") return "/collection/tracks"; // Liked Songs
  return null;
}

const SPLIT_CSS = `
/* The lyrics: from the middle view's start to the right panel's end, then
   pushed right past the playlist's share (a % margin is of that same width). */
html[${SPLIT_ATTR}] .Root__cinema-view {
  grid-column: main-view-start / right-sidebar-end !important;
  margin-left: calc(38% + 8px) !important;
}
/* Spotify's immersive mode adds negative margins: keep ours. */
html[${SPLIT_ATTR}] .Root__cinema-view.Root__cinema-view--controls-hidden {
  margin: 0 0 0 calc(38% + 8px) !important;
  height: auto !important;
  z-index: 5 !important;
}
/* The playlist: the middle view stretched over the same columns, 38% wide.
   While the expanded view is open Spotify hides the middle view
   (display: none) and slides the left panel off screen (transform), and
   marks both inert (undone in JS, see keepUsable).
   SPEED: the middle view stays laid out (hidden) the whole time the lyrics
   are open, in BOTH layouts. Unhiding it from display: none made Spotify
   re-render and re-lay out the whole page (~0.5 s stutter on every switch to
   Side by side); now a switch only moves the line between the two. */
html[${ROOM_ATTR}] .Root__main-view {
  grid-column: main-view-start / right-sidebar-end !important;
  width: 38% !important;
  display: flex !important;
}
html[${ROOM_ATTR}]:not([${SPLIT_ATTR}]) .Root__main-view {
  visibility: hidden !important;
}
html[${SPLIT_ATTR}] .Root__main-view {
  transform: none !important;
}
html[${SPLIT_ATTR}] .Root__nav-bar {
  transform: none !important;
}
/* ONE SKY (speed, 2026-11-27): side by side, the playlist page's sky and the
   lyrics' sky were two full animated skies at once (Milky Way: 2 x 264
   twinkling stars, ~25 fps). Instead one sky (.prism-split-sky, built for
   the whole area) sits behind both halves; the two own skies are switched
   off (display: none stops their animations) and the backgrounds above it
   are cleared. The lyrics' reading veil stays. */
.${SHARED_SKY_CLASS} {
  grid-row: main-view;
  grid-column: main-view-start / right-sidebar-end;
  position: relative;
  z-index: 0;
  isolation: isolate;
  overflow: hidden;
  border-radius: 8px;
  pointer-events: none;
}
html[${ONE_SKY_ATTR}] .Root__main-view > .prism-pl-sky { display: none !important; }
html[${ONE_SKY_ATTR}] .Root__main-view { background: transparent !important; }
html[${ONE_SKY_ATTR}] .prism-lyrics-sky { background: none !important; }
html[${ONE_SKY_ATTR}] .prism-lyrics-sky > :not(.prism-lyrics-veil) { display: none !important; }
html[${ONE_SKY_ATTR}] .Root__cinema-view > .main-actionBar-ActionBarContainer { background: transparent !important; }
/* The right panel is covered by the lyrics. */
html[${SPLIT_ATTR}] .Root__right-sidebar {
  visibility: hidden !important;
}
/* The Full / Side by side switch (look "A, two icon buttons", 2026-11-27):
   two 32px round glass buttons, the size of Spotify's own buttons beside
   them; the chosen one has the pastel gradient. */
.${SWITCH_CLASS} {
  display: flex;
  gap: 8px;
  margin-right: 16px;
  align-items: center;
}
.${SWITCH_CLASS}.is-floating {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  margin: 0;
}
.${SWITCH_CLASS} button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: border-color 150ms ease-out, background 150ms ease-out, box-shadow 150ms ease-out;
}
.${SWITCH_CLASS} button:hover {
  border-color: rgba(205, 184, 255, 0.75);
  background: rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 0 12px rgba(205, 184, 255, 0.4);
}
.${SWITCH_CLASS} button:active { transform: scale(0.97); }
.${SWITCH_CLASS} button:focus-visible { outline: 2px solid #cdb8ff; outline-offset: 2px; }
.${SWITCH_CLASS} button.on {
  background: linear-gradient(135deg, #ffb3d1, #bdb2ff);
  border-color: rgba(255, 255, 255, 0.45);
  color: #1b0b33;
}
.${SWITCH_CLASS} svg { width: 16px; height: 16px; display: block; }
`;

let wasSplit = false;

function mode(): LyricsLayout {
  return parseLyricsLayout(loadLyricsLayoutSetting());
}

function lyricsShowing(view: Element | null): boolean {
  if (!view) return false;
  return document.querySelector('[data-testid="lyrics-button"]')?.getAttribute("data-active") === "true";
}

// Room for both? Measured on the whole window minus the left panel, so it
// gives the same answer whether the split is on or not.
function wideEnough(): boolean {
  const top = document.querySelector(".Root__top-container");
  const nav = document.querySelector(".Root__nav-bar");
  if (!top) return false;
  return top.getBoundingClientRect().width - (nav?.getBoundingClientRect().width ?? 0) >= MIN_SPLIT_WIDTH;
}

// Opens the playing playlist/album/Liked Songs in the middle view, unless
// it's already there.
function openPlayingList(): void {
  const path = listPathFor(Spicetify.Player?.data?.context?.uri);
  const history = Spicetify.Platform?.History;
  if (!path || !history || history.location?.pathname === path) return;
  history.push(path);
}

// Spotify makes the middle view and the left panel inert (no clicks, no
// keyboard) while its expanded view is open. Side by side they're visible,
// so they must work. Spotify sets it again on its redraws: runs every check.
function keepUsable(): void {
  document.querySelectorAll<HTMLElement>(".Root__main-view, .Root__nav-bar").forEach((el) => {
    if (el.inert) el.inert = false;
  });
}

const ICONS: Record<LyricsLayout, string> = {
  full: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  split:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 3v10" stroke="currentColor" stroke-width="1.5"/></svg>',
};
const LABELS: Record<LyricsLayout, string> = { full: "Full lyrics", split: "Lyrics side by side" };

// Adds (or updates) the Full / Side by side buttons in the lyrics view's title
// row, just left of Spotify's own round buttons (artwork, Canvas, lyrics...).
// Spotify may redraw that row, so this runs on every check.
function syncSwitch(view: Element | null, show: boolean): void {
  const existing = document.querySelector<HTMLElement>(`.${SWITCH_CLASS}`);
  const header = view?.querySelector<HTMLElement>('[style*="--header-text-color"]');
  if (!show || !header) {
    existing?.remove();
    return;
  }
  // Spotify's button group (artwork, Canvas, artist image, lyrics): ours goes
  // in front of it, as a sibling (never inside Spotify's own list).
  const group = header.querySelector('[aria-label="Show artwork"]')?.parentElement ?? null;
  const parent = group?.parentElement ?? header;
  let box = existing;
  if (!box || box.parentElement !== parent || (group && box.nextElementSibling !== group)) {
    existing?.remove();
    box = document.createElement("div");
    box.className = SWITCH_CLASS;
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Lyrics layout");
    box.setAttribute("data-prism", "lyrics-layout");
    for (const value of ["full", "split"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = ICONS[value];
      button.title = LABELS[value];
      button.setAttribute("aria-label", LABELS[value]);
      button.dataset.layout = value;
      button.addEventListener("click", () => {
        saveLyricsLayoutSetting(value);
        update();
      });
      box.appendChild(button);
    }
    if (group) parent.insertBefore(box, group);
    else {
      // Spotify's buttons not found: float at the row's right end.
      box.classList.add("is-floating");
      if (getComputedStyle(header).position === "static") header.style.position = "relative";
      header.appendChild(box);
    }
  }
  const current = mode();
  box.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    const on = b.dataset.layout === current;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

// Side by side with a themed lyrics view: one shared sky behind both halves
// (see ONE SKY in the CSS). Rebuilt when the theme changes or the area's
// width changes a lot (its star count follows the size); removed otherwise.
function syncSharedSky(split: boolean): void {
  const top = document.querySelector(".Root__top-container");
  const existing = document.querySelector<HTMLElement>(`.${SHARED_SKY_CLASS}`);
  const theme = split ? lyricsSkyTheme() : "none";
  const themed = split && theme !== "none" && !!document.querySelector(".Root__cinema-view .prism-lyrics-sky");
  if (!themed || !top) {
    existing?.remove();
    document.documentElement.removeAttribute(ONE_SKY_ATTR);
    return;
  }
  const builtWidth = Number(existing?.dataset.width ?? 0);
  if (existing && existing.dataset.theme === theme && existing.parentElement === top) {
    const width = existing.getBoundingClientRect().width;
    if (Math.abs(width - builtWidth) <= builtWidth * 0.25) {
      document.documentElement.setAttribute(ONE_SKY_ATTR, "");
      return;
    }
  }
  existing?.remove();
  const host = document.createElement("div");
  host.className = SHARED_SKY_CLASS;
  host.dataset.theme = theme;
  top.insertBefore(host, top.firstChild);
  host.dataset.width = String(Math.round(host.getBoundingClientRect().width));
  host.appendChild(buildSky(theme, host, false));
  document.documentElement.setAttribute(ONE_SKY_ATTR, "");
}

function update(): void {
  const view = document.querySelector(".Root__top-container > .Root__cinema-view");
  const lyrics = lyricsShowing(view);
  const roomy = wideEnough();
  const split = lyrics && roomy && mode() === "split";
  const root = document.documentElement;
  root.toggleAttribute(ROOM_ATTR, lyrics && roomy);
  root.toggleAttribute(SPLIT_ATTR, split);
  if (split) keepUsable();
  if (split && !wasSplit) openPlayingList();
  wasSplit = split;
  syncSharedSky(split);
  syncSwitch(view, lyrics && roomy);
}

// Run once by the always-on script.
export function startLyricsSplit(): void {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = SPLIT_CSS;
    document.head.appendChild(style);
  }
  const top = document.querySelector(".Root__top-container");
  if (!top) {
    window.setTimeout(startLyricsSplit, 1000);
    return;
  }
  // The view is added to .Root__top-container when it opens. While it's
  // open, re-check twice a second (lyrics/artwork mode, Spotify redrawing the
  // title row); no timer while it's closed.
  let timer: number | null = null;
  const hook = () => {
    const open = !!top.querySelector(":scope > .Root__cinema-view");
    if (open && timer === null) timer = window.setInterval(update, 500);
    if (!open && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    update();
  };
  new MutationObserver(hook).observe(top, { childList: true });
  // Undo Spotify's inert at once (not only on the next check).
  const inertWatch = new MutationObserver(() => {
    if (wasSplit) keepUsable();
  });
  top.querySelectorAll(":scope > .Root__main-view, :scope > .Root__nav-bar").forEach((el) => inertWatch.observe(el, { attributes: true, attributeFilter: ["inert"] }));
  window.addEventListener("resize", update);
  hook();
}
