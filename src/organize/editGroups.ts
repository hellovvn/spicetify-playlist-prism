// Editing the suggested groups on Organize's review screen (step 13c).
// PURE: each function takes the groups and returns NEW groups, never changing
// the old ones (React state works best that way: it sees a new value and
// redraws). Unit-tested in tests/editGroups.test.ts.

import type { SongGroup } from "./grouping";

export interface EditableGroup {
  id: string; // stays the same when renamed, so the screen can track it
  name: string;
  songs: string[]; // song URIs, in order
}

// The suggested groups -> editable ones (ids "g1", "g2", ...).
export function editableGroups(groups: SongGroup[]): EditableGroup[] {
  return groups.map((g, i) => ({ id: `g${i + 1}`, name: g.name, songs: [...g.songs] }));
}

// A blank name keeps the old one (a playlist needs a name).
export function renameGroup(groups: EditableGroup[], id: string, name: string): EditableGroup[] {
  const clean = name.trim();
  if (!clean) return groups;
  return groups.map((g) => (g.id === id ? { ...g, name: clean } : g));
}

// Moves a song from one group to another (added at the end). If the target
// already has it (overlap mode), it's just taken out of the first one.
export function moveSong(groups: EditableGroup[], uri: string, fromId: string, toId: string): EditableGroup[] {
  if (fromId === toId) return groups;
  return groups.map((g) => {
    if (g.id === fromId) return { ...g, songs: g.songs.filter((s) => s !== uri) };
    if (g.id === toId && !g.songs.includes(uri)) return { ...g, songs: [...g.songs, uri] };
    return g;
  });
}

// Takes a song out of one group (it won't be in that new playlist).
export function removeSong(groups: EditableGroup[], uri: string, fromId: string): EditableGroup[] {
  return groups.map((g) => (g.id === fromId ? { ...g, songs: g.songs.filter((s) => s !== uri) } : g));
}

// Merges `otherId` INTO `keepId`: one group with both groups' songs (each
// once), keeping keepId's name. The other group disappears.
export function mergeGroups(groups: EditableGroup[], keepId: string, otherId: string): EditableGroup[] {
  if (keepId === otherId) return groups;
  const other = groups.find((g) => g.id === otherId);
  if (!other) return groups;
  return groups
    .filter((g) => g.id !== otherId)
    .map((g) => (g.id === keepId ? { ...g, songs: [...g.songs, ...other.songs.filter((s) => !g.songs.includes(s))] } : g));
}

// Puts "Not included" songs back: each { uri, toId } adds that song to the
// end of that group (once: a song the group already has is skipped).
export function addSongs(groups: EditableGroup[], placements: { uri: string; toId: string }[]): EditableGroup[] {
  return groups.map((g) => {
    const adding = placements.filter((p) => p.toId === g.id && !g.songs.includes(p.uri)).map((p) => p.uri);
    const fresh = adding.filter((uri, i) => adding.indexOf(uri) === i); // the same song twice = once
    return fresh.length ? { ...g, songs: [...g.songs, ...fresh] } : g;
  });
}

// Songs that are in no group (left out or removed), to show the user.
export function songsInNoGroup(groups: EditableGroup[], allSongs: string[]): string[] {
  const placed = new Set(groups.reduce<string[]>((acc, g) => acc.concat(g.songs), []));
  return allSongs.filter((s) => !placed.has(s));
}
