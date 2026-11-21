// Ranking: score every scanned song against the seed and sort them.
// PURE, unit-tested in tests/rank.test.ts.

import type { ScannedSong } from "../scan/scan";
import type { AudioAttributes } from "../spotify/audio";
import type { SourcedTag } from "../tags/combineTags";
import { removeFeatures, removeVersionMarkers } from "../tags/titleVariants";
import { scoreSong, type MatchDetails } from "./score";

export interface RankedSong extends ScannedSong {
  match: MatchDetails;
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
}

// The "same song" key: core title + main artist, ignoring capitals.
// "Snooze (Acoustic)" and "Snooze" by SZA share it, so a playlist doesn't
// get the same song twice in different versions.
export function songKey(song: { name: string; artists: string[] }): string {
  const title = removeVersionMarkers(removeFeatures(song.name)).toLowerCase();
  return `${title}|${(song.artists[0] ?? "").toLowerCase()}`;
}

export function rankSongs(seed: SeedForRanking, songs: ScannedSong[]): Ranking {
  const seedKey = songKey(seed);
  const bestByKey = new Map<string, RankedSong>();
  let noMatch = 0;

  for (const song of songs) {
    // The seed itself (or another version of it) isn't a candidate:
    // it goes first in the new playlist anyway.
    if (song.uri === seed.uri || songKey(song) === seedKey) continue;

    const match = scoreSong(seed, song);
    if (match.tagScore === 0) {
      noMatch++;
      continue;
    }
    // Two versions of the same song: keep the better-scoring one.
    const key = songKey(song);
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
