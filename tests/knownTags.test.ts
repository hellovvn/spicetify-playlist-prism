// Unit tests for the genre / mood allowlist. Run with: npm test

import { describe, expect, test } from "vitest";
import { isKnownTag, KNOWN_TAG_COUNT, tagKey } from "../src/tags/knownTags";
import { cleanTags, isJunkTagName } from "../src/tags/cleanTags";

describe("isKnownTag", () => {
  test("the MusicBrainz list is bundled (2,000+ genres)", () => {
    expect(KNOWN_TAG_COUNT).toBeGreaterThan(2000);
  });
  test("real genres, in any spelling of spaces and dashes", () => {
    for (const tag of ["r&b", "alternative r&b", "dream pop", "k-pop", "kpop", "synthpop", "synth pop", "lo-fi", "hip hop", "shoegaze"]) {
      expect(isKnownTag(tag)).toBe(true);
    }
  });
  test("common Last.fm genres MusicBrainz lacks, and mood words", () => {
    for (const tag of ["alternative", "indie", "cottagecore", "chill", "sexy", "dark", "late night"]) {
      expect(isKnownTag(tag)).toBe(true);
    }
  });
  test("fandom tags, personal labels and jokes are not known", () => {
    for (const tag of ["starlightcore", "vladaclaims", "my top songs", "saw live", "songs i like", "nachspiel"]) {
      expect(isKnownTag(tag)).toBe(false);
    }
  });
  test("tagKey ignores capitals, spaces, dashes and underscores", () => {
    expect(tagKey("Synth-Pop")).toBe(tagKey("synth_pop"));
  });
});

describe("in the tag cleanup", () => {
  test("cleanTags keeps only known genres and moods", () => {
    const tags = cleanTags([
      { name: "rnb", count: 100 },
      { name: "starlightcore", count: 90 },
      { name: "Dream-Pop", count: 60 },
      { name: "vladaclaims", count: 50 },
      { name: "chill", count: 40 },
    ]);
    expect(tags.map((t) => t.name)).toEqual(["r&b", "dream pop", "chill"]);
  });
  test("isJunkTagName (used on cached and saved tags) agrees", () => {
    expect(isJunkTagName("starlightcore")).toBe(true);
    expect(isJunkTagName("R&B")).toBe(false);
    expect(isJunkTagName("ballads")).toBe(false); // plural of a known word
  });
});
