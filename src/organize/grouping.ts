// Organize playlists (step 13b): split songs into groups of similar songs.
// PURE (no Spotify, no randomness): the same songs and settings always give
// the same groups. Unit-tested in tests/grouping.test.ts.
//
// How it works, in plain words:
// 1. Each song becomes a few "signals": its genre tags, its lyrics mood and
//    its tempo (BPM). Musical KEY is not used for grouping (only shown).
//    Tags common to almost all the songs count less (see tagRarity).
// 2. Similarity between a song and a group mixes those signals. "Group mostly
//    by" (Genre / Mood / Energy / Balanced) decides how much each one counts.
//    A signal a song doesn't have is left out (so untagged songs are placed
//    by mood + tempo only).
// 3. k-means: pick N starting songs that are as DIFFERENT from each other as
//    possible, then repeat "put every song in its most similar group" and
//    "recompute each group's average" until nothing moves.
// 4. Auto tries 3 to 8 groups and keeps the number that separates the songs
//    best (a simplified "silhouette" score).
// 5. Each group gets a name from its most typical tags/moods/tempo and a
//    summary (genres, moods, tempo, keys) for the review screen.

import type { SourcedTag } from "../tags/combineTags";
import type { AudioAttributes } from "../spotify/audio";
import { MOODS, type MoodProfile } from "../mood/lyricsMood";
import { isJunkTagName } from "../tags/cleanTags";

export type GroupFocus = "balanced" | "genre" | "mood" | "energy";

export interface GroupingSettings {
  count: number | "auto";
  overlap: boolean; // may a song also join other groups it fits well?
  focus: GroupFocus;
}

export interface SongToGroup {
  uri: string;
  name: string;
  tags: SourcedTag[];
  audio: AudioAttributes | null;
  mood: MoodProfile | null;
}

export interface GroupSummary {
  tags: [string, number][]; // most common tags in the group (name, songs)
  moods: [string, number][]; // most common main lyrics moods
  tempo: { slow: number; mid: number; fast: number; averageBpm: number | null };
  keys: [string, number][]; // most common Camelot keys, e.g. ["8A", 5] (shown only)
  untagged: number; // songs placed by mood/tempo only
}

export interface SongGroup {
  name: string;
  songs: string[]; // URIs, best fit first
  summary: GroupSummary;
}

export interface Grouping {
  groups: SongGroup[];
  focus: GroupFocus;
}

// How much each signal counts, per "Group mostly by" choice.
export const FOCUS_WEIGHTS: Record<GroupFocus, { tags: number; mood: number; tempo: number }> = {
  balanced: { tags: 0.55, mood: 0.25, tempo: 0.2 },
  genre: { tags: 0.8, mood: 0.1, tempo: 0.1 },
  mood: { tags: 0.2, mood: 0.65, tempo: 0.15 },
  energy: { tags: 0.2, mood: 0.15, tempo: 0.65 },
};

export const AUTO_MIN = 3;
export const AUTO_MAX = 8;
// Overlap mode: a song also joins a group whose similarity is at least this
// share of its best group's (and at least OVERLAP_FLOOR).
// (0.8: a song's first group already includes the song itself, so it always
// looks a bit closer to that one; 0.9 almost never let a song join another.)
export const OVERLAP_SHARE = 0.8;
const OVERLAP_FLOOR = 0.3;
// Tempo: songs this many BPM apart count as completely different in tempo.
const BPM_RANGE = 60;
export const SLOW_BELOW = 90;
export const FAST_FROM = 120;

// ----- Signals -----

// A "vector" here is a list of named numbers, e.g. { "r&b": 0.8, soul: 0.3 }.
type Vector = Map<string, number>;

interface Signals {
  uri: string;
  tags: Vector | null; // null = no tags
  mood: Vector | null; // null = no lyrics mood
  bpm: number | null;
}

// Scales a vector to length 1, so songs with many tags don't outweigh others.
function normalize(vector: Vector): Vector | null {
  let length = 0;
  vector.forEach((value) => (length += value * value));
  if (length === 0) return null;
  const out: Vector = new Map();
  vector.forEach((value, key) => out.set(key, value / Math.sqrt(length)));
  return out;
}

