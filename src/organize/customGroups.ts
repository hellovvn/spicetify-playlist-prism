// Organize, "Start from scratch" (step 13c-2): the user makes their own
// groups by picking genres and/or moods for each one, and Prism sorts every
// scanned song into the group it fits best.
// PURE (no Spotify, no React): unit-tested in tests/customGroups.test.ts.
// Like editGroups.ts, each edit returns NEW groups and never changes the old.
//
// How a song is sorted, in plain words:
// 1. A song MATCHES a group when it has one of the group's genres (a Last.fm
//    tag), or one of the group's moods is a main mood of its lyrics.
// 2. How WELL it fits (0..1) mixes two parts, weighted by "Group mostly by":
//      genre part = the song's weights for the group's genres, added up
//                   (max 1; artist-only tags count half, like elsewhere)
//      mood part  = the song's lyrics-mood shares for the group's moods
//    A group with only genres uses only the genre part, and the same for moods.
// 3. "One each": the song goes into the matching group it fits best (a tie
//    goes to the group higher in the list). "Allow overlap": it also joins
//    every matching group it fits nearly as well (OVERLAP_SHARE, as in 13b).
// 4. A song that matches NO group is still placed (nothing is left out): in
//    the closest group by lyrics mood + BPM, like untagged songs in 13b.

import type { Mood } from "../mood/lyricsMood";
import { isJunkTagName } from "../tags/cleanTags";
import {
  FOCUS_WEIGHTS,
  OVERLAP_SHARE,
  closestByMoodAndTempo,
  mainMoods,
  summarize,
  titleCase,
  type GroupFocus,
  type SongGroup,
  type SongToGroup,
} from "./grouping";

export const MIN_CUSTOM_GROUPS = 2;
export const MAX_CUSTOM_GROUPS = 10;

export interface CustomGroup {
  id: string; // stays the same when renamed
  name: string;
  named: boolean; // true once the user typed a name (then it isn't auto-named)
  genres: string[]; // lower-case tag names
  moods: Mood[];
}

export type LabelKind = "genre" | "mood";

export interface LabelChoice {
  name: string;
  songs: number; // how many scanned songs have it
}

// ----- What can be picked -----

// The genres and moods that actually occur in the scanned songs, most common
// first, with how many songs have each. (A genre is counted once per song.)
export function labelChoices(songs: SongToGroup[]): { genres: LabelChoice[]; moods: LabelChoice[] } {
  const genres = new Map<string, number>();
  const moods = new Map<string, number>();
  for (const song of songs) {
    const names = new Set(song.tags.filter((t) => !isJunkTagName(t.name)).map((t) => t.name.toLowerCase()));
    names.forEach((n) => genres.set(n, (genres.get(n) ?? 0) + 1));
    mainMoods(song.mood).forEach((m) => moods.set(m, (moods.get(m) ?? 0) + 1));
  }
  const sorted = (counts: Map<string, number>) =>
    [...counts.entries()]
      .map(([name, n]) => ({ name, songs: n }))
      .sort((a, b) => b.songs - a.songs || a.name.localeCompare(b.name));
  return { genres: sorted(genres), moods: sorted(moods) };
}

// ----- Building the groups -----

// "R&B · Love" from the first two labels, or "" when it has none yet.
export function autoName(group: Pick<CustomGroup, "genres" | "moods">): string {
  return [...group.genres, ...group.moods].slice(0, 2).map(titleCase).join(" · ");
}

// The starting point: `count` empty groups called "Group 1", "Group 2"...
export function blankGroups(count: number): CustomGroup[] {
  const n = Math.max(MIN_CUSTOM_GROUPS, Math.min(MAX_CUSTOM_GROUPS, count));
  return Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: `Group ${i + 1}`, named: false, genres: [], moods: [] }));
}

// A new empty group at the end (its id is one no group has used).
export function addCustomGroup(groups: CustomGroup[]): CustomGroup[] {
  if (groups.length >= MAX_CUSTOM_GROUPS) return groups;
  const used = new Set(groups.map((g) => g.id));
  let n = groups.length + 1;
  while (used.has(`c${n}`)) n++;
  return [...groups, { id: `c${n}`, name: `Group ${groups.length + 1}`, named: false, genres: [], moods: [] }];
}

export function removeCustomGroup(groups: CustomGroup[], id: string): CustomGroup[] {
  if (groups.length <= MIN_CUSTOM_GROUPS) return groups;
  return groups.filter((g) => g.id !== id);
}

// Turns a genre or mood on/off for one group. A group the user hasn't named
// yet is named after its labels as they change.
export function toggleLabel(groups: CustomGroup[], id: string, kind: LabelKind, label: string): CustomGroup[] {
  return groups.map((g, i) => {
    if (g.id !== id) return g;
    const name = label.toLowerCase();
    const next =
      kind === "genre"
        ? { ...g, genres: g.genres.includes(name) ? g.genres.filter((x) => x !== name) : [...g.genres, name] }
        : { ...g, moods: g.moods.includes(name as Mood) ? g.moods.filter((x) => x !== name) : [...g.moods, name as Mood] };
    return next.named ? next : { ...next, name: autoName(next) || `Group ${i + 1}` };
  });
}

