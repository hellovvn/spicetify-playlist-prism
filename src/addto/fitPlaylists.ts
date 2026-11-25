// "Add with Prism": which of the user's playlists fit a song best?
// PURE, unit-tested in tests/fitPlaylists.test.ts. Reading the playlists and
// the song's signals happens in src/flow.ts (findPlaylistsForSong).
//
// Uses the same song-level signals as everything else (scoreSong: tags 60,
// lyrics mood 15, BPM 15, key 10). The song is scored against every KNOWN
// song in a playlist (one with cached tags), and the playlist's fit is the
// mostly the average of its best matches (a playlist fits when a good part of
// it sounds like the song, even if the rest wanders), plus a smaller share for
// how much of the playlist shares a genre with the song at all. That second
// part stops one common tag ("pop") from making every playlist look alike: a
// jazz playlist with three pop songs in it isn't a home for a pop song.

import { scoreSong, type MatchDetails } from "../scoring/score";
import { songKey } from "../scoring/rank";
import type { AudioAttributes } from "../spotify/audio";
import type { SourcedTag } from "../tags/combineTags";
import type { MoodProfile } from "../mood/lyricsMood";
import { isJunkTagName } from "../tags/cleanTags";

export interface FitSong {
  uri: string;
  name: string;
  artists: string[];
  tags: SourcedTag[]; // [] = unknown (never scanned) or no tags at all
  audio: AudioAttributes | null;
  mood?: MoodProfile | null;
}

export interface CandidatePlaylist {
  uri: string;
  name: string;
  songs: FitSong[];
}

export interface PlaylistFit {
  uri: string;
  name: string;
  score: number; // 0..1
  reasons: string[]; // the song's tags the best-matching songs share, most common first (max 3)
  known: number; // songs with tags that were compared
  total: number; // songs in the playlist
}

// How many playlists to suggest.
export const TOP_PLAYLISTS = 5;
// A playlist needs at least this many songs with tags to be judged at all.
export const MIN_KNOWN = 3;
// The fit averages the best quarter of the known songs (at least 3, at most 10).
const BEST_SHARE = 0.25;
const BEST_MIN = 3;
const BEST_MAX = 10;
// Weight of "how much of the playlist shares a genre" (the rest = best matches).
const SPREAD_WEIGHT = 0.3;

// True if the playlist already has the song (the same URI, or the same title
// + main artist from another album: Merge's duplicate rule).
export function hasSong(playlist: CandidatePlaylist, song: Pick<FitSong, "uri" | "name" | "artists">): boolean {
  const key = songKey(song);
  return playlist.songs.some((s) => s.uri === song.uri || songKey(s) === key);
}

// How well one playlist fits the song, or null if it can't be judged
// (too few known songs) or nothing in it shares a tag with the song.
export function playlistFit(song: FitSong, playlist: CandidatePlaylist): PlaylistFit | null {
  const known = playlist.songs.filter((s) => s.tags.length > 0);
  if (known.length < MIN_KNOWN) return null;
  const matches: MatchDetails[] = known.map((s) => scoreSong(song, s)).sort((a, b) => b.score - a.score);
  const count = Math.min(known.length, BEST_MAX, Math.max(BEST_MIN, Math.ceil(known.length * BEST_SHARE)));
  const best = matches.slice(0, count);
  const bestMean = best.reduce((sum, m) => sum + m.score, 0) / count;
  if (bestMean <= 0) return null;
  const spread = matches.filter((m) => m.score > 0).length / known.length;
  const score = (1 - SPREAD_WEIGHT) * bestMean + SPREAD_WEIGHT * spread;
  return { uri: playlist.uri, name: playlist.name, score, reasons: commonTags(best), known: known.length, total: playlist.songs.length };
}

// The song's tags shared most often by the best matches.
function commonTags(matches: MatchDetails[]): string[] {
  const counts = new Map<string, number>();
  for (const match of matches) {
    for (const tag of match.matchedTags) if (!isJunkTagName(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}

// The best playlists for the song, best first. Playlists that already have
// the song are left out. Ties go by name, so the order never jumps around.
export function rankPlaylists(song: FitSong, playlists: CandidatePlaylist[], top = TOP_PLAYLISTS): PlaylistFit[] {
  return playlists
    .filter((p) => !hasSong(p, song))
    .map((p) => playlistFit(song, p))
    .filter((fit): fit is PlaylistFit => fit !== null)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, top);
}

// "92%" for the menu and rows.
export function fitPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}
