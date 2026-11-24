// PLAYLIST TONE: the user sets the "tone" of a playlist (its key genres, the
// moods of its lyrics and, if they like, its tempo), and Prism shows how well
// each song in it fits that tone, as a % like Grow's match score.
// PURE (no Spotify, no React): unit-tested in tests/tone.test.ts.
//
// A tone lives ONLY in Spotify's LocalStorage on this computer (prism:tones,
// keyed by playlist URI). It never writes anything to the playlist (hard rule).
//
// How a song is scored, in plain words (same weights as Grow, minus key):
//   GENRES (60)  how strongly the song has the tone's genres. Mostly its BEST
//                one (a song that is clearly "dark r&b" fits a dark r&b tone,
//                even if the tone also lists four other genres), plus a little
//                for having more of them. Same name = full credit, one inside
//                the other ("r&b" ~ "alternative r&b") = half, like Grow.
//   MOOD (15)    the song's lyrics mood vs the tone's moods (cosine, like Grow).
//   TEMPO (15)   1 inside the picked band (slow < 90, mid 90-119, fast 120+),
//                falling to 0 at 20% outside it.
// Parts the tone doesn't set, or the song has no data for, are left out of
// the average (like Grow, songs aren't punished for missing data). A song
// with no Last.fm tags at all, in a tone with genres, is scored on mood and
// tempo only and marked PARTIAL (a faded ring: a rough guess). With no mood
// or tempo to go on either, it gets no score ("–").

import { MOODS, moodMatch, type Mood, type MoodProfile } from "../mood/lyricsMood";
import type { SourcedTag } from "../tags/combineTags";
import { isJunkTagName } from "../tags/cleanTags";
import { mainMoods } from "../organize/grouping";
import { labelChoices } from "../organize/customGroups";

export type TempoBand = "any" | "slow" | "mid" | "fast";
export const TEMPO_BANDS: { value: TempoBand; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "slow", label: "Slow" },
  { value: "mid", label: "Mid" },
  { value: "fast", label: "Fast" },
];
export const SLOW_BELOW = 90; // same bands as the stats page
export const FAST_FROM = 120;

export interface PlaylistTone {
  genres: string[]; // lower-case tag names
  moods: Mood[];
  tempo: TempoBand;
  show: boolean; // the "Tone" view is switched on for this playlist
  updatedAt: number;
}

export type PlaylistTones = Record<string, PlaylistTone>;

// Sent (same window, both bundles) whenever a tone is saved or removed.
export const TONES_CHANGED_EVENT = "playlist-prism:tones-changed";

export const TONE_WEIGHTS = { genres: 0.6, mood: 0.15, tempo: 0.15 };
// Below this, a song "drifts" from the tone (its row fades in the view).
export const DRIFT_BELOW = 0.5;
// How much of the genre part comes from the best genre (the rest: how many).
const BEST_GENRE_SHARE = 0.75;
// A tag at least this strong (Last.fm's top tag = 1) counts fully.
const FULL_STRENGTH = 0.5;

export function isToneEmpty(tone: Pick<PlaylistTone, "genres" | "moods" | "tempo">): boolean {
  return tone.genres.length === 0 && tone.moods.length === 0 && tone.tempo === "any";
}

// ----- Scoring -----

export interface ToneSong {
  tags: SourcedTag[];
  bpm: number | null;
  mood: MoodProfile | null;
}

export interface ToneMatch {
  score: number | null; // 0..1, null = can't tell (no tags in a genre tone)
  genres: string[]; // the tone's genres this song has, strongest first
  moods: Mood[]; // the tone's moods that are main moods of this song
  tempoFits: boolean | null; // null = tone has no tempo, or BPM unknown
  partial: boolean; // no Last.fm tags: scored on mood + tempo only
}

