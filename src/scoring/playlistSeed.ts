// Grow from a PLAYLIST (not one song): the seed is many songs.
// PURE, unit-tested in tests/playlistSeed.test.ts.
//
// Developer's pick (2026-11-26, "blend + closest songs"):
//   GENRES come from the whole playlist's BLEND (blendTags): one chip per
//   genre, with how many seed songs have it. The user switches off chips.
//   TEMPO, KEY and MOOD are compared to the candidate's CLOSEST seed songs
//   (the CLOSEST_SONGS seed songs sharing the most tags with it), so a mixed
//   playlist doesn't average out to a tempo nobody in it plays.
// The weights are the same as a song seed (score.ts).

import type { SourcedTag } from "../tags/combineTags";
import type { AudioAttributes } from "../spotify/audio";
import { MOODS, type MoodProfile } from "../mood/lyricsMood";
import { isJunkTagName } from "../tags/cleanTags";
import { bpmMatch, combineParts, keyMatch, tagMatch, type MatchDetails, type Scorable } from "./score";
import { moodMatch } from "../mood/lyricsMood";

export const BLEND_MAX_TAGS = 15; // chips shown at most
export const CLOSEST_SONGS = 3; // seed songs that tempo/key/mood are compared with
export const TYPICAL_SONGS = 5; // seed songs asked about on Last.fm for new finds

export interface BlendTag extends SourcedTag {
  count: number; // how many seed songs have this tag
}

interface TaggedSong {
  tags: SourcedTag[];
}

// One chip per genre in the playlist. weight = the tag's AVERAGE strength over
// the tagged seed songs (a song without it counts 0), so a tag every song has
// at full strength is 1 and a tag one song in ten has is about 0.1.
// A tag needs 2+ songs, unless fewer than 4 songs have tags at all.
// source = "artist" only if most of its songs got it from their artist.
// Sorted by how many songs have it (then strength); the top `max` are kept.
export function blendTags(songs: TaggedSong[], max = BLEND_MAX_TAGS): BlendTag[] {
  const tagged = songs.map((song) => song.tags.filter((tag) => !isJunkTagName(tag.name))).filter((tags) => tags.length > 0);
  if (tagged.length === 0) return [];
  const minCount = tagged.length < 4 ? 1 : 2;
  const totals = new Map<string, { sum: number; count: number; fromArtist: number }>();
  for (const tags of tagged) {
    for (const tag of tags) {
      const total = totals.get(tag.name) ?? { sum: 0, count: 0, fromArtist: 0 };
      total.sum += tag.weight;
      total.count += 1;
      if (tag.source === "artist") total.fromArtist += 1;
      totals.set(tag.name, total);
    }
  }
  return [...totals.entries()]
    .filter(([, total]) => total.count >= minCount)
    .map(([name, total]) => ({
      name,
      weight: total.sum / tagged.length,
      source: total.fromArtist * 2 > total.count ? ("artist" as const) : ("track" as const),
      count: total.count,
    }))
    // Most songs first (the seed screen's bars read top-down), then strength.
    .sort((a, b) => b.count - a.count || b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, max);
}

// The average lyrics mood of the songs that have one (null = none has).
// Used for the summary line and the grown playlist's tone.
export function blendMood(moods: (MoodProfile | null | undefined)[]): MoodProfile | null {
  const known = moods.filter((mood): mood is MoodProfile => !!mood);
  if (known.length === 0) return null;
  const blend: MoodProfile = {};
  for (const mood of MOODS) {
    const sum = known.reduce((total, profile) => total + (profile[mood] ?? 0), 0);
    if (sum > 0) blend[mood] = sum / known.length;
  }
  return blend;
}

// Slowest and fastest BPM in the playlist (null = no BPM known).
export function tempoRange(audios: (AudioAttributes | null)[]): { min: number; max: number } | null {
  const bpms = audios.filter((audio): audio is AudioAttributes => !!audio).map((audio) => Math.round(audio.bpm));
  return bpms.length ? { min: Math.min(...bpms), max: Math.max(...bpms) } : null;
}

// How well a candidate fits a playlist seed.
//   tags: against the KEPT blend chips (no shared genre = no match, as always)
//   tempo/key/mood: the average over its CLOSEST_SONGS closest seed songs
//   (closest = most shared tags; ties by tempo), each part over the songs
//   where it's known.
export function scoreAgainstPlaylist(seed: { tags: SourcedTag[]; songs: Scorable[] }, song: Scorable): MatchDetails {
  const tags = tagMatch(seed.tags, song.tags);
  if (tags.score === 0) return { score: 0, tagScore: 0, bpmScore: null, keyScore: null, moodScore: null, matchedTags: [] };

  const closest = closestSeedSongs(seed.songs, song);
  const average = (values: (number | null)[]) => {
    const known = values.filter((value): value is number => value !== null);
    return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
  };
  const bpmScore = average(closest.map((s) => (s.audio && song.audio ? bpmMatch(s.audio.bpm, song.audio.bpm) : null)));
  const keyScore = average(closest.map((s) => (s.audio && song.audio ? keyMatch(s.audio.camelot, song.audio.camelot) : null)));
  const moodScore = average(closest.map((s) => (s.mood && song.mood ? moodMatch(s.mood, song.mood) : null)));
  return { ...combineParts(tags.score, moodScore, bpmScore, keyScore), matchedTags: tags.matched };
}

// The seed songs most like this song: most shared tags first, then the
// closest tempo. Seed songs sharing no tag are only used if none shares one.
export function closestSeedSongs<T extends Scorable>(seedSongs: T[], song: Scorable, count = CLOSEST_SONGS): T[] {
  const ranked = seedSongs.map((seedSong) => ({
    seedSong,
    tags: tagMatch(seedSong.tags, song.tags).score,
    bpm: seedSong.audio && song.audio ? bpmMatch(seedSong.audio.bpm, song.audio.bpm) : 0,
  }));
  const sharing = ranked.filter((r) => r.tags > 0);
  return (sharing.length > 0 ? sharing : ranked)
    .sort((a, b) => b.tags - a.tags || b.bpm - a.bpm)
    .slice(0, count)
    .map((r) => r.seedSong);
}

// The seed songs that best stand for the playlist (most of the kept genres),
// at most one per artist: new finds ask Last.fm for songs similar to these.
export function typicalSongs<T extends TaggedSong & { artists: string[] }>(
  songs: T[],
  kept: SourcedTag[],
  count = TYPICAL_SONGS
): T[] {
  const seenArtists = new Set<string>();
  const result: T[] = [];
  const ranked = songs
    .map((song) => ({ song, score: tagMatch(kept, song.tags).score }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  for (const { song } of ranked) {
    const artist = (song.artists[0] ?? "").toLowerCase();
    if (seenArtists.has(artist)) continue;
    seenArtists.add(artist);
    result.push(song);
    if (result.length >= count) break;
  }
  return result;
}

// Can the user go on? Same rules as a song seed (tagSelection.ts), in
// playlist words.
export function playlistSeedMessage(blend: SourcedTag[], kept: SourcedTag[], included: number): string | null {
  if (included === 0) return "Keep at least one seed song ticked.";
  if (blend.length === 0) return "Last.fm doesn't know these songs well enough to find their genres. Try a different playlist.";
  if (kept.length === 0) return "Keep at least one genre on: genres are what define the vibe.";
  return null;
}
