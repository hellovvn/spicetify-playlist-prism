// Scoring: how well does a candidate song fit the seed's vibe?
// PURE functions, unit-tested in tests/score.test.ts.
//
// Four parts:
//   TAGS (60%)    the vibe itself. No shared tags = not a match, full stop.
//   MOOD (15%)    lyrics about the same things rank higher (step 10).
//   BPM (15%)     similar tempo ranks higher.
//   KEY (10%)     musically compatible keys rank higher.
// Mood, BPM and key only RANK songs that already share tags; they can't make a
// song match on their own (a slow minor-key country song isn't dark R&B).
// (Before step 10 it was tags 70 / BPM 20 / key 10.)

import type { AudioAttributes } from "../spotify/audio";
import type { SourcedTag } from "../tags/combineTags";
import { moodMatch, type MoodProfile } from "../mood/lyricsMood";

export const WEIGHTS = { tags: 0.6, mood: 0.15, bpm: 0.15, key: 0.1 };

export interface MatchDetails {
  score: number; // 0..1 overall
  tagScore: number; // 0..1
  bpmScore: number | null; // null = BPM unknown for seed or song
  keyScore: number | null; // null = key unknown
  moodScore: number | null; // null = lyrics mood unknown for seed or song
  matchedTags: string[]; // seed tags this song shares, strongest first
}

// ----- Tags -----
// For every seed tag: does the song have it, and how strongly?
//   exact name        full credit  ("r&b" = "r&b")
//   one contains other  half credit  ("r&b" ~ "alternative r&b")
// Each seed tag is worth its own weight, so the seed's main tag matters more
// than a minor one. The song earns that tag's worth in full if it has the tag
// at least as strongly as the seed; if weaker, it earns a share (a song that's
// only slightly "r&b" counts less). So a song identical to the seed scores 1.
// The total is divided by the seed's total weight, so it's always 0..1.
export function tagMatch(seedTags: SourcedTag[], songTags: SourcedTag[]): { score: number; matched: string[] } {
  const total = seedTags.reduce((sum, tag) => sum + tag.weight, 0);
  if (total === 0 || songTags.length === 0) return { score: 0, matched: [] };

  const contributions: { name: string; value: number }[] = [];
  for (const seedTag of seedTags) {
    let best = 0;
    for (const songTag of songTags) {
      const credit = seedTag.name === songTag.name ? 1 : containsWords(seedTag.name, songTag.name) ? 0.5 : 0;
      const strength = Math.min(1, songTag.weight / seedTag.weight); // as strong as the seed's = 1
      best = Math.max(best, credit * strength);
    }
    if (best > 0) contributions.push({ name: seedTag.name, value: seedTag.weight * best });
  }

  const score = contributions.reduce((sum, c) => sum + c.value, 0) / total;
  contributions.sort((a, b) => b.value - a.value);
  return { score: Math.min(1, score), matched: contributions.map((c) => c.name) };
}

// True if one tag's words appear, in order, inside the other's:
// "r&b" is inside "alternative r&b", "indie pop" is inside "indie pop rock".
// Whole words only: "rap" is NOT inside "trap".
// (Tag cleanup turns "k-pop" into "k pop", so "pop" does match it, at half credit.)
function containsWords(a: string, b: string): boolean {
  const inside = (small: string, big: string) => ` ${big} `.includes(` ${small} `);
  return inside(a, b) || inside(b, a);
}

// ----- BPM -----
// 1.0 at the same tempo, falling to 0 at 20% faster/slower.
// Half and double time count as the same tempo: a 70 BPM and a 140 BPM song
// share a beat (DJs mix them together), and BPM detection often picks either.
export function bpmMatch(seedBpm: number, songBpm: number): number {
  const options = [songBpm, songBpm * 2, songBpm / 2];
  // Ratios, not differences: 10 BPM matters more at 60 than at 160.
  const distance = Math.min(...options.map((bpm) => Math.abs(Math.log(bpm / seedBpm))));
  return Math.max(0, 1 - distance / Math.log(1.2));
}

// ----- Key -----
// Uses the Camelot wheel (what DJs use): 12 numbers in a circle, A = minor, B = major.
//   same key                         1.0
//   neighbour (±1, same letter)      0.8   e.g. 8A -> 7A / 9A
//   relative major/minor (same no.)  0.8   e.g. 8A -> 8B
//   two steps away (same letter)     0.4
//   anything else                    0
export function keyMatch(seedCamelot: string, songCamelot: string): number {
  const a = parseCamelot(seedCamelot);
  const b = parseCamelot(songCamelot);
  if (!a || !b) return 0;
  const steps = Math.min(Math.abs(a.number - b.number), 12 - Math.abs(a.number - b.number)); // around the circle
  if (a.letter === b.letter) return steps === 0 ? 1 : steps === 1 ? 0.8 : steps === 2 ? 0.4 : 0;
  return steps === 0 ? 0.8 : 0;
}

function parseCamelot(code: string): { number: number; letter: string } | null {
  const match = /^(1[0-2]|[1-9])([AB])$/.exec(code);
  return match ? { number: Number(match[1]), letter: match[2] } : null;
}

// ----- All together -----
export interface Scorable {
  tags: SourcedTag[];
  audio: AudioAttributes | null;
  mood?: MoodProfile | null; // optional: missing = unknown
}

export function scoreSong(seed: Scorable, song: Scorable): MatchDetails {
  const tags = tagMatch(seed.tags, song.tags);
  const bpmScore = seed.audio && song.audio ? bpmMatch(seed.audio.bpm, song.audio.bpm) : null;
  const keyScore = seed.audio && song.audio ? keyMatch(seed.audio.camelot, song.audio.camelot) : null;
  const moodScore = seed.mood && song.mood ? moodMatch(seed.mood, song.mood) : null;

  // No shared tags: not a match, whatever the mood/tempo/key.
  if (tags.score === 0) return { score: 0, tagScore: 0, bpmScore, keyScore, moodScore, matchedTags: [] };

  return { ...combineParts(tags.score, moodScore, bpmScore, keyScore), matchedTags: tags.matched };
}

// Weighted average of the parts we HAVE. If mood/BPM/key is unknown, the
// score is based on the other parts rather than being punished for missing data.
// Shared by scoreSong and the playlist seed (src/scoring/playlistSeed.ts).
export function combineParts(
  tagScore: number,
  moodScore: number | null,
  bpmScore: number | null,
  keyScore: number | null
): Omit<MatchDetails, "matchedTags"> {
  let sum = WEIGHTS.tags * tagScore;
  let weights = WEIGHTS.tags;
  if (moodScore !== null) {
    sum += WEIGHTS.mood * moodScore;
    weights += WEIGHTS.mood;
  }
  if (bpmScore !== null) {
    sum += WEIGHTS.bpm * bpmScore;
    weights += WEIGHTS.bpm;
  }
  if (keyScore !== null) {
    sum += WEIGHTS.key * keyScore;
    weights += WEIGHTS.key;
  }
  return { score: sum / weights, tagScore, bpmScore, keyScore, moodScore };
}