// How much each tag counts in THIS selection ("TF-IDF", a classic idea from
// search engines): a tag almost every song has ("pop") barely tells songs
// apart, so it counts less; a tag only some share ("dark r&b") counts more.
//   rarity = log(1 + songs / songs with the tag)
// Real data: two playlists both full of "pop" all landed in one group until
// common tags were weighed down like this.
function tagRarity(songs: SongToGroup[]): Map<string, number> {
  const withTag = new Map<string, number>();
  for (const song of songs) {
    for (const name of new Set(song.tags.map((t) => t.name.toLowerCase()))) {
      withTag.set(name, (withTag.get(name) ?? 0) + 1);
    }
  }
  const rarity = new Map<string, number>();
  withTag.forEach((n, name) => rarity.set(name, Math.log(1 + songs.length / n)));
  return rarity;
}

function signalsOf(song: SongToGroup, rarity: Map<string, number>): Signals {
  const tags: Vector = new Map();
  for (const tag of song.tags) {
    // Personal labels ("my top songs", "saw live") say nothing about the
    // sound; old cached tags can still contain them, so skip them here too.
    if (isJunkTagName(tag.name)) continue;
    // Artist-only tags count half, like in the Prism flow's scoring.
    const value = tag.weight * (tag.source === "artist" ? 0.5 : 1);
    const name = tag.name.toLowerCase();
    tags.set(name, Math.max(tags.get(name) ?? 0, value * (rarity.get(name) ?? 1)));
  }
  const mood: Vector = new Map();
  if (song.mood) for (const m of MOODS) if (song.mood[m]) mood.set(m, song.mood[m]!);
  return { uri: song.uri, tags: normalize(tags), mood: normalize(mood), bpm: song.audio ? song.audio.bpm : null };
}

const hasData = (s: Signals) => s.tags !== null || s.mood !== null || s.bpm !== null;

// Cosine similarity: 1 = pointing the same way, 0 = nothing in common.
function cosine(a: Vector, b: Vector): number {
  let dot = 0;
  let lengthB = 0;
  b.forEach((value, key) => {
    lengthB += value * value;
    dot += value * (a.get(key) ?? 0);
  });
  let lengthA = 0;
  a.forEach((value) => (lengthA += value * value));
  return lengthA && lengthB ? dot / Math.sqrt(lengthA * lengthB) : 0;
}

// A group's "average song".
interface Centre {
  tags: Vector | null;
  mood: Vector | null;
  bpm: number | null;
}

// Similarity of a song to a group's centre, 0..1: the weighted average of the
// signals BOTH have (missing ones are left out and the rest re-weighted).
function similarity(song: Signals, centre: Centre, focus: GroupFocus): number {
  const w = FOCUS_WEIGHTS[focus];
  let total = 0;
  let weight = 0;
  if (song.tags && centre.tags) {
    total += w.tags * cosine(song.tags, centre.tags);
    weight += w.tags;
  }
  if (song.mood && centre.mood) {
    total += w.mood * cosine(song.mood, centre.mood);
    weight += w.mood;
  }
  if (song.bpm !== null && centre.bpm !== null) {
    total += w.tempo * Math.max(0, 1 - Math.abs(song.bpm - centre.bpm) / BPM_RANGE);
    weight += w.tempo;
  }
  return weight ? total / weight : 0;
}

function centreOf(members: Signals[]): Centre {
  const sum = (pick: (s: Signals) => Vector | null): Vector | null => {
    const out: Vector = new Map();
    let n = 0;
    for (const s of members) {
      const v = pick(s);
      if (!v) continue;
      n++;
      v.forEach((value, key) => out.set(key, (out.get(key) ?? 0) + value));
    }
    if (!n) return null;
    out.forEach((value, key) => out.set(key, value / n));
    return out;
  };
  const bpms = members.map((s) => s.bpm).filter((b): b is number => b !== null);
  return {
    tags: sum((s) => s.tags),
    mood: sum((s) => s.mood),
    bpm: bpms.length ? bpms.reduce((a, b) => a + b, 0) / bpms.length : null,
  };
}

