// Unit tests for scoring. Run with: npm test

import { describe, expect, test } from "vitest";
import { bpmMatch, keyMatch, scoreSong, tagMatch, WEIGHTS } from "../src/scoring/score";
import type { SourcedTag } from "../src/tags/combineTags";

const t = (name: string, weight = 1, source: "track" | "artist" = "track"): SourcedTag => ({ name, weight, source });
const audio = (bpm: number, camelot: string) => ({ bpm, key: "C", mode: "minor" as const, camelot });

// Seed tags from the real "Often" (The Weeknd): sexy 1, r&b 0.81, love 0.32, dark 0.12, sex 0.05
const often = [t("sexy", 1), t("r&b", 0.81), t("love", 0.32), t("dark", 0.12), t("sex", 0.05)];
const oftenTotal = 1 + 0.81 + 0.32 + 0.12 + 0.05;

describe("tagMatch", () => {
  test("same tags, same weights -> 1", () => {
    expect(tagMatch(often, often).score).toBeCloseTo(1);
  });

  test("no shared tags -> 0", () => {
    expect(tagMatch(often, [t("country"), t("folk")])).toEqual({ score: 0, matched: [] });
  });

  test("sharing the seed's MAIN tag beats sharing a minor one", () => {
    const sharesSexy = tagMatch(often, [t("sexy")]).score;
    const sharesDark = tagMatch(often, [t("dark")]).score;
    expect(sharesSexy).toBeCloseTo(1 / oftenTotal);
    expect(sharesDark).toBeCloseTo(0.12 / oftenTotal);
    expect(sharesSexy).toBeGreaterThan(sharesDark);
  });

  test("a song that's only slightly r&b counts less than a very r&b one", () => {
    expect(tagMatch(often, [t("r&b", 0.2)]).score).toBeLessThan(tagMatch(often, [t("r&b", 1)]).score);
  });

  test("related tags get half credit: 'r&b' ~ 'alternative r&b'", () => {
    expect(tagMatch([t("r&b")], [t("alternative r&b")]).score).toBeCloseTo(0.5);
    expect(tagMatch([t("alternative r&b")], [t("r&b")]).score).toBeCloseTo(0.5);
  });

  test("whole words only: 'rap' doesn't match 'trap'", () => {
    expect(tagMatch([t("rap")], [t("trap")]).score).toBe(0);
  });

  test("artist-only tags (half weight) score lower than the song's own", () => {
    expect(tagMatch(often, [t("r&b", 0.5, "artist")]).score).toBeLessThan(tagMatch(often, [t("r&b", 1)]).score);
  });

  test("lists the matched seed tags, strongest contribution first", () => {
    expect(tagMatch(often, [t("dark"), t("r&b"), t("pop")]).matched).toEqual(["r&b", "dark"]);
  });

  test("never above 1, and 0 for an empty seed", () => {
    expect(tagMatch([t("r&b")], [t("r&b"), t("alternative r&b")]).score).toBe(1);
    expect(tagMatch([], [t("r&b")]).score).toBe(0);
  });
});

describe("bpmMatch", () => {
  test.each([
    [100, 100, 1],
    [100, 110, 0.48], // 10% faster: about half
    [100, 120, 0], // 20% faster: 0
    [100, 80, 0], // 20% slower: 0
    [70, 140, 1], // double time = same beat
    [140, 70, 1], // half time = same beat
    [100, 150, 0], // unrelated
  ])("seed %i, song %i -> %f", (seed, song, expected) => {
    expect(bpmMatch(seed, song)).toBeCloseTo(expected, 1);
  });
});

describe("keyMatch (Camelot wheel)", () => {
  test.each([
    ["8A", "8A", 1, "same key"],
    ["8A", "9A", 0.8, "neighbour"],
    ["8A", "7A", 0.8, "neighbour the other way"],
    ["12A", "1A", 0.8, "neighbour across 12 -> 1 (it's a circle)"],
    ["8A", "8B", 0.8, "relative major"],
    ["8A", "10A", 0.4, "two steps"],
    ["8A", "9B", 0, "neighbour AND other mode"],
    ["8A", "2A", 0, "opposite side"],
    ["8A", "nonsense", 0, "bad data"],
  ])("%s vs %s -> %f (%s)", (a, b, expected) => {
    expect(keyMatch(a, b)).toBe(expected);
  });
});

describe("scoreSong", () => {
  const seed = { tags: [t("r&b")], audio: audio(100, "8A") };

  test("perfect match on everything -> 1", () => {
    expect(scoreSong(seed, { tags: [t("r&b")], audio: audio(100, "8A") }).score).toBeCloseTo(1);
  });

  test("tags define the vibe: same BPM and key but no shared tags -> 0", () => {
    const result = scoreSong(seed, { tags: [t("country")], audio: audio(100, "8A") });
    expect(result.score).toBe(0);
    expect(result.matchedTags).toEqual([]);
  });

  test("weights: tags 60%, mood 15%, BPM 15%, key 10% (adding up to 100%)", () => {
    expect(WEIGHTS.tags + WEIGHTS.mood + WEIGHTS.bpm + WEIGHTS.key).toBeCloseTo(1);
    // Full tag + mood match, BPM way off, key way off -> only tags + mood count.
    const withMood = { ...seed, mood: { dark: 1 } };
    const result = scoreSong(withMood, { tags: [t("r&b")], audio: audio(160, "2A"), mood: { dark: 1 } });
    expect(result.score).toBeCloseTo(WEIGHTS.tags + WEIGHTS.mood);
    expect(result.moodScore).toBeCloseTo(1);
  });

  test("similar lyrics mood ranks a song higher, with the same tags", () => {
    const withMood = { ...seed, mood: { heartbreak: 0.7, dark: 0.3 } };
    const same = scoreSong(withMood, { tags: [t("r&b")], audio: audio(100, "8A"), mood: { heartbreak: 0.6, dark: 0.4 } });
    const other = scoreSong(withMood, { tags: [t("r&b")], audio: audio(100, "8A"), mood: { party: 1 } });
    expect(same.score).toBeGreaterThan(other.score);
    expect(other.moodScore).toBe(0);
  });

  test("mood can't make a match on its own: no shared tags -> 0", () => {
    const result = scoreSong({ ...seed, mood: { dark: 1 } }, { tags: [t("country")], audio: null, mood: { dark: 1 } });
    expect(result.score).toBe(0);
  });

  test("unknown mood (seed or song) is left out, not punished", () => {
    expect(scoreSong(seed, { tags: [t("r&b")], audio: audio(100, "8A"), mood: { dark: 1 } }).moodScore).toBeNull();
    const result = scoreSong({ ...seed, mood: { dark: 1 } }, { tags: [t("r&b")], audio: audio(100, "8A"), mood: null });
    expect(result.moodScore).toBeNull();
    expect(result.score).toBeCloseTo(1);
  });

  test("closer tempo and key rank a song higher, with the same tags", () => {
    const close = scoreSong(seed, { tags: [t("r&b")], audio: audio(102, "9A") }).score;
    const far = scoreSong(seed, { tags: [t("r&b")], audio: audio(130, "3B") }).score;
    expect(close).toBeGreaterThan(far);
  });

  test("unknown BPM/key isn't punished: the score uses tags alone", () => {
    const result = scoreSong(seed, { tags: [t("r&b")], audio: null });
    expect(result.score).toBeCloseTo(1);
    expect(result.bpmScore).toBeNull();
    expect(result.keyScore).toBeNull();
  });
});
