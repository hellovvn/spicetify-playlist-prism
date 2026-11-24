// DISCOVER (build plan 14e): "new finds" for a Grow playlist. Songs similar to
// the seed that are NOT in the user's library, from Last.fm's similar songs,
// then found on Spotify. They only ever go into the NEW playlist.
//
// This file is the PURE part (tested in tests/discover.test.ts): choosing
// which similar songs to look up, matching Spotify's search results, and the
// count chips. The network part is findNewSongs in src/flow.ts.
//
// Spike (2026-11-23, 6 seeds): Last.fm gave 30 similar songs for every seed,
// 118/120 were found on Spotify, ~6% were already in the library. The top
// 1-3 were usually the seed's own artist, so songs per artist are capped.

import { removeFeatures, removeVersionMarkers } from "../tags/titleVariants";
import { songKey, type RankedSong } from "../scoring/rank";

// One song from Last.fm's track.getSimilar (or the artist fallback).
// match = Last.fm's similarity, 0..1 (1 = most similar).
export interface SimilarSong {
  name: string;
  artist: string;
  match: number;
}

// One Spotify search result (a track).
export interface FoundTrack {
  uri: string;
  name: string;
  artists: string[];
  cover?: string;
  coverSmall?: string;
}

export const MAX_PER_ARTIST = 2; // variety: at most 2 new finds by one artist
export const MAX_CANDIDATES = 40; // similar songs looked up (tags + Spotify search)

// Which similar songs to look up, most similar first: not the seed, not a
// song already in the library (same title + main artist, any version), no
// repeats, at most MAX_PER_ARTIST per artist.
export function pickCandidates(
  similar: SimilarSong[],
  options: { seed: { name: string; artists: string[] }; libraryKeys: Set<string>; max?: number; perArtist?: number }
): SimilarSong[] {
  const max = options.max ?? MAX_CANDIDATES;
  const perArtist = options.perArtist ?? MAX_PER_ARTIST;
  const seedKey = songKey(options.seed);
  const seen = new Set<string>();
  const byArtist = new Map<string, number>();
  const result: SimilarSong[] = [];
  for (const song of [...similar].sort((a, b) => b.match - a.match)) {
    if (result.length >= max) break;
    const key = songKey({ name: song.name, artists: [song.artist] });
    const artist = song.artist.toLowerCase();
    if (key === seedKey || options.libraryKeys.has(key) || seen.has(key)) continue;
    if ((byArtist.get(artist) ?? 0) >= perArtist) continue;
    seen.add(key);
    byArtist.set(artist, (byArtist.get(artist) ?? 0) + 1);
    result.push(song);
  }
  return result;
}

// Title for comparing: no "(feat. ...)", no "- Remastered", lower case, only
// letters/digits. "Seasons (feat. Khalid)" and "seasons" compare equal.
export function compareTitle(name: string): string {
  return removeVersionMarkers(removeFeatures(name))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// The search result that IS the wanted song: same title (as above) and the
// wanted artist among its artists. null = not on Spotify (or search missed it);
// a "close" match is never used, it could be a different song.
export function bestSearchHit(want: SimilarSong, results: FoundTrack[]): FoundTrack | null {
  const title = compareTitle(want.name);
  const artist = want.artist.toLowerCase();
  return (
    results.find(
      (track) => compareTitle(track.name) === title && track.artists.some((a) => a.toLowerCase() === artist)
    ) ?? null
  );
}

// ----- How many new finds (the "New finds" chips) -----
export type NewCount = number | "off";
export const NEW_COUNTS: NewCount[] = ["off", 5, 10, 20];
export const DEFAULT_NEW_COUNT: NewCount = 10;

export function parseNewCount(text: string | null | undefined): NewCount | null {
  const value = (text ?? "").trim().toLowerCase();
  if (value === "off") return "off";
  const n = Number(value);
  return NEW_COUNTS.includes(n) ? n : null;
}

// The new finds to tick: the best `count` by score.
export function newPicks(newSongs: RankedSong[], count: NewCount): string[] {
  if (count === "off") return [];
  return [...newSongs]
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, count)
    .map((song) => song.uri);
}

// Two best-first lists into one, best first (library songs and new finds
// side by side in the preview). Ties keep library songs first.
export function mergeByScore(a: RankedSong[], b: RankedSong[]): RankedSong[] {
  return [...a, ...b].sort((x, y) => y.match.score - x.match.score);
}