// ----- k-means -----

// How "typical of a crowd" each song is: its average similarity to its 3
// most similar songs. A lone outlier (say the only two metal songs among
// R&B) scores low. To stay quick with big libraries, each song is compared
// with at most ~300 others (an even spread, so it's the same every time).
function crowdScores(pool: Signals[], focus: GroupFocus): Map<string, number> {
  const stride = Math.max(1, Math.ceil(pool.length / 300));
  const sample = pool.filter((_, i) => i % stride === 0);
  const centres = new Map(sample.map((s) => [s.uri, centreOf([s])]));
  const scores = new Map<string, number>();
  for (const s of pool) {
    const sims = sample
      .filter((o) => o.uri !== s.uri)
      .map((o) => similarity(s, centres.get(o.uri)!, focus))
      .sort((a, b) => b - a)
      .slice(0, 3);
    scores.set(s.uri, sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : 0);
  }
  return scores;
}

// Starting songs ("seeds") for k-means. Each next seed is the song that is
// most DIFFERENT from the seeds so far AND typical of a crowd:
//   score = (1 - similarity to the closest seed) x crowd score
// Plain "most different" picked lone outliers, so a group would grow around
// 2 metal songs instead of a real cluster (seen in the developer's data).
// Ties go by URI, so the result never depends on chance or song order.
function startingCentres(songs: Signals[], k: number, focus: GroupFocus): Centre[] {
  const pool = [...songs].sort((a, b) => a.uri.localeCompare(b.uri));
  const crowd = crowdScores(pool, focus);
  let first = pool[0];
  for (const s of pool) if (crowd.get(s.uri)! > crowd.get(first.uri)!) first = s;
  const centres: Centre[] = [centreOf([first])];
  const used = new Set([first.uri]);
  while (centres.length < k && used.size < pool.length) {
    let best: Signals | null = null;
    let bestScore = -Infinity;
    for (const s of pool) {
      if (used.has(s.uri)) continue;
      const closest = Math.max(...centres.map((c) => similarity(s, c, focus)));
      const score = (1 - closest) * crowd.get(s.uri)!;
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (!best) break;
    used.add(best.uri);
    centres.push(centreOf([best]));
  }
  return centres;
}

function closestCentre(song: Signals, centres: Centre[], focus: GroupFocus): number {
  let best = 0;
  let bestSim = -1;
  centres.forEach((c, i) => {
    const sim = similarity(song, c, focus);
    if (sim > bestSim) {
      bestSim = sim;
      best = i;
    }
  });
  return best;
}

interface Clustering {
  assignment: number[]; // group index per song (same order as `songs`)
  centres: Centre[];
}

function kMeans(songs: Signals[], k: number, focus: GroupFocus): Clustering {
  let centres = startingCentres(songs, k, focus);
  let assignment = songs.map((s) => closestCentre(s, centres, focus));
  for (let round = 0; round < 30; round++) {
    // Recompute each group's centre from its members.
    centres = centres.map((old, i) => {
      const members = songs.filter((_, j) => assignment[j] === i);
      return members.length ? centreOf(members) : old;
    });
    const next = songs.map((s) => closestCentre(s, centres, focus));
    const moved = next.some((g, j) => g !== assignment[j]);
    assignment = next;
    if (!moved) break; // stable: done
  }
  return { assignment, centres };
}

// How well the songs are separated (higher = clearer groups), roughly -1..1.
// For each song: how much closer it is to its own group than to the next best.
function separation({ assignment, centres }: Clustering, songs: Signals[], focus: GroupFocus): number {
  let total = 0;
  songs.forEach((s, j) => {
    const own = 1 - similarity(s, centres[assignment[j]], focus);
    let other = Infinity;
    centres.forEach((c, i) => i !== assignment[j] && (other = Math.min(other, 1 - similarity(s, c, focus))));
    const most = Math.max(own, other);
    total += most > 0 && other !== Infinity ? (other - own) / most : 0;
  });
  // Tiny groups (under 3 songs) aren't useful playlists: count them against.
  const sizes = centres.map((_, i) => assignment.filter((g) => g === i).length);
  const tiny = sizes.filter((n) => n < 3).length;
  return total / Math.max(songs.length, 1) - tiny * 0.05;
}

// ----- Names and summaries -----

// Joins the lists into one (like the newer Array.flatMap, which this
// project's TypeScript settings don't include).
const flat = <T>(lists: T[][]): T[] => ([] as T[]).concat(...lists);

const countUp = (values: string[]): [string, number][] => {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

// Main moods of a song: those with at least 20% of its mood (like topMoods).
const mainMoods = (mood: MoodProfile | null) =>
  mood ? MOODS.filter((m) => (mood[m] ?? 0) >= 0.2).sort((a, b) => (mood[b] ?? 0) - (mood[a] ?? 0)).slice(0, 2) : [];

// Main moods counted per song; a tie in songs goes to the STRONGER mood (its
// total share), so love songs with a bit of heartbreak are "love", not
// whichever comes first in the alphabet.
function moodCounts(songs: SongToGroup[]): [string, number][] {
  const count = new Map<string, number>();
  const strength = new Map<string, number>();
  for (const s of songs) {
    for (const m of mainMoods(s.mood)) {
      count.set(m, (count.get(m) ?? 0) + 1);
      strength.set(m, (strength.get(m) ?? 0) + (s.mood?.[m] ?? 0));
    }
  }
  return [...count.entries()].sort(
    (a, b) => b[1] - a[1] || (strength.get(b[0]) ?? 0) - (strength.get(a[0]) ?? 0) || a[0].localeCompare(b[0])
  );
}

function summarize(songs: SongToGroup[]): GroupSummary {
  const bpms = songs.map((s) => s.audio?.bpm).filter((b): b is number => typeof b === "number");
  return {
    tags: countUp(
      flat(songs.map((s) => [...new Set(s.tags.filter((t) => !isJunkTagName(t.name)).map((t) => t.name.toLowerCase()))]))
    ).slice(0, 6),
    moods: moodCounts(songs).slice(0, 3),
    tempo: {
      slow: bpms.filter((b) => Math.round(b) < SLOW_BELOW).length,
      mid: bpms.filter((b) => Math.round(b) >= SLOW_BELOW && Math.round(b) < FAST_FROM).length,
      fast: bpms.filter((b) => Math.round(b) >= FAST_FROM).length,
      averageBpm: bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null,
    },
    keys: countUp(songs.map((s) => s.audio?.camelot).filter((k): k is string => !!k)).slice(0, 3),
    untagged: songs.filter((s) => s.tags.length === 0).length,
  };
}

// "r&b" -> "R&B", "hip hop" -> "Hip Hop", "heartbreak" -> "Heartbreak".
export function titleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => (/^\w&\w$/.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function tempoWord(summary: GroupSummary): string | null {
  const bpm = summary.tempo.averageBpm;
  if (bpm === null) return null;
  return bpm < SLOW_BELOW ? "Slow" : bpm >= FAST_FROM ? "Upbeat" : "Mid-tempo";
}

// The group's most TYPICAL tag: common in this group, and more common here
// than across all the songs ("lift"), so every group isn't just named "r&b".
// "Share" uses each song's tag WEIGHT (how strongly Last.fm applies the tag),
// so a group of jazz songs that are also a bit chill is "Jazz", not "Chill".
function typicalTags(group: SongToGroup[], all: SongToGroup[]): string[] {
  const share = (songs: SongToGroup[], tag: string) =>
    songs.reduce((sum, s) => sum + Math.max(0, ...s.tags.filter((t) => t.name.toLowerCase() === tag).map((t) => t.weight)), 0) /
    Math.max(songs.length, 1);
  // Long descriptive tags ("a vocal centric aesthetic") make poor names: only
  // tags of up to 3 words can name a group (they still count for grouping).
  const candidates = summarize(group)
    .tags.map(([tag]) => tag)
    .filter((tag) => tag.split(" ").length <= 3);
  return candidates
    .map((tag) => {
      const here = share(group, tag);
      return { tag, score: here * Math.sqrt(here / Math.max(share(all, tag), 0.01)) };
    })
    .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
    .map((t) => t.tag);
}

function nameGroup(group: SongToGroup[], all: SongToGroup[], focus: GroupFocus): string {
  const summary = summarize(group);
  const tags = typicalTags(group, all);
  const mood = summary.moods[0] && summary.moods[0][1] >= group.length * 0.25 ? summary.moods[0][0] : null;
  const tempo = tempoWord(summary);
  const parts: (string | null)[] =
    focus === "genre"
      ? [tags[0], tags[1]]
      : focus === "mood"
        ? [mood, tags[0]]
        : focus === "energy"
          ? [tempo, tags[0]]
          : [tags[0], mood ?? tempo];
  const name = parts.filter((p): p is string => !!p).map(titleCase).join(" · ");
  return name || (mood ? `${titleCase(mood)} songs` : tempo ? `${tempo} songs` : "Mixed");
}

// ----- Putting it together -----

export function groupSongs(songs: SongToGroup[], settings: GroupingSettings): Grouping {
  const focus = settings.focus;
  const rarity = tagRarity(songs);
  const signals = songs.map((song) => signalsOf(song, rarity));
  const withData = signals.filter(hasData);
  if (withData.length === 0) {
    return { focus, groups: songs.length ? [{ name: "Mixed", songs: songs.map((s) => s.uri), summary: summarize(songs) }] : [] };
  }

  // How many groups: the chosen number (never more than there are songs),
  // or for Auto, the number from 3 to 8 that separates the songs best.
  let clustering: Clustering;
  if (settings.count === "auto") {
    const max = Math.min(AUTO_MAX, Math.floor(withData.length / 3));
    let best: { score: number; result: Clustering } | null = null;
    for (let k = AUTO_MIN; k <= Math.max(max, AUTO_MIN); k++) {
      const result = kMeans(withData, Math.min(k, withData.length), focus);
      const score = separation(result, withData, focus);
      if (!best || score > best.score + 1e-9) best = { score, result }; // ties keep fewer groups
    }
    clustering = best!.result;
  } else {
    clustering = kMeans(withData, Math.max(1, Math.min(settings.count, withData.length)), focus);
  }

  // Songs per group, best fit first.
  const k = clustering.centres.length;
  const members: { uri: string; sim: number }[][] = Array.from({ length: k }, () => []);
  withData.forEach((s, j) => {
    const sims = clustering.centres.map((c) => similarity(s, c, focus));
    const own = clustering.assignment[j];
    members[own].push({ uri: s.uri, sim: sims[own] });
    if (settings.overlap) {
      // Also every other group it fits nearly as well.
      sims.forEach((sim, i) => {
        if (i !== own && sim >= sims[own] * OVERLAP_SHARE && sim >= OVERLAP_FLOOR) members[i].push({ uri: s.uri, sim });
      });
    }
  });
  // Songs with no signals at all (no tags, mood or BPM): forced into the
  // biggest group, so nothing is left out.
  const biggest = members.reduce((b, list, i) => (list.length > members[b].length ? i : b), 0);
  signals.filter((s) => !hasData(s)).forEach((s) => members[biggest].push({ uri: s.uri, sim: 0 }));

  const byUri = new Map(songs.map((s) => [s.uri, s]));
  const groups = members
    .filter((list) => list.length > 0)
    .map((list) => {
      const uris = [...list].sort((a, b) => b.sim - a.sim || a.uri.localeCompare(b.uri)).map((m) => m.uri);
      const groupSongs = uris.map((u) => byUri.get(u)!);
      return { name: nameGroup(groupSongs, songs, focus), songs: uris, summary: summarize(groupSongs) };
    })
    .sort((a, b) => b.songs.length - a.songs.length || a.name.localeCompare(b.name));

  // Names must be different: add a number to repeats ("R&B · Love 2").
  const seen = new Map<string, number>();
  for (const group of groups) {
    const n = (seen.get(group.name) ?? 0) + 1;
    seen.set(group.name, n);
    if (n > 1) group.name = `${group.name} ${n}`;
  }
  return { focus, groups };
}
