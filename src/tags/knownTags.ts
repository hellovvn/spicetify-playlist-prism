// Which tags Prism keeps: ONLY known genres and mood words (decided
// 2026-11-22). Last.fm tags are typed by its users, so besides genres they
// contain personal labels ("my top songs"), fandom tags ("starlightcore")
// and jokes. A blocklist can't keep up with those, so instead this is an
// ALLOWLIST: a tag is kept only if it is
//   - a genre on the MusicBrainz genre list (src/tags/musicbrainzGenres.ts),
//   - one of the common Last.fm genres MusicBrainz doesn't list (EXTRA_GENRES), or
//   - a mood / vibe word (MOOD_TAGS), which Prism also uses for matching.
// Pure (tested in tests/knownTags.test.ts).
//
// Matching ignores capitals, spaces, "-" and "_", so "synthpop", "synth pop"
// and "Synth-Pop" are the same; "rnb" is turned into "r&b" first by
// normalizeTagName in cleanTags.ts (the caller does that).

import { MUSICBRAINZ_GENRES } from "./musicbrainzGenres";

// Genres people tag on Last.fm all the time that aren't on the MusicBrainz list.
const EXTRA_GENRES = [
  "alternative", "indie", "indie r&b", "alt r&b", "rap", "underground rap", "cloud rap", "emo rap", "sad rap",
  "r&b soul", "slow jams", "lofi hip hop", "chillhop", "chillwave", "cottagecore", "dark academia",
  "soundtrack", "acoustic", "instrumental", "singer songwriter", "ballad", "piano", "covers", "kpop", "jpop",
  "cpop", "latin", "reggaeton", "afrobeats", "amapiano", "edm", "bedroom r&b", "dark r&b", "pop rap",
  "neo soul", "uk r&b", "nu jazz", "jazz rap", "pop punk", "post hardcore", "midwest emo", "hyperpop",
  "phonk", "drill", "hardstyle", "nightcore", "slowed", "sped up",
  // Voice descriptors: not genres, but they say how a song sounds and help matching.
  "female vocalist", "female vocalists", "male vocalist", "male vocalists",
  // A live recording (also comes from "(Live)" in a song's title).
  "live",
];

// Mood and vibe words: they describe how a song FEELS, and Prism matches on
// them as well as on genres. (The lyrics-mood names are included.)
const MOOD_TAGS = [
  "chill", "chillout", "mellow", "calm", "relax", "relaxing", "sleep", "study",
  "sad", "melancholic", "melancholy", "depressing", "emotional", "heartbreak", "breakup", "lonely", "longing",
  "love", "love songs", "romantic", "sexy", "sex", "sensual", "seductive", "desire", "lust",
  "happy", "upbeat", "uplifting", "feel good", "hopeful", "energetic", "party", "dance", "summer", "sunny",
  "dark", "moody", "brooding", "haunting", "eerie", "angry", "aggressive", "anger", "numb",
  "dreamy", "ethereal", "atmospheric", "ambient", "night", "late night", "nocturnal", "rainy", "rain",
  "nostalgic", "nostalgia", "bittersweet", "soft", "smooth", "groovy", "sultry", "intimate", "epic", "cinematic",
];

// The comparison key: lowercase, no spaces / "-" / "_".
export function tagKey(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, "");
}

const KNOWN = new Set<string>([
  ...MUSICBRAINZ_GENRES.split("\n").map(tagKey),
  ...EXTRA_GENRES.map(tagKey),
  ...MOOD_TAGS.map(tagKey),
]);

// True for a genre or mood word Prism keeps. Give it a NORMALIZED name
// (normalizeTagName), so synonyms like "rnb" -> "r&b" are already applied.
// Decades ("80s", "1990s") describe an era's sound, so they're kept too.
const DECADE = /^(\d0s|\d{3}0s)$/;

export function isKnownTag(normalizedName: string): boolean {
  return KNOWN.has(tagKey(normalizedName)) || DECADE.test(normalizedName.trim());
}

// How many names are on the allowlist (for tests and notes).
export const KNOWN_TAG_COUNT = KNOWN.size;
