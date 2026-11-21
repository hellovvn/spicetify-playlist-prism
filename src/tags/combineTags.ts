// Blends a song's own tags with its artist's tags.
//
// Why: real data showed many songs (new or niche) have few or no Last.fm
// tags, but their artist usually does. Artist tags are broader (one artist,
// many styles), so they count for LESS than the song's own tags, and each
// tag remembers where it came from so the UI can say "via artist".
//
// Pure function, unit-tested in tests/combineTags.test.ts.

import type { CleanTag } from "./cleanTags";

export type TagSource = "track" | "artist";

export interface SourcedTag extends CleanTag {
  source: TagSource;
}

export interface CombineOptions {
  // If the song has at least this many tags, artist tags aren't used. Default 3.
  minTrackTags?: number;
  // Artist tag weights are multiplied by this. Default 0.5.
  artistWeight?: number;
  // Keep at most this many tags. Default 15.
  maxTags?: number;
}

// Tells the caller whether it's worth fetching artist tags at all, so we
// don't spend a Last.fm request when the song is already well tagged.
export function needsArtistTags(trackTags: CleanTag[], options: CombineOptions = {}): boolean {
  return trackTags.length < (options.minTrackTags ?? 3);
}

export function combineTags(
  trackTags: CleanTag[],
  artistTags: CleanTag[],
  options: CombineOptions = {}
): SourcedTag[] {
  const artistWeight = options.artistWeight ?? 0.5;
  const maxTags = options.maxTags ?? 15;

  const fromTrack: SourcedTag[] = trackTags.map((tag) => ({ ...tag, source: "track" }));
  if (!needsArtistTags(trackTags, options)) {
    return fromTrack.slice(0, maxTags);
  }

  // Start with the song's own tags; they always win over artist tags.
  const byName = new Map<string, SourcedTag>();
  for (const tag of fromTrack) byName.set(tag.name, tag);

  // Add artist tags at reduced weight, but only names the song doesn't already have.
  for (const tag of artistTags) {
    if (!byName.has(tag.name)) {
      byName.set(tag.name, { name: tag.name, weight: tag.weight * artistWeight, source: "artist" });
    }
  }

  return [...byName.values()]
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, maxTags);
}
