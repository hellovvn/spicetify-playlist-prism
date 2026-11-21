// Unit tests for tag cleanup.
// Run with: npm test
//
// Two kinds of tests here:
//  1. Fixture tests: REAL Last.fm data recorded in step 3. They check the
//     whole cleanup gives sensible results on actual messy input.
//  2. Rule tests: small hand-made inputs, one rule each. When one fails,
//     its name tells you exactly which rule broke.

import { describe, expect, test } from "vitest";
import { cleanTags, normalizeTagName } from "../src/tags/cleanTags";
import fixtures from "./fixtures/lastfm-tags.json";

// Helper: just the tag names, in order (easier to read in test failures).
const names = (tags: { name: string }[]) => tags.map((tag) => tag.name);

describe("cleanTags on real Last.fm data (fixtures)", () => {
  // Expected cleaned tag names for each recorded song, strongest first.
  const expected: Record<string, string[]> = {
    Often: ["sexy", "r&b", "love", "dark", "sex"],
    RESCUER: [],
    "Couldn’t Make It Any Harder": ["female vocalist", "ballad", "singer songwriter", "pop", "sad"],
    "Snooze (Acoustic) (feat. Justin Bieber)": [],
    "WHERE IS MY HUSBAND!": ["big band", "pop soul", "go go", "soul", "contemporary r&b"],
    "Marvins Room": ["hip hop", "rap", "r&b", "downtempo"],
    YUKON: ["pop", "indie pop", "r&b", "bedroom pop", "downtempo", "alternative r&b", "nachspiel"],
    "Golden Tears": [],
  };

  // test.each runs the same test once per song; $title goes in the test name.
  test.each(fixtures.songs)("$title", (song) => {
    const result = cleanTags(song.tags, { artistNames: song.artists });
    expect(names(result)).toEqual(expected[song.title]);
  });

  test("every song's strongest cleaned tag has weight 1", () => {
    for (const song of fixtures.songs) {
      const result = cleanTags(song.tags, { artistNames: song.artists });
      if (result.length > 0) expect(result[0].weight).toBe(1);
    }
  });
});

describe("normalizeTagName", () => {
  test.each([
    ["Hip-Hop", "hip hop"],
    ["hiphop", "hip hop"],
    ["  Pop   Soul ", "pop soul"],
    ["rnb", "r&b"],
    ["alternative rnb", "alternative r&b"],
    ["R&B", "r&b"],
    ["female vocalists", "female vocalist"],
    ["Chill-Out", "chill"],
    ["late_night", "late night"],
  ])("%s -> %s", (input, output) => {
    expect(normalizeTagName(input)).toBe(output);
  });
});

describe("cleanTags rules", () => {
  test("drops opinion/junk tags", () => {
    const result = cleanTags([
      { name: "seen live", count: 100 },
      { name: "soty", count: 90 },
      { name: "fav", count: 80 },
      { name: "love at first listen", count: 70 },
      { name: "indie", count: 50 },
    ]);
    expect(names(result)).toEqual(["indie"]);
  });

  test("drops years and 'best of' tags but keeps decades like 80s", () => {
    const result = cleanTags([
      { name: "2011", count: 100 },
      { name: "best of 2011", count: 90 },
      { name: "80s", count: 50 },
    ]);
    expect(names(result)).toEqual(["80s"]);
  });

  test("drops nationalities", () => {
    const result = cleanTags([
      { name: "Canadian", count: 100 },
      { name: "british", count: 90 },
      { name: "soul", count: 10 },
    ]);
    expect(names(result)).toEqual(["soul"]);
  });

  test("drops a bare nationality but keeps genres that contain one", () => {
    // Real case from the smoke test: Carpetman's artist tags.
    const result = cleanTags([
      { name: "pop", count: 100 },
      { name: "ukrainian", count: 100 },
      { name: "dark r&b", count: 66 },
      { name: "ukrainian pop", count: 66 },
    ]);
    expect(names(result)).toEqual(["pop", "dark r&b", "ukrainian pop"]);
  });

  test("drops bare country names too, but keeps genres that contain one", () => {
    // Real cases: "sweden" (Isak Danielson), "canada"/"haiti"/"haitian" earlier.
    const result = cleanTags([
      { name: "pop", count: 100 },
      { name: "Sweden", count: 30 },
      { name: "canada", count: 30 },
      { name: "haitian", count: 30 },
      { name: "japanese", count: 30 },
      { name: "korean r&b", count: 20 },
    ]);
    expect(names(result)).toEqual(["pop", "korean r&b"]);
  });

  test("drops every credited artist's name, any capitalisation", () => {
    const result = cleanTags(
      [
        { name: "SZA", count: 100 },
        { name: "justin bieber", count: 90 },
        { name: "rnb", count: 40 },
      ],
      { artistNames: ["SZA", "Justin Bieber"] }
    );
    expect(names(result)).toEqual(["r&b"]);
  });

  test("re-scales AFTER removing junk, so real tags aren't squashed", () => {
    // Without re-scaling, "sad" would be 4/100 = 0.04 and get dropped.
    const result = cleanTags([
      { name: "love at first listen", count: 100 },
      { name: "pop", count: 40 },
      { name: "sad", count: 4 },
    ]);
    expect(result).toEqual([
      { name: "pop", weight: 1 },
      { name: "sad", weight: 0.1 },
    ]);
  });

  test("merges duplicates by keeping the higher count (not the sum)", () => {
    const result = cleanTags([
      { name: "Hip-Hop", count: 100 },
      { name: "hip hop", count: 32 },
      { name: "hiphop", count: 10 },
    ]);
    expect(result).toEqual([{ name: "hip hop", weight: 1 }]);
  });

  test("drops tags under minWeight (default 0.05)", () => {
    const tags = [
      { name: "pop", count: 100 },
      { name: "rock", count: 5 },
      { name: "jazz", count: 4 },
    ];
    expect(names(cleanTags(tags))).toEqual(["pop", "rock"]);
    expect(names(cleanTags(tags, { minWeight: 0.5 }))).toEqual(["pop"]);
  });

  test("keeps at most maxTags", () => {
    const tags = Array.from({ length: 30 }, (_, i) => ({ name: `genre ${i}`, count: 100 - i }));
    expect(cleanTags(tags)).toHaveLength(15);
    expect(cleanTags(tags, { maxTags: 3 })).toHaveLength(3);
  });

  test("returns [] for no tags, all-junk tags, or zero counts", () => {
    expect(cleanTags([])).toEqual([]);
    expect(cleanTags([{ name: "seen live", count: 100 }])).toEqual([]);
    expect(cleanTags([{ name: "pop", count: 0 }])).toEqual([]);
  });

  test("survives a bad count from Last.fm (NaN) without crashing", () => {
    const result = cleanTags([
      { name: "pop", count: 100 },
      { name: "rock", count: Number.NaN },
    ]);
    expect(names(result)).toEqual(["pop"]);
  });
});
