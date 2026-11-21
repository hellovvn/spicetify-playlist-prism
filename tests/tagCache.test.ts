// Unit tests for the tag cache. Run with: npm test
// Time is passed in as a number, so tests can "jump ahead 31 days" instantly.

import { describe, expect, test } from "vitest";
import { CACHE_VERSION, TagCache } from "../src/scan/tagCache";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 20);
const value = { tags: [{ name: "r&b", weight: 1, source: "track" as const }], matchedTitle: "Often" };

describe("TagCache", () => {
  test("remembers a song's tags", () => {
    const cache = new TagCache();
    cache.set("spotify:track:a", value, NOW);
    expect(cache.get("spotify:track:a", NOW)).toEqual(value);
    expect(cache.get("spotify:track:other", NOW)).toBeNull();
  });

  test("survives a save + load round trip", () => {
    const cache = new TagCache();
    cache.set("spotify:track:a", value, NOW);
    const reloaded = new TagCache(cache.toJSON(NOW));
    expect(reloaded.get("spotify:track:a", NOW + DAY)).toEqual(value);
  });

  test("entries expire after 30 days", () => {
    const cache = new TagCache();
    cache.set("spotify:track:a", value, NOW);
    expect(cache.get("spotify:track:a", NOW + 30 * DAY)).toEqual(value);
    expect(cache.get("spotify:track:a", NOW + 31 * DAY)).toBeNull();
  });

  test("expired entries are not saved again", () => {
    const cache = new TagCache();
    cache.set("spotify:track:old", value, NOW - 40 * DAY);
    cache.set("spotify:track:new", value, NOW);
    expect(new TagCache(cache.toJSON(NOW)).size).toBe(1);
  });

  test("a cache saved under another version is thrown away (cleanup rules changed)", () => {
    const old = JSON.stringify({ version: CACHE_VERSION - 1, entries: { "spotify:track:a": { ...value, at: NOW } } });
    expect(new TagCache(old).size).toBe(0);
  });

  test.each([
    ["nothing saved", null],
    ["empty text", ""],
    ["corrupt text", "{not json"],
    ["wrong shape", JSON.stringify({ version: CACHE_VERSION, entries: "nope" })],
  ])("starts empty for %s", (_label, json) => {
    expect(new TagCache(json).size).toBe(0);
  });

  test("skips individually broken entries but keeps good ones", () => {
    const json = JSON.stringify({
      version: CACHE_VERSION,
      entries: { good: { ...value, at: NOW }, noTags: { at: NOW }, noTime: { ...value } },
    });
    const cache = new TagCache(json);
    expect(cache.size).toBe(1);
    expect(cache.get("good", NOW)).toEqual(value);
  });
});
