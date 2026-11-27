// Ranking: score every scanned song against the seed and sort them.
// PURE, unit-tested in tests/rank.test.ts.

import type { ScannedSong } from "../scan/scan";
import type { AudioAttributes } from "../spotify/audio";
import type { SourcedTag } from "../tags/combineTags";
import type { MoodProfile } from "../mood/lyricsMood";
import { removeFeatures, removeVersionMarkers } from "../tags/titleVariants";
import { scoreSong, type MatchDetails } from "./score";

export interface RankedSong extends ScannedSong {
  match: MatchDetails;
  // Set on DISCOVER "new finds" (src/discover/discover.ts): a song NOT from
  // the user's playlists. similarity = Last.fm's match with the seed, 0..1.
  newFind?: { similarity: number };
}

export interface Ranking {
  matches: RankedSong[]; // songs sharing at least one tag, best first
  noMatch: number; // scanned songs with no shared tags (left out)
}

export interface SeedForRanking {
  uri: string;
  name: string;
  artists: string[];
  tags: SourcedTag[]; // only the chips the user kept ON
  audio: AudioAttributes | null;
  mood: MoodProfile | null;
}

// The "same song" key: core title + main artist, ignoring capitals.
// "Snooze (Acoustic)" and "Snooze" by SZA share it, so a playlist doesn't
// get the same song twice in different versions.
export function songKey(song: { name: string; artists: string[] }): string {
  const title = removeVersionMarkers(removeFeatures(song.name)).toLowerCase();
  return `${title}|${(song.artists[0] ?? "").toLowerCase()}`;
}

export function rankSongs(seed: SeedForRanking, songs: ScannedSong[]): Ranking {
  // The seed itself (or another version of it) isn't a candidate:
  // it goes first in the new playlist anyway.
  return rankWith((song) => scoreSong(seed, song), songs, { uris: new Set([seed.uri]), keys: new Set([songKey(seed)]) });
}

// Scores every song with `score` and sorts them. Songs in `exclude` (by URI
// or "same song" key) are skipped: the seed song, or every song of a seed
// playlist (they're in the new playlist anyway).
export function rankWith(
  score: (song: ScannedSong) => MatchDetails,
  songs: ScannedSong[],
  exclude: { uris: Set<string>; keys: Set<string> }
): Ranking {
  const bestByKey = new Map<string, RankedSong>();
  let noMatch = 0;

  for (const song of songs) {
    const key = songKey(song);
    if (exclude.uris.has(song.uri) || exclude.keys.has(key)) continue;

    const match = score(song);
    if (match.tagScore === 0) {
      noMatch++;
      continue;
    }
    // Two versions of the same song: keep the better-scoring one.
    const existing = bestByKey.get(key);
    if (!existing || match.score > existing.match.score) bestByKey.set(key, { ...song, match });
  }

  const matches = [...bestByKey.values()].sort(
    (a, b) => b.match.score - a.match.score || a.name.localeCompare(b.name)
  );
  return { matches, noMatch };
}

// The RECOMMENDED songs: the best `max` by rank, all ticked in the preview,
// and the user unticks what they don't want. (Decided after real data: a fixed
// % cut-off gave only 10 songs for "Often", because seeds with many tags
// produce low % even for good matches. Rank works for every seed.)
// `minScore` is just a floor so very weak matches are never recommended.
export function defaultPicks(matches: RankedSong[], options: { minScore?: number; max?: number } = {}): string[] {
  const minScore = options.minScore ?? 0.15;
  const max = options.max ?? 30;
  return matches
    .filter((song) => song.match.score >= minScore)
    .slice(0, max)
    .map((song) => song.uri);
}

// ----- How many songs to recommend (the count chips on the preview) -----
// A number, or "all" (every match). The chips offer PICK_COUNTS; "Custom"
// lets the user type any number from 1 to MAX_CUSTOM_COUNT.
export type PickCount = number | "all";
export const PICK_COUNTS: PickCount[] = [10, 20, 30, 50, "all"];
export const DEFAULT_PICK_COUNT = 30;
export const MAX_CUSTOM_COUNT = 500;

// The recommended songs for a chosen count. "all" = every match (no score
// floor: the user asked for everything). A number = the best N, as before.
export function picksFor(matches: RankedSong[], count: PickCount): string[] {
  if (count === "all") return matches.map((song) => song.uri);
  return defaultPicks(matches, { max: count });
}

// A count typed in the "Custom" box, or the saved setting: a whole number
// from 1 to MAX_CUSTOM_COUNT, or "all". Anything else = null (not valid).
export function parsePickCount(text: string | null | undefined): PickCount | null {
  const value = (text ?? "").trim().toLowerCase();
  if (value === "all") return "all";
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_CUSTOM_COUNT ? n : null;
}