// A typed name sticks; a blank one goes back to the automatic name.
export function renameCustomGroup(groups: CustomGroup[], id: string, name: string): CustomGroup[] {
  const clean = name.trim();
  return groups.map((g, i) =>
    g.id !== id ? g : clean ? { ...g, name: clean, named: true } : { ...g, name: autoName(g) || `Group ${i + 1}`, named: false }
  );
}

// What's missing before the songs can be sorted, or null when it's ready.
export function checkCustomGroups(groups: CustomGroup[]): string | null {
  if (groups.length < MIN_CUSTOM_GROUPS) return `Make at least ${MIN_CUSTOM_GROUPS} groups.`;
  const empty = groups.find((g) => g.genres.length === 0 && g.moods.length === 0);
  if (empty) return `"${empty.name}" has no genres or moods yet. Pick at least one, or remove the group.`;
  return null;
}

// ----- Sorting the songs -----

// Does the song have one of the group's genres or moods?
export function songMatches(song: SongToGroup, group: Pick<CustomGroup, "genres" | "moods">): boolean {
  const tags = new Set(song.tags.map((t) => t.name.toLowerCase()));
  const moods = mainMoods(song.mood);
  return group.genres.some((g) => tags.has(g)) || group.moods.some((m) => moods.includes(m));
}

// How many songs match a group (the "≈ N songs" hint while building; the
// real number can be lower when a song fits another group better).
export function matchCount(songs: SongToGroup[], group: Pick<CustomGroup, "genres" | "moods">): number {
  return songs.filter((s) => songMatches(s, group)).length;
}

// How well a song fits a group, 0..1 (see the top of this file).
export function fitScore(song: SongToGroup, group: Pick<CustomGroup, "genres" | "moods">, focus: GroupFocus): number {
  const w = FOCUS_WEIGHTS[focus];
  let total = 0;
  let weight = 0;
  if (group.genres.length) {
    let genre = 0;
    for (const tag of song.tags) {
      if (group.genres.includes(tag.name.toLowerCase())) genre += tag.weight * (tag.source === "artist" ? 0.5 : 1);
    }
    total += w.tags * Math.min(1, genre);
    weight += w.tags;
  }
  if (group.moods.length) {
    const mood = group.moods.reduce((sum, m) => sum + (song.mood?.[m] ?? 0), 0);
    total += w.mood * Math.min(1, mood);
    weight += w.mood;
  }
  return weight ? total / weight : 0;
}

export interface CustomSortSettings {
  overlap: boolean;
  focus: GroupFocus;
}

export interface CustomSortResult {
  groups: SongGroup[]; // same order as the user's groups; empty ones are kept
  placedByMoodTempo: string[]; // songs that matched no group (force-sorted)
}

export function sortIntoGroups(songs: SongToGroup[], custom: CustomGroup[], settings: CustomSortSettings): CustomSortResult {
  const members: { song: SongToGroup; fit: number }[][] = custom.map(() => []);
  const unmatched: SongToGroup[] = [];
  for (const song of songs) {
    const fits = custom.map((g) => (songMatches(song, g) ? fitScore(song, g, settings.focus) : -1));
    let best = -1;
    fits.forEach((f, i) => {
      if (f >= 0 && (best < 0 || f > fits[best] + 1e-9)) best = i; // ties keep the earlier group
    });
    if (best < 0) {
      unmatched.push(song);
      continue;
    }
    members[best].push({ song, fit: fits[best] });
    if (settings.overlap) {
      fits.forEach((f, i) => {
        if (i !== best && f >= 0 && f >= fits[best] * OVERLAP_SHARE) members[i].push({ song, fit: f });
      });
    }
  }

  // Songs that matched nothing: the closest group by mood + BPM, compared
  // with the songs that DID match each group. (Sorted first, so the result
  // never depends on the order the songs were scanned in.)
  unmatched.sort((a, b) => a.uri.localeCompare(b.uri));
  const closest = closestByMoodAndTempo(
    members.map((list) => list.map((m) => m.song)),
    unmatched,
    settings.focus
  );
  // Best fit first; force-sorted songs after the matching ones.
  const ordered = members.map((list) =>
    [...list].sort((a, b) => b.fit - a.fit || a.song.uri.localeCompare(b.song.uri)).map((m) => m.song)
  );
  unmatched.forEach((song, j) => ordered[closest[j]].push(song));

  // Names must be different (they become playlist names): "Love 2".
  const seen = new Map<string, number>();
  const groups = custom.map((g, i) => {
    const n = (seen.get(g.name) ?? 0) + 1;
    seen.set(g.name, n);
    return { name: n > 1 ? `${g.name} ${n}` : g.name, songs: ordered[i].map((s) => s.uri), summary: summarize(ordered[i]) };
  });
  return { groups, placedByMoodTempo: unmatched.map((s) => s.uri) };
}
