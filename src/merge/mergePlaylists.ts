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
}

// Playlists in the order picked, each one's songs in its own order. A song is
// a duplicate when it has the same URI OR the same songKey (core title + main
// artist) as one already kept, so the single and the album copy of a song
// only go in once. The first copy keeps its place.
export function mergeSongs(lists: ScanTrack[][]): MergePlan {
  const seenUris = new Set<string>();
  const seenKeys = new Set<string>();
  const tracks: ScanTrack[] = [];
  let total = 0;
  for (const list of lists) {
    for (const track of list) {
      total++;
      const key = songKey(track);
      if (seenUris.has(track.uri) || seenKeys.has(key)) continue;
      seenUris.add(track.uri);
      seenKeys.add(key);
      tracks.push(track);
    }
  }
  return { tracks, total, duplicates: total - tracks.length };
}

// The suggested name: "A + B", "A + B + C", or "A + B + 3 more" for many.
export function defaultMergeName(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= 3) return clean.join(" + ");
  return `${clean.slice(0, 2).join(" + ")} + ${clean.length - 2} more`;
}
