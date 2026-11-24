// Unit tests for playlist tones (src/tone/tone.ts). Run with: npm test

import { describe, expect, test } from "vitest";
import {
  describeMatch,
  genreFit,
  isToneEmpty,
  parseTones,
  scoreAgainstTone,
  suggestTone,
  tempoFit,
  toneSummary,
  withTone,
  type PlaylistTone,
  type ToneSong,
} from "../src/tone/tone";
import type { SourcedTag } from "../src/tags/combineTags";

const t = (name: string, weight = 1, source: "track" | "artist" = "track"): SourcedTag => ({ name, weight, source });
const song = (tags: SourcedTag[], bpm: number | null = null, mood: ToneSong["mood"] = null): ToneSong => ({ tags, bpm, mood });
const tone = (genres: string[], moods: PlaylistTone["moods"] = [], tempo: PlaylistTone["tempo"] = "any") => ({ genres, moods, tempo });

describe("genreFit", () => {
  test("a song clearly in ONE of several tone genres still fits well", () => {
    const fit = genreFit(["r&b", "soul", "pop", "indie", "jazz"], [t("r&b", 1)]);
    expect(fit.score).toBeCloseTo(0.75 + 0.25 * (1 / 5));
    expect(fit.matched).toEqual(["r&b"]);
  });

  test("having all the tone's genres = 1", () => {
    expect(genreFit(["r&b", "soul"], [t("r&b"), t("soul", 0.6)]).score).toBeCloseTo(1);
  });

  test("no shared genres = 0", () => {
    expect(genreFit(["r&b"], [t("country")])).toEqual({ score: 0, matched: [] });
  });

  test("related names get half credit, whole words only", () => {
    expect(genreFit(["r&b"], [t("alternative r&b")]).score).toBeCloseTo(0.5);
    expect(genreFit(["rap"], [t("trap")]).score).toBe(0);
  });

  test("a weak tag counts less", () => {
    expect(genreFit(["r&b"], [t("r&b", 0.1)]).score).toBeLessThan(genreFit(["r&b"], [t("r&b", 0.8)]).score);
  });
});

describe("tempoFit", () => {
  test("inside the band = 1", () => {
    expect(tempoFit("slow", 70)).toBe(1);
    expect(tempoFit("mid", 100)).toBe(1);
    expect(tempoFit("fast", 150)).toBe(1);
    expect(tempoFit("any", 200)).toBe(1);
  });

  test("falls to 0 at 20% outside", () => {
    expect(tempoFit("slow", 99)).toBeGreaterThan(0);
    expect(tempoFit("slow", 99)).toBeLessThan(1);
    expect(tempoFit("slow", 110)).toBe(0);
    expect(tempoFit("fast", 90)).toBe(0);
  });
});

describe("scoreAgainstTone", () => {
  test("a perfect fit scores 1", () => {
    const match = scoreAgainstTone(tone(["r&b"], ["love"], "slow"), song([t("r&b")], 72, { love: 1 }));
    expect(match.score).toBeCloseTo(1);
    expect(match.genres).toEqual(["r&b"]);
    expect(match.moods).toEqual(["love"]);
    expect(match.tempoFits).toBe(true);
  });

  test("no shared genre still gets some score from mood and tempo", () => {
    const match = scoreAgainstTone(tone(["r&b"], ["love"], "slow"), song([t("rock")], 72, { love: 1 }));
    expect(match.score).toBeCloseTo(0.3 / 0.9);
  });

  test("unknown mood / BPM are left out, not punished", () => {
    const match = scoreAgainstTone(tone(["r&b"], ["love"], "slow"), song([t("r&b")]));
    expect(match.score).toBeCloseTo(1);
    expect(match.tempoFits).toBeNull();
  });

  test("a song with no tags in a genre tone is scored on mood + tempo, marked partial", () => {
    const match = scoreAgainstTone(tone(["r&b"], ["love"], "slow"), song([], 70, { love: 1 }));
    expect(match.score).toBeCloseTo(1);
    expect(match.partial).toBe(true);
    expect(scoreAgainstTone(tone(["r&b"], ["love"]), song([t("r&b")], 70, { love: 1 })).partial).toBe(false);
  });

  test("no tags and nothing else to go on = no score", () => {
    expect(scoreAgainstTone(tone(["r&b"]), song([], 70, { love: 1 })).score).toBeNull();
    expect(scoreAgainstTone(tone(["r&b"], ["love"]), song([], 70, null)).partial).toBe(false);
  });

  test("a mood-only tone scores on mood", () => {
    expect(scoreAgainstTone(tone([], ["dark"]), song([], null, { dark: 1 })).score).toBeCloseTo(1);
    expect(scoreAgainstTone(tone([], ["dark"]), song([t("pop")])).score).toBeNull();
  });

  test("junk tags are ignored", () => {
    expect(scoreAgainstTone(tone(["my top songs"]), song([t("my top songs")])).score).toBeNull();
  });
});

