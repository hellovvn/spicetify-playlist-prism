// Playlist stats. A small record of how each Prism playlist was made is saved
// when it's created; for any other playlist (or ones made before records were
// saved, 2026-11-22) an ESTIMATE is worked out from songs Prism has scanned.
// PURE: unit-tested in tests/playlistStats.test.ts. Saving/loading the text is
// in src/storage.ts; reading a playlist for an estimate is in src/flow.ts.
//
// Only counts and names are kept (no lyrics, nothing from other people).

import type { SourcedTag } from "../tags/combineTags";
import type { AudioAttributes } from "../spotify/audio";
import { topMoods, type MoodProfile } from "../mood/lyricsMood";
import { isJunkTagName } from "../tags/cleanTags";

export interface PrismPlaylistRecord {
  uri: string; // the new playlist
  name: string;
  createdAt: number | null; // milliseconds since 1970 (Date.now()); null = unknown (estimate)
  seed: { uri: string; name: string; artists: string[] } | null; // null = unknown (estimate)
  keptTags: string[]; // the seed tags the user kept ON (empty for an estimate)
  songCount: number; // including the seed
  // How many songs have each tag, biggest first, e.g. [["r&b", 24], ["rap", 11]].
  tagCounts: [string, number][];
  // How many songs have each lyrics mood as a main mood.
  moodCounts: [string, number][];
  averageBpm: number | null; // null if no song had a BPM
  // Added 2026-11-22 (later than the fields above), so OPTIONAL: records saved
  // before then don't have them, and the page just hides those parts.
  tempo?: TempoSpread;
  length?: LengthSummary;
  match?: MatchSpread; // only for playlists Prism made (scores aren't known otherwise)
  // Set when this was worked out from scans instead of saved at creation:
  // how many of the songs Prism has tags for (the counts only cover those).
  estimate?: { scanned: number };
  // Set for playlists made by Organize (step 13d): the playlists its songs
  // were sorted out of. Organize playlists have no seed song (seed = null).
  organized?: { from: string[] };
}

export interface NamedValue {
  name: string; // song title
  value: number;
}

// Slow < 90 BPM <= mid < 120 BPM <= fast.
export const SLOW_BELOW = 90;
export const FAST_FROM = 120;

export interface TempoSpread {
  slow: number;
  mid: number;
  fast: number;
  slowest: NamedValue | null; // value = BPM
  fastest: NamedValue | null;
}

export interface LengthSummary {
  totalMs: number; // of the songs whose length is known
  known: number; // how many songs that is
  longest: NamedValue | null; // value = milliseconds
  shortest: NamedValue | null;
}

export interface MatchSpread {
  average: number; // 0..1
  // How many picked songs fall in each score band, best band first.
  bands: [string, number][];
  best: NamedValue | null; // value = score 0..1
}

interface SongLike {
  uri: string;
  name?: string;
  durationMs?: number;
  tags: SourcedTag[];
  audio: AudioAttributes | null;
  mood: MoodProfile | null;
}

// The song with the highest / lowest value (first one wins a tie).
function extreme(items: NamedValue[], pick: "max" | "min"): NamedValue | null {
  let best: NamedValue | null = null;
  for (const item of items) {
    if (!best || (pick === "max" ? item.value > best.value : item.value < best.value)) best = item;
  }
  return best;
}

export function tempoSpread(songs: Omit<SongLike, "uri">[]): TempoSpread {
  const withBpm = songs
    .filter((song) => typeof song.audio?.bpm === "number")
    .map((song) => ({ name: song.name ?? "", value: Math.round(song.audio!.bpm) }));
  return {
    slow: withBpm.filter((s) => s.value < SLOW_BELOW).length,
    mid: withBpm.filter((s) => s.value >= SLOW_BELOW && s.value < FAST_FROM).length,
    fast: withBpm.filter((s) => s.value >= FAST_FROM).length,
    slowest: extreme(withBpm, "min"),
    fastest: extreme(withBpm, "max"),
  };
}

export function lengthSummary(songs: Omit<SongLike, "uri">[]): LengthSummary {
  const timed = songs
    .filter((song) => typeof song.durationMs === "number" && song.durationMs > 0)
    .map((song) => ({ name: song.name ?? "", value: song.durationMs! }));
  return {
    totalMs: timed.reduce((sum, song) => sum + song.value, 0),
    known: timed.length,
    longest: extreme(timed, "max"),
    shortest: extreme(timed, "min"),
  };
}

