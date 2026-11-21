import { describe, expect, test } from "vitest";
import { MOOD_CACHE_VERSION, MoodCache } from "../src/scan/moodCache";

const DAY = 24 * 60 * 60 * 1000;

describe("MoodCache", () => {
  test("not cached = undefined; a cached 'no profile' = null", () => {
    const cache = new MoodCache();
    expect(cache.get("a", 0)).toBeUndefined();
    cache.set("a", null, 0);
    expect(cache.get("a", 0)).toBeNull();
  });

  test("survives a save and load", () => {
    const cache = new MoodCache();
    cache.set("a", { dark: 1 }, 0);
    cache.set("b", null, 0);
    const loaded = new MoodCache(cache.toJSON(0));
    expect(loaded.get("a", 0)).toEqual({ dark: 1 });
    expect(loaded.get("b", 0)).toBeNull();
  });

  test("entries expire after 60 days", () => {
    const cache = new MoodCache();
    cache.set("a", { dark: 1 }, 0);
    expect(cache.get("a", 59 * DAY)).toEqual({ dark: 1 });
    expect(cache.get("a", 61 * DAY)).toBeUndefined();
    expect(cache.toJSON(61 * DAY)).not.toContain('"a"');
  });

  test("broken text or another version starts empty", () => {
    expect(new MoodCache("{not json").get("a", 0)).toBeUndefined();
    const old = JSON.stringify({ version: MOOD_CACHE_VERSION + 99, entries: { a: { mood: { dark: 1 }, at: 0 } } });
    expect(new MoodCache(old).get("a", 0)).toBeUndefined();
  });
});
