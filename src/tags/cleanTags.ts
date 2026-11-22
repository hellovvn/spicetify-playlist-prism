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
  // The song's title, so we can drop tags that just repeat it (see below).
  title?: string;
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
  // Personal labels people put on their own library (seen in real data, 2026-11-22).
  "saw live",
  "my top songs",
  "my music library",
  "my songs",
  "liked",
  "loved",
  "guilty pleasure",
  "guilty pleasures",
  "to listen",
]);

// Nationalities and countries describe where the artist is from, not the vibe of a song.
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
  "ukrainian", // found by the smoke test (Carpetman's artist tags)
  "russian",
  "polish",
  "finnish",
  "belgian",
  "brazilian",
  "mexican",
  "new zealand",
  "south african",
  "nigerian",
  "jamaican",
  "haitian", // found in real artist tags
  "japanese", // found in real artist tags
  "korean",
  "chinese",
  "indian",
  // Countries too, not just nationalities ("sweden", "canada", "haiti" were all seen).
  "sweden",
  "canada",
  "haiti",
  "america",
  "united states",
  "united kingdom",
  "england",
  "scotland",
  "ireland",
  "australia",
  "germany",
  "france",
  "netherlands",
  "spain",
  "italy",
  "norway",
  "denmark",
  "finland",
  "poland",
  "russia",
  "ukraine",
  "belgium",
  "brazil",
  "mexico",
  "japan",
  "korea",
  "south korea",
  "china",
  "india",
  "nigeria",
  "jamaica",
  "south africa",
]);
// Note: only the bare nationality or country is dropped. Genres that contain
// one ("ukrainian pop", "british soul", "korean r&b") are kept: those describe a sound.

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

// ----- Spelling and plural variants -----
// Real case: "The Color Violet" was tagged color, colors, colour, colours.
// baseForm() maps each word to a shared form so variants can be compared:
//   colours -> colour -> color,   colors -> color
// It's ONLY used for comparing; the tag keeps a real spelling for display.
// Words ending in "s" that aren't plurals keep their s ("blues" is a genre, not many "blue").
const NOT_PLURAL = new Set(["blues", "bass", "chorus", "lyrics", "news", "jazz", "yes", "this", "is", "us"]);

export function baseForm(word: string): string {
  let w = word.toLowerCase();
  if (!NOT_PLURAL.has(w) && w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.endsWith("our") && w.length > 4) w = w.slice(0, -3) + "or"; // British -> American: colour, flavour
  return w;
}

const baseOfTag = (name: string) => name.split(" ").map(baseForm).join(" ");

// ----- Tags that just repeat the title -----
// People tag songs with words from the title ("color" on "The Color Violet",
// so it shows up in a "colours" playlist). That says nothing about the vibe.
// BUT some title words ARE the vibe: a song called "Sad Girl" tagged "sad"
// really is sad. So mood/genre words are kept even when they're in the title.
const VIBE_WORDS = new Set([
  "love", "sad", "happy", "dark", "chill", "sexy", "sex", "night", "summer", "rain", "party", "dance",
  "romantic", "angry", "lonely", "heartbreak", "dream", "dreamy", "slow", "soft", "broken", "sleep",
  "blues", "jazz", "soul", "rock", "pop", "rap", "disco", "country", "funk", "house", "trap", "gospel",
  // Sound words: "Acoustic Love" tagged "acoustic" really is acoustic.
  "acoustic", "piano", "instrumental", "orchestral", "lofi", "ballad",
]);

// The title's words, as base forms ("The Color Violet" -> the, color, violet).
function titleWords(title: string | undefined): Set<string> {
  if (!title) return new Set();
  // Split on spaces and punctuation; works for any alphabet (e.g. Cyrillic titles).
  const words = normalizeTagName(title).split(/[\s()[\].,!?:;"/]+/).filter(Boolean);
  return new Set(words.map(baseForm));
}

// True when EVERY word of the tag is a title word (so "violet" goes, but
// "violet hour" stays) and the tag isn't a vibe word.
function repeatsTitle(name: string, title: Set<string>): boolean {
  if (title.size === 0 || VIBE_WORDS.has(name)) return false;
  return name.split(" ").every((word) => title.has(baseForm(word)));
}

// True for tags that say nothing about the sound (personal labels, years,
// ratings...). Exported so code using OLD cached tags (cleaned before a junk
// word was added here) can still skip them, e.g. Organize's grouping.
export function isJunkTagName(name: string): boolean {
  const normal = normalizeTagName(name);
  return JUNK_TAGS.has(normal) || JUNK_PATTERNS.some((pattern) => pattern.test(normal));
}

function isJunk(name: string, artistNames: Set<string>, title: Set<string>): boolean {
  return (
    name === "" ||
    JUNK_TAGS.has(name) ||
    NATIONALITIES.has(name) ||
    artistNames.has(name) ||
    repeatsTitle(name, title) ||
    JUNK_PATTERNS.some((pattern) => pattern.test(name))
  );
}

export function cleanTags(tags: LastfmTag[], options: CleanOptions = {}): CleanTag[] {
  const minWeight = options.minWeight ?? 0.05;
  const maxTags = options.maxTags ?? 15;
  const artistNames = new Set((options.artistNames ?? []).map(normalizeTagName));
  const title = titleWords(options.title);

  // 1. Normalize names, 2. drop junk, 3. merge duplicates (keep the HIGHER
  //    count: adding them up could go past 100 and over-reward duplicates).
  //    Spelling/plural variants count as duplicates: they share a baseOfTag()
  //    key, and the name shown is the strongest variant's.
  const merged = new Map<string, { name: string; count: number }>();
  for (const tag of tags) {
    const name = normalizeTagName(tag.name);
    if (isJunk(name, artistNames, title)) continue;
    const count = Number.isFinite(tag.count) ? tag.count : 0;
    const key = baseOfTag(name);
    const existing = merged.get(key);
    if (!existing || count > existing.count) merged.set(key, { name, count });
  }

  // 4. Re-scale so the strongest remaining tag is 1.0.
  const maxCount = Math.max(0, ...[...merged.values()].map((entry) => entry.count));
  if (maxCount <= 0) return [];

  // 5. Drop weak tags, 6. sort strongest first, 7. keep the top N.
  return [...merged.values()]
    .map(({ name, count }) => ({ name, weight: count / maxCount }))
    .filter((tag) => tag.weight >= minWeight)
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
    .slice(0, maxTags);
}