export function genreFit(toneGenres: string[], songTags: SourcedTag[]): { score: number; matched: string[] } {
  if (toneGenres.length === 0 || songTags.length === 0) return { score: 0, matched: [] };
  const fits: { name: string; value: number }[] = [];
  for (const genre of toneGenres) {
    let best = 0;
    for (const tag of songTags) {
      const credit = genre === tag.name ? 1 : containsWords(genre, tag.name) ? 0.5 : 0;
      best = Math.max(best, credit * Math.min(1, tag.weight / FULL_STRENGTH));
    }
    if (best > 0) fits.push({ name: genre, value: best });
  }
  if (fits.length === 0) return { score: 0, matched: [] };
  fits.sort((a, b) => b.value - a.value);
  const coverage = fits.reduce((sum, f) => sum + f.value, 0) / toneGenres.length;
  return { score: BEST_GENRE_SHARE * fits[0].value + (1 - BEST_GENRE_SHARE) * coverage, matched: fits.map((f) => f.name) };
}

// Whole words, in order, inside the other (same rule as Grow's tagMatch).
function containsWords(a: string, b: string): boolean {
  const inside = (small: string, big: string) => ` ${big} `.includes(` ${small} `);
  return inside(a, b) || inside(b, a);
}

export function tempoFit(band: TempoBand, bpm: number): number {
  if (band === "any") return 1;
  const low = band === "slow" ? 0 : band === "mid" ? SLOW_BELOW : FAST_FROM;
  const high = band === "slow" ? SLOW_BELOW : band === "mid" ? FAST_FROM : Infinity;
  if (bpm >= low && bpm < high) return 1;
  const edge = bpm < low ? low : high;
  const distance = Math.abs(Math.log(bpm / edge));
  return Math.max(0, 1 - distance / Math.log(1.2));
}

// The tone's moods as a profile (equal shares), to compare with a song's.
function toneMoodProfile(moods: Mood[]): MoodProfile {
  const profile: MoodProfile = {};
  moods.forEach((m) => (profile[m] = 1 / moods.length));
  return profile;
}

export function scoreAgainstTone(tone: Pick<PlaylistTone, "genres" | "moods" | "tempo">, song: ToneSong): ToneMatch {
  const tags = song.tags.filter((t) => !isJunkTagName(t.name));
  let sum = 0;
  let weights = 0;
  const genres = genreFit(tone.genres, tags);
  const partial = tone.genres.length > 0 && tags.length === 0;
  if (tone.genres.length > 0 && tags.length > 0) {
    sum += TONE_WEIGHTS.genres * genres.score;
    weights += TONE_WEIGHTS.genres;
  }
  const moods = tone.moods.filter((m) => mainMoods(song.mood).includes(m));
  if (tone.moods.length > 0 && song.mood) {
    sum += TONE_WEIGHTS.mood * moodMatch(toneMoodProfile(tone.moods), song.mood);
    weights += TONE_WEIGHTS.mood;
  }
  let tempoFits: boolean | null = null;
  if (tone.tempo !== "any" && song.bpm) {
    const fit = tempoFit(tone.tempo, song.bpm);
    tempoFits = fit === 1;
    sum += TONE_WEIGHTS.tempo * fit;
    weights += TONE_WEIGHTS.tempo;
  }
  const score = weights > 0 ? sum / weights : null;
  return { score, genres: genres.matched, moods, tempoFits, partial: partial && score !== null };
}

// "Fits: dark r&b, desire, slow" / "Drifts: no shared genres" for the tooltip.
export function describeMatch(tone: Pick<PlaylistTone, "genres" | "moods" | "tempo">, match: ToneMatch, bpm: number | null): string {
  if (match.score === null) return "Not scored: Last.fm has no tags for this song, and there's no lyrics mood or tempo to go on";
  const parts = [...match.genres.slice(0, 3), ...match.moods];
  if (match.tempoFits) parts.push(tone.tempo);
  const pct = match.partial
    ? `~${Math.round(match.score * 100)}% tone match (a rough guess: no Last.fm tags, so mood and tempo only)`
    : `${Math.round(match.score * 100)}% tone match`;
  const misses: string[] = [];
  if (tone.genres.length > 0 && match.genres.length === 0 && !match.partial) misses.push("no shared genres");
  if (match.tempoFits === false && bpm) misses.push(`${Math.round(bpm)} BPM`);
  return [pct, parts.length ? `fits: ${parts.join(", ")}` : "", misses.length ? `off: ${misses.join(", ")}` : ""]
    .filter(Boolean)
    .join(" · ");
}

