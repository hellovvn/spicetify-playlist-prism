// Turning the songs of several playlists into ONE list to scan.
// PURE helpers, unit-tested in tests/scanTracks.test.ts.

import { yearFromRelease } from "../stats/playlistExtras";

export interface ScanTrack {
  uri: string;
  name: string;
  artists: string[];
  durationMs?: number; // song length, when Spotify says (for the stats page)
  year?: number; // release year, when Spotify says (the stats page's "Eras")
  // Album cover web addresses, when Spotify says (Organize's cards and lists):
  cover?: string; // ~300px, for the 2x2 mosaics
  coverSmall?: string; // ~64px, for song rows
}

// Spotify gives covers as "spotify:image:<id>" in several sizes (label
// "small" ~64px, "standard" ~300px). The web address is i.scdn.co/image/<id>.
function coverUrl(images: any[] | undefined, label: string): string | undefined {
  const image = (images ?? []).find((i: any) => i?.label === label) ?? (images ?? [])[0];
  const id = typeof image?.url === "string" && image.url.startsWith("spotify:image:") ? image.url.slice(14) : null;
  return id ? `https://i.scdn.co/image/${id}` : undefined;
}

// Spotify's raw playlist / Liked Songs items -> ScanTrack.
// Skips anything we can't look up: podcast episodes, local files (MP3s on
// your computer have no Spotify URI to match), and broken entries.
// `any`: Spotify's raw data; we check each field we use.
export function toScanTracks(items: any[]): ScanTrack[] {
  const result: ScanTrack[] = [];
  for (const item of items ?? []) {
    if (typeof item?.uri !== "string" || !item.uri.startsWith("spotify:track:")) continue;
    if (item.isLocal || typeof item.name !== "string") continue;
    const artists = (item.artists ?? []).map((a: any) => a?.name).filter(Boolean);
    const durationMs = item.duration?.milliseconds;
    const year = yearFromRelease(item.release?.isoString);
    const cover = coverUrl(item.album?.images, "standard");
    const coverSmall = coverUrl(item.album?.images, "small");
    result.push({
      uri: item.uri,
      name: item.name,
      artists,
      ...(typeof durationMs === "number" ? { durationMs } : {}),
      ...(year ? { year } : {}),
      ...(cover ? { cover } : {}),
      ...(coverSmall ? { coverSmall } : {}),
    });
  }
  return result;
}

// Merges the lists and removes duplicates (the same song in two playlists),
// keeping the first copy. Also says how many duplicates were dropped.
export function mergeTracks(lists: ScanTrack[][]): { tracks: ScanTrack[]; duplicates: number } {
  const seen = new Set<string>();
  const tracks: ScanTrack[] = [];
  let duplicates = 0;
  for (const list of lists) {
    for (const track of list) {
      if (seen.has(track.uri)) {
        duplicates++;
      } else {
        seen.add(track.uri);
        tracks.push(track);
      }
    }
  }
  return { tracks, duplicates };
}
