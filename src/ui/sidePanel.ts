// Prism stats in Spotify's right-hand Now Playing panel: the PURE parts
// (unit-tested in tests/sidePanel.test.ts). The panel itself is
// src/ui/PanelStats.tsx, and src/ui/panelHost.tsx puts it on screen.
//
// Shown while the open page is a playlist Prism made or organized, i.e. one
// with a saved record. Read-only: it never changes the playlist.

import type { PrismPlaylistRecord, PrismPlaylistRecords } from "../stats/playlistStats";

// Event the Settings page sends after the "Prism stats in the side panel"
// switch changes, so the panel updates straight away.
export const PANEL_STATS_CHANGED_EVENT = "playlist-prism:panel-stats-changed";

// The saved text ("on" / "off" / nothing yet) -> on or off. Only an explicit
// "off" turns it off, so it's on for everyone by default.
export function isPanelStatsOn(saved: string | null): boolean {
  return saved !== "off";
}

// "/playlist/4cCN2s73MfFCG1Rti184H2" -> "spotify:playlist:4cCN2s73MfFCG1Rti184H2".
// Anything else (home, search, an album, Prism's own page...) -> null.
export function playlistUriFromPath(path: string): string | null {
  const match = /^\/playlist\/([A-Za-z0-9]{22})\/?$/.exec(path);
  return match ? `spotify:playlist:${match[1]}` : null;
}

// The saved record for the playlist open at `path`, or null. Estimates are
// never saved as records, so this only finds playlists Prism made or organized.
export function panelRecordFor(path: string, records: PrismPlaylistRecords): PrismPlaylistRecord | null {
  const uri = playlistUriFromPath(path);
  return uri ? records[uri] ?? null : null;
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
