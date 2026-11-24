// PLAYLIST THEMES (developer's picks 2026-11-24, mockups H1/H2/H3): a moving
// background for Spotify's playlist pages, a colour rail beside the songs
// (each song's part in its main genre's colour) and a genre-mix bar under
// the title. Picked in Prism Settings, saved in LocalStorage only.
//
// PURE (no Spotify, no DOM): tests/playlistTheme.test.ts. The page side is
// src/ui/playlistTheme.ts.

import type { SourcedTag } from "../tags/combineTags";
import { isJunkTagName } from "../tags/cleanTags";
import { tagColours } from "../ui/tagLabels";

export type PlaylistThemeId = "none" | "aurora" | "stars" | "nebula";

// In the order Settings shows them.
export const PLAYLIST_THEMES: { id: PlaylistThemeId; label: string }[] = [
  { id: "none", label: "No theme" },
  { id: "aurora", label: "Northern lights" },
  { id: "stars", label: "Starry night" },
  { id: "nebula", label: "Bubble nebula" },
];

// Settings sends this after a change, so open playlists update at once.
export const PLAYLIST_THEME_CHANGED_EVENT = "playlist-prism:playlist-theme-changed";

// The saved text -> a theme. Nothing saved, or anything unknown, = no theme.
export function parsePlaylistTheme(saved: string | null): PlaylistThemeId {
  return PLAYLIST_THEMES.some((t) => t.id === saved) ? (saved as PlaylistThemeId) : "none";
}

// A song's main genre: its strongest tag that isn't a personal label.
// null = no tags (not scanned yet, or Last.fm had none).
export function mainGenre(tags: SourcedTag[] | null | undefined): string | null {
  let best: SourcedTag | null = null;
  for (const tag of tags ?? []) {
    if (isJunkTagName(tag.name)) continue;
    if (!best || tag.weight > best.weight) best = tag;
  }
  return best ? best.name.toLowerCase() : null;
}

export interface GenreMix {
  rows: { name: string; count: number; share: number }[]; // share 0-100, rounded
  otherCount: number; // songs whose genre isn't in rows
  scanned: number; // songs with a main genre
  total: number;
}

// How the playlist's songs split by main genre: the top `max` genres, the
// rest counted as "other". Shares are of the scanned songs only.
export function genreMix(mains: (string | null)[], max = 5): GenreMix {
  const counts = new Map<string, number>();
  for (const name of mains) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  const scanned = [...counts.values()].reduce((sum, n) => sum + n, 0);
  // Most songs first; ties alphabetically so the order never jumps around.
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const rows = sorted.slice(0, max).map(([name, count]) => ({ name, count, share: Math.round((count / scanned) * 100) }));
  const otherCount = sorted.slice(max).reduce((sum, [, n]) => sum + n, 0);
  return { rows, otherCount, scanned, total: mains.length };
}

// Colours for every genre on the page: the most common first, so the top
// genres never share a colour (same rule as the stats page).
export function genreColours(mains: (string | null)[]): Map<string, string> {
  const mix = genreMix(mains, Number.MAX_SAFE_INTEGER);
  return tagColours(mix.rows.map((r) => r.name));
}

// The caption under the genre-mix bar.
export function mixCaption(mix: GenreMix): string {
  if (mix.scanned === 0) return "Genres show here once Prism has scanned these songs";
  const parts = mix.rows.map((r) => `${r.name} ${r.share}%`);
  if (mix.otherCount > 0) parts.push(`other ${Math.round((mix.otherCount / mix.scanned) * 100)}%`);
  const from = mix.scanned < mix.total ? ` (from ${mix.scanned} of ${mix.total} songs)` : "";
  return parts.join(" · ") + from;
}
