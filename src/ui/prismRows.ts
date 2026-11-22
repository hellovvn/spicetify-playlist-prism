// Purple hover with drifting rainbow rays for playlists Prism made, in Spotify's sidebar ("Your Library").
//
// Spotify draws the sidebar, so we can't change its React code. Instead this
// adds a <style> tag with one rule per Prism playlist. Each sidebar row
// contains an element labelled "listrow-title-spotify:playlist:<ID>", and CSS
// :has() lets us style the ROW that contains it, only while hovered.
//
// Which playlists: ones with a saved record (made since 2026-11-22), plus ones
// still named with Prism's default "Prism · " (older ones, made before records
// were saved). Runs from the always-on script (src/extensions/prism.tsx).
// prismRowCss is PURE (tests/prismRows.test.ts).

import { isPlaylistUri } from "../nav";
import { loadPlaylistRecordsText } from "../storage";
import { parseRecords } from "../stats/playlistStats";
import { NAME_PREFIX } from "../organize/createPlaylists";

const STYLE_ID = "playlist-prism-sidebar-rows";
export const DEFAULT_NAME_PREFIX = NAME_PREFIX; // one copy, shared with Organize

// The CSS for these playlists' sidebar rows (empty if none).
export function prismRowCss(uris: string[]): string {
  const valid = [...new Set(uris)].filter(isPlaylistUri);
  if (valid.length === 0) return "";
  // [role="row"]:has(...) = "the row that contains this playlist's title".
  const rows = (after: string) =>
    valid.map((uri) => `[role="row"]:has([aria-labelledby^="listrow-title-${uri}"]):hover [data-encore-id="listRow"]${after}`).join(",\n");
  // Spotify paints its grey hover on the row's ::after layer (on top of the
  // row), so the purple goes on that same layer, plus a light rim on the row.
  // On top of the purple: two soft rainbow "rays" (like the light bands on
  // Prism's own page) that sway across the row. They are extra background
  // layers (the first one listed is drawn on top), wider than the row
  // (background-size 260% / 340%), and the animation slides their
  // background-position, so the bands drift across at two different speeds.
  return `
/* Prism playlists: a purple twilight glow with rainbow rays on hover (see src/ui/prismRows.ts). */
${rows("::after")} {
  background:
    linear-gradient(105deg, transparent 32%, rgba(255, 150, 200, 0.4) 39%, rgba(255, 205, 150, 0.36) 44%, rgba(255, 240, 150, 0.32) 49%, rgba(150, 240, 190, 0.32) 54%, rgba(140, 200, 255, 0.36) 59%, rgba(190, 160, 255, 0.4) 64%, transparent 71%) 0 0 / 260% 100% no-repeat,
    linear-gradient(125deg, transparent 40%, rgba(190, 160, 255, 0.28) 46%, rgba(140, 200, 255, 0.26) 50%, rgba(150, 240, 190, 0.24) 54%, rgba(255, 150, 200, 0.26) 58%, transparent 64%) 0 0 / 340% 100% no-repeat,
    linear-gradient(100deg, rgba(123, 63, 228, 0.6), rgba(77, 34, 112, 0.55) 55%, rgba(192, 79, 216, 0.45)) !important;
  animation: prism-row-rays 3.2s ease-in-out infinite alternate;
}
${rows("")} {
  box-shadow: inset 0 0 0 1px rgba(205, 184, 255, 0.35);
}
@keyframes prism-row-rays {
  from { background-position: 100% 0, 0% 0, 0 0; }
  to { background-position: 0% 0, 100% 0, 0 0; }
}
@media (prefers-reduced-motion: reduce) {
${rows("::after")} { animation: none; }
}
`;
}

// Playlists in the user's library that Prism made (read-only lookup).
async function findPrismPlaylists(): Promise<string[]> {
  const uris = Object.keys(parseRecords(loadPlaylistRecordsText()));
  try {
    const root = await Spicetify.Platform.RootlistAPI.getContents();
    const walk = (items: any[]) => {
      for (const item of items ?? []) {
        if (item?.type === "folder") walk(item.items);
        else if (typeof item?.name === "string" && item.name.startsWith(DEFAULT_NAME_PREFIX)) uris.push(item.uri);
      }
    };
    walk(root?.items);
  } catch (error) {
    console.warn("[Playlist Prism] couldn't read the library for sidebar styling", error);
  }
  return uris;
}

// Writes (or rewrites) the style tag.
export async function refreshPrismRows(): Promise<void> {
  const css = prismRowCss(await findPrismPlaylists());
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

// Event the page sends after saving a new playlist record (src/flow.ts).
export const RECORDS_CHANGED_EVENT = "playlist-prism:records-changed";

// Keeps the styling up to date: now, after Prism creates a playlist, and
// every 20 s (to catch playlists renamed or added elsewhere). Cheap: one
// local read plus Spotify's own library list.
export function startPrismRows(): void {
  refreshPrismRows();
  window.addEventListener(RECORDS_CHANGED_EVENT, () => refreshPrismRows());
  setInterval(() => refreshPrismRows(), 20000);
}