// ----- The whole playlist at a glance (switch summary, stats "Tone fit") -----
// fits / drift count only FULL scores (partial ones are rough guesses and
// are counted on their own); the average fit uses every score there is.
export interface ToneSummary {
  average: number | null; // 0..1
  fits: number;
  drift: number;
  partial: number;
  unscored: number;
}

export function toneSummary(matches: Pick<ToneMatch, "score" | "partial">[]): ToneSummary {
  const scored = matches.filter((m) => m.score !== null) as { score: number; partial: boolean }[];
  const full = scored.filter((m) => !m.partial);
  return {
    average: scored.length ? scored.reduce((sum, m) => sum + m.score, 0) / scored.length : null,
    fits: full.filter((m) => m.score >= DRIFT_BELOW).length,
    drift: full.filter((m) => m.score < DRIFT_BELOW).length,
    partial: scored.length - full.length,
    unscored: matches.length - scored.length,
  };
}

// ----- A first suggestion, from the playlist's own songs -----
// Genres shared by at least a fifth of the songs (top 4, at least 2 songs),
// moods that are a main mood of at least a fifth, and a tempo band if at
// least 70% of the songs with a BPM are in it.
export function suggestTone(songs: ToneSong[]): Pick<PlaylistTone, "genres" | "moods" | "tempo"> {
  const choices = labelChoices(songs.map((s, i) => ({ uri: String(i), name: "", tags: s.tags, mood: s.mood, audio: null })));
  const enough = Math.max(2, Math.ceil(songs.length / 5));
  const genres = choices.genres.filter((g) => g.songs >= enough).slice(0, 4).map((g) => g.name);
  if (genres.length === 0 && choices.genres[0]?.songs >= 2) genres.push(choices.genres[0].name);
  const moods = choices.moods.filter((m) => m.songs >= enough).slice(0, 2).map((m) => m.name as Mood);
  return { genres, moods, tempo: commonTempo(songs.map((s) => s.bpm)) };
}

// A tempo band if at least 70% of the songs with a BPM (3 or more) are in it.
export function commonTempo(bpmList: (number | null)[]): TempoBand {
  const bpms = bpmList.filter((b): b is number => !!b);
  let tempo: TempoBand = "any";
  for (const band of ["slow", "mid", "fast"] as TempoBand[]) {
    if (bpms.length >= 3 && bpms.filter((b) => tempoFit(band, b) === 1).length / bpms.length >= 0.7) tempo = band;
  }
  return tempo;
}

// ----- The tone a GROWN playlist starts with -----
// Made from the choices behind it: the genre chips the user kept ON (in
// their order), the seed song's main lyrics moods, and a tempo band if the
// playlist's songs mostly share one (same 70% rule as suggestTone). The tone
// view is switched on, so the new playlist shows its fit straight away.
export function toneFromGrow(choice: {
  kept: SourcedTag[];
  seedMood: MoodProfile | null;
  bpms: (number | null)[]; // the seed's and every picked song's
  now: number;
}): PlaylistTone {
  const genres: string[] = [];
  for (const tag of choice.kept) {
    const name = tag.name.toLowerCase().trim();
    if (name && !isJunkTagName(name) && !genres.includes(name)) genres.push(name);
  }
  return { genres, moods: mainMoods(choice.seedMood), tempo: commonTempo(choice.bpms), show: true, updatedAt: choice.now };
}

// ----- Saved tones (prism:tones) -----

export function parseTones(text: string | null): PlaylistTones {
  if (!text) return {};
  try {
    const raw = JSON.parse(text);
    const tones: PlaylistTones = {};
    for (const [uri, value] of Object.entries(raw ?? {})) {
      const t = value as any;
      if (!t || !Array.isArray(t.genres) || !Array.isArray(t.moods)) continue;
      tones[uri] = {
        genres: t.genres.filter((g: unknown) => typeof g === "string"),
        moods: t.moods.filter((m: unknown) => (MOODS as readonly string[]).includes(m as string)),
        tempo: ["slow", "mid", "fast"].includes(t.tempo) ? t.tempo : "any",
        show: t.show === true,
        updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : 0,
      };
    }
    return tones;
  } catch {
    return {};
  }
}

export function withTone(tones: PlaylistTones, uri: string, tone: PlaylistTone | null): PlaylistTones {
  const next = { ...tones };
  if (tone) next[uri] = tone;
  else delete next[uri];
  return next;
}
