// Merge playlists: join several playlists into ONE new playlist, without
// duplicates. PURE helpers, unit-tested in tests/mergePlaylists.test.ts.
// The writing (create + the optional "[merged] " rename) is in
// src/spotify/write.ts (createMergedPlaylist).

import { songKey } from "../scoring/rank";
import type { ScanTrack } from "../scan/tracks";

export interface MergePlan {
  tracks: ScanTrack[]; // what goes into the new playlist, in order
  total: number; // songs in all the picked playlists together
  duplicates: number; // how many of those were dropped
  dropped: DroppedSong[]; // each left-out copy and the copy kept instead (review screen)
}

// A copy that was left out. from / keptFrom are indexes into the lists
// passed to mergeSongs (= the picked playlists, in order).
export interface DroppedSong {
  track: ScanTrack;
  from: number;
  kept: ScanTrack;
  keptFrom: number;
}

// Playlists in the order picked, each one's songs in its own order. A song is
// a duplicate when it has the same URI OR the same songKey (core title + main
// artist) as one already kept, so the single and the album copy of a song
// only go in once. The first copy keeps its place.
export function mergeSongs(lists: ScanTrack[][]): MergePlan {
  // What was kept, by URI and by songKey, and which playlist it came from.
  const byUri = new Map<string, { track: ScanTrack; from: number }>();
  const byKey = new Map<string, { track: ScanTrack; from: number }>();
  const tracks: ScanTrack[] = [];
  const dropped: DroppedSong[] = [];
  let total = 0;
  lists.forEach((list, from) => {
    for (const track of list) {
      total++;
      const key = songKey(track);
      const kept = byUri.get(track.uri) ?? byKey.get(key);
      if (kept) {
        dropped.push({ track, from, kept: kept.track, keptFrom: kept.from });
        continue;
      }
      const entry = { track, from };
      byUri.set(track.uri, entry);
      byKey.set(key, entry);
      tracks.push(track);
    }
  });
  return { tracks, total, duplicates: dropped.length, dropped };
}

// The suggested name: "A + B", "A + B + C", or "A + B + 3 more" for many.
export function defaultMergeName(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= 3) return clean.join(" + ");
  return `${clean.slice(0, 2).join(" + ")} + ${clean.length - 2} more`;
}
