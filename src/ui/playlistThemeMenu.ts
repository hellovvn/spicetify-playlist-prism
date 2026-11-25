// "PRISM THEME" RIGHT-CLICK SUB-MENU (14b, developer's pick "A", 2026-11-25):
// right-click one playlist > Prism theme > pick a theme for THAT playlist.
// The main theme from Settings is marked "(default)"; picking it removes the
// playlist's own theme again. Each theme has a small swatch in its colours.
// The current choice's row is softly tinted lavender (look "D", developer's
// pick 2026-11-25): its swatch carries an invisible data-prism-chosen marker
// and CSS tints the row that holds it (menu text itself can't be styled).
//
// LOCAL ONLY: saved in "prism:playlistThemes" (parseThemeOverrides in
// src/theme/playlistTheme.ts). The playlist itself is NEVER changed.
// After a pick, PLAYLIST_THEME_CHANGED_EVENT makes the page, the lyrics and
// Settings update at once.

import { loadPlaylistThemeOverrides, loadPlaylistThemeSetting, savePlaylistThemeOverrides } from "../storage";
import {
  parsePlaylistTheme,
  parseThemeOverrides,
  PLAYLIST_THEMES,
  PLAYLIST_THEME_CHANGED_EVENT,
  withThemeOverride,
  type PlaylistThemeId,
} from "../theme/playlistTheme";

// Swatch colours (top-left to bottom-right) for each theme's menu icon.
const SWATCH: Record<PlaylistThemeId, string[]> = {
  none: ["#2a2a2a", "#121212"],
  twilight: ["#21143d", "#4d2270", "#6e2f7e"],
  aurora: ["#151236", "#3fbf9a", "#8ff7cf"],
  stars: ["#4a3290", "#1a1333", "#0f0b22"],
  milkyway: ["#070a20", "#6a5fb0", "#070a20"],
  nebula: ["#f6a6c8", "#2a1a4a", "#9fe3d0"],
  afterglow: ["#1c1238", "#592a5c", "#c9676a"],
  mist: ["#f0a8c4", "#4a4282", "#9fd8e6"],
  blossom: ["#ffd0e2", "#7a4069", "#3a2049"],
  rain: ["#ffd59e", "#2d2552", "#141a2e"],
};

// A 16px rounded swatch. Spicetify draws a full <svg> text as the item's icon.
function swatchSvg(theme: PlaylistThemeId, chosen = false): string {
  const colours = SWATCH[theme];
  const id = `prism-sw-${theme}`;
  const stops = colours.map((c, i) => `<stop offset="${Math.round((i / (colours.length - 1)) * 100)}%" stop-color="${c}"/>`).join("");
  return (
    `<svg width="16" height="16" viewBox="0 0 16 16"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>` +
    `<rect x="1" y="1" width="14" height="14" rx="4" fill="url(#${id})" stroke="rgba(255,255,255,0.35)" stroke-width="1"${chosen ? " data-prism-chosen" : ""}/></svg>`
  );
}

// The playlist the menu is open on (set by the sub-menu's shouldAdd).
let currentUri: string | null = null;
const themeItems: { id: PlaylistThemeId; item: Spicetify.ContextMenu.Item }[] = [];

const labelOf = (id: PlaylistThemeId) => PLAYLIST_THEMES.find((t) => t.id === id)?.label ?? id;
const mainTheme = () => parsePlaylistTheme(loadPlaylistThemeSetting());

// Picking the main theme (the one marked "(default)") removes the playlist's
// own theme, so it follows Settings again; any other pick is saved for it.
function choose(theme: PlaylistThemeId): void {
  if (!currentUri) return;
  const own = theme === mainTheme() ? null : theme;
  const next = withThemeOverride(parseThemeOverrides(loadPlaylistThemeOverrides()), currentUri, own);
  savePlaylistThemeOverrides(JSON.stringify(next));
  window.dispatchEvent(new Event(PLAYLIST_THEME_CHANGED_EVENT));
}

// Labels for the playlist the menu is open on: the main theme says
// "(default)", and the one this playlist shows gets the chosen marker.
function redraw(): void {
  if (!currentUri) return;
  const main = mainTheme();
  const shown = parseThemeOverrides(loadPlaylistThemeOverrides())[currentUri] ?? main;
  for (const { id, item } of themeItems) {
    item.name = `${labelOf(id)}${id === main ? " (default)" : ""}` as any;
    item.icon = swatchSvg(id, id === shown) as Spicetify.Icon;
  }
}

// The chosen row's tint. In its own style tag so it also shows with No theme
// (Spotify's grey menu); hover/keyboard focus keep the standard hover look.
const CHOSEN_CSS = `
[data-encore-id="menuRow"]:has([data-prism-chosen]):not([data-hovered]):not([data-focused]) {
  background: rgba(183, 148, 255, 0.22) !important;
  border-radius: 9px;
}`;

export function startPlaylistThemeMenu(icon: string, isSinglePlaylist: (uris: string[]) => boolean): void {
  const style = document.createElement("style");
  style.id = "prism-theme-menu-css";
  style.textContent = CHOSEN_CSS;
  document.head.appendChild(style);
  for (const { id, label } of PLAYLIST_THEMES) {
    themeItems.push({ id, item: new Spicetify.ContextMenu.Item(label, () => choose(id), () => true, swatchSvg(id) as Spicetify.Icon) });
  }
  // The 5th argument (icon) exists in Spicetify's code but not in its type list.
  const SubMenu = Spicetify.ContextMenu.SubMenu as any;
  new SubMenu(
    "Prism theme",
    themeItems.map((t) => t.item),
    (uris: string[]) => {
      if (!isSinglePlaylist(uris)) return false;
      currentUri = uris[0];
      setTimeout(redraw); // not during the menu's own drawing (shouldAdd runs while React draws it)
      return true;
    },
    false,
    icon
  ).register();
}
