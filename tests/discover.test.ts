// Unit tests for DISCOVER (new finds). Run with: npm test

import { describe, expect, test } from "vitest";
import {
  bestSearchHit,
  compareTitle,
  mergeByScore,
  newPicks,
  parseNewCount,
  pickCandidates,
  type SimilarSong,
} from "../src/discover/discover";
import { parseSimilarTracks } from "../src/lastfm/client";
import { parseSearchTracks } from "../src/spotify/search";
import { songKey, type RankedSong } from "../src/scoring/rank";

const sim = (name: string, artist: string, match: number): SimilarSong => ({ name, artist, match });
const seed = { name: "Kill Bill", artists: ["SZA"] };

describe("pickCandidates", () => {
  test("most similar first, at most 2 per artist (the seed's artist dominates the top)", () => {
    const picked = pickCandidates(
      [sim("Snooze", "SZA", 1), sim("SOS", "SZA", 0.92), sim("Low", "SZA", 0.9), sim("Bad Habit", "Steve Lacy", 0.32)],
      { seed, libraryKeys: new Set() }
    );
    expect(picked.map((s) => s.name)).toEqual(["Snooze", "SOS", "Bad Habit"]);
  });

  test("skips the seed and songs already in the library (any version)", () => {
    const libraryKeys = new Set([songKey({ name: "Snooze", artists: ["SZA"] })]);
    const picked = pickCandidates(
      [sim("Kill Bill", "SZA", 1), sim("Snooze (Acoustic)", "SZA", 0.9), sim("Pain", "PinkPantheress", 0.27)],
      { seed, libraryKeys }
    );
    expect(picked.map((s) => s.name)).toEqual(["Pain"]);
  });

  test("stops at max", () => {
    const many = Array.from({ length: 10 }, (_, i) => sim(`Song ${i}`, `Artist ${i}`, 1 - i / 10));
    expect(pickCandidates(many, { seed, libraryKeys: new Set(), max: 4 })).toHaveLength(4);
  });
});

describe("bestSearchHit", () => {
  const results = [
    { uri: "spotify:track:1", name: "Seasons - Live", artists: ["Someone Else"] },
    { uri: "spotify:track:2", name: "Seasons (feat. Khalid)", artists: ["6LACK", "Khalid"] },
  ];
  test("same title (ignoring feat./versions) and the wanted artist", () => {
    expect(bestSearchHit(sim("Seasons", "6lack", 0.3), results)?.uri).toBe("spotify:track:2");
  });
  test("no exact match = null (never a guess)", () => {
    expect(bestSearchHit(sim("Seasons", "Rihanna", 0.3), results)).toBeNull();
  });
  test("compareTitle ignores case and punctuation", () => {
    expect(compareTitle("Sunshine & Rain...")).toBe(compareTitle("sunshine rain"));
  });
});

describe("count chips and merging", () => {
  const song = (uri: string, score: number, newFind = false) =>
    ({ uri, name: uri, artists: ["A"], tags: [], audio: null, mood: null, tagStatus: "song", match: { score }, ...(newFind ? { newFind: { similarity: 0.5 } } : {}) }) as unknown as RankedSong;

  test("newPicks: best N by score, none when off", () => {
    const finds = [song("a", 0.3, true), song("b", 0.9, true), song("c", 0.6, true)];
    expect(newPicks(finds, 2)).toEqual(["b", "c"]);
    expect(newPicks(finds, "off")).toEqual([]);
  });

  test("parseNewCount accepts Off and whole numbers 1 to 50 (Custom)", () => {
    expect(parseNewCount("off")).toBe("off");
    expect(parseNewCount("10")).toBe(10);
    expect(parseNewCount("7")).toBe(7);
    expect(parseNewCount("50")).toBe(50);
    expect(parseNewCount("51")).toBeNull();
    expect(parseNewCount("0")).toBeNull();
    expect(parseNewCount("2.5")).toBeNull();
    expect(parseNewCount("")).toBeNull();
    expect(parseNewCount(null)).toBeNull();
  });

  test("mergeByScore: one best-first list", () => {
    const merged = mergeByScore([song("lib1", 0.8), song("lib2", 0.4)], [song("new1", 0.6, true)]);
    expect(merged.map((s) => s.uri)).toEqual(["lib1", "new1", "lib2"]);
  });
});

describe("parsers", () => {
  test("parseSimilarTracks reads Last.fm's track.getSimilar (one item may be an object)", () => {
    expect(parseSimilarTracks({ similartracks: { track: { name: "SOS", match: "0.92", artist: { name: "SZA" } } } })).toEqual([
      { name: "SOS", artist: "SZA", match: 0.92 },
    ]);
    expect(parseSimilarTracks({})).toEqual([]);
  });

  test("parseSearchTracks keeps only tracks, with artists and covers", () => {
    const res = {
      data: {
        searchV2: {
          topResultsV2: {
            itemsV2: [
              { item: { data: { __typename: "Album", uri: "spotify:album:x", name: "SOS" } } },
              {
                item: {
                  data: {
                    __typename: "Track",
                    uri: "spotify:track:y",
                    name: "SOS",
                    artists: { items: [{ profile: { name: "SZA" } }] },
                    albumOfTrack: { coverArt: { sources: [{ width: 64, url: "s.jpg" }, { width: 300, url: "m.jpg" }] } },
                  },
                },
              },
            ],
          },
        },
      },
    };
    expect(parseSearchTracks(res)).toEqual([
      { uri: "spotify:track:y", name: "SOS", artists: ["SZA"], cover: "m.jpg", coverSmall: "s.jpg" },
    ]);
  });
});
