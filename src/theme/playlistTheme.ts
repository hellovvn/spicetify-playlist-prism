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

export type PlaylistThemeId =
  | "none" | "aurora" | "stars" | "nebula"
  // Added 2026-11-25 (developer's picks): Prism's own twilight sky and six new looks.
  | "twilight" | "afterglow" | "mist" | "milkyway" | "rain" | "blossom";

// In the order Settings shows them.
export const PLAYLIST_THEMES: { id: PlaylistThemeId; label: string }[] = [
  { id: "none", label: "No theme" },
  { id: "twilight", label: "Twilight" },
  { id: "aurora", label: "Northern lights" },
  { id: "stars", label: "Starry night" },
  { id: "milkyway", label: "Milky Way" },
  { id: "nebula", label: "Bubble nebula" },
  { id: "afterglow", label: "Afterglow" },
  { id: "mist", label: "Misty morning" },
  { id: "blossom", label: "Blossom canopy" },
  { id: "rain", label: "Window rain" },
];

// Settings sends this after a change, so open playlists update at once.
export const PLAYLIST_THEME_CHANGED_EVENT = "playlist-prism:playlist-theme-changed";

// The saved text -> a theme. Nothing saved, or anything unknown, = no theme.
export function parsePlaylistTheme(saved: string | null): PlaylistThemeId {
  return PLAYLIST_THEMES.some((t) => t.id === saved) ? (saved as PlaylistThemeId) : "none";
}

// ----- A theme for ONE playlist (14b, developer's pick "A, right-click sub-menu", 2026-11-25) -----
// Saved ONLY in Prism (Spicetify.LocalStorage "prism:playlistThemes", a JSON map
// playlist URI -> theme id). The playlist itself is NEVER changed (hard rule).
// A playlist without an entry uses the main theme from Settings ("Use my
// default"); an entry may also be "none" (this playlist keeps Spotify's look).
export type ThemeOverrides = Record<string, PlaylistThemeId>;

// The saved JSON -> overrides. Broken text or unknown themes are dropped.
export function parseThemeOverrides(saved: string | null): ThemeOverrides {
  let raw: unknown;
  try {
    raw = JSON.parse(saved ?? "{}");
  } catch {
    return {};
  }
  const out: ThemeOverrides = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [uri, id] of Object.entries(raw as Record<string, unknown>)) {
    if (uri.startsWith("spotify:playlist:") && typeof id === "string" && PLAYLIST_THEMES.some((t) => t.id === id)) out[uri] = id as PlaylistThemeId;
  }
  return out;
}

// A copy with this playlist's theme set, or removed (null = back to the main theme).
export function withThemeOverride(overrides: ThemeOverrides, uri: string, theme: PlaylistThemeId | null): ThemeOverrides {
  const next = { ...overrides };
  if (theme === null) delete next[uri];
  else next[uri] = theme;
  return next;
}

// The theme to show: the playlist's own one if it has one, else the main theme.
export function effectiveTheme(main: PlaylistThemeId, overrides: ThemeOverrides, playlistUri: string | null | undefined): PlaylistThemeId {
  return (playlistUri && overrides[playlistUri]) || main;
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

// The lyrics view with a playlist theme on (14c, developer's pick "D, moving
// sky + reading veil", 2026-11-25): the theme's own sky behind the lyrics, a
// soft dark veil behind the lines, and the lines tinted to the theme. The line
// being sung stays white; "passed" = lines already sung, "inactive" = lines
// still to come. "none" keeps Prism's twilight lyrics (src/ui/lyricsTheme.ts).
export const LYRICS_LINE_COLOURS: Record<Exclude<PlaylistThemeId, "none">, { passed: string; inactive: string }> = {
  aurora: { passed: "#c9fbe6", inactive: "rgba(143, 247, 207, 0.55)" },
  stars: { passed: "#fff1cc", inactive: "rgba(255, 232, 180, 0.7)" },
  nebula: { passed: "#ffd9ea", inactive: "rgba(246, 166, 200, 0.6)" },
  twilight: { passed: "#e9dcff", inactive: "rgba(205, 184, 255, 0.6)" },
  afterglow: { passed: "#ffe0d2", inactive: "rgba(255, 190, 170, 0.62)" },
  mist: { passed: "#fff3ea", inactive: "rgba(255, 235, 240, 0.65)" },
  milkyway: { passed: "#e6e0ff", inactive: "rgba(200, 190, 255, 0.58)" },
  rain: { passed: "#ffe9cf", inactive: "rgba(255, 213, 158, 0.6)" },
  blossom: { passed: "#ffe2ee", inactive: "rgba(255, 190, 215, 0.62)" },
};

// Which of Spotify's pages a playlist theme paints (step 16, developer's pick
// "A, full sky", 2026-11-24):
//   "playlist" = /playlist/<id>: the sky plus the colour rail and genre mix,
//   "sky"      = album, artist and Liked Songs pages: the same sky, cleared
//                cover washes, glass bars and pastel play button, but no rail
//                or genre mix (developer's decision: those stay playlist-only).
//   "band"     = Home: the sky only as a band behind the top of the page,
//                fading into Quiet night's dark purple below and as you scroll
//                (developer's pick "D, sky band", 2026-11-24).
//   "search"   = Search: Browse all and the results (/search, /search/<words>
//                and its Songs/Artists/... tabs): the full sky, Browse tiles as
//                pastel glass (developer's pick "B", 2026-11-24).
//   "genre"    = a genre/category page (/genre/<id>): the full sky instead of
//                Spotify's colour header, its tiles as pastel glass too.
//   "settings" = Spotify's Settings (/preferences): NO sky, Quiet night's
//                still dark purple with each section on a card, Prism toggles
//                (developer's pick "C, quiet night + cards", 2026-11-24).
//   "profile"  = a profile (/user/<id>) and its "Show all" pages (followers,
//                following, top artists/tracks, playlists): the full sky, its
//                sections on lavender glass and the moving cover ring round
//                the avatar (developer's pick "A, full sky + avatar ring",
//                2026-11-25).
//   "podcast"  = a podcast show (/show/<id>) or episode (/episode/<id>): the
//                full sky like albums, Spotify's greens/blues turned Prism
//                (developer's pick "A, full sky", 2026-11-25).
// null = a page the theme leaves alone.
export type ThemedPage = "playlist" | "sky" | "band" | "search" | "genre" | "settings" | "profile" | "podcast";

export function themedPageKind(path: string | undefined): ThemedPage | null {
  if (path === "/") return "band";
  const p = (path ?? "").replace(/\/$/, "");
  if (/^\/playlist\/[A-Za-z0-9]{22}$/.test(p)) return "playlist";
  if (/^\/(album|artist)\/[A-Za-z0-9]{22}$/.test(p)) return "sky";
  if (p === "/collection/tracks") return "sky";
  if (p === "/search" || p.startsWith("/search/")) return "search";
  if (/^\/genre\/[A-Za-z0-9-]+$/.test(p)) return "genre";
  if (p === "/preferences") return "settings";
  if (/^\/(show|episode)\/[A-Za-z0-9]{22}$/.test(p)) return "podcast";
  if (/^\/user\/[^/]+(\/(followers|following|playlists|top\/artists|top\/tracks))?$/.test(p)) return "profile";
  return null;
}
