// Which tag chips are switched on. PURE helpers (no React, no Spotify), so
// they're unit-tested in tests/tagSelection.test.ts and the component stays simple.
//
// We store the tags the user switched OFF (not the ones that are on):
// every tag starts on, so "nothing switched off yet" is just an empty list.

import type { SourcedTag } from "../tags/combineTags";

// Switch one tag on/off. Returns a NEW list instead of changing the old one:
// React only notices a state change when it gets a new value.
export function toggleTag(offNames: string[], name: string): string[] {
  return offNames.includes(name) ? offNames.filter((n) => n !== name) : [...offNames, name];
}

// The tags still switched on, in their original order (strongest first).
export function keptTags(tags: SourcedTag[], offNames: string[]): SourcedTag[] {
  return tags.filter((tag) => !offNames.includes(tag.name));
}

// Can the user continue to the next step with these tags?
// Rule (decided with the developer): tags define the vibe; BPM/key/lyrics
// only RANK songs within it. So zero tags = blocked, artist-only = warned.
export type SeedStatus =
  | { kind: "ok" }
  | { kind: "artist-only"; message: string } // allowed, with a warning
  | { kind: "all-off"; message: string } // blocked
  | { kind: "no-tags"; message: string }; // blocked

export function seedStatus(allTags: SourcedTag[], kept: SourcedTag[]): SeedStatus {
  if (allTags.length === 0) {
    return {
      kind: "no-tags",
      message: "Last.fm doesn't know this song or its artist well enough. Try a different seed song.",
    };
  }
  if (kept.length === 0) {
    return { kind: "all-off", message: "Keep at least one tag on: tags are what define the vibe." };
  }
  if (kept.every((tag) => tag.source === "artist")) {
    return {
      kind: "artist-only",
      message: "These tags describe the artist, not this exact song, so matches will be broader.",
    };
  }
  return { kind: "ok" };
}

export function canContinue(status: SeedStatus): boolean {
  return status.kind === "ok" || status.kind === "artist-only";
}

// Splits tags into the song's own and the artist's, for the two chip rows.
export function splitBySource(tags: SourcedTag[]): { song: SourcedTag[]; artist: SourcedTag[] } {
  return {
    song: tags.filter((tag) => tag.source === "track"),
    artist: tags.filter((tag) => tag.source === "artist"),
  };
}
