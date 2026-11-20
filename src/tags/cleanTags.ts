// Tag cleanup: turns Last.fm's messy, user-made tags into a short list of
// useful genre/mood tags with weights from 0 to 1.
//
// This is a PURE function: same input, same output, no network, no Spotify.
// That makes it easy to unit-test (see tests/cleanTags.test.ts).
//
// The order of the steps matters. In particular we re-scale weights AFTER
// removing junk: real data showed junk tags at the top (e.g. "love at first
// listen" = 100) squashing real tags like "sad" down to 4.

import type { LastfmTag } from "../lastfm/client";

// A cleaned tag. weight is relative: the song's strongest real tag is 1.0.
export interface CleanTag {
  name: string;
  weight: number;
}

export interface CleanOptions {
  // Artist names of the song, so we can drop tags like "Drake".
  artistNames?: string[];
  // Tags weaker than this (after re-scaling) are dropped. Default 0.05.
  minWeight?: number;
  // Keep at most this many tags. Default 15.
  maxTags?: number;
}

// Whole tags that mean the same thing, after normalizing. Left side -> right side.
const TAG_SYNONYMS: Record<string, string> = {
  "female vocalists": "female vocalist",
  "male vocalists": "male vocalist",
  "rhythm and blues": "r&b",
  "r and b": "r&b",
  electronica: "electronic",
  "chill out": "chill",
  chillout: "chill",
  "doo wop": "doowop",
};

// Single WORDS that should be replaced inside any tag, so that
// "alternative rnb" becomes "alternative r&b" too.
const WORD_SYNONYMS: Record<string, string> = {
  rnb: "r&b",
  hiphop: "hip hop",
};

// Tags that say nothing about how a song sounds or feels.
const JUNK_TAGS = new Set([
  "seen live",
  "favorite",
  "favorites",
  "favourite",
  "favourites",
  "fav",
  "favs",
  "my favorite",
  "love at first listen",
  "soty",
  "aoty",
  "albums i own",
  "my music",
  "spotify",
  "check out",
  "awesome",
  "amazing",
  "beautiful",
  "cool",
  "good",
  "great",
  "under 2000 listeners",
  "fip",
]);

// Nationalities describe the artist, not the vibe of a song.
const NATIONALITIES = new Set([
  "american",
  "british",
  "english",
  "uk",
  "usa",
  "canadian",
  "australian",
  "irish",
  "scottish",
  "swedish",
  "norwegian",
  "danish",
  "german",
  "french",
  "dutch",
  "spanish",
  "italian",
]);

// Pattern-based junk:
//   ^\d{4}$          a year on its own, e.g. "2011", "2025"
//   ^best of         "best of 2011", "best of the decade"
//   ^(my )?top \d+   "top 10", "my top 100"
//   stars?$          "5 stars", "4 of 5 stars"
const JUNK_PATTERNS = [/^\d{4}$/, /^best of\b/, /^(my )?top \d+/, /\bstars?$/];

// Lowercase, turn "-" and "_" into spaces, squeeze spaces, apply word synonyms.
// Exported because the artist-name check and tests use the same rules.
export function normalizeTagName(name: string): string {
  const basic = name
    .toLowerCase()
    .replace(/[-_]+/g, " ") // "Hip-Hop" -> "hip hop"
    .replace(/\s+/g, " ") // "pop   soul" -> "pop soul"
    .trim();
  const words = basic.split(" ").map((word) => WORD_SYNONYMS[word] ?? word);
  const joined = words.join(" ");
  return TAG_SYNONYMS[joined] ?? joined;
}

function isJunk(name: string, artistNames: Set<string>): boolean {
  return (
    name === "" ||
    JUNK_TAGS.has(name) ||
    NATIONALITIES.has(name) ||
    artistNames.has(name) ||
    JUNK_PATTERNS.some((pattern) => pattern.test(name))
  );
}

export function cleanTags(tags: LastfmTag[], options: CleanOptions = {}): CleanTag[] {
  const minWeight = options.minWeight ?? 0.05;
  const maxTags = options.maxTags ?? 15;
  const artistNames = new Set((options.artistNames ?? []).map(normalizeTagName));

  // 1. Normalize names, 2. drop junk, 3. merge duplicates (keep the HIGHER
  //    count: adding them up could go past 100 and over-reward duplicates).
  const merged = new Map<string, number>();
  for (const tag of tags) {
    const name = normalizeTagName(tag.name);
    if (isJunk(name, artistNames)) continue;
    const count = Number.isFinite(tag.count) ? tag.count : 0;
    merged.set(name, Math.max(merged.get(name) ?? 0, count));
  }

  // 4. Re-scale so the strongest remaining tag is 1.0.
  const maxCount = Math.max(0, ...merged.values());
  if (maxCount <= 0) return [];

  // 5. Drop weak tags, 6. sort strongest first, 7. keep the top N.
  return [...merged.entries()]
    .map(([name, count]) => ({ name, weight: count / maxCount }))
    .filter((tag) => tag.weight >= minWeight)
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, maxTags);
}
