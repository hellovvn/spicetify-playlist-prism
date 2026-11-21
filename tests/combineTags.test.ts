// Unit tests for blending song tags with artist tags. Run with: npm test

import { describe, expect, test } from "vitest";
import { combineTags, needsArtistTags } from "../src/tags/combineTags";

const track3 = [
  { name: "r&b", weight: 1 },
  { name: "sexy", weight: 0.8 },
  { name: "dark", weight: 0.3 },
];
const artist = [
  { name: "pop", weight: 1 },
  { name: "r&b", weight: 0.9 },
  { name: "dance", weight: 0.4 },
];

describe("needsArtistTags", () => {
  test.each([
    [0, true],
    [2, true],
    [3, false],
    [10, false],
  ])("%i song tags -> needs artist tags: %s", (count, expected) => {
    const tags = Array.from({ length: count }, (_, i) => ({ name: `t${i}`, weight: 1 }));
    expect(needsArtistTags(tags)).toBe(expected);
  });
});

describe("combineTags", () => {
  test("well-tagged song (3+): artist tags are ignored", () => {
    const result = combineTags(track3, artist);
    expect(result.map((t) => t.name)).toEqual(["r&b", "sexy", "dark"]);
    expect(result.every((t) => t.source === "track")).toBe(true);
  });

  test("untagged song: uses artist tags at half weight, marked 'artist'", () => {
    expect(combineTags([], artist)).toEqual([
      { name: "pop", weight: 0.5, source: "artist" },
      { name: "r&b", weight: 0.45, source: "artist" },
      { name: "dance", weight: 0.2, source: "artist" },
    ]);
  });

  test("few song tags: blends both, song tags keep full weight", () => {
    const result = combineTags([{ name: "soul", weight: 1 }], artist);
    expect(result).toEqual([
      { name: "soul", weight: 1, source: "track" },
      { name: "pop", weight: 0.5, source: "artist" },
      { name: "r&b", weight: 0.45, source: "artist" },
      { name: "dance", weight: 0.2, source: "artist" },
    ]);
  });

  test("same tag in both: the song's own version wins", () => {
    const result = combineTags([{ name: "r&b", weight: 0.1 }], artist);
    const rnb = result.find((t) => t.name === "r&b");
    // Even though the artist's r&b (0.9 * 0.5 = 0.45) would be stronger,
    // we trust what people tagged on the SONG itself.
    expect(rnb).toEqual({ name: "r&b", weight: 0.1, source: "track" });
  });

  test("options: minTrackTags, artistWeight, maxTags", () => {
    expect(combineTags([{ name: "soul", weight: 1 }], artist, { minTrackTags: 1 })).toHaveLength(1);
    expect(combineTags([], artist, { artistWeight: 0.25 })[0].weight).toBe(0.25);
    expect(combineTags([], artist, { maxTags: 2 })).toHaveLength(2);
  });

  test("drops artist tags that become too weak once halved (real case: 'japanese' 0.06 -> 0.03)", () => {
    const result = combineTags([], [
      { name: "electronic", weight: 1 },
      { name: "downtempo", weight: 0.1 }, // 0.05 after halving: exactly the cut-off, kept
      { name: "japanese", weight: 0.06 }, // 0.03 after halving: dropped
    ]);
    expect(result.map((t) => t.name)).toEqual(["electronic", "downtempo"]);
    expect(combineTags([], [{ name: "x", weight: 0.06 }], { minWeight: 0 })).toHaveLength(1);
  });

  test("nothing anywhere -> []", () => {
    expect(combineTags([], [])).toEqual([]);
  });
});
