// Prism stats in Spotify's right-hand Now Playing panel: the PURE parts
// (unit-tested in tests/sidePanel.test.ts). The panel itself is
// src/ui/PanelStats.tsx, and src/ui/panelHost.tsx puts it on screen.
//
// Shown on ANY playlist page while the Settings switch is on: a saved record
// for playlists Prism made or organized, an estimate (with a background scan)
// for the rest. Read-only: it never changes the playlist.

import type { PrismPlaylistRecord } from "../stats/playlistStats";

// Event the Settings page sends after the "Prism stats in the side panel"
// switch changes, so the panel updates straight away.
export const PANEL_STATS_CHANGED_EVENT = "prism:panel-stats-changed";

// The saved text ("on" / "off" / nothing yet) -> on or off. Only an explicit
// "off" turns it off, so it's on for everyone by default.
export function isPanelStatsOn(saved: string | null): boolean {
  return saved !== "off";
}

// The panel's two tabs (mockup "B"): "Prism stats" or Spotify's own "Now
// playing". ONE choice for every playlist, kept until switched back or
// Spotify restarts. It lives as an attribute on <html>, because the page
// (PrismPage: may the stats page minimize into the panel?) and the always-on
// script (panelHost) are separate bundles that only share the page.
export type PanelView = "prism" | "spotify";
export const PANEL_VIEW_ATTR = "data-prism-panel-view";

export function readPanelView(root: { getAttribute(name: string): string | null }): PanelView {
  return root.getAttribute(PANEL_VIEW_ATTR) === "spotify" ? "spotify" : "prism";
}

// "spotify:image:ab67…" -> a normal https address an <img> can show.
export function imageUrl(spotifyImage: string | undefined | null): string | null {
  if (!spotifyImage) return null;
  const match = /^spotify:image:([a-f0-9]+)$/.exec(spotifyImage);
  if (match) return `https://i.scdn.co/image/${match[1]}`;
  return /^https:\/\//.test(spotifyImage) ? spotifyImage : null;
}

// 5280000 ms -> "1 h 28 min"; 840000 -> "14 min".
export function formatLength(ms: number): string {
  const minutes = Math.round(ms / 60000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

// The line under the playlist name.
export function panelSubtitle(record: PrismPlaylistRecord): string {
  if (record.seed) return `Grown from "${record.seed.name}" · ${record.seed.artists.join(", ")}`;
  // Not the source playlists' names: those playlists may be deleted later.
  if (record.organized) return "Organized with Prism";
  // An estimate for a playlist Prism didn't make: say how much of it is known.
  if (record.estimate && record.estimate.scanned < record.songCount) {
    return `${record.songCount} songs · stats from ${record.estimate.scanned} scanned`;
  }
  return `${record.songCount} songs`;
}

// 146000 ms -> "2:26".
export function formatClock(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// When the playlist was made, short: "22 Nov 2026" (null when unknown).
export function madeOn(record: PrismPlaylistRecord): string | null {
  return record.createdAt === null
    ? null
    : new Date(record.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// A playlist's cover address -> the image(s) to show. Spotify gives either one
// image ("spotify:image:<id>" or https) or a MOSAIC of four album covers,
// "spotify:mosaic:<id>:<id>:<id>:<id>", shown as a 2x2 grid.
export function artworkUrls(cover: string | null | undefined): string[] {
  if (!cover) return [];
  const mosaic = /^spotify:mosaic:(.+)$/.exec(cover);
  if (mosaic) {
    return mosaic[1]
      .split(":")
      .filter((id) => /^[a-f0-9]+$/.test(id))
      .map((id) => `https://i.scdn.co/image/${id}`);
  }
  const single = imageUrl(cover);
  return single ? [single] : [];
}