describe("describeMatch", () => {
  test("says what fits and what doesn't", () => {
    const tn = tone(["r&b"], [], "slow");
    const text = describeMatch(tn, scoreAgainstTone(tn, song([t("rock")], 140)), 140);
    expect(text).toBe("0% tone match · off: no shared genres, 140 BPM");
    const good = describeMatch(tn, scoreAgainstTone(tn, song([t("r&b")], 70)), 70);
    expect(good).toBe("100% tone match · fits: r&b, slow");
    const rough = describeMatch(tn, scoreAgainstTone(tn, song([], 70)), 70);
    expect(rough).toMatch(/^~100% tone match \(a rough guess/);
    expect(rough).not.toContain("no shared genres");
  });
});

describe("toneSummary", () => {
  test("counts full scores, keeps partial and unscored apart", () => {
    const sum = toneSummary([
      { score: 0.9, partial: false },
      { score: 0.6, partial: false },
      { score: 0.2, partial: false },
      { score: 0.7, partial: true },
      { score: null, partial: false },
    ]);
    expect(sum).toEqual({ average: expect.closeTo(0.6), fits: 2, drift: 1, partial: 1, unscored: 1 });
  });

  test("nothing scored", () => {
    expect(toneSummary([{ score: null, partial: false }]).average).toBeNull();
  });
});

describe("suggestTone", () => {
  test("picks the playlist's common genres, moods and tempo", () => {
    const songs = [
      song([t("r&b"), t("soul")], 70, { love: 1 }),
      song([t("r&b")], 75, { love: 0.7, dark: 0.3 }),
      song([t("r&b"), t("pop")], 80, { heartbreak: 1 }),
      song([t("soul")], 85, { love: 1 }),
      song([t("metal")], 160, null),
    ];
    expect(suggestTone(songs)).toEqual({ genres: ["r&b", "soul"], moods: ["love"], tempo: "slow" });
  });

  test("an empty playlist suggests nothing", () => {
    const s = suggestTone([]);
    expect(isToneEmpty(s)).toBe(true);
  });
});

describe("saved tones", () => {
  test("round trip, and bad entries are dropped", () => {
    const uri = "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M";
    const saved: PlaylistTone = { genres: ["r&b"], moods: ["love"], tempo: "slow", show: true, updatedAt: 5 };
    const text = JSON.stringify({ ...withTone({}, uri, saved), bad: { genres: "x" } });
    expect(parseTones(text)).toEqual({ [uri]: saved });
    expect(withTone(parseTones(text), uri, null)).toEqual({});
    expect(parseTones("not json")).toEqual({});
  });

  test("unknown moods and tempos are cleaned", () => {
    const parsed = parseTones(JSON.stringify({ a: { genres: [], moods: ["love", "zzz"], tempo: "warp" } }));
    expect(parsed.a.moods).toEqual(["love"]);
    expect(parsed.a.tempo).toBe("any");
    expect(parsed.a.show).toBe(false);
  });
});
