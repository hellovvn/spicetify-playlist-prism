// Unit tests for the lyrics mood word list. The "lyrics" here are made-up
// lines written for the tests (never real song lyrics).

import { describe, expect, test } from "vitest";
import { formatMood, lyricsMood, moodMatch, moodOf, splitWords, topMoods } from "../src/mood/lyricsMood";

describe("splitWords", () => {
  test("lowercases, joins apostrophes, drops punctuation", () => {
    expect(splitWords("Don't stop, I'm CRYIN' tears!")).toEqual(["dont", "stop", "im", "cryin", "tears"]);
  });
  test("curly apostrophes too", () => {
    expect(splitWords("Can’t sleep")).toEqual(["cant", "sleep"]);
  });
});

describe("moodOf", () => {
  test.each([
    ["tears", "heartbreak"],
    ["crying", "heartbreak"],
    ["cryin", "heartbreak"],
    ["kissed", "love"],
    ["dancing", "party"],
    ["demons", "dark"],
    ["sin", "dark"], // exact match wins, never cut down
    ["sunshine", "hopeful"],
  ])("%s -> %s", (word, mood) => {
    expect(moodOf(word)).toBe(mood);
  });
  test.each(["baby", "the", "want", "heart", "is"])("%s is not a mood word", (word) => {
    expect(moodOf(word)).toBeNull();
  });
});

describe("lyricsMood", () => {
  const sad = ["I cry alone tonight", "tears and goodbye", "so lonely, so lost", "you left me broken"];

  test("counts mood words into shares that add up to 1", () => {
    const profile = lyricsMood(sad, "en")!;
    expect(profile.heartbreak).toBe(1);
    expect(Object.values(profile).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(1);
  });

  test("a mix of moods", () => {
    const profile = lyricsMood(["kiss me, love", "touch my skin", "your body on the sheets"], "en")!;
    expect(profile.desire).toBeCloseTo(4 / 6);
    expect(profile.love).toBeCloseTo(2 / 6);
  });

  test("too few mood words: no profile", () => {
    expect(lyricsMood(["la la la", "one cry"], "en")).toBeNull();
  });

  test("non-English lyrics: no profile", () => {
    expect(lyricsMood(sad, "ko")).toBeNull();
  });

  test("unknown language is still tried", () => {
    expect(lyricsMood(sad, undefined)).not.toBeNull();
  });
});

describe("moodMatch", () => {
  test("same mix = 1, nothing shared = 0", () => {
    expect(moodMatch({ heartbreak: 0.5, dark: 0.5 }, { heartbreak: 0.5, dark: 0.5 })).toBeCloseTo(1);
    expect(moodMatch({ heartbreak: 1 }, { party: 1 })).toBe(0);
  });
  test("compares the mix, not the size", () => {
    expect(moodMatch({ love: 0.8, desire: 0.2 }, { love: 0.8, desire: 0.2 })).toBeCloseTo(1);
  });
  test("a partial overlap is in between", () => {
    const score = moodMatch({ heartbreak: 0.7, dark: 0.3 }, { heartbreak: 0.3, party: 0.7 });
    expect(score).toBeGreaterThan(0.2);
    expect(score).toBeLessThan(0.6);
  });
  test("empty profile = 0", () => {
    expect(moodMatch({}, { love: 1 })).toBe(0);
  });
});

describe("topMoods / formatMood", () => {
  test("main moods, strongest first, under 20% left out", () => {
    expect(topMoods({ love: 0.3, heartbreak: 0.55, party: 0.15 })).toEqual(["heartbreak", "love"]);
  });
  test("text for the seed panel", () => {
    expect(formatMood({ dark: 0.6, desire: 0.4 })).toBe("Lyrics mood: dark, desire");
    expect(formatMood({ love: 0.15, party: 0.15, dark: 0.14, hopeful: 0.14, numb: 0.14, anger: 0.14, desire: 0.14 })).toBe(
      "Lyrics mood: mixed"
    );
    expect(formatMood(null)).toBe("Lyrics mood: unknown");
  });
});