// Score bands for "how close to the seed".
export const MATCH_BANDS: [string, number][] = [
  ["60%+", 0.6],
  ["40–59%", 0.4],
  ["20–39%", 0.2],
  ["under 20%", 0],
];

export function matchSpread(picks: { name: string; score: number }[]): MatchSpread | undefined {
  if (picks.length === 0) return undefined;
  const bands = MATCH_BANDS.map(([label, from], i): [string, number] => {
    const to = i === 0 ? Infinity : MATCH_BANDS[i - 1][1];
    return [label, picks.filter((p) => p.score >= from && p.score < to).length];
  });
  return {
    average: picks.reduce((sum, p) => sum + p.score, 0) / picks.length,
    bands,
    best: extreme(picks.map((p) => ({ name: p.name, value: p.score })), "max"),
  };
}

// Counts how often each value appears, biggest first (ties: A-Z).
function countUp(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Tag counts, mood counts and average BPM for a list of songs.
function summarize(songs: Omit<SongLike, "uri">[]) {
  const tagNames: string[] = [];
  const moods: string[] = [];
  for (const song of songs) {
    // A song counts once per tag, even if the tag shows up twice in its list.
    // Personal labels ("my top songs", "saw live") are skipped: songs' cached
    // tags may have been cleaned before those words were on the junk list.
    tagNames.push(...new Set(song.tags.filter((tag) => !isJunkTagName(tag.name)).map((tag) => tag.name.toLowerCase())));
    if (song.mood) moods.push(...topMoods(song.mood));
  }
  const bpms = songs.map((song) => song.audio?.bpm).filter((bpm): bpm is number => typeof bpm === "number");
  return {
    tagCounts: countUp(tagNames),
    moodCounts: countUp(moods),
    averageBpm: bpms.length ? Math.round(bpms.reduce((sum, bpm) => sum + bpm, 0) / bpms.length) : null,
  };
}

export function buildRecord(input: {
  uri: string;
  name: string;
  createdAt: number;
  seed: { uri: string; name: string; artists: string[] } & Omit<SongLike, "uri">;
  keptTags: SourcedTag[];
  // The picked songs (not including the seed); match.score = how close to the seed.
  songs: (SongLike & { name: string; match?: { score: number } })[];
}): PrismPlaylistRecord {
  const all: Omit<SongLike, "uri">[] = [input.seed, ...input.songs];
  return {
    uri: input.uri,
    name: input.name.trim(),
    createdAt: input.createdAt,
    seed: { uri: input.seed.uri, name: input.seed.name, artists: input.seed.artists },
    keptTags: input.keptTags.map((tag) => tag.name),
    songCount: all.length,
    ...summarize(all),
    tempo: tempoSpread(all),
    length: lengthSummary(all),
    match: matchSpread(
      input.songs.filter((song) => song.match).map((song) => ({ name: song.name, score: song.match!.score }))
    ),
  };
}

// The record for a playlist made by Organize (step 13d). No seed song: the
// "built from" labels are the genres/moods picked for the group (Start from
// scratch) or the group's most common tags (suggested groups).
export function buildOrganizeRecord(input: {
  uri: string;
  name: string;
  createdAt: number;
  labels: string[];
  from: string[]; // names of the playlists that were organized
  songs: SongLike[];
}): PrismPlaylistRecord {
  return {
    uri: input.uri,
    name: input.name.trim(),
    createdAt: input.createdAt,
    seed: null,
    keptTags: [...input.labels],
    songCount: input.songs.length,
    ...summarize(input.songs),
    tempo: tempoSpread(input.songs),
    length: lengthSummary(input.songs),
    organized: { from: [...input.from] },
  };
}

// An ESTIMATE for a playlist with no saved record: counts genres from the
// songs Prism has scanned before (tags = null means "not scanned"). BPM and
// mood use whatever is known for every song.
export function estimateRecord(input: {
  uri: string;
  name: string;
  songs: {
    uri: string;
    name?: string;
    durationMs?: number;
    tags: SourcedTag[] | null;
    audio: AudioAttributes | null;
    mood: MoodProfile | null;
  }[];
}): PrismPlaylistRecord {
  const scanned = input.songs.filter((song) => song.tags !== null);
  const tagCounts = summarize(scanned.map((song) => ({ ...song, tags: song.tags ?? [] }))).tagCounts;
  const { moodCounts, averageBpm } = summarize(input.songs.map((song) => ({ ...song, tags: [] })));
  return {
    uri: input.uri,
    name: input.name.trim(),
    createdAt: null,
    seed: null,
    keptTags: [],
    songCount: input.songs.length,
    tagCounts,
    moodCounts,
    averageBpm,
    tempo: tempoSpread(input.songs.map((song) => ({ ...song, tags: [] }))),
    length: lengthSummary(input.songs.map((song) => ({ ...song, tags: [] }))),
    estimate: { scanned: scanned.length },
  };
}

// ----- The saved list (one JSON text for all Prism playlists) -----
// Stored as an object keyed by playlist URI. Bad or missing text = empty.

// Event the page sends after saving a new playlist record (src/flow.ts), so
// the side panel (src/ui/panelHost.tsx) can show the new playlist's stats.
export const RECORDS_CHANGED_EVENT = "playlist-prism:records-changed";

export type PrismPlaylistRecords = Record<string, PrismPlaylistRecord>;

export function parseRecords(text: string | null): PrismPlaylistRecords {
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function addRecord(records: PrismPlaylistRecords, record: PrismPlaylistRecord): PrismPlaylistRecords {
  return { ...records, [record.uri]: record };
}

// ----- For the stats page -----

export interface ChartRow {
  name: string;
  count: number; // songs with this tag
  share: number; // of the whole playlist, 0..1 (sets the bar's length)
}

// The genre bars: the `max` most common tags, biggest first.
// For an estimate, shares are of the SCANNED songs (the only ones counted).
export function chartRows(record: PrismPlaylistRecord, max = 8): ChartRow[] {
  const total = Math.max(record.estimate ? record.estimate.scanned : record.songCount, 1);
  return genreCounts(record)
    .slice(0, max)
    .map(([name, count]) => ({ name, count, share: Math.min(count / total, 1) }));
}

// The record's tag counts without personal labels ("my top songs", "saw
// live"...). Records saved before those words were on the junk list still
// contain them, so they're filtered when shown, not only when saved.
export function genreCounts(record: PrismPlaylistRecord): [string, number][] {
  return record.tagCounts.filter(([name]) => !isJunkTagName(name));
}

// The tags a playlist was built from, without personal labels (same reason).
export function builtFromTags(record: PrismPlaylistRecord): string[] {
  return record.keptTags.filter((name) => !isJunkTagName(name));
}

// The most common lyrics mood, or null if no song had one.
export function topMood(record: PrismPlaylistRecord): string | null {
  return record.moodCounts[0]?.[0] ?? null;
}

// DEV/TEST: made-up numbers so the stats page can be shown without a real
// Prism playlist (debug hook / smoke test).
export const SAMPLE_RECORD: PrismPlaylistRecord = {
  uri: "spotify:playlist:0000000000000000000000",
  name: "Prism · Sample",
  createdAt: Date.UTC(2026, 10, 22, 12), // midday UTC, so it shows the 22nd in every time zone
  seed: { uri: "spotify:track:0000000000000000000000", name: "Sample song", artists: ["Sample artist"] },
  keptTags: ["r&b", "sexy", "dark", "love"],
  songCount: 31,
  tagCounts: [["r&b", 24], ["pop", 13], ["sexy", 11], ["soul", 9], ["dark", 7], ["trap", 5], ["synthpop", 4], ["love", 3], ["indie", 2]],
  moodCounts: [["heartbreak", 12], ["love", 9], ["desire", 6]],
  averageBpm: 104,
  tempo: { slow: 9, mid: 15, fast: 7, slowest: { name: "Self", value: 72 }, fastest: { name: "Call Out My Name", value: 134 } },
  length: { totalMs: 6744000, known: 31, longest: { name: "Is There Someone Else?", value: 288000 }, shortest: { name: "Best Lover", value: 146000 } },
  match: { average: 0.47, bands: [["60%+", 6], ["40–59%", 14], ["20–39%", 10], ["under 20%", 0]], best: { name: "One Of The Girls", value: 0.71 } },
};
