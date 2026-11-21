// Lyrics mood (step 10): what a song's lyrics are ABOUT, from a word list.
// PURE functions, unit-tested in tests/lyricsMood.test.ts.
//
// How it works:
//   1. Split the lyrics into words ("Cryin'" -> "cryin").
//   2. Count how many words belong to each mood's word list below.
//   3. Turn the counts into shares: a song with 6 heartbreak words and
//      2 love words is 75% heartbreak, 25% love. That's its "mood profile".
//   4. Two songs match when their profiles point the same way
//      (cosine similarity, see moodMatch).
//
// Limits (decided with the developer: simple, free, private):
//   - English only (the word lists are English).
//   - It counts words, it doesn't understand them: "I don't hate you" counts as anger.
//   - Songs with very few mood words get NO profile (too little to judge),
//     and are scored on tags/BPM/key only, like songs without BPM.
// Privacy: the lyrics text is only read here to count words. It is never
// stored, logged, or sent anywhere; only the profile (8 numbers) is kept.

export const MOODS = ["love", "heartbreak", "desire", "party", "anger", "dark", "hopeful", "numb"] as const;
export type Mood = (typeof MOODS)[number];

// Shares per mood, adding up to 1. Moods with no words are left out.
export type MoodProfile = Partial<Record<Mood, number>>;

// Words in their base form. `moodOf` also finds simple variants:
// "tears" (-s), "crying" (-ing), "cryin" (-in), "kissed" (-ed), "dancing" (-ing + e).
// Very common words ("baby", "want", "need", "heart") are left out on purpose:
// they're in almost every song, so they'd make every song look the same.
// Words with two common meanings are left out too, after checking real songs:
// "light" ("lights off" isn't hopeful), "lie" ("lie down" isn't anger).
const WORDS: Record<Mood, string[]> = {
  love: ["love", "lover", "darling", "honey", "sweetheart", "forever", "together", "adore", "cherish", "kiss",
    "hug", "marry", "wedding", "soulmate", "beautiful", "romance", "valentine", "devotion"],
  heartbreak: ["cry", "tear", "broken", "break", "goodbye", "alone", "lonely", "miss", "lost", "hurt", "pain",
    "sorry", "leave", "left", "gone", "regret", "sad", "sadness", "ache", "heartbreak", "heartbroken", "apart",
    "empty", "forget", "memory", "memories"],
  desire: ["body", "touch", "skin", "bed", "sheets", "lips", "taste", "naked", "sexy", "sex", "crave", "desire",
    "lust", "tease", "waist", "hips", "sweat", "thighs", "moan"],
  party: ["party", "dance", "club", "drink", "shot", "bottle", "celebrate", "fun", "wild", "lit", "dj", "floor",
    "weekend", "champagne", "tequila", "money", "cash", "crowd"],
  anger: ["hate", "fight", "kill", "mad", "rage", "angry", "enemy", "enemies", "fake", "liar", "liars",
    "revenge", "war", "scream", "burn", "destroy", "betray", "snake"],
  dark: ["dark", "darkness", "devil", "demon", "death", "die", "dead", "hell", "sin", "sinner", "shadow", "ghost",
    "poison", "knife", "monster", "grave", "evil", "haunt", "curse", "nightmare", "bury", "blood"],
  hopeful: ["hope", "rise", "free", "freedom", "dream", "sun", "sunshine", "shine", "fly", "believe",
    "strong", "alive", "smile", "happy", "heaven", "bright", "golden", "tomorrow"],
  numb: ["high", "smoke", "drunk", "pill", "wasted", "numb", "faded", "lean", "drug", "liquor", "whiskey", "sober",
    "overdose", "weed", "dope", "xanax", "codeine"],
};

// word -> mood, built once from the lists above.
const MOOD_BY_WORD = new Map<string, Mood>();
for (const mood of MOODS) for (const word of WORDS[mood]) MOOD_BY_WORD.set(word, mood);

// A song needs at least this many mood words to get a profile.
export const MIN_MOOD_WORDS = 5;

// "Don't", "Cryin'", "TEARS!" -> "dont", "cryin", "tears"
export function splitWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "") // apostrophes join the word: don't -> dont
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// The mood a single word belongs to, trying simple variants. Exact match first,
// so a word like "sin" is never cut down to "s".
export function moodOf(word: string): Mood | null {
  const tries = [word];
  for (const ending of ["s", "es", "ing", "in", "ed", "d"]) {
    if (word.length > ending.length + 2 && word.endsWith(ending)) {
      const base = word.slice(0, -ending.length);
      tries.push(base, base + "e"); // dancing -> danc -> dance
    }
  }
  for (const candidate of tries) {
    const mood = MOOD_BY_WORD.get(candidate);
    if (mood) return mood;
  }
  return null;
}

// The whole song: lyric lines in, mood profile out (or null if it can't be judged).
export function lyricsMood(lines: string[], language: string | null | undefined): MoodProfile | null {
  if (language && language !== "en") return null; // word lists are English only

  const counts = new Map<Mood, number>();
  let total = 0;
  for (const line of lines) {
    for (const word of splitWords(line)) {
      const mood = moodOf(word);
      if (mood) {
        counts.set(mood, (counts.get(mood) ?? 0) + 1);
        total++;
      }
    }
  }
  if (total < MIN_MOOD_WORDS) return null;

  const profile: MoodProfile = {};
  counts.forEach((count, mood) => (profile[mood] = count / total));
  return profile;
}

// How alike two profiles are, 0..1: "cosine similarity".
// Think of each profile as an arrow with 8 directions (one per mood). Arrows
// pointing the same way score 1; arrows with nothing in common score 0. It
// compares the MIX of moods, so a short song and a long song can still match.
export function moodMatch(a: MoodProfile, b: MoodProfile): number {
  let dot = 0;
  let lengthA = 0;
  let lengthB = 0;
  for (const mood of MOODS) {
    const x = a[mood] ?? 0;
    const y = b[mood] ?? 0;
    dot += x * y;
    lengthA += x * x;
    lengthB += y * y;
  }
  if (lengthA === 0 || lengthB === 0) return 0;
  return dot / Math.sqrt(lengthA * lengthB);
}

// The main moods, for display: "heartbreak, desire". Moods under 20% are left out.
export function topMoods(profile: MoodProfile, max = 2): Mood[] {
  return MOODS.filter((mood) => (profile[mood] ?? 0) >= 0.2)
    .sort((a, b) => (profile[b] ?? 0) - (profile[a] ?? 0))
    .slice(0, max);
}

// For the seed panel and tooltips.
export function formatMood(profile: MoodProfile | null): string {
  if (!profile) return "Lyrics mood: unknown";
  const main = topMoods(profile);
  return `Lyrics mood: ${main.length > 0 ? main.join(", ") : "mixed"}`;
}
